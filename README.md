# dsh-civ6-whale

让 AI 在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的会话里玩《文明6》。思考和行动的是 DSH 自己的模型，用的是 DSH 的额度，**不需要另配 API Key**。

```
DSH 会话 ──(MCP, stdio)──> civ6-mcp（Python）──(Tuner 调试端口 4318)──> 文明6
```

插件本身不碰游戏。它注册三个会话预设和一个入口工具，由它们在后台拉起 [civ6-mcp](https://github.com/Darianliu23/civ6-mcp)；civ6-mcp 通过游戏的调试端口读取局面、发出操作，所有操作都走游戏自己的规则。

## 三种玩法

| 预设 | AI 能做什么 | 适合 |
|---|---|---|
| 文明6·AI 自己玩 | 全部操作（61 个工具）。自己一回合一回合地打，每隔几回合汇报一次 | 想看 AI 打 |
| 文明6·AI 当助理 | **只能查询**（31 个工具），不能动游戏。你问它答，给具体建议 | 自己玩，要个参谋 |
| 文明6·一起玩 | 全部操作，但按你的话来；不经你同意不结束回合 | 边聊边玩，分工合作 |

工具数是原版规则下的数字（隐藏了原版没有的总督、着力点、世界议会）。

**随时接手**（“AI 自己玩”和“一起玩”）：说“我来”“停一下”，AI 会交出操作权，之后它所有改动游戏的操作都会被 civ6-mcp 拒绝，只能查询和给建议；说“你来”“继续”再交还给它。想立刻打断正在进行的操作，点 DSH 的停止按钮。

## 老会话也能玩：入口工具 civ6

DSH 规定会话聊过以后就不能再换预设。为了让已经聊过、没选预设的会话也能玩，插件默认在**所有会话**里加一个 `civ6` 工具：

- 常驻上下文里只有这一个工具的简短说明，不会把六十多个游戏工具塞进每个会话；
- 想玩时直接说“来玩文明6”，AI 会先调 `{"action":"help"}` 读规则和动作列表，之后每个动作都是 `{"action":"动作名","args":{参数}}`；
- 第一次用到时插件才在后台启动 civ6-mcp，玩法默认“一起玩”（配置里可以改）；
- 游戏没开或没进对局时，会直接告诉 AI 连不上，不会卡住。

专门开会话玩的话，预设体验更好：每个动作是独立的工具，参数检查更严格，规则一开始就在上下文里。入口工具胜在随时随地。

## 需要什么

1. **文明6**（Steam 版）。打开 Tuner：选项里的 “Tuner (disables achievements)”，或者在游戏关着时把
   `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VI\AppOptions.txt` 里的 `EnableTuner 0` 改成 `EnableTuner 1`。
   开着 Tuner 时**成就会被禁用**。另外关掉“自动结束回合”，用窗口化。不需要装 SDK。
2. **civ6-mcp**（`base-game-compat` 分支）和 [uv](https://docs.astral.sh/uv/)：

   ```bash
   git clone -b base-game-compat https://github.com/Darianliu23/civ6-mcp.git
   ```

   ```bash
   cd civ6-mcp
   ```

   ```bash
   uv sync
   ```

   uv 会自动下载需要的 Python（3.12）。克隆到用户目录下的 `civ6-mcp` 或 `Projects\civ6-mcp` 时插件能自己找到，放在别处就在插件配置里填路径。
3. **DSH**。

## 安装插件

在 DSH 的插件市场搜 `dsh-civ6-whale` 安装，或者在插件页面用 `github:Darianliu23/dsh-civ6-whale` 安装。装好后重启一次 DSH，新建会话时就能看到三个文明6 预设。

DSH 的桌面版和网页版用不同的 profile，要用哪个就在哪个里装。

<details>
<summary>从本地文件夹装（开发时）</summary>

在 `<DSH_HOME>/profiles/desktop`（或 `web`）里：

1. `package.json` 的 `dependencies` 加 `"dsh-civ6-whale": "link:<本仓库路径>"`，`dsh.profile.bundles` 加 `"dsh-civ6-whale"`；
2. 用 DSH 自带的 pnpm 运行 `pnpm install --no-frozen-lockfile`；
3. 重启 DSH。

</details>

## 怎么玩

1. 启动文明6，进入一局对局（停在主菜单时读不到局面）。
2. 在 DSH 里**新建会话**，发第一条消息之前选一个文明6 预设；或者在任意会话里说“来玩文明6”用入口工具。
3. 直接说话，比如：
   - AI 自己玩：“开始吧，目标科技胜利”
   - AI 当助理：“现在该造什么？”“这个开拓者去哪建城好？”
   - 一起玩：“开拓者原地坐城，然后你帮我选个开局生产”“这回合你来收尾”

AI 每回合结束时写的反思存在 civ6-mcp 的日记里（`~/.civ6-mcp`），按这一局合起来读，新会话可以用 `get_diary` 接着之前的思路玩。

## 设置

DSH 左侧边栏「插件」→ dsh-civ6-whale →「配置 ›」。所有设置都要**重启 DSH**才生效，预设相关的还要新建会话。

| 设置 | 默认 | 说明 |
|---|---|---|
| 创建三个预设 | 都开 | 不想要哪个就关掉 |
| 在所有会话里提供 civ6 入口工具 | 开 | 关掉后只能在选了预设的会话里玩 |
| 入口工具的玩法 | 一起玩 | 也可以选 AI 当助理、AI 自己玩 |
| 额外要求 | 空 | 比如“走科技胜利，前 50 回合至少铺 4 座城” |
| 原版规则（没有资料片） | 开 | 隐藏原版没有的工具，并告诉 AI 忽略相关机制。启用了“风云变幻”就关掉 |
| civ6-mcp 文件夹 | 空（自动找） | 依次找环境变量 `CIV6_MCP_DIR`、用户目录下的 `civ6-mcp` 和 `Projects\civ6-mcp`、各个盘的 `Projects\civ6-mcp` |
| uv 路径 | 空（自动找） | 找不到时填 `uv.exe` 的完整路径 |
| 单个动作最长等多少分钟 | 15 | 后期结束回合要等所有电脑文明走完 |
| 三个预设的名字、基础预设 | | 基础预设默认 `standard` |

## 已知限制

- 只在 **Windows 11 + 原版文明6（没有资料片）** 上实际玩过（AI 自己玩到第 74 回合）。装了“风云变幻”应该也能用（上游就是按风云变幻写的），但带着这边的改动没有测过。
- **游戏顾问**（选项 → 游戏 → 教程/顾问）弹出来时，游戏会停下等人点掉，电脑文明的回合也跟着停。civ6-mcp 结束回合时会自动把它关掉；嫌烦可以直接在选项里把顾问关了。
- **游戏只接受一个 Tuner 连接**。每个会话用完 20 秒后会放开连接，所以几个会话可以轮流玩，但不能同时操作；开着 SDK 的 FireTuner.exe 也会占掉连接。
- AI 思考时游戏不会暂停。文明6 是回合制，单人游戏里这不要紧。
- 接手靠说一句话或者点停止按钮，游戏里没有快捷键。
- civ6-mcp 要自己装，插件不会自动下载。

## 致谢

civ6-mcp 来自 [lmwilki/civ6-mcp](https://github.com/lmwilki/civ6-mcp)（MIT），连接游戏的 FireTuner 协议、全部游戏工具和结束回合的逻辑都是原作者写的。[Darianliu23/civ6-mcp](https://github.com/Darianliu23/civ6-mcp) 的 `base-game-compat` 分支在它的基础上加了原版规则兼容、三种玩法、接管开关和几处修复，说明见那边的 README。

## 开发

- 改了 `lib/index.js` 的 `Config` 以后运行 `npm run build:client` 重新生成配置卡片 `lib/client.js`。
- `npm test`：`tests/gateway.test.mjs` 会真的拉起本机的 civ6-mcp 走一遍入口工具（不需要游戏开着）。

## 许可

MIT，见 `LICENSE`。
