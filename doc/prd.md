# Claude Code 多 Provider 本地网关：PRD 与前后端开发文档

> 第一版只支持 Claude Code。目标是做一个优雅、稳定、可视化的本地 Provider Gateway，让用户可以通过不同命令并行启动不同 Provider 的 Claude Code 实例，例如 `claude-glm`、`claude-minimax`。

---

# 0. 产品命名方案

## 0.1 推荐产品名

### 首选：**Clair**

含义：来自 clear / clarity，表达“清晰路由、清晰配置、清晰工作流”。名字短、优雅、偏 Anthropic / Apple 风格，不像工具软件那么粗糙。

建议完整命名：

* App 名：**Clair**
* 副标题：**Local Claude Provider Gateway**
* 中文描述：**Claude Code 本地 Provider 网关**

命令行前缀可以是：

```bash
clair
clair status
clair start
clair profile list
```

但用户日常启动 Claude Code 时仍然使用生成的命令：

```bash
claude-glm
claude-minimax
claude-default
```

## 0.2 备选名称

| 名称                | 风格    | 说明                           |
| ----------------- | ----- | ---------------------------- |
| **Clair**         | 优雅、简洁 | 首选，清晰、轻量、好记                  |
| **Lumen**         | 温暖、智能 | 有“光源、照亮配置”的感觉，但可能撞名较多        |
| **Conduit**       | 工程感   | 意为管道、通道，表达网关路由，但略偏技术         |
| **Relay**         | 简洁工具感 | 表达转发、代理，但不够独特                |
| **Aster**         | 轻盈、现代 | 像一个优雅桌面工具名，但语义弱一点            |
| **Harbor**        | 稳定、安全 | Provider 的停靠港，偏稳重            |
| **Switchboard**   | 功能准确  | 路由面板，但稍长、不够优雅                |
| **Claude Router** | 直白    | SEO 清晰，但产品感弱，且过度绑定 Claude 名称 |

## 0.3 最终建议

第一版产品名使用：

# **Clair**

一句话定位：

> **Clair is a local gateway for running multiple Claude Code provider profiles side by side.**

中文定位：

> **Clair 是一个用于并行运行多个 Claude Code Provider Profile 的本地网关。**

---

# 1. 产品背景

## 1.1 用户现状

高级 AI 编程用户通常不会只使用一个模型或一个 Provider。他们可能同时拥有：

* GLM token plan
* MiniMax coding plan
* DeepSeek API key
* OpenAI-compatible 中转服务
* Claude 官方账号
* 内网模型服务

但是 Claude Code 默认更偏向“当前配置”的使用方式。很多现有工具，例如 CC Switch，主要解决的是：

> 在多个 Provider 之间切换。

但用户真实需求逐渐变成：

> 多个 Provider 同时存在，并且可以并行运行不同的 Claude Code 实例。

例如：

```text
终端 A：claude-glm       → GLM
终端 B：claude-minimax   → MiniMax
终端 C：claude-default   → 默认 Provider
```

这类并行场景无法通过“覆盖式切换配置文件”优雅解决。

## 1.2 当前 CC Switch 类工具的问题

典型配置切换器的架构是：

```text
用户选择 Provider
    ↓
写入 Claude Code 配置文件
    ↓
Claude Code 读取当前配置
```

这种方式的问题：

1. **全局状态**：当前激活 Provider 只有一个。
2. **覆盖写入**：切换时会覆盖配置文件。
3. **并行冲突**：两个 Claude Code 实例无法天然使用不同 Provider。
4. **扩展受限**：想做路由、统计、熔断、失败重试，需要脱离“配置写入”思路。

## 1.3 Clair 的机会点

Clair 不做“配置覆盖器”，而做：

> **本地 Provider Gateway + 可视化 Profile 管理器。**

Clair 的核心思想：

```text
Claude Code 不直接连接真实 Provider
Claude Code 连接 Clair 本地代理
Clair 根据 Profile 路由到不同 Provider
```

例如：

```text
claude-glm
  → http://127.0.0.1:18789/glm
  → GLM Provider

claude-minimax
  → http://127.0.0.1:18789/minimax
  → MiniMax Provider
```

---

# 2. 产品目标

## 2.1 第一版目标

第一版只支持 Claude Code。

核心目标：

1. 用户可以在 UI 中添加多个 Provider。
2. 用户可以为不同 Provider 创建不同 Profile。
3. 本地代理服务根据 Profile 路径分流请求。
4. 用户可以生成 `claude-xxx` 启动命令。
5. 不同 Claude Code 实例可以同时运行，并使用不同 Provider。
6. UI 要足够精致，风格接近 Anthropic Claude App / Claude Web，而不是粗糙管理后台。

## 2.2 非目标

第一版不做：

1. 不支持 Codex、Gemini CLI、OpenCode、OpenClaw。
2. 不做复杂用量统计。
3. 不做余额查询。
4. 不做多 key 自动轮询。
5. 不做复杂失败重试与熔断。
6. 不做插件市场。
7. 不承诺适配所有非 Anthropic API 格式 Provider。
8. 不覆盖系统原始 `claude` 命令，除非用户主动开启。

## 2.3 第一版成功标准

MVP 成功标准：

```text
用户可以在 Clair 中配置 GLM 和 MiniMax。
Clair 启动本地代理。
Clair 生成 claude-glm 和 claude-minimax 两个命令。
用户分别在两个终端执行 claude-glm 和 claude-minimax。
两个 Claude Code 实例可以同时运行，互不影响。
```

---

# 3. 目标用户

## 3.1 核心用户

第一版目标用户是：

* Linux 桌面用户
* Claude Code 高频用户
* 有多个 AI Provider / API key / token plan
* 熟悉命令行，但希望 Provider 管理可视化
* 希望并行跑多个 Claude Code 实例

## 3.2 用户画像

### 用户 A：多模型编程用户

有 GLM、MiniMax、DeepSeek 等多个 Provider。希望根据不同任务选择不同模型。

需求：

* 快速启动不同 Provider 的 Claude Code
* 不想每次手动 export 环境变量
* 不想修改全局配置文件

### 用户 B：中转服务重度用户

使用多个中转 API 服务，每个服务有不同模型、价格和稳定性。

需求：

* 管理多个 base_url 和 token
* 快速测试 Provider 是否可用
* 用 profile 区分不同工作场景

### 用户 C：本地工具开发者

希望自己改造、扩展、二次开发本地 AI CLI 工具链。

需求：

* 清晰的数据结构
* 可扩展代理架构
* 后续能加入日志、统计、熔断、模型映射

---

# 4. 产品定位

## 4.1 一句话定位

**Clair 是一个优雅的 Claude Code 本地 Provider Gateway，用于管理多个 Provider Profile，并支持并行启动不同 Provider 的 Claude Code 实例。**

## 4.2 产品关键词

* Local-first
* Provider Gateway
* Claude Code Profile
* Parallel Sessions
* Elegant Desktop UI
* Anthropic-inspired Design
* Safe Credential Management

## 4.3 与 CC Switch 的区别

| 维度             | CC Switch 类工具 | Clair                           |
| -------------- | ------------- | ------------------------------- |
| 核心模式           | 覆盖式切换配置       | 本地代理路由                          |
| 当前 Provider    | 通常只有一个        | 可以多个并行                          |
| 并行 Claude Code | 不擅长           | 核心能力                            |
| 启动方式           | 切换后运行 claude  | `claude-glm` / `claude-minimax` |
| 架构重点           | 写配置文件         | HTTP Gateway                    |
| 第一版范围          | 多工具配置管理       | 只支持 Claude Code                 |

---

# 5. 核心概念

## 5.1 Provider

Provider 表示一个真实 AI 服务商或 API endpoint。

示例：

```text
Zhipu GLM
MiniMax
DeepSeek
OpenAI-compatible Proxy
Custom Anthropic-compatible Provider
```

Provider 包含：

* 名称
* 类型
* base_url
* api_key
* auth_scheme
* 默认模型
* 是否支持 streaming
* 备注

## 5.2 Credential

第一版可以不单独拆 Credential，直接将 API key 存在 Provider 上。

但数据结构建议预留未来拆分空间。

未来结构：

```text
Provider: MiniMax
Credential A: minimax-coding-plan
Credential B: minimax-backup-key
```

## 5.3 Profile

Profile 是 Clair 中最重要的用户级启动配置。

一个 Profile 对应一个 Claude Code 启动方式。

示例：

```text
Profile: claude-glm
Provider: Zhipu GLM
Route: /glm
Command: claude-glm
Model: glm-4.5
```

```text
Profile: claude-minimax
Provider: MiniMax
Route: /minimax
Command: claude-minimax
Model: minimax-m1
```

## 5.4 Route

Route 是本地代理的路径前缀。

例如：

```text
http://127.0.0.1:18789/glm
http://127.0.0.1:18789/minimax
http://127.0.0.1:18789/default
```

Clair 根据路径选择 Profile，再根据 Profile 选择 Provider。

## 5.5 Command Wrapper

Command Wrapper 是 Clair 自动生成的 shell 启动脚本。

例如：

```bash
~/.local/bin/claude-glm
~/.local/bin/claude-minimax
```

内容示例：

```bash
#!/usr/bin/env bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:18789/glm"
export ANTHROPIC_AUTH_TOKEN="clair-local-token"
exec /path/to/original/claude "$@"
```

---

# 6. 用户核心流程

## 6.1 首次启动流程

```text
用户打开 Clair
  ↓
检查本地代理状态
  ↓
检查 Claude Code 是否安装
  ↓
展示欢迎页
  ↓
引导用户添加第一个 Provider
  ↓
创建默认 Profile
  ↓
生成 claude-default 命令
  ↓
启动本地代理
```

## 6.2 添加 Provider 流程

```text
点击 Add Provider
  ↓
选择 Provider 类型
  ↓
填写 name / base_url / api_key / model
  ↓
点击 Test Connection
  ↓
测试成功
  ↓
保存 Provider
```

## 6.3 创建 Profile 流程

```text
点击 New Profile
  ↓
填写 Profile 名称，例如 Claude MiniMax
  ↓
自动生成 route: /minimax
  ↓
选择 Provider: MiniMax
  ↓
选择模型: minimax-m1
  ↓
生成 command: claude-minimax
  ↓
保存 Profile
  ↓
生成 shell wrapper
```

## 6.4 启动 Claude Code 流程

```text
用户打开终端
  ↓
运行 claude-minimax
  ↓
wrapper 设置 ANTHROPIC_BASE_URL
  ↓
启动 Claude Code
  ↓
Claude Code 请求 Clair 本地代理
  ↓
Clair 路由到 MiniMax Provider
```

## 6.5 并行运行流程

```text
终端 A: claude-glm
  → /glm
  → GLM

终端 B: claude-minimax
  → /minimax
  → MiniMax
```

两个实例互不覆盖配置，互不影响。

---

# 7. 功能需求

## 7.1 Provider 管理

### 7.1.1 Provider 列表

展示所有 Provider。

字段：

* 图标
* 名称
* 类型
* base_url
* 默认模型
* 状态
* 是否被 Profile 使用
* 最后测试时间

状态包括：

```text
Ready
Active
Error
Untested
Disabled
```

### 7.1.2 新增 Provider

表单字段：

| 字段               | 必填 | 说明                                                |
| ---------------- | -- | ------------------------------------------------- |
| Name             | 是  | 用户自定义名称，如 Zhipu GLM                               |
| Type             | 是  | Anthropic-compatible / OpenAI-compatible / Custom |
| Base URL         | 是  | API endpoint                                      |
| API Key          | 是  | token                                             |
| Auth Scheme      | 是  | x-api-key / bearer                                |
| Default Model    | 是  | 默认模型                                              |
| Notes            | 否  | 备注，例如 coding plan                                 |
| Enable Streaming | 否  | 默认开启                                              |

第一版 Provider Type 建议：

```text
Anthropic-compatible
OpenAI-compatible experimental
Custom
```

MVP 可以先真正稳定支持 Anthropic-compatible，OpenAI-compatible 标记为实验。

### 7.1.3 编辑 Provider

用户可以修改：

* name
* base_url
* api_key
* auth_scheme
* default_model
* notes
* enabled

修改 Provider 后：

* 关联 Profile 自动使用新配置
* 已运行的 Claude Code 实例是否受影响取决于代理实时读取配置还是缓存配置
* 建议第一版代理每次请求读取内存配置，UI 保存后更新内存配置

### 7.1.4 删除 Provider

删除前检查是否有 Profile 引用。

如果有引用：

```text
This provider is used by 2 profiles:
- claude-glm
- claude-default

Please reassign or delete these profiles first.
```

第一版不允许直接删除被引用 Provider。

### 7.1.5 测试连接

测试内容：

1. base_url 可访问
2. API key 格式可用
3. 模型是否可用
4. 是否支持 streaming

第一版可以简单实现：

* 向目标 Provider 发一个最小 messages 请求
* max_tokens 设置为 8
* prompt: `Say ok.`

测试结果：

```text
Connected
Latency: 823ms
Model: glm-4.5
Streaming: supported
```

失败时展示：

```text
401 Unauthorized: Please check API key or auth scheme.
404 Not Found: Please check base URL.
Timeout: Provider did not respond within 15s.
```

---

## 7.2 Profile 管理

### 7.2.1 Profile 列表

展示：

* Profile 名称
* command
* route
* provider
* model
* 是否默认
* 状态

示例：

```text
Default       claude-default    /default    Zhipu GLM    glm-4.5
GLM           claude-glm        /glm        Zhipu GLM    glm-4.5
MiniMax       claude-minimax    /minimax    MiniMax      minimax-m1
```

### 7.2.2 新增 Profile

字段：

| 字段               | 必填 | 说明                         |
| ---------------- | -- | -------------------------- |
| Name             | 是  | 例如 Claude MiniMax          |
| Route Path       | 是  | 例如 /minimax                |
| Provider         | 是  | 选择已有 Provider              |
| Model            | 是  | 默认填 Provider default_model |
| Command Name     | 是  | 例如 claude-minimax          |
| Is Default       | 否  | 是否默认                       |
| Generate Wrapper | 否  | 默认开启                       |

### 7.2.3 Route 校验

Route 必须：

* 以 `/` 开头
* 只包含小写字母、数字、短横线、下划线
* 不能重复
* 不能使用保留路径

保留路径：

```text
/health
/status
/api
/admin
/logs
```

### 7.2.4 Command 校验

Command name 必须：

* 只包含字母、数字、短横线、下划线
* 不允许空格
* 不允许覆盖危险命令
* 默认不覆盖原始 `claude`

危险命令示例：

```text
bash
sh
sudo
rm
cp
mv
python
node
npm
git
```

### 7.2.5 默认 Profile

只能有一个默认 Profile。

默认 Profile 对应：

```text
/default route
claude-default command
```

可选高级设置：允许用户创建 `~/.local/bin/claude` wrapper，将默认 `claude` 命令路由到 Clair。

这个功能第一版建议放在 Advanced Settings 中，并明确提示风险。

---

## 7.3 本地代理服务

### 7.3.1 服务监听

默认监听：

```text
127.0.0.1:18789
```

不建议默认监听 `0.0.0.0`，避免 token 暴露。

用户可配置端口。

### 7.3.2 路由规则

示例：

```text
GET  /health
GET  /status
POST /:profileRoute/v1/messages
POST /:profileRoute/messages
```

请求示例：

```text
POST http://127.0.0.1:18789/glm/v1/messages
```

Clair 解析：

```text
route = /glm
profile = claude-glm
provider = Zhipu GLM
```

然后转发到：

```text
provider.base_url + /v1/messages
```

### 7.3.3 请求头处理

Claude Code 到 Clair：

```text
Authorization: Bearer clair-local-token
x-api-key: clair-local-token
```

Clair 到 Provider：

根据 Provider auth_scheme 设置：

```text
x-api-key: provider.api_key
```

或：

```text
Authorization: Bearer provider.api_key
```

需要移除或替换原请求中的认证头，避免把 Clair local token 发给真实 Provider。

### 7.3.4 Body 处理

第一版建议：

* Anthropic-compatible Provider：透传 body，仅修改 model。
* OpenAI-compatible Provider：标记 experimental，可暂缓完整转换。

对于 Anthropic-compatible：

```json
{
  "model": "claude-sonnet-4-5",
  "messages": [...],
  "max_tokens": 1024,
  "stream": true
}
```

Clair 根据 Profile model 覆盖：

```json
{
  "model": "glm-4.5",
  "messages": [...],
  "max_tokens": 1024,
  "stream": true
}
```

### 7.3.5 Streaming

必须支持 SSE 流式透传。

MVP 最低要求：

* 如果 provider 返回 `text/event-stream`，Clair 原样转发给 Claude Code。
* 不解析流内容，不做 token 统计。
* 保持 headers 正确。

关键 header：

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### 7.3.6 错误处理

错误响应保持 Anthropic 风格更好。

示例：

```json
{
  "type": "error",
  "error": {
    "type": "provider_connection_error",
    "message": "Failed to connect to provider MiniMax: timeout after 30s"
  }
}
```

错误类型：

```text
profile_not_found
provider_not_found
provider_disabled
auth_failed
provider_timeout
provider_connection_error
provider_response_error
invalid_request
```

---

## 7.4 Wrapper 生成

### 7.4.1 生成位置

默认：

```text
~/.local/bin
```

需要检查该目录是否在 PATH 中。

如果不在 PATH，UI 提示：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### 7.4.2 Wrapper 内容

示例：

```bash
#!/usr/bin/env bash
set -e

CLAIR_BASE_URL="http://127.0.0.1:18789/glm"
CLAIR_TOKEN="clair-local-token"
CLAUDE_BIN="/usr/local/bin/claude"

export ANTHROPIC_BASE_URL="$CLAIR_BASE_URL"
export ANTHROPIC_AUTH_TOKEN="$CLAIR_TOKEN"

exec "$CLAUDE_BIN" "$@"
```

### 7.4.3 Claude 原始路径查找

查找方式：

```bash
which claude
```

但要避免找到 Clair 自己生成的 wrapper。

后端应该记录原始 Claude Code 路径，例如：

```text
/usr/local/bin/claude
/home/user/.npm-global/bin/claude
/home/user/.local/share/pnpm/claude
```

如果找不到，UI 提示用户手动填写。

### 7.4.4 重新生成

当以下配置变化时，需要提示重新生成 wrapper：

* route path
* command name
* local proxy port
* local token
* original claude binary path

---

## 7.5 设置页

设置包括：

### General

* App theme: System / Light / Dark
* Start Clair on login
* Start proxy on app launch
* Minimize to tray

### Proxy

* Host: 默认 `127.0.0.1`
* Port: 默认 `18789`
* Local auth token
* Regenerate token
* Request timeout

### Claude Code

* Original Claude binary path
* Wrapper directory
* Check PATH
* Generate default command
* Advanced: override `claude` command

### Data

* Export config
* Import config
* Open data directory
* Reset app

---

# 8. UI / UX 设计文档

## 8.1 设计目标

Clair 的 UI 不能像普通后台管理系统，而应该像一个精致的桌面工具。

关键词：

```text
Warm
Calm
Precise
Minimal
Readable
Premium
Local-first
```

参考风格：

* Anthropic Claude Web
* Claude Desktop / Claude App
* Apple System Settings
* Raycast
* Linear 的克制感

避免：

* 过度科技感
* 赛博朋克
* 霓虹渐变
* 粗边框
* 太多 icon
* 蓝色 SaaS 后台风
* 表格堆满字段

## 8.2 视觉风格

### 颜色

主色建议：

```text
Background: #F7F4EF / #FAF8F4
Surface: #FFFFFF / #FBFAF7
Primary: #D97742 / #C96F3A
Text: #25211D
Muted Text: #7C746B
Border: #E7E0D6
Success: #4F8A5B
Warning: #B9852D
Error: #B85C50
```

整体是暖白 + 陶土橙，而不是纯白 + 亮蓝。

### 字体

Linux 下建议：

```text
Inter
SF Pro Display fallback
Noto Sans
system-ui
```

CSS：

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### 圆角

```text
小组件：10px
卡片：16px
大容器：20px
按钮：12px
```

### 阴影

使用非常克制的阴影：

```css
box-shadow: 0 12px 30px rgba(38, 31, 24, 0.06);
```

边框比阴影更重要。

## 8.3 信息架构

主界面建议三栏：

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Bar: Clair     Proxy: Running     Add Provider          │
├───────────────┬─────────────────────────┬───────────────────┤
│ Profiles      │ Providers               │ Details           │
│               │                         │                   │
│ Default       │ Zhipu GLM               │ Profile Details   │
│ GLM           │ MiniMax                 │ Route             │
│ MiniMax       │ DeepSeek                │ Command           │
│               │                         │ Test / Generate   │
└───────────────┴─────────────────────────┴───────────────────┘
```

### 左侧：Profiles

* Default
* claude-glm
* claude-minimax
* New Profile 按钮

### 中间：Provider Cards

* Provider 图标
* 名称
* base_url
* model
* status badge
* 使用它的 Profile 数量

### 右侧：详情面板

当选中 Profile：

* Route URL
* Command
* Provider
* Model
* Generated wrapper status
* Copy command
* Regenerate wrapper
* Test profile

当选中 Provider：

* Provider 配置
* Test connection
* Edit
* Delete
* Associated profiles

## 8.4 关键页面

### 8.4.1 Welcome 页面

文案：

```text
Run Claude Code with multiple providers, side by side.

Create local profiles like claude-glm and claude-minimax,
then let Clair route each session to the right provider.
```

按钮：

```text
Get Started
Import from CC Switch
Open Settings
```

第一版可以先不做导入，按钮置灰或隐藏。

### 8.4.2 Provider 列表页

卡片设计：

```text
┌──────────────────────────────────────────┐
│ ● Zhipu GLM                     Ready    │
│ https://open.bigmodel.cn                 │
│ Model: glm-4.5  ·  Used by 2 profiles    │
│                                          │
│ [Test] [Edit] [Create Profile]           │
└──────────────────────────────────────────┘
```

### 8.4.3 Profile 详情页

```text
Profile
Claude MiniMax

Route
http://127.0.0.1:18789/minimax

Command
claude-minimax

Provider
MiniMax · minimax-m1

Actions
[Copy command] [Regenerate wrapper] [Test]
```

### 8.4.4 Add Provider Modal

分步设计更优雅：

Step 1: Choose Type

```text
Anthropic-compatible
OpenAI-compatible experimental
Custom
```

Step 2: Credentials

```text
Name
Base URL
API Key
Auth Scheme
Default Model
```

Step 3: Test

```text
[Test Connection]
```

Step 4: Create Profile

```text
Create a Claude Code profile for this provider?
Command: claude-minimax
Route: /minimax
```

## 8.5 交互动效

建议使用 Framer Motion。

动效原则：

* 快，150ms～220ms
* 柔和 ease-out
* 不弹跳
* 不花哨

使用场景：

* 卡片 hover 微上浮
* 详情面板切换淡入
* status badge 轻微变化
* modal 打开缩放 0.98 → 1

## 8.6 空状态设计

没有 Provider：

```text
No providers yet.
Add your first provider to start routing Claude Code locally.
```

没有 Profile：

```text
No profiles yet.
Profiles create commands like claude-glm or claude-minimax.
```

代理未启动：

```text
Proxy is not running.
Start the local gateway before launching Claude Code profiles.
```

---

# 9. 技术架构

## 9.1 推荐技术栈

### 桌面应用

```text
Tauri 2
React
TypeScript
Vite
Tailwind CSS
Framer Motion
Lucide Icons
```

### 后端

```text
Rust
Tokio
Axum
Reqwest
SQLx / rusqlite
Serde
```

### 数据库

```text
SQLite
```

### 配置目录

Linux：

```text
~/.config/clair/
~/.local/share/clair/
```

建议：

```text
~/.config/clair/config.json
~/.local/share/clair/clair.db
~/.local/share/clair/logs/
~/.local/bin/claude-glm
```

## 9.2 进程结构

```text
Clair Desktop App
  ├── React UI
  ├── Tauri Commands
  ├── SQLite Config Store
  ├── Local Proxy Server
  └── Wrapper Generator
```

## 9.3 本地代理架构

```text
Claude Code
  ↓
Wrapper command sets ANTHROPIC_BASE_URL
  ↓
Clair Proxy: 127.0.0.1:18789/:route
  ↓
Route Resolver
  ↓
Profile Resolver
  ↓
Provider Resolver
  ↓
Request Adapter
  ↓
Provider API
```

## 9.4 模块划分

```text
src-tauri/src/
  main.rs
  commands/
    provider.rs
    profile.rs
    proxy.rs
    settings.rs
    wrapper.rs
  domain/
    provider.rs
    profile.rs
    settings.rs
  db/
    mod.rs
    migrations.rs
  proxy/
    server.rs
    router.rs
    forward.rs
    adapters/
      anthropic.rs
      openai.rs
  services/
    provider_service.rs
    profile_service.rs
    wrapper_service.rs
    claude_detect_service.rs
  security/
    secret.rs
  utils/
    paths.rs
    validation.rs
```

前端：

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    layout/
    provider/
    profile/
    settings/
    common/
  hooks/
    useProviders.ts
    useProfiles.ts
    useProxyStatus.ts
  lib/
    api.ts
    types.ts
    validators.ts
  styles/
    globals.css
```

---

# 10. 数据模型

## 10.1 Provider

TypeScript：

```ts
type ProviderType =
  | 'anthropic_compatible'
  | 'openai_compatible'
  | 'custom'

type AuthScheme = 'x_api_key' | 'bearer'

type ProviderStatus = 'ready' | 'untested' | 'error' | 'disabled'

type Provider = {
  id: string
  name: string
  type: ProviderType
  baseUrl: string
  apiKey: string
  authScheme: AuthScheme
  defaultModel: string
  enableStreaming: boolean
  notes?: string
  status: ProviderStatus
  lastTestedAt?: string
  createdAt: string
  updatedAt: string
}
```

Rust：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderType {
    AnthropicCompatible,
    OpenAICompatible,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthScheme {
    XApiKey,
    Bearer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub base_url: String,
    pub api_key: String,
    pub auth_scheme: AuthScheme,
    pub default_model: String,
    pub enable_streaming: bool,
    pub notes: Option<String>,
    pub status: String,
    pub last_tested_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

## 10.2 Profile

TypeScript：

```ts
type Profile = {
  id: string
  name: string
  routePath: string
  providerId: string
  model: string
  commandName: string
  isDefault: boolean
  wrapperEnabled: boolean
  wrapperPath?: string
  createdAt: string
  updatedAt: string
}
```

Rust：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub route_path: String,
    pub provider_id: String,
    pub model: String,
    pub command_name: String,
    pub is_default: bool,
    pub wrapper_enabled: bool,
    pub wrapper_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

## 10.3 App Settings

```ts
type AppSettings = {
  proxyHost: string
  proxyPort: number
  proxyAuthToken: string
  startProxyOnLaunch: boolean
  startAppOnLogin: boolean
  minimizeToTray: boolean
  wrapperDir: string
  claudeBinaryPath?: string
  theme: 'system' | 'light' | 'dark'
}
```

## 10.4 Request Log

第一版可以只做轻量日志，不做完整 token 统计。

```ts
type RequestLog = {
  id: string
  profileId: string
  providerId: string
  model: string
  method: string
  path: string
  statusCode?: number
  latencyMs?: number
  error?: string
  createdAt: string
}
```

---

# 11. SQLite 表结构

## 11.1 providers

```sql
CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  auth_scheme TEXT NOT NULL,
  default_model TEXT NOT NULL,
  enable_streaming INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'untested',
  last_tested_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 11.2 profiles

```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route_path TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  command_name TEXT NOT NULL UNIQUE,
  is_default INTEGER NOT NULL DEFAULT 0,
  wrapper_enabled INTEGER NOT NULL DEFAULT 1,
  wrapper_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(provider_id) REFERENCES providers(id)
);
```

## 11.3 settings

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## 11.4 request_logs

```sql
CREATE TABLE request_logs (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  provider_id TEXT,
  model TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL
);
```

## 11.5 indexes

```sql
CREATE INDEX idx_profiles_route_path ON profiles(route_path);
CREATE INDEX idx_profiles_provider_id ON profiles(provider_id);
CREATE INDEX idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX idx_request_logs_profile_id ON request_logs(profile_id);
```

---

# 12. 后端接口设计

这里的接口是 Tauri command，不一定是 HTTP API。

## 12.1 Provider Commands

### list_providers

输入：无

输出：

```ts
Provider[]
```

### create_provider

输入：

```ts
type CreateProviderInput = {
  name: string
  type: ProviderType
  baseUrl: string
  apiKey: string
  authScheme: AuthScheme
  defaultModel: string
  enableStreaming: boolean
  notes?: string
}
```

输出：

```ts
Provider
```

### update_provider

输入：

```ts
type UpdateProviderInput = {
  id: string
  name?: string
  baseUrl?: string
  apiKey?: string
  authScheme?: AuthScheme
  defaultModel?: string
  enableStreaming?: boolean
  notes?: string
  status?: ProviderStatus
}
```

输出：

```ts
Provider
```

### delete_provider

输入：

```ts
{ id: string }
```

输出：

```ts
{ success: boolean }
```

如果被 Profile 引用，返回错误。

### test_provider

输入：

```ts
{ id: string }
```

输出：

```ts
type TestProviderResult = {
  ok: boolean
  latencyMs?: number
  message: string
  model?: string
  streamingSupported?: boolean
}
```

## 12.2 Profile Commands

### list_profiles

输出：

```ts
Profile[]
```

### create_profile

输入：

```ts
type CreateProfileInput = {
  name: string
  routePath: string
  providerId: string
  model: string
  commandName: string
  isDefault: boolean
  wrapperEnabled: boolean
}
```

输出：

```ts
Profile
```

### update_profile

输入：

```ts
type UpdateProfileInput = {
  id: string
  name?: string
  routePath?: string
  providerId?: string
  model?: string
  commandName?: string
  isDefault?: boolean
  wrapperEnabled?: boolean
}
```

输出：

```ts
Profile
```

### delete_profile

输入：

```ts
{ id: string }
```

输出：

```ts
{ success: boolean }
```

### set_default_profile

输入：

```ts
{ id: string }
```

输出：

```ts
Profile
```

## 12.3 Proxy Commands

### get_proxy_status

输出：

```ts
type ProxyStatus = {
  running: boolean
  host: string
  port: number
  activeRoutes: Array<{
    routePath: string
    profileName: string
    providerName: string
  }>
}
```

### start_proxy

输出：

```ts
ProxyStatus
```

### stop_proxy

输出：

```ts
ProxyStatus
```

### restart_proxy

输出：

```ts
ProxyStatus
```

## 12.4 Wrapper Commands

### detect_claude_binary

输出：

```ts
type ClaudeBinaryDetection = {
  found: boolean
  path?: string
  candidates: string[]
}
```

### generate_wrapper

输入：

```ts
{ profileId: string }
```

输出：

```ts
type GenerateWrapperResult = {
  success: boolean
  path: string
  commandName: string
}
```

### generate_all_wrappers

输出：

```ts
GenerateWrapperResult[]
```

### check_wrapper_status

输入：

```ts
{ profileId: string }
```

输出：

```ts
type WrapperStatus = {
  exists: boolean
  executable: boolean
  path?: string
  inPath: boolean
  stale: boolean
}
```

## 12.5 Settings Commands

### get_settings

输出：

```ts
AppSettings
```

### update_settings

输入：

```ts
Partial<AppSettings>
```

输出：

```ts
AppSettings
```

---

# 13. 本地代理详细设计

## 13.1 请求路径解析

请求：

```text
POST /glm/v1/messages
```

解析：

```rust
route_path = "/glm"
remaining_path = "/v1/messages"
```

查找：

```text
profiles.route_path == "/glm"
```

得到：

```text
profile.model = "glm-4.5"
profile.provider_id = "zhipu-glm"
```

## 13.2 转发 URL 构造

Provider base_url：

```text
https://open.bigmodel.cn/api/anthropic
```

remaining_path：

```text
/v1/messages
```

最终：

```text
https://open.bigmodel.cn/api/anthropic/v1/messages
```

需要注意去重 `/`。

## 13.3 请求头转发策略

保留：

```text
content-type
anthropic-version
anthropic-beta
user-agent
accept
```

移除：

```text
authorization
x-api-key
host
content-length
```

重新设置认证：

```text
x-api-key: provider.api_key
```

或：

```text
authorization: Bearer provider.api_key
```

## 13.4 Model Override

如果请求 body 是 JSON，并且有 `model` 字段：

```json
{
  "model": "claude-sonnet-4-5"
}
```

替换成 profile.model：

```json
{
  "model": "glm-4.5"
}
```

如果用户后续需要模型映射，可扩展为：

```text
requested_model → mapped_model
```

第一版直接强制使用 profile.model。

## 13.5 Streaming 透传

使用 reqwest 发起 upstream 请求。

如果响应是 streaming：

* 不 buffer 整体响应
* 将 bytes_stream 转成 axum body
* 保持 content-type

伪代码：

```rust
let response = client.request(method, upstream_url)
    .headers(headers)
    .body(body)
    .send()
    .await?;

let status = response.status();
let headers = response.headers().clone();
let stream = response.bytes_stream();

return Response::builder()
    .status(status)
    .headers(filtered_headers)
    .body(Body::from_stream(stream));
```

## 13.6 超时

默认：

```text
connect timeout: 10s
total request timeout: 300s
```

Streaming 请求不应该用太短 total timeout。

---

# 14. 前端开发文档

## 14.1 页面结构

```text
App
├── MainLayout
│   ├── SidebarProfiles
│   ├── TopBar
│   ├── ProviderList
│   └── DetailPanel
├── AddProviderModal
├── AddProfileModal
├── SettingsModal
└── ToastProvider
```

## 14.2 状态管理

第一版可以用 React Query 或 Zustand。

推荐：

```text
TanStack Query 管服务端数据
Zustand 管 UI 状态
```

服务端数据：

* providers
* profiles
* settings
* proxyStatus

UI 状态：

* selectedProviderId
* selectedProfileId
* activeModal
* theme

## 14.3 API 封装

`src/lib/api.ts`

```ts
import { invoke } from '@tauri-apps/api/core'

export async function listProviders() {
  return invoke<Provider[]>('list_providers')
}

export async function createProvider(input: CreateProviderInput) {
  return invoke<Provider>('create_provider', { input })
}

export async function testProvider(id: string) {
  return invoke<TestProviderResult>('test_provider', { id })
}
```

## 14.4 组件设计

### ProviderCard

Props：

```ts
type ProviderCardProps = {
  provider: Provider
  selected: boolean
  profileCount: number
  onSelect: () => void
  onTest: () => void
  onEdit: () => void
}
```

视觉要求：

* 16px 圆角
* 暖白背景
* hover border 加深
* selected 使用陶土橙边框
* 状态 badge 在右上角

### ProfileListItem

Props：

```ts
type ProfileListItemProps = {
  profile: Profile
  provider?: Provider
  selected: boolean
  onSelect: () => void
}
```

展示：

```text
Profile Name
command · provider name
```

### DetailPanel

根据选择对象展示。

状态：

```ts
type DetailMode =
  | { type: 'profile'; id: string }
  | { type: 'provider'; id: string }
  | { type: 'empty' }
```

## 14.5 表单校验

前端用 zod。

Provider schema：

```ts
const providerSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  defaultModel: z.string().min(1),
  authScheme: z.enum(['x_api_key', 'bearer']),
})
```

Profile schema：

```ts
const profileSchema = z.object({
  name: z.string().min(1),
  routePath: z.string().regex(/^\/[a-z0-9_-]+$/),
  commandName: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  providerId: z.string().min(1),
  model: z.string().min(1),
})
```

## 14.6 Toast 文案

成功：

```text
Provider saved.
Profile created.
Wrapper generated at ~/.local/bin/claude-minimax.
Proxy is running on 127.0.0.1:18789.
```

失败：

```text
Could not connect to provider.
Route path is already used.
Command name already exists.
Claude binary was not found.
```

## 14.7 前端主题 CSS 变量

```css
:root {
  --background: #f7f4ef;
  --surface: #fffdf9;
  --surface-muted: #f0ebe3;
  --text: #25211d;
  --text-muted: #7c746b;
  --border: #e7e0d6;
  --primary: #c96f3a;
  --primary-hover: #b86232;
  --success: #4f8a5b;
  --warning: #b9852d;
  --error: #b85c50;
  --shadow-soft: 0 18px 50px rgba(38, 31, 24, 0.08);
}
```

---

# 15. 安全设计

## 15.1 本地监听安全

默认只监听：

```text
127.0.0.1
```

不要监听公网地址。

## 15.2 本地代理 token

即使只监听 localhost，也建议 wrapper 带一个 Clair local token。

Clair 检查：

```text
Authorization: Bearer clair-local-token
```

或：

```text
x-api-key: clair-local-token
```

没有 token 的请求拒绝。

## 15.3 API key 存储

第一版可以存在 SQLite，但要清楚这是 MVP。

更好方案：

* Linux 使用 Secret Service / keyring
* 或者使用系统 keychain
* SQLite 只存 key reference

第一版建议：

```text
MVP: SQLite 明文存储，但 UI 明确说明 local-only。
V1.1: 接入系统 keyring。
```

## 15.4 日志脱敏

日志不能记录完整 API key。

显示格式：

```text
sk-****abcd
```

请求 body 是否记录：第一版不记录，避免泄露代码和 prompt。

## 15.5 导出配置脱敏

导出配置默认不包含 API key。

提供选项：

```text
Export without secrets
Export with secrets
```

导出 secrets 需要二次确认。

---

# 16. 开发里程碑

## 16.1 Milestone 0：项目初始化

目标：项目能启动。

任务：

* 初始化 Tauri + React + TypeScript
* 配置 Tailwind
* 配置基础窗口
* 建立 Rust 模块结构
* 初始化 SQLite

验收：

```text
运行 pnpm tauri dev 可以打开 Clair 主窗口。
```

## 16.2 Milestone 1：Provider / Profile CRUD

任务：

* Provider 表
* Profile 表
* Tauri commands
* 前端列表与表单
* 基础校验

验收：

```text
可以创建 GLM Provider。
可以创建 claude-glm Profile。
关闭重开后数据仍存在。
```

## 16.3 Milestone 2：本地代理

任务：

* Axum server
* start / stop / status
* route resolver
* provider resolver
* Anthropic-compatible 透传
* model override

验收：

```text
curl http://127.0.0.1:18789/health 返回 ok。
通过 /glm/v1/messages 可以请求真实 Provider。
```

## 16.4 Milestone 3：Wrapper 生成

任务：

* 检测 Claude binary
* 生成 claude-glm
* chmod +x
* 检查 PATH
* UI 显示 wrapper 状态

验收：

```text
终端运行 claude-glm 可以启动 Claude Code，并走 Clair 代理。
```

## 16.5 Milestone 4：UI 精修

任务：

* 三栏布局
* 精致卡片
* Add Provider Modal
* Add Profile Modal
* Settings Modal
* Toast
* 动效
* 空状态

验收：

```text
UI 不像粗糙后台，整体接近 Claude / Anthropic 风格。
```

## 16.6 Milestone 5：测试与打包

任务：

* Linux AppImage / deb 打包
* 常见错误提示
* 端口占用处理
* Provider 连接测试
* README

验收：

```text
可以安装到 Ubuntu，打开 UI，配置 Provider，生成命令，并成功运行。
```

---

# 17. MVP 开发顺序建议

最小可用路径：

```text
1. 先做纯后端代理 hardcode 两个 provider
2. 验证 claude-glm / claude-minimax 可行
3. 再做 SQLite 配置
4. 再做 UI
5. 最后做 wrapper 自动生成
```

不要一开始就陷入 UI 和完整数据库。

推荐第一周目标：

```text
通过命令行配置两个 provider，并让两个 Claude Code 同时跑起来。
```

推荐第二周目标：

```text
把配置能力搬到 UI，做出可用桌面 App。
```

---

# 18. 风险与应对

## 18.1 Claude Code 对 Anthropic API 兼容要求较高

风险：某些 Provider 声称兼容，但实际流式格式不完全兼容。

应对：

* 第一版明确支持 Anthropic-compatible Provider
* 每个 Provider 增加 test profile
* 不承诺所有中转都可用

## 18.2 Streaming 不稳定

风险：代理层处理 streaming 不当导致 Claude Code 卡住。

应对：

* streaming 原样透传
* 不做复杂解析
* 测试长响应

## 18.3 Wrapper 覆盖原始 claude

风险：用户误覆盖原始命令。

应对：

* 默认不生成 `claude`
* 只生成 `claude-xxx`
* 覆盖 `claude` 放 Advanced，并强提醒

## 18.4 API key 安全

风险：SQLite 明文存储 key。

应对：

* 第一版本地-only
* 日志脱敏
* 后续接入 keyring

## 18.5 Provider 格式转换复杂

风险：OpenAI-compatible 转 Anthropic streaming 工作量较大。

应对：

* 第一版以 Anthropic-compatible 为主
* OpenAI-compatible 标 experimental
* 后续单独做 adapter milestone

---

# 19. 第一版验收清单

## 19.1 功能验收

* [ ] 可以新增 Provider
* [ ] 可以编辑 Provider
* [ ] 可以删除未被引用的 Provider
* [ ] 可以测试 Provider
* [ ] 可以新增 Profile
* [ ] 可以设置默认 Profile
* [ ] 可以启动本地代理
* [ ] 可以停止本地代理
* [ ] 可以查看代理状态
* [ ] 可以生成 wrapper
* [ ] 可以检测 Claude Code 路径
* [ ] 可以复制启动命令
* [ ] 可以并行运行两个不同 Profile

## 19.2 UI 验收

* [ ] 主界面三栏布局清晰
* [ ] 暖白 + 陶土橙视觉风格
* [ ] 卡片有精致边框和留白
* [ ] 表单不拥挤
* [ ] 空状态友好
* [ ] 错误提示明确
* [ ] 按钮层级清晰
* [ ] 不像粗糙后台管理系统

## 19.3 安全验收

* [ ] 默认监听 127.0.0.1
* [ ] 本地代理需要 token
* [ ] 日志不显示完整 API key
* [ ] 导出配置默认不含 secret
* [ ] 删除 Provider 有引用检查

## 19.4 技术验收

* [ ] SQLite 数据持久化正常
* [ ] 代理支持 streaming
* [ ] model override 正常
* [ ] wrapper chmod +x 正常
* [ ] PATH 检测正常
* [ ] Linux 打包可安装

---

# 20. 未来版本规划

## V1.1

* 系统 keyring 存储 API key
* 请求日志页面
* Provider 导入导出
* 从 CC Switch 导入 Provider
* 托盘常驻
* 开机自启

## V1.2

* OpenAI-compatible adapter
* Anthropic ↔ OpenAI 消息格式转换
* Streaming 转换
* 模型映射表

## V1.3

* 用量统计
* Token 估算
* 请求成本估算
* 每个 Profile 的使用报表

## V1.4

* 多 key 轮询
* 失败重试
* 熔断器
* fallback provider

## V2.0

* 支持 Codex
* 支持 Gemini CLI
* 支持 OpenCode
* Provider Marketplace
* Team profile sync

---

# 21. 给开发者的最终建议

第一版一定要保持克制。

最重要的是打通这条链路：

```text
UI 添加 Provider
  ↓
创建 Profile
  ↓
生成 claude-xxx
  ↓
Claude Code 请求 Clair
  ↓
Clair 路由到正确 Provider
  ↓
两个 Claude Code 实例并行工作
```

不要一开始就追求全 Provider 兼容、复杂统计和高级熔断。Clair 的第一版价值不是“大而全”，而是：

> **让 Claude Code 的多 Provider 并行工作流变得优雅、稳定、可见。**

这就是产品的核心。
