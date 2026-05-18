use crate::commands::proxy::ProxyState;
use crate::db::Database;
use crate::domain::Profile;
use crate::security::validation::{
    is_dangerous_command, is_reserved_route, is_valid_command_name, is_valid_route_path,
};
use chrono::Utc;
use serde::Deserialize;
use tauri::State;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateProfileInput {
    pub name: String,
    pub route_path: String,
    pub provider_id: String,
    pub model: String,
    pub command_name: String,
    pub is_default: bool,
    pub wrapper_enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileInput {
    pub id: String,
    pub name: Option<String>,
    pub route_path: Option<String>,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub command_name: Option<String>,
    pub is_default: Option<bool>,
    pub wrapper_enabled: Option<bool>,
}

#[tauri::command]
pub async fn list_profiles(db: State<'_, Database>) -> Result<Vec<Profile>, String> {
    db.list_profiles().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_profile(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    input: CreateProfileInput,
) -> Result<Profile, String> {
    validate_route_path(&input.route_path)?;
    validate_command_name(&input.command_name)?;

    // Verify provider exists
    db.get_provider(&input.provider_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;

    // Check for duplicate routes
    if db
        .get_profile_by_route(&input.route_path)
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Route path already exists".to_string());
    }

    let now = Utc::now().to_rfc3339();
    let profile = Profile {
        id: Uuid::new_v4().to_string(),
        name: input.name,
        route_path: input.route_path,
        provider_id: input.provider_id,
        model: input.model,
        command_name: input.command_name,
        is_default: input.is_default,
        wrapper_enabled: input.wrapper_enabled,
        wrapper_path: None,
        created_at: now.clone(),
        updated_at: now,
    };

    if profile.is_default {
        db.clear_default_profile().map_err(|e| e.to_string())?;
    }

    db.create_profile(&profile).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint") {
            "Route path or command name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    let _ = super::proxy::reload_proxy_config_if_running(&proxy_state, &db).await;

    Ok(profile)
}

#[tauri::command]
pub async fn update_profile(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    input: UpdateProfileInput,
) -> Result<Profile, String> {
    let mut profile = db
        .get_profile(&input.id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Profile not found".to_string())?;

    if let Some(name) = input.name {
        profile.name = name;
    }
    if let Some(route_path) = input.route_path {
        validate_route_path(&route_path)?;
        profile.route_path = route_path;
    }
    if let Some(provider_id) = input.provider_id {
        // Verify provider exists
        db.get_provider(&provider_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Provider not found".to_string())?;
        profile.provider_id = provider_id;
    }
    if let Some(model) = input.model {
        profile.model = model;
    }
    if let Some(command_name) = input.command_name {
        validate_command_name(&command_name)?;
        profile.command_name = command_name;
    }
    if let Some(is_default) = input.is_default {
        if is_default {
            db.clear_default_profile().map_err(|e| e.to_string())?;
        }
        profile.is_default = is_default;
    }
    if let Some(wrapper_enabled) = input.wrapper_enabled {
        profile.wrapper_enabled = wrapper_enabled;
    }

    db.update_profile(&profile).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint") {
            "Route path or command name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    let _ = super::proxy::reload_proxy_config_if_running(&proxy_state, &db).await;

    Ok(profile)
}

#[tauri::command]
pub async fn delete_profile(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    id: String,
) -> Result<bool, String> {
    db.delete_profile(&id).map_err(|e| e.to_string())?;
    let _ = super::proxy::reload_proxy_config_if_running(&proxy_state, &db).await;
    Ok(true)
}

#[tauri::command]
pub async fn set_default_profile(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    id: String,
) -> Result<Profile, String> {
    if !db.set_default_profile(&id).map_err(|e| e.to_string())? {
        return Err("Profile not found".to_string());
    }

    let _ = super::proxy::reload_proxy_config_if_running(&proxy_state, &db).await;

    db.get_profile(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Profile not found".to_string())
}

fn validate_route_path(route: &str) -> Result<(), String> {
    if !is_valid_route_path(route) {
        return Err(
            "Route path must start with / and contain only lowercase letters, numbers, - and _"
                .to_string(),
        );
    }
    if is_reserved_route(route) {
        return Err("This route path is reserved".to_string());
    }
    Ok(())
}

fn validate_command_name(cmd: &str) -> Result<(), String> {
    if !is_valid_command_name(cmd) {
        return Err("Command name can only contain letters, numbers, - and _".to_string());
    }
    if is_dangerous_command(cmd) {
        return Err("This command name is not allowed".to_string());
    }
    Ok(())
}
