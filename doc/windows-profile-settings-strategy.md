# Windows Profile Settings Strategy

## 目标

Windows 版本需要同时满足这两个场景：

1. 同一个项目目录里并行运行多个 Claude Code 会话，每个会话走不同 Provider / Token。
2. 继续共享 `%USERPROFILE%\.claude` 下的 skills、plugins、hooks、slash commands，不影响普通 `claude` 和已经在运行中的会话。

## 结论

Windows 主方案应当是：

`claude-glm.cmd` -> `claude.exe --settings <profile-settings.json>`

而不是：

`claude-glm.cmd` -> `set ANTHROPIC_*` -> `claude.exe`

## 为什么纯环境变量 launcher 不可靠

在这台 Windows 机器上已经做过实测：

1. 用户级 `%USERPROFILE%\.claude\settings.json` 已存在 `env`，并且包含 GLM 的 `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL`。
2. 单独在当前 shell 或 `.cmd` 里设置 `ANTHROPIC_BASE_URL`、`ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL` 后启动 `claude.exe`，`apiKeySource` 会切到 `ANTHROPIC_API_KEY`，但请求没有稳定切到目标 `base_url`，`model` 也可能仍显示全局配置里的值。
3. Claude debug 日志显示用户级 settings 的 `env` 仍在生效，因此“外层 set 环境变量”在这台机器上不是可靠的覆盖层。

结论：仅靠 `.cmd` 里的 `set ANTHROPIC_*`，无法保证 Windows 上的 Provider / Model 真正切换成功。

## 已验证可行的方案

使用 `claude.exe --settings <profile-settings.json>`。

每个 profile 对应一份独立 settings 覆盖文件，文件内写入：

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`
- `ANTHROPIC_DEFAULT_OPUS_MODEL`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`

在 Clair 里，这些值不是直接指向第三方厂商，而是指向本地 proxy：

- `ANTHROPIC_BASE_URL=http://127.0.0.1:<proxy_port>/<route_path>`
- `ANTHROPIC_API_KEY=<clair local proxy token>`
- `ANTHROPIC_MODEL=<profile.model>`

这样 Claude Code 的请求仍然先进入 Clair，再由 Clair 路由到真实 Provider。

## 本机验证结论

已验证以下事实：

1. `--settings` 能覆盖用户级 `%USERPROFILE%\.claude\settings.json` 中原有的 GLM env。
2. 非 `--bare` 模式下，Claude 仍会加载共享的 `%USERPROFILE%\.claude` skills、plugins、hooks、slash commands。
3. 两个不同的 `--settings` 文件可以并行启动两个不同配置的 Claude 进程，互不干扰。
4. 普通 `claude` 命令不会被改写；已经运行中的 Claude 会话也不会被新的 profile 启动器影响。

## 2026-05-18 Windows 实测结果

以下链路已经在当前 Windows 机器上完成实测，并确认成功：

1. 在 Clair 中配置 `MiniMax` provider。
2. 创建 profile：
   - route: `/claudeminimax`
   - command: `claude-minimax2`
   - model: `MiniMax-M2.7`
3. 启动 proxy。
4. 生成 launcher 与 profile settings：
   - `C:\Users\sikm\AppData\Local\Clair\bin\claude-minimax2.cmd`
   - `C:\Users\sikm\AppData\Local\Clair\bin\profiles\claude-minimax2.settings.json`
5. `Test Profile Route` 成功，运行证据显示：
   - upstream: `https://api.minimaxi.com/anthropic/v1/messages`
   - status: `200`
   - model rewrite: `MiniMax-M2.7 -> MiniMax-M2.7`
6. 手动将 launcher 目录加入当前 PowerShell 会话的 `PATH` 后，`claude-minimax2` 可直接启动 Claude Code。
7. Claude Code 启动后显示模型为 `MiniMax-M2.7`，并且可以正常回复。

最终验证通过的 profile settings 内容如下：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "clair-6b20b3ec",
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:28789/claudeminimax",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "MiniMax-M2.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "MiniMax-M2.7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "MiniMax-M2.7",
    "ANTHROPIC_MODEL": "MiniMax-M2.7"
  }
}
```

这次实测也确认了两个关键设计结论：

1. Windows 版 launcher 应当通过 `--settings` 注入 profile 配置，而不是依赖父 shell 的环境变量。
2. 本地 proxy token 在 Windows 上应写入 `ANTHROPIC_AUTH_TOKEN`，而不是 `ANTHROPIC_API_KEY`，否则会和用户级 `.claude/settings.json` 中已有的 token/API key 形成认证冲突。

## 对 Clair 的实现要求

Windows launcher 生成逻辑需要改成两份产物：

1. `launcher`
   - 例如：`%LOCALAPPDATA%\Clair\bin\claude-glm.cmd`
2. `profile settings`
   - 例如：`%LOCALAPPDATA%\Clair\bin\profiles\claude-glm.settings.json`

launcher 内容只负责：

1. 定位 `claude.exe`
2. 执行 `claude.exe --settings "<profile-settings.json>" %*`

profile settings 内容负责：

1. 写入指向 Clair local proxy 的 `env`
2. 写入 profile 对应的模型映射

## 为什么这个方案更适合当前项目

它保留了 Clair 原本最重要的几个能力：

1. 仍然通过本地 proxy 做 route -> provider 路由。
2. 仍然保留运行时证据链和 profile 端到端测试。
3. 不需要改全局 `%USERPROFILE%\.claude\settings.json`。
4. 可以继续生成 `claude-glm`、`claude-minimax` 这类独立命令。

## 不采用的方案

### 1. 直接反复改全局 `%USERPROFILE%\.claude\settings.json`

不适合并行多会话。新启动的会话会抢同一份全局状态。

### 2. 项目级 `.claude/settings.local.json`

不适合同一项目目录里同时开多个不同 Provider 的会话，因为项目级配置天然只有一份。

### 3. 纯环境变量 `.cmd` launcher

在当前 Windows 安装态下已经证明不稳定，不应作为主方案。
