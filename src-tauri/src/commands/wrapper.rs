use crate::db::Database;
use crate::services::claude_detect_service::{ClaudeBinaryDetection, ClaudeBinaryVerification};
use crate::services::wrapper_service::{WrapperPathDiagnostics, WrapperStatus};
use crate::services::{ClaudeDetectService, SettingsService};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct GenerateWrapperResult {
    pub success: bool,
    pub path: String,
    pub settings_path: Option<String>,
    pub command_name: String,
}

#[tauri::command]
pub async fn detect_claude_binary() -> Result<ClaudeBinaryDetection, String> {
    ClaudeDetectService::detect().await
}

#[tauri::command]
pub async fn verify_claude_binary(
    path: Option<String>,
) -> Result<ClaudeBinaryVerification, String> {
    ClaudeDetectService::verify(path).await
}

#[tauri::command]
pub async fn get_wrapper_path_diagnostics(
    db: tauri::State<'_, Database>,
) -> Result<WrapperPathDiagnostics, String> {
    let settings = SettingsService::load_settings(&db)?;
    crate::services::wrapper_service::WrapperService::get_path_diagnostics(&settings.wrapper_dir)
}

#[tauri::command]
pub async fn generate_wrapper(
    db: tauri::State<'_, Database>,
    profile_id: String,
) -> Result<GenerateWrapperResult, String> {
    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let profile = profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    let artifacts =
        crate::services::wrapper_service::WrapperService::generate(&db, &profile).await?;

    Ok(GenerateWrapperResult {
        success: true,
        path: artifacts.launcher_path.to_string_lossy().to_string(),
        settings_path: artifacts
            .settings_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
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
            match crate::services::wrapper_service::WrapperService::generate(&db, &profile).await {
                Ok(artifacts) => {
                    results.push(GenerateWrapperResult {
                        success: true,
                        path: artifacts.launcher_path.to_string_lossy().to_string(),
                        settings_path: artifacts
                            .settings_path
                            .as_ref()
                            .map(|path| path.to_string_lossy().to_string()),
                        command_name: profile.command_name,
                    });
                }
                Err(e) => {
                    results.push(GenerateWrapperResult {
                        success: false,
                        path: e.to_string(),
                        settings_path: None,
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
    let profile = profiles
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "Profile not found".to_string())?;

    crate::services::wrapper_service::WrapperService::check_status(&db, &profile).await
}
