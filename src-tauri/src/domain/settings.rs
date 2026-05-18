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
            proxy_port: 28789,
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
    format!("clair-{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap())
}