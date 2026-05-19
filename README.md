# Clair

**Local Claude Provider Gateway** — 并行运行多个 Claude Code Provider 的本地网关。

[English](./README.en.md)

---

## 它是什么

Clair 让你用不同命令同时启动不同 Provider 的 Claude Code 实例，互不干扰：

```bash
终端 A：claude-glm       → GLM (智谱)
终端 B：claude-minimax   → MiniMax
终端 C：claude-deepseek  → DeepSeek
```

每个命令对应一个 Profile，通过本地代理路由到对应 API Provider，自动替换模型和认证。

## 工作原理

```
┌──────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│  claude-glm  │────▶│                          │────▶│  GLM API     │
├──────────────┤     │  Clair Local Proxy        │     ├──────────────┤
│claude-minimax│────▶│  127.0.0.1:28789          │────▶│  MiniMax API  │
├──────────────┤     │                          │     ├──────────────┤
│claude-default│────▶│  路由: Profile → Provider  │────▶│  Claude API   │
└──────────────┘     └──────────────────────────┘     └──────────────┘
```

1. **Provider** — 配置 API 厂商信息（Base URL、API Key、认证方式、默认模型）
2. **Profile** — 定义路由规则（路径、命令名、模型覆盖）并绑定到某个 Provider
3. **Wrapper 脚本** — 生成 `~/.local/bin/claude-xxx` 可执行脚本，通过 `--settings` 文件注入配置
4. **本地代理** — 监听 `127.0.0.1:28789`，根据请求路径路由到对应 Provider

## 功能特性

- **Provider 管理** — 添加、编辑、测试 API Provider（Anthropic-compatible / OpenAI-compatible / Custom）
- **Profile 管理** — 为每个 Provider 创建多个路由配置，自定义命令名和模型
- **本地 HTTP 代理** — 透明转发请求，自动处理认证头替换和模型覆盖
- **Wrapper 脚本生成** — 一键生成 `claude-xxx` 命令脚本 + per-profile settings 文件
- **路由测试** — 端到端测试 Profile 路由，查看完整的请求证据链
- **SSE 流式响应** — 支持流式输出透传
- **国际化** — 支持简体中文和英文
- **连接测试** — 测试 Provider 连通性并显示延迟

## 安装

### Linux (deb)

从 [Releases](https://github.com/cmyandlqs/Clair/releases) 下载最新 `.deb` 文件：

```bash
sudo dpkg -i Clair_0.1.0_amd64.deb
```

### Linux (AppImage)

从 [Releases](https://github.com/cmyandlqs/Clair/releases) 下载最新 `.AppImage` 文件：

```bash
chmod +x Clair_0.1.0_amd64.AppImage
./Clair_0.1.0_amd64.AppImage
```

## 使用流程

### 1. 创建 Provider

点击 **+ Add Provider**，填写 API 厂商信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| Name | Provider 名称 | `GLM` |
| Type | API 兼容类型 | `Anthropic-compatible` |
| Base URL | API 地址 | `https://open.bigmodel.cn/api/paas/v4` |
| API Key | 认证密钥 | `your-api-key` |
| Auth Scheme | 认证方式 | `x-api-key` 或 `Bearer` |
| Default Model | 默认模型 | `glm-4` |

### 2. 测试连接

点击 **Test Connection**，确认连接成功后状态变为 **Ready**。

### 3. 创建 Profile

| 字段 | 说明 | 示例 |
|------|------|------|
| Name | Profile 名称 | `GLM` |
| Provider | 绑定的 Provider | `GLM` |
| Route Path | 代理路由路径 | `/glm` |
| Command Name | 生成的命令名 | `claude-glm` |
| Model | 使用的模型 | `glm-4` |

### 4. 生成 Wrapper 脚本

选中 Profile 后，点击 **Regenerate Wrapper**，将生成：

- `~/.local/bin/claude-glm` — 启动脚本
- `~/.local/bin/profiles/claude-glm.settings.json` — Profile 配置文件

### 5. 启动代理

点击 **Start** 启动本地代理。状态指示灯变绿表示代理运行中。

### 6. 使用

```bash
claude-glm       # 启动 GLM 版 Claude Code
claude-minimax   # 启动 MiniMax 版
```

## 数据存储

| 文件 | 说明 |
|------|------|
| `~/.config/clair/clair.db` | SQLite 配置数据库 |
| `~/.local/bin/claude-*` | Wrapper 启动脚本 |
| `~/.local/bin/profiles/*.settings.json` | Profile 配置文件 |

## 安全说明

- 代理默认监听 `127.0.0.1`（仅本地访问）
- API Key 日志自动脱敏：`sk-****abcd`
- 认证 Token 使用 128-bit UUID
- Wrapper 脚本中的路径经过 Shell 转义防注入
- Settings 修改 host/port/token 后自动重启代理
- 删除 Provider 时检查 Profile 引用，防止误删

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + Framer Motion |
| 状态管理 | TanStack Query + Zustand |
| 后端 | Rust + Axum + SQLite |
| HTTP 代理 | Rust Axum |

## 开发

### 环境要求

- Node.js 18+
- Rust 1.75+ (via [rustup](https://rustup.rs))
- [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/)

### 常用命令

```bash
npm install              # 安装前端依赖
npm run dev              # Vite 开发服务器
npm run build            # 前端生产构建
cargo check              # Rust 类型检查
cargo test               # 运行测试 (23 tests)
cargo tauri dev          # 开发模式（热重载）
cargo tauri build        # 生产打包 (.deb + .AppImage)
```

## 项目结构

```
clair/
├── src/                        # 前端 React 代码
│   ├── components/
│   │   ├── layout/             # TopBar, Sidebar, MainLayout, DetailPanel
│   │   ├── provider/           # ProviderList, AddProviderModal, EditProviderModal
│   │   ├── profile/            # AddProfileModal, EditProfileModal
│   │   ├── settings/           # SettingsModal
│   │   └── common/             # Badge, Toast, TestResultModal, ErrorBoundary, ProviderAvatar
│   ├── hooks/                  # useProviders, useProfiles, useProxyStatus, useUIStore
│   ├── lib/                    # api.ts, types.ts, validators.ts, i18n.tsx
│   └── styles/                 # globals.css
├── src-tauri/                  # Rust 后端
│   └── src/
│       ├── commands/           # Tauri 命令处理
│       ├── domain/             # Provider, Profile, AppSettings
│       ├── db/                 # SQLite 操作 + 迁移
│       ├── proxy/              # HTTP 代理 (Axum)
│       ├── services/           # wrapper_service, provider_service, settings_service
│       └── security/           # API Key 脱敏、认证校验
├── doc/                        # 文档
│   ├── prd.md                  # 产品需求文档
│   ├── frontend-dev.md         # 前端开发规范
│   ├── backend-dev.md          # 后端开发指南
│   └── test.md                 # 测试用例
└── CLAUDE.md                   # Claude Code 开发指南
```

## License

MIT