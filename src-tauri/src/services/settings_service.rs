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
            settings.claude_binary_path = normalize_optional_setting(v);
        }
        if let Some(v) = map.get("theme") {
            settings.theme = v.clone();
        }

        persist_missing_defaults(db, &map, &settings).map_err(|e| e.to_string())?;

        Ok(settings)
    }
}

fn persist_missing_defaults(
    db: &Database,
    map: &std::collections::HashMap<String, String>,
    settings: &AppSettings,
) -> rusqlite::Result<()> {
    if !map.contains_key("proxy_host") {
        db.set_setting("proxy_host", &settings.proxy_host)?;
    }
    if !map.contains_key("proxy_port") {
        db.set_setting("proxy_port", &settings.proxy_port.to_string())?;
    }
    if !map.contains_key("proxy_auth_token") {
        db.set_setting("proxy_auth_token", &settings.proxy_auth_token)?;
    }
    if !map.contains_key("start_proxy_on_launch") {
        db.set_setting(
            "start_proxy_on_launch",
            &settings.start_proxy_on_launch.to_string(),
        )?;
    }
    if !map.contains_key("start_app_on_login") {
        db.set_setting(
            "start_app_on_login",
            &settings.start_app_on_login.to_string(),
        )?;
    }
    if !map.contains_key("minimize_to_tray") {
        db.set_setting("minimize_to_tray", &settings.minimize_to_tray.to_string())?;
    }
    if !map.contains_key("wrapper_dir") {
        db.set_setting("wrapper_dir", &settings.wrapper_dir)?;
    }
    if !map.contains_key("theme") {
        db.set_setting("theme", &settings.theme)?;
    }

    Ok(())
}

fn normalize_optional_setting(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::SettingsService;
    use crate::db::{migrations, Database};

    #[test]
    fn load_settings_persists_generated_proxy_token() {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("settings.db");
        let db = Database::new(db_path).unwrap();
        migrations::run_migrations(&db.connection()).unwrap();

        let first = SettingsService::load_settings(&db).unwrap();
        let second = SettingsService::load_settings(&db).unwrap();
        let stored = db.get_all_settings().unwrap();

        assert_eq!(first.proxy_auth_token, second.proxy_auth_token);
        assert_eq!(
            stored.get("proxy_auth_token"),
            Some(&first.proxy_auth_token)
        );
    }
}
