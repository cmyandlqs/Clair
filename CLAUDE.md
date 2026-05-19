# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clair** is a Local Claude Provider Gateway - a Tauri 2 desktop application that enables running multiple Claude Code instances with different providers in parallel.

Architecture: Claude Code → Clair local proxy (127.0.0.1:28789) → Multiple Provider backends

Users generate wrapper scripts (e.g., `claude-glm`, `claude-minimax`) that launch Claude Code with per-profile `--settings` files to route requests through Clair's local proxy.

**Branches**: `main` (Windows, NSIS), `linux-dev` (Linux, deb/appimage). Both use `--settings` approach with platform-specific launcher scripts.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri 2 |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + Framer Motion |
| State | TanStack Query + Zustand |
| Backend | Rust + Axum + SQLite |
| HTTP Proxy | Rust Axum |

## Project Structure

```
clair/
├── src/                    # Frontend React code
│   ├── app/
│   │   └── App.tsx         # Root component with ErrorBoundary + QueryClient
│   ├── components/
│   │   ├── layout/         # MainLayout, TopBar, Sidebar, DetailPanel
│   │   ├── provider/       # ProviderList, AddProviderModal, EditProviderModal
│   │   ├── profile/        # AddProfileModal, EditProfileModal
│   │   ├── settings/       # SettingsModal
│   │   └── common/         # Badge, ProviderAvatar, Toast, TestResultModal, ErrorBoundary
│   ├── hooks/              # useProviders, useProfiles, useProxyStatus, useUIStore, useToast
│   ├── lib/                # api.ts (Tauri invoke), types.ts, validators.ts, i18n.tsx
│   └── styles/             # globals.css (CSS variables + component classes)
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers (provider, profile, proxy, wrapper, settings)
│   │   ├── domain/         # Domain models (Provider, Profile, AppSettings)
│   │   ├── db/             # SQLite operations (connection, migrations, CRUD)
│   │   ├── proxy/          # HTTP proxy server (Axum-based routing + forwarding)
│   │   ├── services/       # Business logic (wrapper_service, provider_service, settings_service, claude_detect_service)
│   │   └── security/       # Auth token handling, API key masking, input validation
│   └── tauri.conf.json
├── doc/
│   ├── prd.md             # Product requirements (source of truth)
│   ├── frontend-dev.md    # Frontend implementation guide + design system
│   ├── backend-dev.md     # Backend Rust modules guide
│   └── test.md            # Test cases & acceptance criteria
└── CLAUDE.md
```

## Key Features

1. **Provider Management**: CRUD for API providers (Anthropic-compatible, OpenAI-compatible)
2. **Profile Management**: Route path + command name + model override per Provider
3. **Local Proxy**: HTTP proxy on 127.0.0.1:28789 routing to upstream providers, with model rewriting and SSE streaming
4. **Wrapper Generation**: Launcher scripts (Linux: bash, Windows: `.cmd`) + per-profile `.settings.json` files
5. **Test Route**: End-to-end profile route testing with modal result display
6. **Evidence**: In-memory request log with model rewrite tracking

## Development Commands

```bash
# Frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production (includes tsc type check)

# Backend
cargo check          # Type check Rust
cargo build          # Build Rust
cargo test           # Run tests (23 tests)

# Tauri
cargo tauri dev     # Dev with hot reload
cargo tauri build   # Production build
```

## Database Schema

SQLite with tables:
- `providers` - Provider configurations (id, name, type, base_url, api_key, auth_scheme, default_model, status, etc.)
- `profiles` - Profile routing rules (id, name, route_path, provider_id, model, command_name, is_default, wrapper_enabled)
- `settings` - App settings (key-value pairs)
- `request_logs` - Proxy request logs (deprecated: now using in-memory evidence store)

## Security

- Proxy listens on `127.0.0.1` only (host validated in settings)
- API keys masked in logs: `sk-****abcd`
- Proxy auth token: full UUID (128-bit entropy)
- Wrapper scripts: embedded paths are shell-escaped to prevent injection
- Settings validation: host must be localhost, port >= 1024, token non-empty
- Provider deletion blocked if profiles reference it

## Code Conventions

- Components: Functional React with hooks
- Styling: Tailwind utility classes + CSS variables in `globals.css`
- Types: Zod schemas for form validation, TypeScript interfaces for static types
- State: TanStack Query for server state, Zustand for UI state (useUIStore)
- Tauri: Commands in `src-tauri/src/commands/`, invoked via `invoke()` from `api.ts`
- Backend errors: `Result<_, String>` pattern with `tracing::warn!` for non-fatal errors
- Mutex: Use `lock_safe()` helper (recovers from poison) instead of `.lock().unwrap()`
- File writes: Atomic via temp-file-then-rename pattern

## Documentation

- [doc/prd.md](doc/prd.md) - Full product requirements (primary source of truth)
- [doc/frontend-dev.md](doc/frontend-dev.md) - Frontend implementation with design system
- [doc/backend-dev.md](doc/backend-dev.md) - Backend Rust modules guide
- [doc/test.md](doc/test.md) - Test cases & acceptance criteria
