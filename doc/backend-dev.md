# Clair 后端开发文档

> 本文档基于 `doc/prd.md` 产品需求文档，定义 Clair 后端（Rust + Tauri）的具体实现细节。

---

## 1. 技术栈与项目结构

### 1.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Rust | 1.75+ | 编程语言 |
| Tauri | 2.x | 桌面框架 |
| Tokio | 1.x | 异步运行时 |
| Axum | 0.7.x | HTTP 框架 |
| Reqwest | 0.12.x | HTTP 客户端 |
| rusqlite | 0.32.x | SQLite 驱动 |
| Serde | 1.x | 序列化 |
| UUID | 1.x | ID 生成 |
| chrono | 0.4.x | 时间处理 |

### 1.2 项目结构

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── src/
│   ├── main.rs                 # 入口
│   ├── lib.rs                  # 库入口，注册所有 Tauri 命令
│   ├── commands/               # Tauri 命令处理器
│   │   ├── mod.rs
│   │   ├── provider.rs         # Provider CRUD + 测试
│   │   ├── profile.rs         # Profile CRUD + 路由测试
│   │   ├── proxy.rs           # 代理启动/停止/重载 + lock_safe 工具函数
│   │   ├── wrapper.rs         # Wrapper 生成/状态检查/路径诊断
│   │   └── settings.rs        # 设置读写 + 校验（host/port/token）
│   ├── domain/                 # 领域模型
│   │   ├── mod.rs
│   │   ├── provider.rs        # Provider struct + ProviderType/AuthScheme/ProviderStatus 枚举
│   │   ├── profile.rs         # Profile struct
│   │   └── settings.rs        # AppSettings struct + 默认值生成
│   ├── db/                     # SQLite 操作
│   │   ├── mod.rs             # CRUD 方法（connection helper 通过 lock_safe 恢复 poison）
│   │   ├── migrations.rs      # CREATE TABLE IF NOT EXISTS 迁移
│   │   └── connection.rs      # Database 封装 Mutex<Connection>
│   ├── proxy/                  # 本地代理服务
│   │   ├── mod.rs             # 导出 ProxyServer
│   │   └── server.rs          # Axum 服务器：路由、认证、转发、模型改写、SSE 流式、证据记录
│   ├── services/               # 业务服务
│   │   ├── mod.rs
│   │   ├── provider_service.rs # Provider 连接测试逻辑
│   │   ├── settings_service.rs # 设置加载 + 缺省值持久化
│   │   ├── wrapper_service.rs  # Wrapper 生成（shell 转义 + 原子写入）+ 状态检查
│   │   └── claude_detect_service.rs # Claude 二进制探测 + 版本验证
│   └── security/               # 安全相关
│       ├── mod.rs
│       ├── secret.rs          # API key 脱敏
│       └── validation.rs      # 路由路径/命令名/URL 校验
```

---

## 2. Cargo.toml 依赖

```toml
[package]
name = "clair"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { version = "2", features = ["devtools"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
axum = { version = "0.7", features = ["form", "json"] }
reqwest = { version = "0.12", features = ["json", "stream"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }
rusqlite = { version = "0.32", features = ["bundled"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "2"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["cors"] }
hyper = "1"
hyper-util = { version = "0.1", features = ["client", "server", "tokio"] }
http-body-util = "0.1"
bytes = "1"
anyhow = "1"

[profile.release]
strip = true
lto = true
codegen-units = 1
```

---

## 3. 领域模型

### 3.1 Provider

```rust
// src-tauri/src/domain/provider.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    AnthropicCompatible,
    OpenaiCompatible,
    Custom,
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::AnthropicCompatible => write!(f, "anthropic_compatible"),
            ProviderType::OpenaiCompatible => write!(f, "openai_compatible"),
            ProviderType::Custom => write!(f, "custom"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthScheme {
    XApiKey,
    Bearer,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderStatus {
    Ready,
    Untested,
    Error,
    Disabled,
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
    pub status: ProviderStatus,
    pub last_tested_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

### 3.2 Profile

```rust
// src-tauri/src/domain/profile.rs

use serde::{Deserialize, Serialize};

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

### 3.3 Settings

```rust
// src-tauri/src/domain/settings.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub proxy_host: String,
    pub proxy_port: u16,
    pub proxy_auth_token: String,
    pub start_proxy_on_launch: bool,
    pub start_app_on_login: bool,
    pub minimize_to_tray: bool,
    pub wrapper_dir: String,
    pub claude_binary_path: Option<String>,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            proxy_host: "127.0.0.1".to_string(),
            proxy_port: 18789,
            proxy_auth_token: generate_local_token(),
            start_proxy_on_launch: true,
            start_app_on_login: false,
            minimize_to_tray: true,
            wrapper_dir: dirs::home_dir()
                .map(|p| p.join(".local/bin").to_string_lossy().to_string())
                .unwrap_or_else(|| "~/.local/bin".to_string()),
            claude_binary_path: None,
            theme: "system".to_string(),
        }
    }
}

fn generate_local_token() -> String {
    use uuid::Uuid;
    format!("clair-{}", Uuid::new_v4().to_string().split('-').next().unwrap())
}
```

---

## 4. 数据库

### 4.1 连接管理

```rust
// src-tauri/src/db/connection.rs

use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: PathBuf) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn connection(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap()
    }
}

unsafe impl Send for Database {}
unsafe impl Sync for Database {}
```

### 4.2 迁移脚本

```rust
// src-tauri/src/db/migrations.rs

use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS providers (
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

        CREATE TABLE IF NOT EXISTS profiles (
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

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS request_logs (
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

        CREATE INDEX IF NOT EXISTS idx_profiles_route_path ON profiles(route_path);
        CREATE INDEX IF NOT EXISTS idx_profiles_provider_id ON profiles(provider_id);
        CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_request_logs_profile_id ON request_logs(profile_id);
        "#,
    )?;

    Ok(())
}
```

### 4.3 Repository 实现

```rust
// src-tauri/src/db/mod.rs

pub mod connection;
pub mod migrations;

pub use connection::Database;

use crate::domain::{Provider, Profile, ProviderType, AuthScheme, ProviderStatus};
use chrono::Utc;
use rusqlite::params;

impl Database {
    // ============ Provider Repository ============

    pub fn list_providers(&self) -> rusqlite::Result<Vec<Provider>> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, provider_type, base_url, api_key, auth_scheme,
                    default_model, enable_streaming, notes, status, last_tested_at,
                    created_at, updated_at FROM providers ORDER BY name"
        )?;

        let providers = stmt.query_map([], |row| {
            Ok(Provider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: parse_provider_type(&row.get::<_, String>(2)?),
                base_url: row.get(3)?,
                api_key: row.get(4)?,
                auth_scheme: parse_auth_scheme(&row.get::<_, String>(5)?),
                default_model: row.get(6)?,
                enable_streaming: row.get::<_, i32>(7)? == 1,
                notes: row.get(8)?,
                status: parse_provider_status(&row.get::<_, String>(9)?),
                last_tested_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(providers)
    }

    pub fn create_provider(&self, provider: &Provider) -> rusqlite::Result<()> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO providers (id, name, provider_type, base_url, api_key,
             auth_scheme, default_model, enable_streaming, notes, status,
             created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                provider.id,
                provider.name,
                provider.provider_type.to_string(),
                provider.base_url,
                provider.api_key,
                provider.auth_scheme.to_string(),
                provider.default_model,
                provider.enable_streaming as i32,
                provider.notes,
                provider.status.to_string(),
                provider.created_at,
                provider.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_provider(&self, id: &str) -> rusqlite::Result<Option<Provider>> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, provider_type, base_url, api_key, auth_scheme,
                    default_model, enable_streaming, notes, status, last_tested_at,
                    created_at, updated_at FROM providers WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Provider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: parse_provider_type(&row.get::<_, String>(2)?),
                base_url: row.get(3)?,
                api_key: row.get(4)?,
                auth_scheme: parse_auth_scheme(&row.get::<_, String>(5)?),
                default_model: row.get(6)?,
                enable_streaming: row.get::<_, i32>(7)? == 1,
                notes: row.get(8)?,
                status: parse_provider_status(&row.get::<_, String>(9)?),
                last_tested_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_provider(&self, provider: &Provider) -> rusqlite::Result<()> {
        let conn = self.connection()?;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE providers SET name = ?1, provider_type = ?2, base_url = ?3,
             api_key = ?4, auth_scheme = ?5, default_model = ?6, enable_streaming = ?7,
             notes = ?8, status = ?9, last_tested_at = ?10, updated_at = ?11
             WHERE id = ?12",
            params![
                provider.name,
                provider.provider_type.to_string(),
                provider.base_url,
                provider.api_key,
                provider.auth_scheme.to_string(),
                provider.default_model,
                provider.enable_streaming as i32,
                provider.notes,
                provider.status.to_string(),
                provider.last_tested_at,
                now,
                provider.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_provider(&self, id: &str) -> rusqlite::Result<bool> {
        let conn = self.connection()?;
        let affected = conn.execute("DELETE FROM providers WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }

    pub fn provider_has_profiles(&self, id: &str) -> rusqlite::Result<bool> {
        let conn = self.connection()?;
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM profiles WHERE provider_id = ?1",
            params![id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    // ============ Profile Repository ============

    pub fn list_profiles(&self) -> rusqlite::Result<Vec<Profile>> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, route_path, provider_id, model, command_name,
                    is_default, wrapper_enabled, wrapper_path, created_at, updated_at
             FROM profiles ORDER BY is_default DESC, name"
        )?;

        let profiles = stmt.query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                route_path: row.get(2)?,
                provider_id: row.get(3)?,
                model: row.get(4)?,
                command_name: row.get(5)?,
                is_default: row.get::<_, i32>(6)? == 1,
                wrapper_enabled: row.get::<_, i32>(7)? == 1,
                wrapper_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(profiles)
    }

    pub fn create_profile(&self, profile: &Profile) -> rusqlite::Result<()> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO profiles (id, name, route_path, provider_id, model, command_name,
             is_default, wrapper_enabled, wrapper_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                profile.id,
                profile.name,
                profile.route_path,
                profile.provider_id,
                profile.model,
                profile.command_name,
                profile.is_default as i32,
                profile.wrapper_enabled as i32,
                profile.wrapper_path,
                profile.created_at,
                profile.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_profile_by_route(&self, route: &str) -> rusqlite::Result<Option<Profile>> {
        let conn = self.connection()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, route_path, provider_id, model, command_name,
                    is_default, wrapper_enabled, wrapper_path, created_at, updated_at
             FROM profiles WHERE route_path = ?1"
        )?;

        let mut rows = stmt.query(params![route])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                route_path: row.get(2)?,
                provider_id: row.get(3)?,
                model: row.get(4)?,
                command_name: row.get(5)?,
                is_default: row.get::<_, i32>(6)? == 1,
                wrapper_enabled: row.get::<_, i32>(7)? == 1,
                wrapper_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_profile(&self, profile: &Profile) -> rusqlite::Result<()> {
        let conn = self.connection()?;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE profiles SET name = ?1, route_path = ?2, provider_id = ?3, model = ?4,
             command_name = ?5, is_default = ?6, wrapper_enabled = ?7, wrapper_path = ?8,
             updated_at = ?9 WHERE id = ?10",
            params![
                profile.name,
                profile.route_path,
                profile.provider_id,
                profile.model,
                profile.command_name,
                profile.is_default as i32,
                profile.wrapper_enabled as i32,
                profile.wrapper_path,
                now,
                profile.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_profile(&self, id: &str) -> rusqlite::Result<bool> {
        let conn = self.connection()?;
        let affected = conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }

    pub fn clear_default_profile(&self) -> rusqlite::Result<()> {
        let conn = self.connection()?;
        conn.execute("UPDATE profiles SET is_default = 0 WHERE is_default = 1", [])?;
        Ok(())
    }

    pub fn set_default_profile(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.connection()?;
        conn.execute("UPDATE profiles SET is_default = 0", [])?;
        conn.execute("UPDATE profiles SET is_default = 1 WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ============ Helper Functions ============

fn parse_provider_type(s: &str) -> ProviderType {
    match s {
        "anthropic_compatible" => ProviderType::AnthropicCompatible,
        "openai_compatible" => ProviderType::OpenaiCompatible,
        _ => ProviderType::Custom,
    }
}

fn parse_auth_scheme(s: &str) -> AuthScheme {
    match s {
        "bearer" => AuthScheme::Bearer,
        _ => AuthScheme::XApiKey,
    }
}

fn parse_provider_status(s: &str) -> ProviderStatus {
    match s {
        "ready" => ProviderStatus::Ready,
        "error" => ProviderStatus::Error,
        "disabled" => ProviderStatus::Disabled,
        _ => ProviderStatus::Untested,
    }
}
```

---

## 5. Tauri Commands

### 5.1 Provider Commands

```rust
// src-tauri/src/commands/provider.rs

use crate::db::Database;
use crate::domain::{Provider, ProviderType, AuthScheme, ProviderStatus};
use crate::services::provider_service::ProviderService;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateProviderInput {
    pub name: String,
    #[serde(rename = "type")]
    pub provider_type: ProviderType,
    pub base_url: String,
    pub api_key: String,
    pub auth_scheme: AuthScheme,
    pub default_model: String,
    pub enable_streaming: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProviderInput {
    pub id: String,
    pub name: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub auth_scheme: Option<AuthScheme>,
    pub default_model: Option<String>,
    pub enable_streaming: Option<bool>,
    pub notes: Option<String>,
    pub status: Option<ProviderStatus>,
}

#[derive(Debug, Serialize)]
pub struct TestProviderResult {
    pub ok: bool,
    pub latency_ms: Option<u64>,
    pub message: String,
    pub model: Option<String>,
    pub streaming_supported: Option<bool>,
}

#[tauri::command]
pub async fn list_providers(db: State<'_, Database>) -> Result<Vec<Provider>, String> {
    db.list_providers().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_provider(
    db: State<'_, Database>,
    input: CreateProviderInput,
) -> Result<Provider, String> {
    let now = Utc::now().to_rfc3339();
    let provider = Provider {
        id: Uuid::new_v4().to_string(),
        name: input.name,
        provider_type: input.provider_type,
        base_url: input.base_url,
        api_key: input.api_key,
        auth_scheme: input.auth_scheme,
        default_model: input.default_model,
        enable_streaming: input.enable_streaming,
        notes: input.notes,
        status: ProviderStatus::Untested,
        last_tested_at: None,
        created_at: now.clone(),
        updated_at: now,
    };

    db.create_provider(&provider).map_err(|e| e.to_string())?;
    Ok(provider)
}

#[tauri::command]
pub async fn update_provider(
    db: State<'_, Database>,
    input: UpdateProviderInput,
) -> Result<Provider, String> {
    let mut provider = db.get_provider(&input.id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;

    if let Some(name) = input.name {
        provider.name = name;
    }
    if let Some(base_url) = input.base_url {
        provider.base_url = base_url;
    }
    if let Some(api_key) = input.api_key {
        provider.api_key = api_key;
    }
    if let Some(auth_scheme) = input.auth_scheme {
        provider.auth_scheme = auth_scheme;
    }
    if let Some(default_model) = input.default_model {
        provider.default_model = default_model;
    }
    if let Some(enable_streaming) = input.enable_streaming {
        provider.enable_streaming = enable_streaming;
    }
    if let Some(notes) = input.notes {
        provider.notes = Some(notes);
    }
    if let Some(status) = input.status {
        provider.status = status;
    }

    db.update_provider(&provider).map_err(|e| e.to_string())?;
    Ok(provider)
}

#[tauri::command]
pub async fn delete_provider(db: State<'_, Database>, id: String) -> Result<bool, String> {
    // Check if provider is used by any profiles
    if db.provider_has_profiles(&id).map_err(|e| e.to_string())? {
        return Err("Provider is used by existing profiles. Please delete or reassign them first.".to_string());
    }

    db.delete_provider(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_provider(
    db: State<'_, Database>,
    id: String,
) -> Result<TestProviderResult, String> {
    let provider = db.get_provider(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;

    ProviderService::test_provider(&provider).await.map_err(|e| e.to_string())
}
```

### 5.2 Profile Commands

```rust
// src-tauri/src/commands/profile.rs

use crate::db::Database;
use crate::domain::Profile;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateProfileInput {
    pub name: String,
    pub route_path: String,
    pub provider_id: String,
    pub model: String,
    pub command_name: String,
    pub is_default: bool,
    pub wrapper_enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileInput {
    pub id: String,
    pub name: Option<String>,
    pub route_path: Option<String>,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub command_name: Option<String>,
    pub is_default: Option<bool>,
    pub wrapper_enabled: Option<bool>,
}

#[tauri::command]
pub async fn list_profiles(db: State<'_, Database>) -> Result<Vec<Profile>, String> {
    db.list_profiles().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_profile(
    db: State<'_, Database>,
    input: CreateProfileInput,
) -> Result<Profile, String> {
    // Validate route path
    if !input.route_path.starts_with('/') {
        return Err("Route path must start with /".to_string());
    }

    // Check for reserved routes
    let reserved = ["/health", "/status", "/api", "/admin", "/logs"];
    if reserved.contains(&input.route_path.as_str()) {
        return Err("This route path is reserved".to_string());
    }

    // Check for duplicate routes
    if db.get_profile_by_route(&input.route_path).map_err(|e| e.to_string())?.is_some() {
        return Err("Route path already exists".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let mut profile = Profile {
        id: Uuid::new_v4().to_string(),
        name: input.name,
        route_path: input.route_path,
        provider_id: input.provider_id,
        model: input.model,
        command_name: input.command_name,
        is_default: input.is_default,
        wrapper_enabled: input.wrapper_enabled,
        wrapper_path: None,
        created_at: now.clone(),
        updated_at: now,
    };

    // Handle default profile
    if profile.is_default {
        db.clear_default_profile().map_err(|e| e.to_string())?;
    }

    db.create_profile(&profile).map_err(|e| e.to_string())?;

    // Generate wrapper if enabled
    if profile.wrapper_enabled {
        if let Ok(wrapper_path) = ProfileService::generate_wrapper(&profile) {
            profile.wrapper_path = Some(wrapper_path);
        }
    }

    Ok(profile)
}

#[tauri::command]
pub async fn update_profile(
    db: State<'_, Database>,
    input: UpdateProfileInput,
) -> Result<Profile, String> {
    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let mut profile = profiles.into_iter()
        .find(|p| p.id == input.id)
        .ok_or_else(|| "Profile not found".to_string())?;

    if let Some(name) = input.name {
        profile.name = name;
    }
    if let Some(route_path) = input.route_path {
        profile.route_path = route_path;
    }
    if let Some(provider_id) = input.provider_id {
        profile.provider_id = provider_id;
    }
    if let Some(model) = input.model {
        profile.model = model;
    }
    if let Some(command_name) = input.command_name {
        profile.command_name = command_name;
    }
    if let Some(is_default) = input.is_default {
        if is_default {
            db.clear_default_profile().map_err(|e| e.to_string())?;
        }
        profile.is_default = is_default;
    }
    if let Some(wrapper_enabled) = input.wrapper_enabled {
        profile.wrapper_enabled = wrapper_enabled;
    }

    db.update_profile(&profile).map_err(|e| e.to_string())?;
    Ok(profile)
}

#[tauri::command]
pub async fn delete_profile(db: State<'_, Database>, id: String) -> Result<bool, String> {
    db.delete_profile(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_default_profile(db: State<'_, Database>, id: String) -> Result<Profile, String> {
    db.set_default_profile(&id).map_err(|e| e.to_string())?;

    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    profiles.into_iter()
        .find(|p| p.id == id)
        .ok_or_else(|| "Profile not found".to_string())
}
```

### 5.3 Proxy Commands

```rust
// src-tauri/src/commands/proxy.rs

use serde::{Deserialize, Serialize};
use crate::proxy::ProxyServer;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Serialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub host: String,
    pub port: u16,
    pub active_routes: Vec<ActiveRoute>,
}

#[derive(Debug, Serialize)]
pub struct ActiveRoute {
    pub route_path: String,
    pub profile_name: String,
    pub provider_name: String,
}

pub struct ProxyState {
    pub server: Option<Arc<RwLock<ProxyServer>>>,
}

impl ProxyState {
    pub fn new() -> Self {
        Self { server: None }
    }
}

#[tauri::command]
pub async fn get_proxy_status(state: tauri::State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    let status = state.server.read().await;

    if let Some(server) = status.server.as_ref() {
        let server = server.read().await;
        Ok(ProxyStatus {
            running: true,
            host: server.host.clone(),
            port: server.port,
            active_routes: server.get_active_routes().await,
        })
    } else {
        Ok(ProxyStatus {
            running: false,
            host: "127.0.0.1".to_string(),
            port: 18789,
            active_routes: vec![],
        })
    }
}

#[tauri::command]
pub async fn start_proxy(
    state: tauri::State<'_, ProxyState>,
    db: tauri::State<'_, Database>,
) -> Result<ProxyStatus, String> {
    // Stop existing server first
    {
        let mut server = state.server.write().await;
        if let Some(s) = server.server.take() {
            let s = s.read().await;
            s.shutdown().await;
        }
    }

    // Load config from database
    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let providers = db.list_providers().map_err(|e| e.to_string())?;

    // Create and start new server
    let server = ProxyServer::new("127.0.0.1".to_string(), 18789, profiles, providers)
        .map_err(|e| e.to_string())?;

    let addr = format!("127.0.0.1:18789");
    let listener = tokio::net::TcpListener::bind(&addr).await.map_err(|e| e.to_string())?;

    let server = Arc::new(RwLock::new(server));
    let server_clone = server.clone();

    tokio::spawn(async move {
        let app = server_clone.read().await.build_router();
        axum::serve(listener, app).await.ok();
    });

    {
        let mut state_server = state.server.write().await;
        state_server.server = Some(server);
    }

    Ok(ProxyStatus {
        running: true,
        host: "127.0.0.1".to_string(),
        port: 18789,
        active_routes: vec![],
    })
}

#[tauri::command]
pub async fn stop_proxy(state: tauri::State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    let mut server = state.server.write().await;
    if let Some(s) = server.server.take() {
        let s = s.read().await;
        s.shutdown().await;
    }

    Ok(ProxyStatus {
        running: false,
        host: "127.0.0.1".to_string(),
        port: 18789,
        active_routes: vec![],
    })
}

#[tauri::command]
pub async fn restart_proxy(
    state: tauri::State<'_, ProxyState>,
    db: tauri::State<'_, Database>,
) -> Result<ProxyStatus, String> {
    drop(state.server.write().await);
    start_proxy(state, db).await
}
```

### 5.4 Wrapper Commands

```rust
// src-tauri/src/commands/wrapper.rs

use crate::db::Database;
use crate::services::wrapper_service::WrapperService;
use crate::services::claude_detect_service::ClaudeDetectService;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ClaudeBinaryDetection {
    pub found: bool,
    pub path: Option<String>,
    pub candidates: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct GenerateWrapperResult {
    pub success: bool,
    pub path: String,
    pub command_name: String,
}

#[derive(Debug, Serialize)]
pub struct WrapperStatus {
    pub exists: bool,
    pub executable: bool,
    pub path: Option<String>,
    pub in_path: bool,
    pub stale: bool,
}

#[tauri::command]
pub async fn detect_claude_binary() -> Result<ClaudeBinaryDetection, String> {
    ClaudeDetectService::detect().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_wrapper(
    db: tauri::State<'_, Database>,
    profile_id: String,
) -> Result<GenerateWrapperResult, String> {
    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let profile = profiles.into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let path = WrapperService::generate(&profile).map_err(|e| e.to_string())?;

    Ok(GenerateWrapperResult {
        success: true,
        path,
        command_name: profile.command_name,
    })
}

#[tauri::command]
pub async fn generate_all_wrappers(
    db: tauri::State<'_, Database>,
) -> Result<Vec<GenerateWrapperResult>, String> {
    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let mut results = vec![];

    for profile in profiles {
        if profile.wrapper_enabled {
            match WrapperService::generate(&profile) {
                Ok(path) => {
                    results.push(GenerateWrapperResult {
                        success: true,
                        path,
                        command_name: profile.command_name,
                    });
                }
                Err(e) => {
                    results.push(GenerateWrapperResult {
                        success: false,
                        path: e.to_string(),
                        command_name: profile.command_name,
                    });
                }
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn check_wrapper_status(
    db: tauri::State<'_, Database>,
    profile_id: String,
) -> Result<WrapperStatus, String> {
    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let profile = profiles.into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    WrapperService::check_status(&profile).map_err(|e| e.to_string())
}
```

### 5.5 Settings Commands

```rust
// src-tauri/src/commands/settings.rs

use crate::db::Database;
use crate::domain::settings::AppSettings;
use serde::{Deserialize, Serialize};
use tauri::State;

#[tauri::command]
pub async fn get_settings(db: tauri::State<'_, Database>) -> Result<AppSettings, String> {
    // Load from database, return defaults if not set
    Ok(AppSettings::default())
}

#[tauri::command]
pub async fn update_settings(
    db: tauri::State<'_, Database>,
    input: Partial<AppSettings>,
) -> Result<AppSettings, String> {
    // For MVP, settings are stored in memory or simple JSON file
    // Future: persist to database
    let mut settings = AppSettings::default();

    if let Some(proxy_host) = input.proxy_host {
        settings.proxy_host = proxy_host;
    }
    if let Some(proxy_port) = input.proxy_port {
        settings.proxy_port = proxy_port;
    }
    if let Some(proxy_auth_token) = input.proxy_auth_token {
        settings.proxy_auth_token = proxy_auth_token;
    }
    if let Some(start_proxy_on_launch) = input.start_proxy_on_launch {
        settings.start_proxy_on_launch = start_proxy_on_launch;
    }
    if let Some(start_app_on_login) = input.start_app_on_login {
        settings.start_app_on_login = start_app_on_login;
    }
    if let Some(minimize_to_tray) = input.minimize_to_tray {
        settings.minimize_to_tray = minimize_to_tray;
    }
    if let Some(wrapper_dir) = input.wrapper_dir {
        settings.wrapper_dir = wrapper_dir;
    }
    if let Some(claude_binary_path) = input.claude_binary_path {
        settings.claude_binary_path = Some(claude_binary_path);
    }
    if let Some(theme) = input.theme {
        settings.theme = theme;
    }

    Ok(settings)
}
```

---

## 6. 本地代理服务

### 6.1 Proxy Server

```rust
// src-tauri/src/proxy/server.rs

use crate::domain::{Profile, Provider};
use axum::{
    body::Body,
    extract::{Path, State},
    http::{Request, StatusCode},
    middleware,
    response::Response,
    routing::{any, get},
    Router,
};
use bytes::Bytes;
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use tower::ServiceBuilder;

pub struct ProxyServer {
    pub host: String,
    pub port: u16,
    pub profiles: Vec<Profile>,
    pub providers: HashMap<String, Provider>,
    client: reqwest::Client,
}

impl ProxyServer {
    pub fn new(host: String, port: u16, profiles: Vec<Profile>, providers: Vec<Provider>) -> Result<Self, String> {
        let providers: HashMap<String, Provider> = providers.into_iter()
            .map(|p| (p.id.clone(), p))
            .collect();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        Ok(Self {
            host,
            port,
            profiles,
            providers,
            client,
        })
    }

    pub fn build_router(&self) -> Router {
        let state = Arc::new(self.clone());

        Router::new()
            .route("/health", get(Self::health_handler))
            .route("/status", get(Self::status_handler))
            .route("/*path", any(Self::proxy_handler))
            .with_state(state)
    }

    async fn health_handler() -> &'static str {
        "ok"
    }

    async fn status_handler(State(state): State<Arc<ProxyServer>>) -> String {
        let profiles = state.profiles.len();
        let providers = state.providers.len();
        format!("Clair Proxy: {} profiles, {} providers", profiles, providers)
    }

    async fn proxy_handler(
        State(state): State<Arc<ProxyServer>>,
        Path(path): Path<String>,
        request: Request<Body>,
    ) -> Response {
        // Parse route from path
        let parts: Vec<&str> = path.splitn(2, '/').filter(|s| !s.is_empty()).collect();
        if parts.is_empty() {
            return Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Body::from("Route not found"))
                .unwrap();
        }

        let route = format!("/{}", parts[0]);
        let remaining_path = parts.get(1).map(|p| format!("/{}", p)).unwrap_or_default();

        // Find profile by route
        let profile = match state.profiles.iter().find(|p| p.route_path == route) {
            Some(p) => p,
            None => {
                return Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Body::from(format!("Profile not found for route: {}", route)))
                    .unwrap();
            }
        };

        // Get provider
        let provider = match state.providers.get(&profile.provider_id) {
            Some(p) => p,
            None => {
                return Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(Body::from("Provider not found"))
                    .unwrap();
            }
        };

        // Build upstream URL
        let upstream_url = format!("{}{}", provider.base_url.trim_end_matches('/'), remaining_path);

        // Forward request
        match state.forward_request(&upstream_url, provider, profile, request).await {
            Ok(response) => response,
            Err(e) => {
                let error_body = serde_json::json!({
                    "type": "error",
                    "error": {
                        "type": "provider_connection_error",
                        "message": e.to_string()
                    }
                }).to_string();

                Response::builder()
                    .status(StatusCode::BAD_GATEWAY)
                    .header("Content-Type", "application/json")
                    .body(Body::from(error_body))
                    .unwrap()
            }
        }
    }

    async fn forward_request(
        &self,
        upstream_url: &str,
        provider: &Provider,
        profile: &Profile,
        request: Request<Body>,
    ) -> Result<Response, String> {
        let mut req_builder = self.client.request(
            request.method().clone(),
            upstream_url,
        );

        // Set auth header based on provider auth scheme
        match provider.auth_scheme {
            crate::domain::AuthScheme::XApiKey => {
                req_builder = req_builder.header("x-api-key", &provider.api_key);
            }
            crate::domain::AuthScheme::Bearer => {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", provider.api_key));
            }
        }

        // Copy headers (filtered)
        for (key, value) in request.headers() {
            let key_str = key.as_str();
            // Filter out auth headers that will be replaced
            if key_str.eq_ignore_ascii_case("authorization")
                || key_str.eq_ignore_ascii_case("x-api-key")
                || key_str.eq_ignore_ascii_case("host")
                || key_str.eq_ignore_ascii_case("content-length")
            {
                continue;
            }
            req_builder = req_builder.header(key_str, value);
        }

        // Collect body
        let body = hyper::body::to_bytes(request.into_body())
            .await
            .map_err(|e| e.to_string())?
            .to_vec();

        // Override model in body if present
        let body = if let Ok(mut json) = serde_json::from_slice::<serde_json::Value>(&body) {
            if json.get("model").is_some() {
                json["model"] = serde_json::Value::String(profile.model.clone());
                serde_json::to_vec(&json).map_err(|e| e.to_string())?
            } else {
                body
            }
        } else {
            body
        };

        req_builder = req_builder.body(body);

        // Send request
        let response = req_builder.send().await.map_err(|e| e.to_string())?;

        let status = response.status();
        let headers = response.headers().clone();

        let stream = response.bytes_stream();

        Response::builder()
            .status(status)
            .header("Content-Type", headers.get("content-type").map(|v| v.to_str().unwrap_or("application/json")).unwrap_or("application/json"))
            .body(Body::from_stream(stream))
            .map_err(|e| e.to_string())
    }

    pub async fn shutdown(&self) {
        // For graceful shutdown, implement signal handling
    }

    pub async fn get_active_routes(&self) -> Vec<ActiveRoute> {
        self.profiles.iter().map(|p| {
            let provider_name = self.providers.get(&p.provider_id)
                .map(|pr| pr.name.clone())
                .unwrap_or_default();
            ActiveRoute {
                route_path: p.route_path.clone(),
                profile_name: p.name.clone(),
                provider_name,
            }
        }).collect()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ActiveRoute {
    pub route_path: String,
    pub profile_name: String,
    pub provider_name: String,
}

impl Clone for ProxyServer {
    fn clone(&self) -> Self {
        Self {
            host: self.host.clone(),
            port: self.port,
            profiles: self.profiles.clone(),
            providers: self.providers.clone(),
            client: self.client.clone(),
        }
    }
}
```

---

## 7. Services

### 7.1 Provider Service

```rust
// src-tauri/src/services/provider_service.rs

use crate::domain::{Provider, ProviderStatus};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Serialize)]
pub struct TestProviderResult {
    pub ok: bool,
    pub latency_ms: Option<u64>,
    pub message: String,
    pub model: Option<String>,
    pub streaming_supported: Option<bool>,
}

pub struct ProviderService;

impl ProviderService {
    pub async fn test_provider(provider: &Provider) -> Result<TestProviderResult, String> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("{}/v1/messages", provider.base_url.trim_end_matches('/'));

        let request_body = serde_json::json!({
            "model": provider.default_model,
            "messages": [{"role": "user", "content": "Say ok."}],
            "max_tokens": 8
        });

        let start = Instant::now();

        let mut req_builder = client.post(&url)
            .header("Content-Type", "application/json");

        match provider.auth_scheme {
            crate::domain::AuthScheme::XApiKey => {
                req_builder = req_builder.header("x-api-key", &provider.api_key);
            }
            crate::domain::AuthScheme::Bearer => {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", provider.api_key));
            }
        }

        let response = req_builder
            .body(request_body.to_string())
            .send()
            .await;

        let latency_ms = start.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    Ok(TestProviderResult {
                        ok: true,
                        latency_ms: Some(latency_ms),
                        message: "Connected".to_string(),
                        model: Some(provider.default_model.clone()),
                        streaming_supported: Some(provider.enable_streaming),
                    })
                } else {
                    let error_message = match resp.status().as_u16() {
                        401 => "401 Unauthorized: Please check API key or auth scheme.",
                        403 => "403 Forbidden: Please check API key permissions.",
                        404 => "404 Not Found: Please check base URL.",
                        _ => &resp.status().canonical_reason().unwrap_or("Unknown error"),
                    };

                    Ok(TestProviderResult {
                        ok: false,
                        latency_ms: Some(latency_ms),
                        message: error_message.to_string(),
                        model: None,
                        streaming_supported: None,
                    })
                }
            }
            Err(e) => {
                let message = if e.is_timeout() {
                    "Timeout: Provider did not respond within 15s.".to_string()
                } else if e.is_connect() {
                    "Connection failed: Please check base URL.".to_string()
                } else {
                    e.to_string()
                };

                Ok(TestProviderResult {
                    ok: false,
                    latency_ms: Some(latency_ms),
                    message,
                    model: None,
                    streaming_supported: None,
                })
            }
        }
    }
}
```

### 7.2 Wrapper Service

Wrapper 生成逻辑位于 `src-tauri/src/services/wrapper_service.rs`，核心功能：

- **`generate(profile, settings)`** — 生成 wrapper 脚本 + `.settings.json` 文件，使用 `--settings` 方案（而非环境变量 `export`）
- **`check_status(profile, settings)`** — 检查 wrapper 脚本和 settings 文件的存在性、可执行性、新鲜度
- **`diagnose_wrapper_path(settings)`** — 诊断 wrapper 目录配置、PATH 可达性
- Shell 转义使用 `escape_shell_double_quote()` / `escape_batch_value()` 防注入
- 文件写入使用原子模式：write → `.tmp` → rename
- Linux 生成 bash wrapper，Windows 生成 `.cmd` wrapper
- `build_profile_settings_content()` 跨平台通用（无 `#[cfg]` 条件编译）

> 注：不存在 `profile_service.rs`，Profile 相关业务逻辑直接在 `commands/profile.rs` 命令层处理。

### 7.3 Wrapper Service 代码

详见 `src-tauri/src/services/wrapper_service.rs`，当前实现要点已在上方描述。

### 7.4 Claude Detect Service

```rust
// src-tauri/src/services/claude_detect_service.rs

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct ClaudeBinaryDetection {
    pub found: bool,
    pub path: Option<String>,
    pub candidates: Vec<String>,
}

pub struct ClaudeDetectService;

impl ClaudeDetectService {
    pub async fn detect() -> Result<ClaudeBinaryDetection, String> {
        let candidates = vec![
            "/usr/local/bin/claude",
            "/usr/bin/claude",
            "/home/.local/share/pnpm/claude",
            "/home/.npm-global/bin/claude",
        ];

        // Try to find using which
        if let Ok(output) = Command::new("which").arg("claude").output() {
            if output.status().success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() && !path.contains("clair") {
                    return Ok(ClaudeBinaryDetection {
                        found: true,
                        path: Some(path),
                        candidates,
                    });
                }
            }
        }

        // Check candidates directly
        for candidate in &candidates {
            if std::path::Path::new(candidate).exists() {
                return Ok(ClaudeBinaryDetection {
                    found: true,
                    path: Some(candidate.to_string()),
                    candidates,
                });
            }
        }

        Ok(ClaudeBinaryDetection {
            found: false,
            path: None,
            candidates,
        })
    }
}
```

---

## 8. Main Entry

```rust
// src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    clair_lib::run()
}
```

```rust
// src-tauri/src/lib.rs

mod commands;
mod db;
mod domain;
mod proxy;
mod services;
mod security;

use db::Database;
use std::path::PathBuf;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn run() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_level("info"))
        .init();

    // Setup database path
    let config_dir = dirs::config_dir()
        .map(|p| p.join("clair"))
        .unwrap_or_else(|| PathBuf::from(".clair"));

    std::fs::create_dir_all(&config_dir).expect("Failed to create config directory");

    let db_path = config_dir.join("clair.db");

    // Initialize database
    let db = Database::new(db_path).expect("Failed to initialize database");

    // Initialize proxy state
    let proxy_state = commands::proxy::ProxyState::new();

    // Build Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(db)
        .manage(proxy_state)
        .invoke_handler(tauri::generate_handler![
            // Provider commands
            commands::provider::list_providers,
            commands::provider::create_provider,
            commands::provider::update_provider,
            commands::provider::delete_provider,
            commands::provider::test_provider,
            commands::provider::test_provider_config,
            // Profile commands
            commands::profile::list_profiles,
            commands::profile::create_profile,
            commands::profile::update_profile,
            commands::profile::delete_profile,
            commands::profile::test_profile,
            // Proxy commands
            commands::proxy::get_proxy_status,
            commands::proxy::start_proxy,
            commands::proxy::stop_proxy,
            commands::proxy::reload_proxy_config,
            commands::proxy::get_proxy_evidence,
            // Wrapper commands
            commands::wrapper::detect_claude_binary,
            commands::wrapper::verify_claude_binary,
            commands::wrapper::generate_wrapper,
            commands::wrapper::check_wrapper_status,
            commands::wrapper::get_wrapper_path_diagnostics,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 9. 开发注意事项

### 9.1 异步运行时

- 使用 Tokio 作为异步运行时
- 所有 I/O 操作必须是异步的
- 数据库操作使用阻塞接口但注意不要阻塞 executor

### 9.2 错误处理

- 命令层统一使用 `Result<_, String>` 模式
- 非致命错误使用 `tracing::warn!` 记录，不中断流程（如代理 reload 失败）
- Mutex 恢复使用 `lock_safe()` helper（`unwrap_or_else(|e| e.into_inner())`），而非 `.lock().unwrap()`
- Provider 删除时若有关联 Profile 则拒绝（返回错误信息）

### 9.3 日志脱敏

```rust
// src-tauri/src/security/secret.rs
// 脱敏 API key: "sk-abc...xyz" → "sk-****xyz"
pub fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        "****".to_string()
    } else {
        format!("{}****{}", &key[..4], &key[key.len() - 4..])
    }
}
```

### 9.4 文件写入安全

- Wrapper 和 Settings 文件使用原子写入：write → `.tmp` → rename
- Shell 转义：`escape_shell_double_quote()` / `escape_batch_value()` 防注入

### 9.5 测试

MVP 阶段重点测试：
1. Provider CRUD
2. Profile CRUD（包含路由唯一性）
3. 代理转发（model override）
4. Wrapper 生成

---

## 10. API 命令清单

| 命令 | 输入 | 输出 |
|------|------|------|
| `list_providers` | - | `Provider[]` |
| `create_provider` | `CreateProviderInput` | `Provider` |
| `update_provider` | `UpdateProviderInput` | `Provider` |
| `delete_provider` | `{id: string}` | `boolean` |
| `test_provider` | `{id: string}` | `TestProviderResult` |
| `test_provider_config` | `TestProviderConfigInput` | `TestProviderResult` |
| `list_profiles` | - | `Profile[]` |
| `create_profile` | `CreateProfileInput` | `Profile` |
| `update_profile` | `UpdateProfileInput` | `Profile` |
| `delete_profile` | `{id: string}` | `boolean` |
| `test_profile` | `{profileId: string}` | `TestProfileResult` |
| `get_proxy_status` | - | `ProxyStatus` |
| `start_proxy` | - | `ProxyStatus` |
| `stop_proxy` | - | `ProxyStatus` |
| `reload_proxy_config` | - | `ProxyStatus` |
| `get_proxy_evidence` | `{limit?: number}` | `ProxyEvidenceEntry[]` |
| `detect_claude_binary` | - | `ClaudeBinaryDetection` |
| `verify_claude_binary` | `{path?: string}` | `ClaudeBinaryVerification` |
| `generate_wrapper` | `{profileId: string}` | `GenerateWrapperResult` |
| `check_wrapper_status` | `{profileId: string}` | `WrapperStatus` |
| `get_wrapper_path_diagnostics` | - | `WrapperPathDiagnostics` |
| `get_settings` | - | `AppSettings` |
| `update_settings` | `Partial<AppSettings>` | `AppSettings` |