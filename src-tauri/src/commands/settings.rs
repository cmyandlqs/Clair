use crate::db::Database;
use crate::domain::AppSettings;
use serde::Deserialize;
use tauri::State;

#[tauri::command]
pub async fn get_settings(db: State<'_, Database>) -> Result<AppSettings, String> {
    let map = db.get_all_settings().map_err(|e| e.to_string())?;
    let mut settings = AppSettings::default();

    if let Some(v) = map.get("proxy_host") {
        settings.proxy_host = v.clone();
    }
    if let Some(v) = map.get("proxy_port") {
        settings.proxy_port = v.parse().unwrap_or(28789);
    }
    if let Some(v) = map.get("proxy_auth_token") {
        settings.proxy_auth_token = v.clone();
    }
    if let Some(v) = map.get("start_proxy_on_launch") {
        settings.start_proxy_on_launch = v.parse().unwrap_or(true);
    }
    if let Some(v) = map.get("start_app_on_login") {
        settings.start_app_on_login = v.parse().unwrap_or(false);
    }
    if let Some(v) = map.get("minimize_to_tray") {
        settings.minimize_to_tray = v.parse().unwrap_or(true);
    }
    if let Some(v) = map.get("wrapper_dir") {
        settings.wrapper_dir = v.clone();
    }
    if let Some(v) = map.get("claude_binary_path") {
        settings.claude_binary_path = Some(v.clone());
    }
    if let Some(v) = map.get("theme") {
        settings.theme = v.clone();
    }

    Ok(settings)
}

#[tauri::command]
pub async fn update_settings(
    db: State<'_, Database>,
    input: PartialAppSettings,
) -> Result<AppSettings, String> {
    // Read current settings first
    let mut settings = {
        let map = db.get_all_settings().map_err(|e| e.to_string())?;
        let mut s = AppSettings::default();
        if let Some(v) = map.get("proxy_host") { s.proxy_host = v.clone(); }
        if let Some(v) = map.get("proxy_port") { s.proxy_port = v.parse().unwrap_or(28789); }
        if let Some(v) = map.get("proxy_auth_token") { s.proxy_auth_token = v.clone(); }
        if let Some(v) = map.get("start_proxy_on_launch") { s.start_proxy_on_launch = v.parse().unwrap_or(true); }
        if let Some(v) = map.get("start_app_on_login") { s.start_app_on_login = v.parse().unwrap_or(false); }
        if let Some(v) = map.get("minimize_to_tray") { s.minimize_to_tray = v.parse().unwrap_or(true); }
        if let Some(v) = map.get("wrapper_dir") { s.wrapper_dir = v.clone(); }
        if let Some(v) = map.get("claude_binary_path") { s.claude_binary_path = Some(v.clone()); }
        if let Some(v) = map.get("theme") { s.theme = v.clone(); }
        s
    };

    // Apply updates
    if let Some(v) = input.proxy_host { settings.proxy_host = v; }
    if let Some(v) = input.proxy_port { settings.proxy_port = v; }
    if let Some(v) = input.proxy_auth_token { settings.proxy_auth_token = v; }
    if let Some(v) = input.start_proxy_on_launch { settings.start_proxy_on_launch = v; }
    if let Some(v) = input.start_app_on_login { settings.start_app_on_login = v; }
    if let Some(v) = input.minimize_to_tray { settings.minimize_to_tray = v; }
    if let Some(v) = input.wrapper_dir { settings.wrapper_dir = v; }
    if let Some(v) = input.claude_binary_path { settings.claude_binary_path = Some(v); }
    if let Some(v) = input.theme { settings.theme = v; }

    // Persist all settings
    db.set_setting("proxy_host", &settings.proxy_host).map_err(|e| e.to_string())?;
    db.set_setting("proxy_port", &settings.proxy_port.to_string()).map_err(|e| e.to_string())?;
    db.set_setting("proxy_auth_token", &settings.proxy_auth_token).map_err(|e| e.to_string())?;
    db.set_setting("start_proxy_on_launch", &settings.start_proxy_on_launch.to_string()).map_err(|e| e.to_string())?;
    db.set_setting("start_app_on_login", &settings.start_app_on_login.to_string()).map_err(|e| e.to_string())?;
    db.set_setting("minimize_to_tray", &settings.minimize_to_tray.to_string()).map_err(|e| e.to_string())?;
    db.set_setting("wrapper_dir", &settings.wrapper_dir).map_err(|e| e.to_string())?;
    if let Some(ref v) = settings.claude_binary_path {
        db.set_setting("claude_binary_path", v).map_err(|e| e.to_string())?;
    }
    db.set_setting("theme", &settings.theme).map_err(|e| e.to_string())?;

    Ok(settings)
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
