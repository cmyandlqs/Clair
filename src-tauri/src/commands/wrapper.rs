use crate::db::Database;
use crate::services::claude_detect_service::ClaudeBinaryDetection;
use crate::services::wrapper_service::WrapperStatus;
use crate::services::ClaudeDetectService;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct GenerateWrapperResult {
    pub success: bool,
    pub path: String,
    pub command_name: String,
}

#[tauri::command]
pub async fn detect_claude_binary() -> Result<ClaudeBinaryDetection, String> {
    ClaudeDetectService::detect().await
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

    let path = crate::services::wrapper_service::WrapperService::generate(&db, &profile).await?;

    Ok(GenerateWrapperResult {
        success: true,
        path,
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
                Ok(path) => {
                    results.push(GenerateWrapperResult {
                        success: true,
                        path,
                        command_name: profile.command_name,
                    });
                }
                Err(e) => {
                    results.push(GenerateWrapperResult {
                        success: false,
                        path: e.to_string(),
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

    crate::services::wrapper_service::WrapperService::check_status(&db, &profile)
}
