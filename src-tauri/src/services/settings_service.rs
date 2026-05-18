use crate::db::Database;
use crate::domain::AppSettings;

pub struct SettingsService;

impl SettingsService {
    pub fn load_settings(db: &Database) -> Result<AppSettings, String> {
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
}
