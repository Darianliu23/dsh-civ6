// dsh-civ6：让 DeepSeek 在 DSH 会话里玩《文明6》，不需要 API Key。
//
// 怎么起作用：
//   本机的 civ6-mcp（Python）通过游戏的 Tuner 调试端口读取局面、发出操作。
//   这个插件在所有会话里注册一个 civ6 入口工具，玩法在插件设置页里选，改了马上生效。
//   另外可以打开三个会话预设（默认关），每个预设 = 基础预设（默认 standard）的全部插件
//   + 一个用 stdio 拉起 civ6-mcp 的 MCP 客户端，区别只在传给 civ6-mcp 的模式：
//     auto     AI 自己玩
//     advisor  AI 当助理：只有查询工具，玩家自己操作
//     coop     一起玩：AI 按玩家的话操作，玩家随时接手
//   会话里思考和行动的是 DSH 自己的模型，用的是 DSH 的额度。
//
// schemastery 为什么要绕一圈找：用 link: 从本地文件夹装时，插件的真实路径在仓库里，
// 那里找不到它，所以 import 失败时再去 DSH 自己的目录里找；找不到就不导出 Config，
// 插件照样按默认值工作，只是配置卡片读不到设置。

import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { StdioMcp } from './stdio-mcp.js'

export const name = 'dsh-civ6'

/** 取 DSH 自带的包：先直接 import，不行再去 DSH_HOME 的 profile 目录和 DSH 程序目录里找；找不到返回 null。 */
async function loadHostModule(name) {
  try {
    return await import(name)
  } catch {}
  const bases = []
  const home = process.env.DSH_HOME
  if (home && existsSync(join(home, 'profiles'))) {
    for (const profile of readdirSync(join(home, 'profiles'))) bases.push(join(home, 'profiles', profile))
  }
  for (const start of [process.argv[1], process.execPath, process.cwd()]) {
    let dir = start ? dirname(start) : null
    for (let i = 0; dir && i < 8; i++, dir = dirname(dir)) bases.push(dir)
  }
  for (const base of bases) {
    try {
      const resolved = createRequire(join(base, 'noop.js')).resolve(name)
      return await import(pathToFileURL(resolved).href)
    } catch {}
  }
  return null
}

const schemasteryModule = await loadHostModule('@deepseek-ai/schemastery')
const z = schemasteryModule ? (schemasteryModule.default ?? schemasteryModule) : null

// defineTool 只做校验、原样返回定义；拿不到就用等价的“原样返回”（星露谷插件也这么兜底）
const dshToolsModule = await loadHostModule('@deepseek-ai/dsh-tools')
const defineTool = dshToolsModule?.defineTool ?? ((definition) => definition)

/**
 * 三种玩法：模式名（传给 civ6-mcp 的 CIV_MCP_MODE）、预设 id、默认名字、说明。
 * 预设 id 保留插件改名（dsh-civ6-whale → dsh-civ6）之前的写法：会话里记的是这个 id，
 * 改了的话，已经用这些预设建过的会话会找不到预设。用户看到的是 defaultName，不是 id。
 */
export const MODES = [
  {
    mode: 'auto',
    id: 'dsh-civ6-whale-auto',
    enabledKey: 'autoEnabled',
    nameKey: 'autoName',
    defaultName: '文明6·AI 自己玩',
    what: 'AI 自己一回合一回合地打，你在旁边看，可以随时插话或接手',
  },
  {
    mode: 'advisor',
    id: 'dsh-civ6-whale-advisor',
    enabledKey: 'advisorEnabled',
    nameKey: 'advisorName',
    defaultName: '文明6·AI 当助理',
    what: '你自己玩，AI 只能查看局面、回答问题、给建议，不能操作游戏',
  },
  {
    mode: 'coop',
    id: 'dsh-civ6-whale-coop',
    enabledKey: 'coopEnabled',
    nameKey: 'coopName',
    defaultName: '文明6·一起玩',
    what: '你和 AI 共用一个位置：让它做什么它就做什么，不经你同意不结束回合，你随时可以接手',
  },
]

const DEFAULTS = {
  civMcpDir: '',
  uvPath: '',
  baseGame: true,
  extraInstructions: '',
  // 默认不建预设：所有会话都用入口工具玩，玩法在设置页里选。
  // 用预设建过会话的人把开关打开，老会话就能接着用
  autoEnabled: false,
  advisorEnabled: false,
  coopEnabled: false,
  autoName: MODES[0].defaultName,
  advisorName: MODES[1].defaultName,
  coopName: MODES[2].defaultName,
  basePreset: 'standard',
  // 结束回合最长会等 10 分钟左右才报告“回合没有推进”，这里要比它长
  toolTimeoutMinutes: 15,
  gatewayEnabled: true,
  gatewayMode: 'coop',
}

/** DSH 只把标了 volatile 的设置交给插件页的配置卡片；老版本 schemastery 没有 volatile() 就原样返回。 */
const volatileAll = (dict) => Object.fromEntries(Object.entries(dict)
  .map(([key, schema]) => [key, typeof schema.volatile === 'function' ? schema.volatile() : schema]))

/** 只在 DSH 启动时读一次的设置。 */
const RESTART = '改了以后重启 DSH 才生效。'
const PRESET_ONLY = '（只影响预设；预设改了以后重启 DSH，并新建会话才生效。）'
/** 入口工具每次动作都现读的设置。 */
const LIVE = '改了马上生效：AI 下一次动作时会自动切换并重新读规则，不用重启、不用新建会话。'

export const Config = z
  ? z.object(volatileAll({
      gatewayMode: z.union([
        z.const('coop').description('一起玩'),
        z.const('advisor').description('AI 当助理'),
        z.const('auto').description('AI 自己玩'),
      ]).default(DEFAULTS.gatewayMode)
        .description('玩法。一起玩：AI 按你的话操作，不经你同意不结束回合；AI 当助理：AI 只能查看和给建议；'
          + 'AI 自己玩：AI 自己一回合一回合地打。一起玩和 AI 自己玩时，在会话里说“我来”“你来”可以切换操作权。' + LIVE),
      extraInstructions: z.string().role('textarea').default(DEFAULTS.extraInstructions)
        .description('给 AI 的额外要求，比如“走科技胜利，前 50 回合至少铺 4 座城”。' + LIVE),
      baseGame: z.boolean().default(DEFAULTS.baseGame)
        .description('这局是原版规则（没有“迭起兴衰”和“风云变幻”资料片）。开启后会隐藏总督、着力点、世界议会这些原版没有的工具，'
          + '并告诉 AI 忽略相关机制。装了并启用了“风云变幻”就关掉。' + LIVE),
      toolTimeoutMinutes: z.number().min(1).max(60).step(1).default(DEFAULTS.toolTimeoutMinutes)
        .description('单个游戏动作最长等多少分钟。结束回合要等所有 AI 文明走完，后期大地图可能要几分钟。' + LIVE),
      civMcpDir: z.string().default(DEFAULTS.civMcpDir)
        .description('civ6-mcp 所在的文件夹（里面有 pyproject.toml），要用 Darianliu23/civ6-mcp 的 base-game-compat 分支。'
          + '留空会依次找：环境变量 CIV6_MCP_DIR、用户目录下的 civ6-mcp 和 Projects\\civ6-mcp、各个盘的 Projects\\civ6-mcp。' + LIVE),
      uvPath: z.string().default(DEFAULTS.uvPath)
        .description('uv 的完整路径（uv.exe）。留空会自动在 PATH 和常见位置里找。' + LIVE),
      gatewayEnabled: z.boolean().default(DEFAULTS.gatewayEnabled)
        .description('在所有会话里（包括已经聊过的老会话）提供 civ6 工具。常驻上下文里只有这一个工具的简短说明；'
          + 'AI 要玩时先读规则和动作列表，第一次用到时插件才在后台启动 civ6-mcp。' + RESTART),
      autoEnabled: z.boolean().default(DEFAULTS.autoEnabled)
        .description(`另外创建“AI 自己玩”会话预设：${MODES[0].what}。不用预设也能玩；以前用这个预设建过会话的，打开它老会话才能接着用。` + RESTART),
      advisorEnabled: z.boolean().default(DEFAULTS.advisorEnabled)
        .description(`另外创建“AI 当助理”会话预设：${MODES[1].what}。以前用这个预设建过会话的，打开它老会话才能接着用。` + RESTART),
      coopEnabled: z.boolean().default(DEFAULTS.coopEnabled)
        .description(`另外创建“一起玩”会话预设：${MODES[2].what}。以前用这个预设建过会话的，打开它老会话才能接着用。` + RESTART),
      autoName: z.string().default(DEFAULTS.autoName).description('“AI 自己玩”预设在新建会话时显示的名字。' + PRESET_ONLY),
      advisorName: z.string().default(DEFAULTS.advisorName).description('“AI 当助理”预设显示的名字。' + PRESET_ONLY),
      coopName: z.string().default(DEFAULTS.coopName).description('“一起玩”预设显示的名字。' + PRESET_ONLY),
      basePreset: z.string().default(DEFAULTS.basePreset)
        .description('预设在哪个预设的基础上加文明6 的工具（默认 standard）。' + PRESET_ONLY),
    }))
  : undefined

/** 活引用（volatile 设置）取当前值，普通值原样返回。 */
const read = (value) => (value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value)

/** 这一刻的全部设置：活引用取当前值，没设置的用默认值。 */
export function currentConfig(config) {
  const set = Object.entries(config ?? {}).map(([key, value]) => [key, read(value)]).filter(([, value]) => value !== undefined)
  return { ...DEFAULTS, ...Object.fromEntries(set) }
}

/** 找 uv：设置里填了就用它；否则在 PATH 和常见安装位置里找；找不到就返回 "uv"，交给系统去找。 */
export function findUv(configured, env = process.env) {
  if (configured && String(configured).trim()) return String(configured).trim()
  const exe = process.platform === 'win32' ? 'uv.exe' : 'uv'
  const dirs = String(env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)
  dirs.push(join(homedir(), '.local', 'bin'), join(homedir(), '.cargo', 'bin'))
  for (const dir of dirs) {
    const full = join(dir, exe)
    try {
      if (existsSync(full)) return full
    } catch {}
  }
  return 'uv'
}

/** civ6-mcp 文件夹可能在的位置（设置里没填时按顺序找）。 */
export function civMcpCandidates(env = process.env) {
  const list = []
  if (env.CIV6_MCP_DIR) list.push(env.CIV6_MCP_DIR)
  list.push(join(homedir(), 'civ6-mcp'), join(homedir(), 'Projects', 'civ6-mcp'))
  if (process.platform === 'win32') {
    for (const drive of 'CDEFGH') list.push(`${drive}:\\Projects\\civ6-mcp`)
  }
  return list
}

/** 设置里填了就用它；没填就在常见位置里找有 pyproject.toml 的那个；都没有返回 ''。 */
export function resolveCivMcpDir(configured, env = process.env) {
  if (configured && String(configured).trim()) return String(configured).trim()
  for (const dir of civMcpCandidates(env)) {
    try {
      if (existsSync(join(dir, 'pyproject.toml'))) return dir
    } catch {}
  }
  return ''
}

/** 传给 civ6-mcp 的环境变量（预设和入口工具共用）。 */
export function civMcpEnv(config, mode) {
  const c = currentConfig(config)
  return {
    CIV_MCP_MODE: mode,
    CIV_MCP_BASE_GAME: c.baseGame ? '1' : '0',
    CIV_MCP_EXTRA_INSTRUCTIONS: String(c.extraInstructions ?? ''),
    // 中文 Windows 默认用 GBK 读写文件，civ6-mcp 的日志和手册是 UTF-8
    PYTHONUTF8: '1',
  }
}

/** 拉起 civ6-mcp 的命令（预设和入口工具共用）。 */
export function civMcpCommand(config) {
  const c = currentConfig(config)
  const dir = resolveCivMcpDir(c.civMcpDir)
  return { command: findUv(c.uvPath), args: ['run', '--directory', dir, 'civ-mcp'], cwd: dir }
}

/** 预设里连游戏的 MCP 客户端这一行（DSH 自带的 @deepseek-ai/dsh-mcp-client，用 stdio 拉起 civ6-mcp）。 */
export function mcpClientRow(config, mode) {
  const c = currentConfig(config)
  const cmd = civMcpCommand(c)
  return {
    id: 'mcp-civ6',
    name: '@deepseek-ai/dsh-mcp-client',
    config: {
      serverName: 'civ6',
      transport: 'stdio',
      command: cmd.command,
      args: cmd.args,
      cwd: cmd.cwd,
      env: civMcpEnv(c, mode),
      toolCallTimeoutMs: Number(c.toolTimeoutMinutes) * 60 * 1000,
      // 模式说明 + 英文操作手册大约 27 KB，默认上限 32 KB 太紧，超了会直接拒绝连接
      maxInstructionBytes: 131072,
      // civ6-mcp 进程意外退出时重新拉起；次数给少一点，装坏了的时候别一直空转
      reconnect: { maxAttempts: 20 },
    },
  }
}

/** 一个预设的完整定义：基础预设的全部插件 + 连游戏的 MCP 客户端。 */
export function presetDefinition(config, entry, basePlugins) {
  const c = currentConfig(config)
  return {
    id: entry.id,
    name: c[entry.nameKey] || entry.defaultName,
    description: `${entry.what}（需要文明6 开着、打开了 Tuner，并且已经进入对局）`,
    order: 60 + MODES.indexOf(entry),
    // 每一行浅拷贝一份：Loader 可能会给行补字段，别改到基础预设自己的数据
    plugins: [...basePlugins.map((row) => ({ ...row })), mcpClientRow(c, entry.mode)],
  }
}

export function apply(ctx, config) {
  const log = (level, msg) => {
    try { ctx.logger?.(level, '[dsh-civ6] ' + msg) } catch {}
  }
  if (!z) log('warn', '找不到 @deepseek-ai/schemastery，插件页的配置卡片读不到设置；插件按默认设置工作')

  const c = currentConfig(config)
  const dir = resolveCivMcpDir(c.civMcpDir)
  if (!dir || !existsSync(join(dir, 'pyproject.toml'))) {
    log('warn', (c.civMcpDir ? `在“${c.civMcpDir}”里没找到 civ6-mcp（没有 pyproject.toml）` : '没有找到 civ6-mcp')
      + '。会话连不上游戏；装好 civ6-mcp 后在插件配置里填“civ6-mcp 文件夹”，重启 DSH')
  } else {
    log('info', `使用 civ6-mcp：${dir}`)
  }
  const wanted = MODES.filter((entry) => c[entry.enabledKey])
  if (wanted.length) registerPresets(ctx, c, wanted, log)
  // 入口工具拿活引用，设置页改了马上生效
  if (c.gatewayEnabled) registerGateway(ctx, config, log)
}

// ───────────────────────── 入口工具 civ6 ─────────────────────────

/** 入口工具的名字。 */
export const GATEWAY_TOOL = 'civ6'

const MODE_NAMES = { auto: 'AI 自己玩', advisor: 'AI 当助理', coop: '一起玩' }

/** action="help" 的内容：怎么通过入口工具调用 + civ6-mcp 的连接说明（模式说明和操作手册）+ 精简的动作列表。 */
export function helpText(instructions, tools, mode) {
  const lines = tools.map((t) => {
    const schema = t.inputSchema ?? {}
    const props = schema.properties ?? {}
    const required = new Set(schema.required ?? [])
    const params = Object.keys(props).map((k) => (required.has(k) ? k : k + '?')).join(', ')
    const summary = String(t.description ?? '').trim().split(/\n|(?<=[。.])\s/)[0]
    return `- ${t.name}(${params})：${summary}`
  })
  return [
    `# 用 ${GATEWAY_TOOL} 工具玩文明6（模式：${MODE_NAMES[mode] ?? mode}）`,
    `下面说的每个“工具”都通过 ${GATEWAY_TOOL} 调用：action 填动作名，args 填参数对象，`
      + `例如 {"action":"get_game_overview"}、{"action":"unit_action","args":{"unit_id":65536,"action":"found_city"}}。`
      + '参数后面带 ? 的可以不填。不确定某个动作的参数，可以用 {"action":"describe","args":{"name":"动作名"}} 看完整说明。',
    '',
    String(instructions ?? '').trim(),
    '',
    `## 全部动作（${tools.length} 个）`,
    ...lines,
  ].join('\n')
}

/** 一个动作的完整说明和参数结构（action="describe"）。 */
export function describeTool(tools, toolName) {
  const t = tools.find((x) => x.name === toolName)
  if (!t) return `没有叫“${toolName}”的动作。先用 action="help" 看动作列表。`
  return `# ${t.name}\n\n${String(t.description ?? '').trim()}\n\n参数：\n${JSON.stringify(t.inputSchema ?? {}, null, 2)}`
}

/** 把 MCP 工具结果变成文字。 */
function resultText(result) {
  const text = (result?.content ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('\n')
  return (result?.isError ? '失败：' : '') + (text || '（游戏没有返回内容）')
}

/**
 * 在所有会话里注册入口工具 civ6：常驻上下文里只有它的简短说明；真要玩时 action="help" 再把规则和动作列表读进来。
 * 动作转发给插件自己在后台拉起的 civ6-mcp 进程（第一次用到时才启动）。
 * 不在 inject 里声明 tools：运行时去取，取不到就不注册，不影响预设。
 */
export function createGateway(config, log = () => {}) {
  // 设置每次动作时现读（设置页改了玩法马上生效）；玩法、规则、路径变了就换一个 civ6-mcp 进程
  let current = null // { key, mode, cmd, client }
  let switchedFrom = null // 刚换了玩法、AI 还没重读规则时，记着原来的玩法
  const backend = () => {
    const c = currentConfig(config)
    const mode = MODE_NAMES[c.gatewayMode] ? c.gatewayMode : DEFAULTS.gatewayMode
    const cmd = civMcpCommand(c)
    const modeEnv = civMcpEnv(c, mode)
    const key = JSON.stringify([cmd, modeEnv])
    if (current?.key !== key) {
      if (current) {
        current.client.dispose()
        if (current.mode !== mode) switchedFrom = switchedFrom ?? current.mode
        log('info', `设置改了，换用新的 civ6-mcp（玩法：${MODE_NAMES[mode]}）`)
      }
      const env = { ...process.env, ...modeEnv }
      delete env.VIRTUAL_ENV // 让 civ6-mcp 用它自己的虚拟环境
      current = { key, mode, cmd, client: new StdioMcp({ ...cmd, env, log }) }
    }
    return { ...current, timeoutMs: Number(c.toolTimeoutMinutes) * 60 * 1000 }
  }

  const tool = defineTool({
    name: GATEWAY_TOOL,
    description:
      '玩《文明6》（需要游戏开着、打开了 Tuner 并进入对局）。玩法（一起玩 / AI 当助理 / AI 自己玩）由玩家在插件设置里选，'
      + '第一次用先调 action="help"，会告诉你当前玩法、规则和全部动作；之后 action=动作名、args=参数对象，'
      + '比如 {"action":"get_game_overview"}、{"action":"set_research","args":{"tech_or_civic":"TECH_POTTERY"}}。'
      + '结果里说玩法改了时，先重新调 help 再继续。'
      + `会话里已经有 mcp__civ6__ 开头的工具时，直接用那些，不用这个入口。`,
    parameters: {
      action: { type: 'string', required: true, description: '动作名：help、describe，或 help 列出的任意动作' },
      args: { type: 'object', additionalProperties: true, description: '动作的参数对象；没有参数就不填' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const action = String(args?.action ?? '').trim()
      const signal = exec?.signal
      const { mode, cmd, client, timeoutMs } = backend()
      if (!cmd.cwd || !existsSync(join(cmd.cwd, 'pyproject.toml'))) {
        return `失败：没有找到 civ6-mcp${cmd.cwd ? `（“${cmd.cwd}”里没有 pyproject.toml）` : ''}。`
          + '需要先装好 Darianliu23/civ6-mcp（base-game-compat 分支），'
          + '再在 DSH 的插件配置里填“civ6-mcp 文件夹”并重启 DSH。请把这些告诉玩家。'
      }
      try {
        if (!action || action === 'help') {
          const { instructions, tools } = await client.ensure(signal)
          switchedFrom = null
          return helpText(instructions, tools, mode)
        }
        if (switchedFrom && switchedFrom !== mode) {
          // 玩法换了（比如从一起玩换成助理），先让 AI 按新规则来，这一步不执行
          return `玩家刚在设置里把玩法从“${MODE_NAMES[switchedFrom]}”改成了“${MODE_NAMES[mode]}”，`
            + `这一步（${action}）没有执行。先调 {"action":"help"} 读新玩法的规则，告诉玩家你知道了，再按新规则继续。`
        }
        if (action === 'describe') {
          const { tools } = await client.ensure(signal)
          return describeTool(tools, String(args?.args?.name ?? ''))
        }
        const { tools } = await client.ensure(signal)
        if (!tools.some((t) => t.name === action)) {
          return `失败：没有叫“${action}”的动作（“${MODE_NAMES[mode]}”玩法下可能不开放）。先用 action="help" 看动作列表。`
        }
        const result = await client.callTool(action, args?.args ?? {}, { signal, timeoutMs })
        return resultText(result)
      } catch (error) {
        if (error?.code === 'TIMEOUT') {
          return `失败：${error.message}，已放弃等待（游戏里的操作可能还在进行）。先用 get_game_overview 看看现在的情况。`
        }
        if (signal?.aborted) return '已取消。'
        return '失败：' + String(error?.message ?? error)
          + `\n（检查：civ6-mcp 文件夹“${cmd.cwd}”对不对、uv 能不能用；插件配置里可以改。）`
      }
    },
  })
  return {
    tool,
    /** 当前设置对应的 civ6-mcp 客户端（测试和收尾用）。 */
    get client() { return backend().client },
    dispose() { current?.client.dispose() },
  }
}

function registerGateway(ctx, config, log) {
  ctx.effect(() => {
    let tools
    try {
      tools = ctx.get?.('tools')
    } catch {}
    if (!tools?.register) {
      log('warn', '这个版本的 DSH 没有工具注册服务，没有添加 civ6 入口工具')
      return () => {}
    }
    const gateway = createGateway(config, log)
    const { tool } = gateway
    let off
    try {
      off = tools.register(tool)
      log('info', `已在所有会话里添加 ${GATEWAY_TOOL} 入口工具`)
    } catch (error) {
      log('warn', `添加 ${GATEWAY_TOOL} 入口工具失败：` + (error?.message ?? error))
    }
    return () => {
      try { typeof off === 'function' ? off() : off?.dispose?.() } catch {}
      gateway.dispose()
    }
  })
}

/**
 * 注册会话预设。每次 DSH 启动都从基础预设现读一遍，DSH 升级 standard 时自动跟着变。
 * 不在 inject 里声明 agentPresets：声明了的话，没有预设服务的 DSH 上整个插件都起不来；所以运行时去取。
 */
function registerPresets(ctx, c, wanted, log) {
  ctx.effect(() => {
    let disposed = false
    const removers = []
    let tries = 0
    let timer
    const attempt = async () => {
      if (disposed) return
      let presets
      try {
        presets = ctx.get?.('agentPresets')
      } catch {}
      const base = presets?.definitions?.get?.(c.basePreset)
      if (!presets || !base) {
        // 预设都是启动时注册的，可能比本插件晚一点；等 2 分钟还没有就放弃
        if (++tries <= 60) timer = setTimeout(attempt, 2000)
        else log('warn', presets ? `找不到基础预设“${c.basePreset}”，没有创建文明6 预设` : '这个版本的 DSH 没有会话预设服务，没有创建文明6 预设')
        return
      }
      // 三个一起注册，不排队：register 要等 civ6-mcp 启动完才返回（每个几秒），
      // 一个个来的话，界面在 DSH 刚启动时读预设列表，排在后面的还没注册上就看不到
      await Promise.all(wanted.map(async (entry) => {
        if (presets.definitions.has(entry.id)) {
          log('warn', `已经有 id 为“${entry.id}”的预设了，没有重复创建`)
          return
        }
        try {
          const definition = presetDefinition(c, entry, base.config.plugins)
          const remove = await presets.register(definition)
          if (disposed) await remove?.()
          else {
            removers.push(remove)
            log('info', `已创建会话预设“${definition.name}”（${entry.id}）`)
          }
        } catch (error) {
          log('warn', `创建预设“${entry.defaultName}”失败：` + (error?.message ?? error))
        }
      }))
    }
    timer = setTimeout(attempt, 0)
    return () => {
      disposed = true
      clearTimeout(timer)
      for (const remove of removers) {
        try { remove?.() } catch {}
      }
    }
  })
}
