# Clair

**Local Claude Provider Gateway** — 并行运行多个 Claude Code Provider 的本地网关。

Clair 是一个 Tauri 桌面应用，让你可以通过不同命令同时启动不同 Provider 的 Claude Code 实例：

```bash
终端 A：claude-glm       → GLM (智谱)
终端 B：claude-minimax   → MiniMax
终端 C：claude-deepseek  → DeepSeek
```

每个命令对应一个独立的 Profile，通过本地代理路由到不同的 API Provider，互不干扰。

> Windows 主方案已经从“纯环境变量 launcher”切换到“`--settings` profile launcher”。详细设计和验证结论见 [doc/windows-profile-settings-strategy.md](doc/windows-profile-settings-strategy.md)。

## 工作原理

```
┌──────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│  claude-glm  │────▶│                          │────▶│  GLM API     │
├──────────────┤     │  Clair Local Proxy        │     ├──────────────┤
│claude-minimax│────▶│  127.0.0.1:18789          │────▶│  MiniMax API  │
├──────────────┤     │                          │     ├──────────────┤
│claude-default│────▶│  路由规则: Profile → Provider│────▶│  Claude API   │
└──────────────┘     └──────────────────────────┘     └──────────────┘
```

1. **Provider** — 配置 API 厂商信息（Base URL、API Key、认证方式、默认模型）
2. **Profile** — 定义路由规则（路径、命令名、模型覆盖）并绑定到某个 Provider
3. **Launcher 启动器** — 在 Windows 下生成 `%LOCALAPPDATA%\Clair\bin\claude-xxx.cmd`，通过 `claude.exe --settings <profile-settings.json>` 启动对应 Profile
4. **本地代理** — 监听 `127.0.0.1:18789`，根据请求路径路由到对应 Provider，自动替换模型名和认证信息

## 功能特性

- **Provider 管理** — 添加、编辑、测试 API Provider（支持 Anthropic-compatible / OpenAI-compatible / Custom）
- **Profile 管理** — 为每个 Provider 创建多个路由配置，自定义命令名和模型
- **本地 HTTP 代理** — 透明转发请求，自动处理认证头替换和模型覆盖
- **Launcher + Profile Settings 生成** — 一键生成 `claude-xxx.cmd` 和对应的 profile settings 覆盖文件
- **SSE 流式响应** — 支持流式输出透传
- **连接测试** — 测试 Provider 连通性并显示延迟
- **国际化** — 支持简体中文和英文

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + Framer Motion |
| 状态管理 | TanStack Query + Zustand |
| 表单校验 | Zod + React Hook Form |
| 后端 | Rust + Axum + SQLite |
| HTTP 代理 | Rust Axum |

## 项目结构

```
clair/
├── src/                        # 前端 React 代码
│   ├── components/
│   │   ├── layout/             # TopBar, Sidebar, MainLayout, DetailPanel
│   │   ├── provider/           # ProviderCard, ProviderList, AddProviderModal, EditProviderModal
│   │   ├── profile/            # AddProfileModal, EditProfileModal
│   │   ├── settings/           # SettingsModal
│   │   └── common/             # Badge, Toast
│   ├── hooks/                  # useProviders, useProfiles, useProxyStatus, useUIStore
│   ├── lib/                    # api.ts (Tauri invoke), types.ts, validators.ts, i18n.tsx
│   └── styles/                 # globals.css (设计系统)
├── src-tauri/                  # Rust 后端
│   └── src/
│       ├── commands/           # Tauri 命令处理 (provider, profile, proxy, wrapper, settings)
│       ├── domain/             # 领域模型 (Provider, Profile)
│       ├── db/                 # SQLite 数据库操作 + 迁移
│       ├── proxy/              # HTTP 代理服务器 (Axum)
│       ├── services/           # 业务逻辑 (ProviderService, WrapperService, ClaudeDetectService)
│       ├── security/           # API Key 脱敏、认证
│       └── utils/              # 路由/命令名校验
├── doc/                        # 文档
│   ├── prd.md                  # 产品需求文档
│   ├── frontend-dev.md         # 前端开发规范 + 设计系统
│   ├── backend-dev.md          # 后端 Rust 模块指南
│   └── test.md                 # 测试用例 & 验收标准
└── UI参考/                     # UI 参考设计图
```

## 快速开始

> `main` 现在以 Windows 版本为主线。当前 Linux 版本基线保存在 `linux-dev` 分支。

### 环境要求

- Node.js 18+
- Rust 1.70+ (via [rustup](https://rustup.rs))
- [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/)

### 安装依赖

```bash
# 前端依赖
npm install

# Rust 依赖（自动由 cargo 处理）
```

### 开发模式

```bash
# 启动开发服务器（热重载）
cargo tauri dev
```

### 构建生产版本

```bash
# 仅构建前端
npm run build

# 完整打包 Tauri 应用
cargo tauri build
```

Windows debug 构建产物位于 `src-tauri/target/debug/clair.exe`。

## 使用流程

### 1. 创建 Provider

点击右上角 **+ Add Provider**，填写：

| 字段 | 说明 | 示例 |
|------|------|------|
| Name | Provider 名称 | `GLM` |
| Type | API 兼容类型 | `Anthropic-compatible` |
| Base URL | API 地址 | `https://open.bigmodel.cn/api/paas/v4` |
| API Key | 认证密钥 | `your-api-key` |
| Auth Scheme | 认证方式 | `x-api-key` 或 `Bearer` |
| Default Model | 默认模型 | `glm-4` |

### 2. 测试连接

在 Provider 详情页点击 **Test Connection**，确认连接成功后状态变为 **Ready**。

### 3. 创建 Profile

在左侧边栏点击 **+ New Profile**，配置：

| 字段 | 说明 | 示例 |
|------|------|------|
| Name | Profile 名称 | `GLM` |
| Provider | 绑定的 Provider | `GLM` |
| Route Path | 代理路由路径 | `/glm` |
| Command Name | 生成的命令名 | `claude-glm` |
| Model | 使用的模型 | `glm-4` |

### 4. 生成 Launcher 启动器

选中 Profile 后，点击右侧 **Regenerate Wrapper**，生成类似：

- `%LOCALAPPDATA%\Clair\bin\claude-glm.cmd`
- `%LOCALAPPDATA%\Clair\bin\claude-minimax.cmd`
- `%LOCALAPPDATA%\Clair\bin\profiles\claude-glm.settings.json`
- `%LOCALAPPDATA%\Clair\bin\profiles\claude-minimax.settings.json`

Windows 下 launcher 的实际启动方式是：

```powershell
claude.exe --settings "%LOCALAPPDATA%\Clair\bin\profiles\claude-glm.settings.json"
```

这份 settings 文件会把 Claude 请求指向 Clair local proxy，而不是直接改全局 `%USERPROFILE%\.claude\settings.json`。

### 5. 启动代理

点击右上角 **Start** 按钮启动本地代理。状态指示灯变绿表示代理正在运行。

### 6. 使用

```powershell
# 在 PowerShell 中直接启动
claude-glm

# 或使用完整 launcher 路径启动
& "$env:LOCALAPPDATA\Clair\bin\claude-minimax.cmd"
```

## 数据存储

- **配置数据库**: `%APPDATA%\clair\clair.db`
- **日志目录**: `%APPDATA%\clair\logs\`
- **Launcher 启动器**: `%LOCALAPPDATA%\Clair\bin\claude-*.cmd`
- **Profile Settings**: `%LOCALAPPDATA%\Clair\bin\profiles\*.settings.json`

## 安全说明

- 代理默认监听 `127.0.0.1`（仅本地访问，不暴露到网络）
- 日志中 API Key 自动脱敏：`sk-****abcd`
- 导出配置默认不包含密钥
- 删除 Provider 时检查 Profile 引用，防止误删

## 设计系统

Clair 使用暖白色调 + 陶土橙作为主色调：

| 用途 | 颜色 |
|------|------|
| Primary | `#E67E50` (Terracotta Orange) |
| Background | `#F9F9F9` (Warm Gray) |
| Surface | `#FFFFFF` (White Cards) |
| Border | `#EDEDED` (Subtle) |
| Success | `#52C41A` |
| Error | `#F5222D` |

## 开发命令

```bash
# 前端
npm run dev          # Vite 开发服务器
npm run build        # 生产构建

# 后端
cargo check          # Rust 类型检查
cargo build          # Rust 构建
cargo test           # 运行测试

# Tauri
cargo tauri dev      # 开发模式（热重载）
cargo tauri build    # 生产打包
```

## License

MIT
