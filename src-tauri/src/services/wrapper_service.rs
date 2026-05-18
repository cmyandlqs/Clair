use crate::db::Database;
use crate::domain::{AppSettings, Profile};
use crate::services::claude_detect_service::ClaudeDetectService;
use crate::services::SettingsService;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

pub struct WrapperService;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WrapperStatus {
    pub exists: bool,
    pub executable: bool,
    pub path: Option<String>,
    pub in_path: bool,
    pub stale: bool,
    pub settings_path: Option<String>,
    pub settings_exists: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WrapperPathDiagnostics {
    pub configured_dir: String,
    pub resolved_dir: String,
    pub in_path: bool,
    pub matching_entries: Vec<String>,
    pub path_entries: Vec<String>,
}

pub struct WrapperArtifacts {
    pub launcher_path: PathBuf,
    launcher_content: String,
    pub settings_path: Option<PathBuf>,
    settings_content: Option<String>,
}

impl WrapperService {
    pub async fn generate(db: &Database, profile: &Profile) -> Result<WrapperArtifacts, String> {
        let settings = SettingsService::load_settings(db)?;
        let wrapper_dir = resolve_wrapper_dir(&settings.wrapper_dir)?;
        fs::create_dir_all(&wrapper_dir).map_err(|e| e.to_string())?;

        #[cfg(windows)]
        {
            let profile_settings_dir = wrapper_dir.join("profiles");
            fs::create_dir_all(&profile_settings_dir).map_err(|e| e.to_string())?;
        }

        let claude_path = resolve_claude_path(&settings).await;
        let artifacts = build_wrapper_artifacts(&wrapper_dir, &claude_path, &settings, profile)?;

        if let Some(settings_path) = &artifacts.settings_path {
            if let Some(settings_content) = &artifacts.settings_content {
                fs::write(settings_path, settings_content).map_err(|e| e.to_string())?;
            }
        }

        fs::write(&artifacts.launcher_path, &artifacts.launcher_content)
            .map_err(|e| e.to_string())?;

        #[cfg(unix)]
        {
            let mut perms = fs::metadata(&artifacts.launcher_path)
                .map_err(|e| e.to_string())?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&artifacts.launcher_path, perms).map_err(|e| e.to_string())?;
        }

        Ok(artifacts)
    }

    pub async fn check_status(db: &Database, profile: &Profile) -> Result<WrapperStatus, String> {
        let settings = SettingsService::load_settings(db)?;
        let wrapper_dir = resolve_wrapper_dir(&settings.wrapper_dir)?;
        let launcher_path = wrapper_dir.join(wrapper_file_name(&profile.command_name));
        let settings_path = wrapper_settings_path(&wrapper_dir, &profile.command_name);

        let exists = launcher_path.exists();
        let executable = if exists {
            launcher_path
                .metadata()
                .map(|_metadata| {
                    #[cfg(unix)]
                    {
                        _metadata.permissions().mode() & 0o111 != 0
                    }
                    #[cfg(not(unix))]
                    {
                        true
                    }
                })
                .unwrap_or(false)
        } else {
            false
        };

        let settings_exists = settings_path
            .as_ref()
            .map(|path| path.exists())
            .unwrap_or(false);
        let in_path = check_command_in_path(&profile.command_name);

        let stale = if exists {
            let claude_path = resolve_claude_path(&settings).await;
            let expected = build_wrapper_artifacts(&wrapper_dir, &claude_path, &settings, profile)?;
            artifact_contents_differ(&launcher_path, &expected.launcher_content)
                || settings_artifact_differs(
                    expected.settings_path.as_deref(),
                    expected.settings_content.as_deref(),
                )
        } else {
            false
        };

        Ok(WrapperStatus {
            exists,
            executable,
            path: Some(launcher_path.to_string_lossy().to_string()),
            in_path,
            stale,
            settings_path: settings_path.map(|path| path.to_string_lossy().to_string()),
            settings_exists,
        })
    }

    pub fn get_path_diagnostics(wrapper_dir: &str) -> Result<WrapperPathDiagnostics, String> {
        let resolved_dir = resolve_wrapper_dir(wrapper_dir)?;
        let path_entries = current_path_entries();
        let resolved_dir_string = resolved_dir.to_string_lossy().to_string();
        let matching_entries = path_entries
            .iter()
            .filter(|entry| paths_match(entry, &resolved_dir_string))
            .cloned()
            .collect::<Vec<_>>();

        Ok(WrapperPathDiagnostics {
            configured_dir: wrapper_dir.to_string(),
            resolved_dir: resolved_dir_string,
            in_path: !matching_entries.is_empty(),
            matching_entries,
            path_entries,
        })
    }
}

async fn resolve_claude_path(settings: &AppSettings) -> String {
    match &settings.claude_binary_path {
        Some(path) if !path.is_empty() => path.clone(),
        _ => match ClaudeDetectService::detect().await {
            Ok(detection) if detection.found => {
                detection.path.unwrap_or_else(|| "claude".to_string())
            }
            _ => "claude".to_string(),
        },
    }
}

fn build_wrapper_artifacts(
    wrapper_dir: &Path,
    claude_path: &str,
    settings: &AppSettings,
    profile: &Profile,
) -> Result<WrapperArtifacts, String> {
    let launcher_path = wrapper_dir.join(wrapper_file_name(&profile.command_name));

    #[cfg(windows)]
    {
        let settings_path = wrapper_settings_path(wrapper_dir, &profile.command_name)
            .ok_or_else(|| "Windows launcher settings path could not be resolved".to_string())?;
        let settings_content = build_windows_profile_settings_content(
            &settings.proxy_host,
            settings.proxy_port,
            &profile.route_path,
            &settings.proxy_auth_token,
            &profile.model,
        )?;
        let launcher_content = build_windows_wrapper_content(claude_path, &settings_path);

        return Ok(WrapperArtifacts {
            launcher_path,
            launcher_content,
            settings_path: Some(settings_path),
            settings_content: Some(settings_content),
        });
    }

    #[cfg(not(windows))]
    {
        let launcher_content = build_unix_wrapper_content(
            &settings.proxy_host,
            settings.proxy_port,
            &profile.route_path,
            &settings.proxy_auth_token,
            claude_path,
            &profile.model,
        );

        Ok(WrapperArtifacts {
            launcher_path,
            launcher_content,
            settings_path: None,
            settings_content: None,
        })
    }
}

fn artifact_contents_differ(path: &Path, expected_content: &str) -> bool {
    match fs::read_to_string(path) {
        Ok(current) => normalize_content(&current) != normalize_content(expected_content),
        Err(_) => true,
    }
}

fn settings_artifact_differs(path: Option<&Path>, expected_content: Option<&str>) -> bool {
    match (path, expected_content) {
        (Some(path), Some(content)) => {
            if !path.exists() {
                true
            } else {
                artifact_contents_differ(path, content)
            }
        }
        (Some(path), None) => path.exists(),
        (None, Some(_)) => true,
        (None, None) => false,
    }
}

#[cfg(not(windows))]
fn build_unix_wrapper_content(
    proxy_host: &str,
    proxy_port: u16,
    route_path: &str,
    auth_token: &str,
    claude_path: &str,
    model: &str,
) -> String {
    format!(
        r#"#!/usr/bin/env bash
set -e

CLAIR_BASE_URL="http://{proxy_host}:{proxy_port}{route_path}"
CLAIR_TOKEN="{auth_token}"
CLAUDE_BIN="{claude_path}"
CLAIR_MODEL="{model}"

export ANTHROPIC_BASE_URL="$CLAIR_BASE_URL"
export ANTHROPIC_AUTH_TOKEN="$CLAIR_TOKEN"
export ANTHROPIC_MODEL="$CLAIR_MODEL"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$CLAIR_MODEL"
export ANTHROPIC_DEFAULT_OPUS_MODEL="$CLAIR_MODEL"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$CLAIR_MODEL"

if ! command -v "$CLAUDE_BIN" &> /dev/null; then
    echo "Error: Claude binary not found: $CLAUDE_BIN" >&2
    echo "Please install Claude Code or update the wrapper script." >&2
    exit 1
fi

exec "$CLAUDE_BIN" "$@"
"#,
        proxy_host = proxy_host,
        proxy_port = proxy_port,
        route_path = route_path,
        auth_token = auth_token,
        claude_path = claude_path,
        model = model
    )
}

#[cfg(windows)]
fn build_windows_profile_settings_content(
    proxy_host: &str,
    proxy_port: u16,
    route_path: &str,
    auth_token: &str,
    model: &str,
) -> Result<String, String> {
    let base_url = format!("http://{proxy_host}:{proxy_port}{route_path}");
    let content = serde_json::json!({
        "env": {
            "ANTHROPIC_BASE_URL": base_url,
            "ANTHROPIC_AUTH_TOKEN": auth_token,
            "ANTHROPIC_MODEL": model,
            "ANTHROPIC_DEFAULT_SONNET_MODEL": model,
            "ANTHROPIC_DEFAULT_OPUS_MODEL": model,
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": model
        }
    });

    serde_json::to_string_pretty(&content).map_err(|e| e.to_string())
}

#[cfg(windows)]
fn build_windows_wrapper_content(claude_path: &str, settings_path: &Path) -> String {
    let settings_path = settings_path.to_string_lossy();
    format!(
        r#"@echo off
setlocal

set "CLAUDE_BIN={claude_path}"
set "CLAIR_SETTINGS={settings_path}"

set "ANTHROPIC_API_KEY="
set "ANTHROPIC_AUTH_TOKEN="
set "ANTHROPIC_BASE_URL="
set "ANTHROPIC_MODEL="
set "ANTHROPIC_DEFAULT_SONNET_MODEL="
set "ANTHROPIC_DEFAULT_OPUS_MODEL="
set "ANTHROPIC_DEFAULT_HAIKU_MODEL="
set "ANTHROPIC_REASONING_MODEL="

if not exist "%CLAIR_SETTINGS%" (
    echo Error: Clair profile settings not found: %CLAIR_SETTINGS% 1>&2
    exit /b 1
)

where "%CLAUDE_BIN%" >nul 2>nul
if errorlevel 1 (
    if not exist "%CLAUDE_BIN%" (
        echo Error: Claude binary not found: %CLAUDE_BIN% 1>&2
        echo Please install Claude Code or update the launcher configuration. 1>&2
        exit /b 1
    )
)

call "%CLAUDE_BIN%" --settings "%CLAIR_SETTINGS%" %*
"#,
        claude_path = claude_path,
        settings_path = settings_path
    )
}

fn wrapper_settings_path(wrapper_dir: &Path, command_name: &str) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        Some(
            wrapper_dir
                .join("profiles")
                .join(format!("{command_name}.settings.json")),
        )
    }

    #[cfg(not(windows))]
    {
        let _ = wrapper_dir;
        let _ = command_name;
        None
    }
}

fn resolve_wrapper_dir(wrapper_dir: &str) -> Result<PathBuf, String> {
    #[cfg(windows)]
    if wrapper_dir.contains('%') {
        let expanded = expand_windows_env_vars(wrapper_dir);
        if expanded != wrapper_dir {
            return Ok(PathBuf::from(expanded));
        }
    }

    if wrapper_dir.starts_with('~') {
        dirs::home_dir()
            .map(|path| path.join(wrapper_dir.trim_start_matches("~/")))
            .ok_or_else(|| "Cannot determine home directory".to_string())
    } else {
        Ok(PathBuf::from(wrapper_dir))
    }
}

fn normalize_content(content: &str) -> String {
    content.replace("\r\n", "\n").trim().to_string()
}

fn current_path_entries() -> Vec<String> {
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths)
                .map(|path| path.to_string_lossy().to_string())
                .filter(|entry| !entry.trim().is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn paths_match(path_a: &str, path_b: &str) -> bool {
    normalize_path_for_compare(path_a) == normalize_path_for_compare(path_b)
}

fn normalize_path_for_compare(path: &str) -> String {
    let trimmed = path.trim().trim_end_matches(['\\', '/']);

    #[cfg(windows)]
    {
        trimmed.replace('/', "\\").to_ascii_lowercase()
    }

    #[cfg(not(windows))]
    {
        trimmed.to_string()
    }
}

#[cfg(windows)]
fn expand_windows_env_vars(input: &str) -> String {
    let mut output = String::new();
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '%' {
            let mut var_name = String::new();
            while let Some(next) = chars.peek().copied() {
                chars.next();
                if next == '%' {
                    break;
                }
                var_name.push(next);
            }

            if var_name.is_empty() {
                output.push('%');
                continue;
            }

            match std::env::var(&var_name) {
                Ok(value) => output.push_str(&value),
                Err(_) => {
                    output.push('%');
                    output.push_str(&var_name);
                    output.push('%');
                }
            }
        } else {
            output.push(ch);
        }
    }

    output
}

#[cfg(windows)]
fn wrapper_file_name(command_name: &str) -> String {
    format!("{command_name}.cmd")
}

#[cfg(not(windows))]
fn wrapper_file_name(command_name: &str) -> String {
    command_name.to_string()
}

#[cfg(unix)]
fn check_command_in_path(command_name: &str) -> bool {
    std::process::Command::new("which")
        .arg(command_name)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(windows)]
fn check_command_in_path(command_name: &str) -> bool {
    std::process::Command::new("where")
        .arg(command_name)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{
        build_windows_profile_settings_content, build_windows_wrapper_content,
        normalize_path_for_compare, paths_match, wrapper_settings_path,
    };
    use std::path::Path;

    #[cfg(windows)]
    #[test]
    fn windows_settings_file_points_to_local_proxy_and_model() {
        let content = build_windows_profile_settings_content(
            "127.0.0.1",
            28789,
            "/glm",
            "clair-local-token",
            "MiniMax-M2.7",
        )
        .unwrap();

        assert!(content.contains("\"ANTHROPIC_BASE_URL\": \"http://127.0.0.1:28789/glm\""));
        assert!(content.contains("\"ANTHROPIC_AUTH_TOKEN\": \"clair-local-token\""));
        assert!(content.contains("\"ANTHROPIC_MODEL\": \"MiniMax-M2.7\""));
        assert!(content.contains("\"ANTHROPIC_DEFAULT_SONNET_MODEL\": \"MiniMax-M2.7\""));
    }

    #[cfg(windows)]
    #[test]
    fn windows_wrapper_uses_settings_override_file() {
        let settings_path =
            wrapper_settings_path(Path::new("C:\\Clair\\bin"), "claude-glm").unwrap();
        let content = build_windows_wrapper_content("claude.exe", &settings_path);

        assert!(content.contains("call \"%CLAUDE_BIN%\" --settings \"%CLAIR_SETTINGS%\" %*"));
        assert!(content
            .contains("set \"CLAIR_SETTINGS=C:\\Clair\\bin\\profiles\\claude-glm.settings.json\""));
        assert!(content.contains("set \"ANTHROPIC_API_KEY=\""));
        assert!(content.contains("set \"ANTHROPIC_AUTH_TOKEN=\""));
    }

    #[test]
    fn path_comparison_ignores_trailing_separators() {
        assert!(paths_match("C:\\Users\\me\\bin\\", "C:\\Users\\me\\bin"));
        assert_eq!(
            normalize_path_for_compare("C:\\Users\\me\\bin/"),
            normalize_path_for_compare("C:\\Users\\me\\bin")
        );
    }
}
