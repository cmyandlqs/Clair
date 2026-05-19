# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clair** is a Local Claude Provider Gateway - a Tauri desktop application that enables running multiple Claude Code instances with different providers in parallel.

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
│   ├── components/         # UI components (layout, provider, profile, common)
│   ├── hooks/              # Custom hooks (useProviders, useProfiles, useProxyStatus)
│   ├── lib/                # API封装、类型定义、表单校验
│   └── styles/            # Global CSS & design tokens
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri command handlers
│   │   ├── domain/         # Domain models
│   │   ├── db/             # SQLite operations
│   │   ├── proxy/         # HTTP proxy server
│   │   ├── services/      # Business logic services
│   │   ├── security/      # Auth token, API key handling
│   │   └── utils/         # Utilities
│   └── tauri.conf.json
├── doc/
│   ├── prd.md             # Product requirements (source of truth)
│   ├── frontend-dev.md    # Frontend implementation guide + design system
│   ├── backend-dev.md     # Backend Rust modules guide
│   └── test.md            # Test cases & acceptance criteria
├── UI参考/                 # UI reference images
└── CLAUDE.md
```

## Design System (from UI参考)

**Color Palette**:
- Primary: `#E67E50` (Terracotta Orange - Designer)
- Background: `#F9F9F9` (Warm gray canvas)
- Surface: `#FFFFFF` (Pure white cards)
- Border: `#EDEDED` (Subtle borders)
- Success: `#52C41A`
- Warning: `#FAAD14`
- Error: `#F5222D`

**Typography**:
- Font: SF Pro Display (system), fallback: -apple-system, BlinkMacSystemFont, sans-serif
- Title: 18px/600, Heading: 15-16px/600, Body: 14px/400

**Spacing** (8px grid):
- Page margin: 24px
- Card gap: 16px
- Card padding: 20px
- Form field gap: 16px

**Components**:
- Card radius: 12px
- Button radius: 8px
- Icon stroke: 1.5pt
- Shadow: soft, no harsh shadows

**Motion**:
- Duration: 150-220ms
- Easing: ease-out
- Modal: scale 0.95 → 1
- Hover: subtle lift (-2px translateY)

## Key Features

1. **Provider Management**: CRUD for API providers (Anthropic-compatible, OpenAI-compatible)
2. **Profile Management**: Route path + command name + model override per Provider
3. **Local Proxy**: HTTP proxy on 127.0.0.1:18789 routing to upstream providers
4. **Wrapper Generation**: Launcher scripts in wrapper dir (Windows: `.cmd`, Linux: bash) + per-profile `.settings.json` files
5. **Streaming**: SSE response passthrough from providers

## Development Commands

```bash
# Frontend
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview       # Preview production build

# Backend
cargo check          # Type check Rust
cargo build          # Build Rust
cargo test           # Run tests

# Tauri
cargo tauri dev     # Dev with hot reload
cargo tauri build   # Production build
```

## Database Schema

SQLite database with tables:
- `providers` - Provider configurations
- `profiles` - Profile routing rules
- `settings` - App settings
- `request_logs` - Proxy request logs

## Security Notes

- Default proxy listens on `127.0.0.1` (not 0.0.0.0)
- API keys masked in logs: `sk-****abcd`
- Export configuration excludes secrets by default
- Provider deletion checks for Profile references

## Documentation

- [doc/prd.md](doc/prd.md) - Full product requirements (primary source of truth)
- [doc/frontend-dev.md](doc/frontend-dev.md) - Frontend implementation with design system
- [doc/backend-dev.md](doc/backend-dev.md) - Backend Rust modules guide
- [doc/test.md](doc/test.md) - 31 test cases + acceptance criteria

## Code Conventions

- Components: Functional React with hooks
- Styling: Tailwind utility classes + CSS variables for theme tokens
- Types: Zod schemas for validation, TypeScript for static types
- State: TanStack Query for server state, Zustand for UI state
- Tauri: Commands in `src-tauri/src/commands/`, invoked via `invoke()` from frontend