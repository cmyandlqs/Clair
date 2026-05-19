use crate::commands::proxy::ProxyState;
use crate::db::Database;
use crate::domain::AppSettings;
use crate::services::SettingsService;
use serde::Deserialize;
use tauri::State;

#[tauri::command]
pub async fn get_settings(db: State<'_, Database>) -> Result<AppSettings, String> {
    SettingsService::load_settings(&db)
}

#[tauri::command]
pub async fn update_settings(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    input: PartialAppSettings,
) -> Result<AppSettings, String> {
    let mut settings = SettingsService::load_settings(&db)?;

    if let Some(ref v) = input.proxy_host {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return Err("proxy_host cannot be empty".to_string());
        }
        if trimmed != "127.0.0.1" && trimmed != "localhost" && trimmed != "::1" {
            return Err("proxy_host must be 127.0.0.1, localhost, or ::1 for security".to_string());
        }
        settings.proxy_host = trimmed.to_string();
    }
    if let Some(v) = input.proxy_port {
        if v < 1024 {
            return Err("proxy_port must be >= 1024 (privileged ports not allowed)".to_string());
        }
        settings.proxy_port = v;
    }
    if let Some(ref v) = input.proxy_auth_token {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return Err("proxy_auth_token cannot be empty".to_string());
        }
        settings.proxy_auth_token = trimmed.to_string();
    }
    if let Some(v) = input.start_proxy_on_launch {
        settings.start_proxy_on_launch = v;
    }
    if let Some(v) = input.start_app_on_login {
        settings.start_app_on_login = v;
    }
    if let Some(v) = input.minimize_to_tray {
        settings.minimize_to_tray = v;
    }
    if let Some(v) = input.wrapper_dir {
        settings.wrapper_dir = v;
    }
    if let Some(v) = input.claude_binary_path {
        settings.claude_binary_path = normalize_optional_setting(&v);
    }
    if let Some(v) = input.theme {
        settings.theme = v;
    }

    // Persist all settings
    db.set_setting("proxy_host", &settings.proxy_host)
        .map_err(|e| e.to_string())?;
    db.set_setting("proxy_port", &settings.proxy_port.to_string())
        .map_err(|e| e.to_string())?;
    db.set_setting("proxy_auth_token", &settings.proxy_auth_token)
        .map_err(|e| e.to_string())?;
    db.set_setting(
        "start_proxy_on_launch",
        &settings.start_proxy_on_launch.to_string(),
    )
    .map_err(|e| e.to_string())?;
    db.set_setting(
        "start_app_on_login",
        &settings.start_app_on_login.to_string(),
    )
    .map_err(|e| e.to_string())?;
    db.set_setting("minimize_to_tray", &settings.minimize_to_tray.to_string())
        .map_err(|e| e.to_string())?;
    db.set_setting("wrapper_dir", &settings.wrapper_dir)
        .map_err(|e| e.to_string())?;
    if let Some(ref v) = settings.claude_binary_path {
        db.set_setting("claude_binary_path", v)
            .map_err(|e| e.to_string())?;
    } else {
        db.delete_setting("claude_binary_path")
            .map_err(|e| e.to_string())?;
    }
    db.set_setting("theme", &settings.theme)
        .map_err(|e| e.to_string())?;

    let needs_restart = input.proxy_host.is_some()
        || input.proxy_port.is_some()
        || input.proxy_auth_token.is_some();

    if needs_restart {
        let server_arc = {
            let guard = crate::commands::proxy::lock_safe(&proxy_state.server);
            guard.clone()
        };
        if server_arc.is_some() {
            super::proxy::restart_proxy(proxy_state, db).await?;
            return Ok(settings);
        }
    }

    Ok(settings)
}

fn normalize_optional_setting(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[derive(Debug, Deserialize)]
pub struct PartialAppSettings {
    pub proxy_host: Option<String>,
    pub proxy_port: Option<u16>,
    pub proxy_auth_token: Option<String>,
    pub start_proxy_on_launch: Option<bool>,
    pub start_app_on_login: Option<bool>,
    pub minimize_to_tray: Option<bool>,
    pub wrapper_dir: Option<String>,
    pub claude_binary_path: Option<String>,
    pub theme: Option<String>,
}
