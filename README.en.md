# Clair

**Local Claude Provider Gateway** — Run multiple Claude Code instances with different providers in parallel.

[中文文档](./README.md)

---

## What It Does

Clair lets you launch multiple Claude Code instances with different providers simultaneously, each isolated from the others:

```bash
Terminal A: claude-glm       → GLM (Zhipu)
Terminal B: claude-minimax   → MiniMax
Terminal C: claude-deepseek  → DeepSeek
```

Each command corresponds to a Profile that routes through a local proxy to the designated API Provider, automatically rewriting model names and auth headers.

## How It Works

```
┌──────────────┐     ┌──────────────────────────┐     ┌──────────────┐
│  claude-glm  │────▶│                          │────▶│  GLM API     │
├──────────────┤     │  Clair Local Proxy        │     ├──────────────┤
│claude-minimax│────▶│  127.0.0.1:28789          │────▶│  MiniMax API  │
├──────────────┤     │                          │     ├──────────────┤
│claude-default│────▶│  Route: Profile → Provider│────▶│  Claude API  │
└──────────────┘     └──────────────────────────┘     └──────────────┘
```

1. **Provider** — Configure API vendor info (Base URL, API Key, auth scheme, default model)
2. **Profile** — Define routing rules (path, command name, model override) bound to a Provider
3. **Wrapper Script** — Generates `~/.local/bin/claude-xxx` executable scripts that inject config via `--settings` files
4. **Local Proxy** — Listens on `127.0.0.1:28789`, routes requests by path to the corresponding Provider

## Features

- **Provider Management** — Add, edit, test API Providers (Anthropic-compatible / OpenAI-compatible / Custom)
- **Profile Management** — Create multiple routing configs per Provider with custom command names and models
- **Local HTTP Proxy** — Transparent forwarding with automatic auth header replacement and model rewriting
- **Wrapper Script Generation** — One-click generation of `claude-xxx` command scripts + per-profile settings files
- **Route Testing** — End-to-end profile route testing with full request evidence chain
- **SSE Streaming** — Stream response pass-through support
- **i18n** — Simplified Chinese and English
- **Connection Testing** — Test Provider connectivity with latency display

## Installation

### Linux (deb)

Download the latest `.deb` from [Releases](https://github.com/cmyandlqs/Clair/releases):

```bash
sudo dpkg -i Clair_0.1.0_amd64.deb
```

### Linux (AppImage)

Download the latest `.AppImage` from [Releases](https://github.com/cmyandlqs/Clair/releases):

```bash
chmod +x Clair_0.1.0_amd64.AppImage
./Clair_0.1.0_amd64.AppImage
```

## Usage

### 1. Create a Provider

Click **+ Add Provider** and fill in the API vendor details:

| Field | Description | Example |
|-------|-------------|---------|
| Name | Provider name | `GLM` |
| Type | API compatibility type | `Anthropic-compatible` |
| Base URL | API endpoint | `https://open.bigmodel.cn/api/paas/v4` |
| API Key | Authentication key | `your-api-key` |
| Auth Scheme | Auth method | `x-api-key` or `Bearer` |
| Default Model | Default model | `glm-4` |

### 2. Test Connection

Click **Test Connection**. Status changes to **Ready** on success.

### 3. Create a Profile

| Field | Description | Example |
|-------|-------------|---------|
| Name | Profile name | `GLM` |
| Provider | Bound Provider | `GLM` |
| Route Path | Proxy route path | `/glm` |
| Command Name | Generated command name | `claude-glm` |
| Model | Model to use | `glm-4` |

### 4. Generate Wrapper Script

Select a Profile and click **Regenerate Wrapper**. This generates:

- `~/.local/bin/claude-glm` — Launcher script
- `~/.local/bin/profiles/claude-glm.settings.json` — Profile config file

### 5. Start Proxy

Click **Start** to launch the local proxy. The status indicator turns green when running.

### 6. Use

```bash
claude-glm       # Launch Claude Code with GLM provider
claude-minimax   # Launch Claude Code with MiniMax provider
```

## Data Storage

| File | Description |
|------|-------------|
| `~/.config/clair/clair.db` | SQLite configuration database |
| `~/.local/bin/claude-*` | Wrapper launcher scripts |
| `~/.local/bin/profiles/*.settings.json` | Profile config files |

## Security

- Proxy listens on `127.0.0.1` only (localhost, no network exposure)
- API keys automatically masked in logs: `sk-****abcd`
- Auth tokens use 128-bit UUIDs
- Wrapper script paths are shell-escaped to prevent injection
- Proxy auto-restarts on host/port/token changes
- Provider deletion blocked if referenced by Profiles

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri 2 |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Framer Motion |
| State Management | TanStack Query + Zustand |
| Backend | Rust + Axum + SQLite |
| HTTP Proxy | Rust Axum |

## Development

### Prerequisites

- Node.js 18+
- Rust 1.75+ (via [rustup](https://rustup.rs))
- [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/)

### Commands

```bash
npm install              # Install frontend dependencies
npm run dev              # Vite dev server
npm run build            # Frontend production build
cargo check              # Rust type check
cargo test               # Run tests (23 tests)
cargo tauri dev          # Dev mode (hot reload)
cargo tauri build        # Production build (.deb + .AppImage)
```

## Project Structure

```
clair/
├── src/                        # Frontend React code
│   ├── components/
│   │   ├── layout/             # TopBar, Sidebar, MainLayout, DetailPanel
│   │   ├── provider/           # ProviderList, AddProviderModal, EditProviderModal
│   │   ├── profile/            # AddProfileModal, EditProfileModal
│   │   ├── settings/           # SettingsModal
│   │   └── common/             # Badge, Toast, TestResultModal, ErrorBoundary, ProviderAvatar
│   ├── hooks/                  # useProviders, useProfiles, useProxyStatus, useUIStore
│   ├── lib/                    # api.ts, types.ts, validators.ts, i18n.tsx
│   └── styles/                 # globals.css
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── commands/           # Tauri command handlers
│       ├── domain/             # Provider, Profile, AppSettings
│       ├── db/                 # SQLite operations + migrations
│       ├── proxy/              # HTTP proxy (Axum)
│       ├── services/           # wrapper_service, provider_service, settings_service
│       └── security/           # API key masking, auth validation
├── doc/                        # Documentation
│   ├── prd.md                  # Product requirements
│   ├── frontend-dev.md         # Frontend development guide
│   ├── backend-dev.md          # Backend development guide
│   └── test.md                 # Test cases & acceptance criteria
└── CLAUDE.md                   # Claude Code development guide
```

## License

MIT