use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeBinaryDetection {
    pub found: bool,
    pub path: Option<String>,
    pub candidates: Vec<String>,
}

pub struct ClaudeDetectService;

impl ClaudeDetectService {
    pub async fn detect() -> Result<ClaudeBinaryDetection, String> {
        let home = dirs::home_dir();
        let mut candidates: Vec<String> = vec![
            "/usr/local/bin/claude".to_string(),
            "/usr/bin/claude".to_string(),
        ];

        // Add home-dir based candidates
        if let Some(ref h) = home {
            candidates.push(h.join(".local/bin/claude").to_string_lossy().to_string());
            candidates.push(h.join(".local/share/pnpm/claude").to_string_lossy().to_string());
            candidates.push(h.join(".npm-global/bin/claude").to_string_lossy().to_string());
            candidates.push(h.join(".nvm/versions/node/current/bin/claude").to_string_lossy().to_string());
        }

        // Try to find using which
        if let Ok(output) = Command::new("which").arg("claude").output() {
            if output.status.success() {
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
}
