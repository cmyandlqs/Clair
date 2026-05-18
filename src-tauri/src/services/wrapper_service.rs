use crate::domain::Profile;
use crate::services::claude_detect_service::ClaudeDetectService;
use crate::services::SettingsService;
use crate::db::Database;
use serde::{Deserialize, Serialize};
use std::fs;
use std::os::unix::fs::PermissionsExt;

pub struct WrapperService;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WrapperStatus {
    pub exists: bool,
    pub executable: bool,
    pub path: Option<String>,
    pub in_path: bool,
    pub stale: bool,
}

impl WrapperService {
    pub async fn generate(db: &Database, profile: &Profile) -> Result<String, String> {
        let settings = SettingsService::load_settings(db)?;

        let wrapper_dir = if settings.wrapper_dir.starts_with('~') {
            dirs::home_dir()
                .map(|p| p.join(settings.wrapper_dir.trim_start_matches("~/")))
                .ok_or_else(|| "Cannot determine home directory".to_string())?
        } else {
            std::path::PathBuf::from(&settings.wrapper_dir)
        };

        // Ensure wrapper directory exists
        fs::create_dir_all(&wrapper_dir).map_err(|e| e.to_string())?;

        let wrapper_path = wrapper_dir.join(&profile.command_name);

        // Detect Claude binary path
        let claude_path = match &settings.claude_binary_path {
            Some(p) if !p.is_empty() => p.clone(),
            _ => match ClaudeDetectService::detect().await {
                Ok(detection) if detection.found => {
                    detection.path.unwrap_or_else(|| "claude".to_string())
                }
                _ => "claude".to_string(),
            }
        };

        let proxy_host = &settings.proxy_host;
        let proxy_port = settings.proxy_port;
        let auth_token = &settings.proxy_auth_token;

        // Generate wrapper script
        let wrapper_content = format!(
            r#"#!/usr/bin/env bash
set -e

CLAIR_BASE_URL="http://{proxy_host}:{proxy_port}{route_path}"
CLAIR_TOKEN="{auth_token}"
CLAUDE_BIN="{claude_path}"

export ANTHROPIC_BASE_URL="$CLAIR_BASE_URL"
export ANTHROPIC_AUTH_TOKEN="$CLAIR_TOKEN"

if ! command -v "$CLAUDE_BIN" &> /dev/null; then
    echo "Error: Claude binary not found: $CLAUDE_BIN" >&2
    echo "Please install Claude Code or update the wrapper script." >&2
    exit 1
fi

exec "$CLAUDE_BIN" "$@"
"#,
            proxy_host = proxy_host,
            proxy_port = proxy_port,
            route_path = profile.route_path,
            auth_token = auth_token,
            claude_path = claude_path
        );

        fs::write(&wrapper_path, &wrapper_content).map_err(|e| e.to_string())?;

        // Make executable
        #[cfg(unix)]
        {
            let mut perms = fs::metadata(&wrapper_path)
                .map_err(|e| e.to_string())?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&wrapper_path, perms).map_err(|e| e.to_string())?;
        }

        Ok(wrapper_path.to_string_lossy().to_string())
    }

    pub fn check_status(profile: &Profile) -> Result<WrapperStatus, String> {
        let wrapper_dir = dirs::home_dir()
            .map(|p| p.join(".local/bin"))
            .unwrap_or_default();

        let wrapper_path = wrapper_dir.join(&profile.command_name);

        let exists = wrapper_path.exists();
        let executable = if exists {
            wrapper_path.metadata()
                .map(|m| {
                    #[cfg(unix)]
                    { m.permissions().mode() & 0o111 != 0 }
                    #[cfg(not(unix))]
                    { true }
                })
                .unwrap_or(false)
        } else {
            false
        };

        // Check if in PATH
        let in_path = std::process::Command::new("which")
            .arg(&profile.command_name)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        Ok(WrapperStatus {
            exists,
            executable,
            path: Some(wrapper_path.to_string_lossy().to_string()),
            in_path,
            stale: false,
        })
    }
}
