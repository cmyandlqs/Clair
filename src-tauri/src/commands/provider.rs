use crate::commands::proxy::ProxyState;
use crate::db::Database;
use crate::domain::{AuthScheme, Provider, ProviderStatus, ProviderType};
use crate::security::validation::is_valid_http_url;
use crate::services::provider_service::ProviderService;
use crate::services::provider_service::TestProviderResult;
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct CreateProviderInput {
    pub name: String,
    #[serde(rename = "type")]
    pub provider_type: ProviderType,
    pub base_url: String,
    pub api_key: String,
    pub auth_scheme: AuthScheme,
    pub default_model: String,
    pub enable_streaming: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProviderInput {
    pub id: String,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub provider_type: Option<ProviderType>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub auth_scheme: Option<AuthScheme>,
    pub default_model: Option<String>,
    pub enable_streaming: Option<bool>,
    pub notes: Option<String>,
    pub status: Option<ProviderStatus>,
}

#[tauri::command]
pub async fn list_providers(db: State<'_, Database>) -> Result<Vec<Provider>, String> {
    db.list_providers().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_provider(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    input: CreateProviderInput,
) -> Result<Provider, String> {
    tracing::info!(name = %input.name, "Creating provider");
    validate_base_url(&input.base_url)?;

    let provider = Provider::new(
        input.name,
        input.provider_type,
        input.base_url,
        input.api_key,
        input.auth_scheme,
        input.default_model,
        input.enable_streaming,
        input.notes,
    );

    db.create_provider(&provider).map_err(|e| e.to_string())?;

    if let Err(e) = super::proxy::reload_proxy_config_if_running(&proxy_state, &db).await {
        tracing::warn!("Failed to reload proxy config after provider create: {}", e);
    }

    tracing::info!(id = %provider.id, "Provider created");
    Ok(provider)
}

#[tauri::command]
pub async fn update_provider(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    input: UpdateProviderInput,
) -> Result<Provider, String> {
    tracing::info!(id = %input.id, "Updating provider");

    let mut provider = db
        .get_provider(&input.id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;

    if let Some(v) = input.name {
        provider.name = v;
    }
    if let Some(v) = input.provider_type {
        provider.provider_type = v;
    }
    if let Some(v) = input.base_url {
        provider.base_url = v;
    }
    if let Some(v) = input.api_key {
        provider.api_key = v;
    }
    if let Some(v) = input.auth_scheme {
        provider.auth_scheme = v;
    }
    if let Some(v) = input.default_model {
        provider.default_model = v;
    }
    if let Some(v) = input.enable_streaming {
        provider.enable_streaming = v;
    }
    if let Some(v) = input.notes {
        provider.notes = Some(v);
    }
    if let Some(v) = input.status {
        provider.status = v;
    }

    validate_base_url(&provider.base_url)?;

    db.update_provider(&provider).map_err(|e| e.to_string())?;

    if let Err(e) = super::proxy::reload_proxy_config_if_running(&proxy_state, &db).await {
        tracing::warn!("Failed to reload proxy config after provider update: {}", e);
    }

    tracing::info!(id = %provider.id, "Provider updated");
    Ok(provider)
}

#[tauri::command]
pub async fn delete_provider(
    db: State<'_, Database>,
    proxy_state: State<'_, ProxyState>,
    id: String,
) -> Result<bool, String> {
    if db.provider_has_profiles(&id).map_err(|e| e.to_string())? {
        return Err(
            "Provider is used by existing profiles. Please delete or reassign them first."
                .to_string(),
        );
    }

    db.delete_provider(&id).map_err(|e| e.to_string())?;
    if let Err(e) = super::proxy::reload_proxy_config_if_running(&proxy_state, &db).await {
        tracing::warn!("Failed to reload proxy config after provider delete: {}", e);
    }
    Ok(true)
}

#[tauri::command]
pub async fn test_provider(
    db: State<'_, Database>,
    id: String,
) -> Result<TestProviderResult, String> {
    let provider = db
        .get_provider(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Provider not found".to_string())?;

    let result = ProviderService::test_provider(&provider).await;

    if let Ok(ref r) = result {
        let status = if r.ok {
            ProviderStatus::Ready
        } else {
            ProviderStatus::Error
        };
        let _ = db.update_provider(&Provider {
            status,
            last_tested_at: Some(chrono::Utc::now().to_rfc3339()),
            ..provider
        });
    }

    result
}

#[derive(Debug, Deserialize)]
pub struct TestProviderConfigInput {
    pub provider_type: ProviderType,
    pub base_url: String,
    pub api_key: String,
    pub auth_scheme: AuthScheme,
    pub default_model: String,
}

#[tauri::command]
pub async fn test_provider_config(
    input: TestProviderConfigInput,
) -> Result<TestProviderResult, String> {
    tracing::info!(provider_type = %input.provider_type, base_url = %input.base_url, "Testing provider config");
    validate_base_url(&input.base_url)?;
    ProviderService::test_config(
        &input.provider_type,
        &input.base_url,
        &input.api_key,
        &input.auth_scheme,
        &input.default_model,
    )
    .await
}

fn validate_base_url(url: &str) -> Result<(), String> {
    if is_valid_http_url(url) {
        Ok(())
    } else {
        Err("Base URL must be a valid http:// or https:// URL".to_string())
    }
}
