// 入口工具的实测：真的拉起 civ6-mcp，按 DSH 的调用方式走一遍。
// 运行：node --test tests/gateway.test.mjs
// 需要本机有 civ6-mcp（默认 E:\Projects\civ6-mcp）和 uv；不需要游戏开着。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createGateway, describeTool, helpText, resolveCivMcpDir } from '../lib/index.js'

const civMcpDir = resolveCivMcpDir('')
const haveCivMcp = Boolean(civMcpDir) && existsSync(join(civMcpDir, 'pyproject.toml'))

test('没找到 civ6-mcp 时入口工具直接说明，不去拉进程', async () => {
  const { tool, client } = createGateway({ civMcpDir: 'Z:\\definitely\\not\\here' })
  const out = await tool.execute({ action: 'help' }, {})
  assert.match(out, /失败/)
  assert.equal(client.running, false)
})

test('helpText / describeTool 不依赖进程', () => {
  const tools = [
    { name: 'get_units', description: 'List all your units.\nMore text', inputSchema: { properties: {} } },
    { name: 'set_research', description: 'Choose a tech. Details', inputSchema: { properties: { tech_or_civic: {}, category: {} }, required: ['tech_or_civic'] } },
  ]
  const help = helpText('# 模式说明', tools, 'coop')
  assert.match(help, /一起玩/)
  assert.match(help, /set_research\(tech_or_civic, category\?\)/)
  assert.match(help, /# 模式说明/)
  assert.match(describeTool(tools, 'set_research'), /tech_or_civic/)
  assert.match(describeTool(tools, 'nope'), /没有叫/)
})

test('真实拉起 civ6-mcp：help、describe、调用、未知动作', { skip: !haveCivMcp && `没找到 civ6-mcp：${civMcpDir}`, timeout: 180_000 }, async () => {
  const { tool, client } = createGateway({ civMcpDir, gatewayMode: 'coop', toolTimeoutMinutes: 2 })
  try {
    assert.equal(tool.name, 'civ6')

    const help = await tool.execute({ action: 'help' }, {})
    assert.match(help, /模式：一起玩/)
    assert.match(help, /文明6 · 一起玩/, '应包含 civ6-mcp 的模式说明')
    assert.match(help, /set_control/, '一起玩模式应开放接管开关')
    assert.doesNotMatch(help, /- run_lua\(/, '不应开放任意 Lua')
    const count = Number(help.match(/全部动作（(\d+) 个）/)?.[1])
    assert.ok(count > 50, `动作数 ${count}`)
    console.log(`  help：${help.length} 字，${count} 个动作`)

    const desc = await tool.execute({ action: 'describe', args: { name: 'set_research' } }, {})
    assert.match(desc, /tech_or_civic/)

    // 游戏开没开都行：开着返回局面，没开返回“连不上”的说明，都不能抛异常
    const ov = await tool.execute({ action: 'get_game_overview' }, {})
    assert.ok(typeof ov === 'string' && ov.length > 0)
    console.log('  get_game_overview：' + ov.split('\n')[0].slice(0, 100))

    const unknown = await tool.execute({ action: 'run_lua', args: { code: 'print(1)' } }, {})
    assert.match(unknown, /没有叫“run_lua”的动作/)

    // 被中止的调用要立刻返回，不能挂住
    const ac = new AbortController()
    ac.abort()
    const aborted = await tool.execute({ action: 'get_units' }, { signal: ac.signal })
    assert.match(aborted, /已取消/)

    // 进程被意外结束后，下一次调用要能自动重新拉起
    client.dispose()
    const again = await tool.execute({ action: 'help' }, {})
    assert.match(again, /全部动作/)
  } finally {
    client.dispose()
  }
})
