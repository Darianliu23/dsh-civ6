// 极简的 MCP stdio 客户端：在后台拉起一个 civ6-mcp 进程，用 JSON-RPC（一行一条）跟它说话。
//
// 入口工具 civ6 用它：老会话没有预设里的 MCP 客户端，只能由插件自己拉进程转发。
// 进程第一次用到时才启动；退出了下次调用会自动重新拉起。

import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

const PROTOCOL_VERSION = '2025-06-18'

export class StdioMcp {
  /**
   * @param {{ command: string, args: string[], cwd?: string, env?: Record<string,string>, log?: (level: string, msg: string) => void }} opts
   */
  constructor(opts) {
    this.opts = opts
    this.proc = null
    this.nextId = 1
    this.pending = new Map()
    this.starting = null
    this.instructions = ''
    this.tools = []
    this.stderrTail = []
  }

  get running() {
    return this.proc !== null
  }

  /** 进程没起来就拉起来并完成握手；返回 { instructions, tools }。 */
  async ensure(signal) {
    if (this.proc && !this.starting) return { instructions: this.instructions, tools: this.tools }
    if (!this.starting) {
      this.starting = this.#start(signal).finally(() => { this.starting = null })
    }
    await this.starting
    return { instructions: this.instructions, tools: this.tools }
  }

  async #start(signal) {
    const { command, args, cwd, env } = this.opts
    const proc = spawn(command, args, {
      cwd: cwd || undefined,
      env: env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.proc = proc
    this.stderrTail = []
    proc.stderr.setEncoding('utf8')
    // 一定要读走 stderr：管道写满了子进程会卡住
    proc.stderr.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (!line.trim()) continue
        this.stderrTail.push(line)
        if (this.stderrTail.length > 30) this.stderrTail.shift()
      }
    })
    const rl = createInterface({ input: proc.stdout })
    rl.on('line', (line) => this.#onLine(line))
    // 只处理当前这个进程的事件：被 dispose 后重新拉起时，旧进程的 exit 会晚到，
    // 不能把新进程的请求也判成失败
    proc.on('error', (error) => {
      if (this.proc !== proc) return
      this.proc = null
      this.#failAll(new Error(`启动 civ6-mcp 失败：${error.message}（命令：${command}）`))
    })
    proc.on('exit', (code) => {
      if (this.proc !== proc) return
      this.proc = null
      const tail = this.stderrTail.slice(-5).join('\n')
      this.#failAll(new Error(`civ6-mcp 进程退出了（退出码 ${code}）${tail ? '\n' + tail : ''}`))
    })

    try {
      const init = await this.request('initialize', {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'dsh-civ6-gateway', version: '1' },
      }, { signal, timeoutMs: 60_000 })
      this.notify('notifications/initialized', {})
      this.instructions = init?.instructions ?? ''
      const list = await this.request('tools/list', {}, { signal, timeoutMs: 60_000 })
      this.tools = list?.tools ?? []
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  #onLine(line) {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return // 不是 JSON（理论上 stdout 只有协议消息），忽略
    }
    if (msg.id !== undefined && msg.id !== null && ('result' in msg || 'error' in msg)) {
      const waiter = this.pending.get(msg.id)
      if (!waiter) return
      this.pending.delete(msg.id)
      if (msg.error) waiter.reject(new Error(msg.error.message ?? `MCP 错误 ${msg.error.code}`))
      else waiter.resolve(msg.result)
      return
    }
    // 服务端发来的请求（比如 ping）：ping 回空结果，其余回“不支持”
    if (msg.method && msg.id !== undefined && msg.id !== null) {
      const reply = msg.method === 'ping'
        ? { jsonrpc: '2.0', id: msg.id, result: {} }
        : { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not supported by client' } }
      this.#write(reply)
    }
    // 通知（日志、进度）不用处理
  }

  #failAll(reason) {
    const waiters = [...this.pending.values()]
    this.pending.clear()
    for (const { reject } of waiters) reject(reason)
  }

  #write(obj) {
    if (!this.proc?.stdin?.writable) throw new Error('civ6-mcp 进程没有在运行')
    this.proc.stdin.write(JSON.stringify(obj) + '\n')
  }

  notify(method, params) {
    try { this.#write({ jsonrpc: '2.0', method, params }) } catch {}
  }

  /** 发一个请求，等回复。超时或被中止时会告诉服务端取消这次请求。 */
  request(method, params, { signal, timeoutMs } = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      let timer
      const cleanup = () => {
        clearTimeout(timer)
        signal?.removeEventListener?.('abort', onAbort)
      }
      const cancel = (reason) => {
        if (!this.pending.has(id)) return
        this.pending.delete(id)
        cleanup()
        this.notify('notifications/cancelled', { requestId: id, reason: String(reason?.message ?? reason) })
        reject(reason)
      }
      const onAbort = () => cancel(signal.reason ?? new Error('已取消'))
      this.pending.set(id, {
        resolve: (v) => { cleanup(); resolve(v) },
        reject: (e) => { cleanup(); reject(e) },
      })
      if (signal?.aborted) return onAbort()
      signal?.addEventListener?.('abort', onAbort, { once: true })
      if (timeoutMs) {
        timer = setTimeout(() => {
          const e = new Error(`等了 ${Math.round(timeoutMs / 60000)} 分钟还没有结果`)
          e.code = 'TIMEOUT'
          cancel(e)
        }, timeoutMs)
      }
      try {
        this.#write({ jsonrpc: '2.0', id, method, params })
      } catch (error) {
        this.pending.delete(id)
        cleanup()
        reject(error)
      }
    })
  }

  async callTool(name, args, opts) {
    await this.ensure(opts?.signal)
    return this.request('tools/call', { name, arguments: args ?? {} }, opts)
  }

  /** 关掉进程。Windows 上 uv 会再拉起 python 子进程，要连同子进程一起结束。 */
  dispose() {
    const proc = this.proc
    this.proc = null
    if (!proc) return
    this.#failAll(new Error('civ6-mcp 进程已关闭'))
    try { proc.stdin.end() } catch {}
    if (process.platform === 'win32' && proc.pid) {
      try { spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true }) } catch {}
    } else {
      try { proc.kill() } catch {}
    }
  }
}
