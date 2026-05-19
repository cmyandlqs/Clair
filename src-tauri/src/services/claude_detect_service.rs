use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeBinaryDetection {
    pub found: bool,
    pub path: Option<String>,
    pub candidates: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeBinaryVerification {
    pub configured_path: Option<String>,
    pub resolved_path: Option<String>,
    pub source: String,
    pub runnable: bool,
    pub version: Option<String>,
    pub message: String,
}

pub struct ClaudeDetectService;

impl ClaudeDetectService {
    pub async fn detect() -> Result<ClaudeBinaryDetection, String> {
        let candidates = candidate_paths();

        if let Some(path) = detect_from_path_command() {
            return Ok(ClaudeBinaryDetection {
                found: true,
                path: Some(path),
                candidates,
            });
        }

        for candidate in &candidates {
            if Path::new(candidate).exists() {
                return Ok(ClaudeBinaryDetection {
                    found: true,
                    path: Some(candidate.clone()),
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

    pub async fn verify(
        configured_path: Option<String>,
    ) -> Result<ClaudeBinaryVerification, String> {
        let normalized_configured = normalize_optional_path(configured_path);
        let (resolved_path, source) = match normalized_configured.clone() {
            Some(path) => (Some(path), "configured".to_string()),
            None => match Self::detect().await? {
                ClaudeBinaryDetection {
                    found: true, path, ..
                } => (path, "auto-detected".to_string()),
                _ => (Some("claude".to_string()), "fallback".to_string()),
            },
        };

        let Some(path) = resolved_path.clone() else {
            return Ok(ClaudeBinaryVerification {
                configured_path: normalized_configured,
                resolved_path: None,
                source,
                runnable: false,
                version: None,
                message: "Claude binary could not be resolved".to_string(),
            });
        };

        match run_version_check(&path) {
            Ok(version) => Ok(ClaudeBinaryVerification {
                configured_path: normalized_configured,
                resolved_path: Some(path),
                source,
                runnable: true,
                version: Some(version.clone()),
                message: format!("Claude binary is runnable ({version})"),
            }),
            Err(error) => Ok(ClaudeBinaryVerification {
                configured_path: normalized_configured,
                resolved_path: Some(path),
                source,
                runnable: false,
                version: None,
                message: error,
            }),
        }
    }
}

fn normalize_optional_path(path: Option<String>) -> Option<String> {
    path.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn run_version_check(path: &str) -> Result<String, String> {
    let output = Command::new(path)
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to launch Claude binary: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let version_text = first_non_empty_line(&stdout)
        .or_else(|| first_non_empty_line(&stderr))
        .unwrap_or_else(|| "version output unavailable".to_string());

    if output.status.success() {
        Ok(version_text)
    } else {
        Err(format!(
            "Claude binary exited with status {}: {}",
            output
                .status
                .code()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "unknown".to_string()),
            version_text
        ))
    }
}

fn first_non_empty_line(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.to_string())
}

#[cfg(windows)]
fn candidate_paths() -> Vec<String> {
    let mut candidates = Vec::new();

    if let Some(app_data) = std::env::var_os("APPDATA") {
        let base = std::path::PathBuf::from(app_data);
        candidates.push(
            base.join("npm")
                .join("claude.cmd")
                .to_string_lossy()
                .to_string(),
        );
        candidates.push(
            base.join("npm")
                .join("claude")
                .to_string_lossy()
                .to_string(),
        );
    }

    if let Some(local_app_data) = std::env::var_os("LOCALAPPDATA") {
        let base = std::path::PathBuf::from(local_app_data);
        candidates.push(
            base.join("Microsoft")
                .join("WinGet")
                .join("Links")
                .join("claude.exe")
                .to_string_lossy()
                .to_string(),
        );
        candidates.push(
            base.join("Microsoft")
                .join("WinGet")
                .join("Links")
                .join("claude.cmd")
                .to_string_lossy()
                .to_string(),
        );
        candidates.push(
            base.join("Programs")
                .join("Claude")
                .join("claude.exe")
                .to_string_lossy()
                .to_string(),
        );
    }

    if let Some(home) = dirs::home_dir() {
        candidates.push(
            home.join(".npm-global")
                .join("bin")
                .join("claude.cmd")
                .to_string_lossy()
                .to_string(),
        );
    }

    candidates
}

#[cfg(not(windows))]
fn candidate_paths() -> Vec<String> {
    let home = dirs::home_dir();
    let mut candidates = vec![
        "/usr/local/bin/claude".to_string(),
        "/usr/bin/claude".to_string(),
    ];

    if let Some(ref h) = home {
        candidates.push(h.join(".local/bin/claude").to_string_lossy().to_string());
        candidates.push(
            h.join(".local/share/pnpm/claude")
                .to_string_lossy()
                .to_string(),
        );
        candidates.push(
            h.join(".npm-global/bin/claude")
                .to_string_lossy()
                .to_string(),
        );
        candidates.push(
            h.join(".nvm/versions/node/current/bin/claude")
                .to_string_lossy()
                .to_string(),
        );
    }

    candidates
}

#[cfg(windows)]
fn detect_from_path_command() -> Option<String> {
    let output = Command::new("where").arg("claude").output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .find(|path| !path.is_empty() && !path.to_ascii_lowercase().contains("clair"))
        .map(|s| s.to_string())
}

#[cfg(not(windows))]
fn detect_from_path_command() -> Option<String> {
    let output = Command::new("which").arg("claude").output().ok()?;
    if !output.status.success() {
        return None;
    }

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() || path.contains("clair") {
        None
    } else {
        Some(path)
    }
}

#[cfg(test)]
mod tests {
    use super::{first_non_empty_line, normalize_optional_path};

    #[test]
    fn normalize_optional_path_trims_and_drops_empty_values() {
        assert_eq!(
            normalize_optional_path(Some("  claude.cmd  ".to_string())),
            Some("claude.cmd".to_string())
        );
        assert_eq!(normalize_optional_path(Some("   ".to_string())), None);
        assert_eq!(normalize_optional_path(None), None);
    }

    #[test]
    fn first_non_empty_line_skips_blank_lines() {
        assert_eq!(
            first_non_empty_line("\n\n Claude 1.2.3 \nextra"),
            Some("Claude 1.2.3".to_string())
        );
        assert_eq!(first_non_empty_line(" \n\t"), None);
    }
}
