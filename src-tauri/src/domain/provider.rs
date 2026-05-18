use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    AnthropicCompatible,
    OpenaiCompatible,
    Custom,
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::AnthropicCompatible => write!(f, "anthropic_compatible"),
            ProviderType::OpenaiCompatible => write!(f, "openai_compatible"),
            ProviderType::Custom => write!(f, "custom"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuthScheme {
    XApiKey,
    Bearer,
}

impl std::fmt::Display for AuthScheme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthScheme::XApiKey => write!(f, "x_api_key"),
            AuthScheme::Bearer => write!(f, "bearer"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderStatus {
    Ready,
    Untested,
    Error,
    Disabled,
}

impl std::fmt::Display for ProviderStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderStatus::Ready => write!(f, "ready"),
            ProviderStatus::Untested => write!(f, "untested"),
            ProviderStatus::Error => write!(f, "error"),
            ProviderStatus::Disabled => write!(f, "disabled"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub provider_type: ProviderType,
    pub base_url: String,
    pub api_key: String,
    pub auth_scheme: AuthScheme,
    pub default_model: String,
    pub enable_streaming: bool,
    pub notes: Option<String>,
    pub status: ProviderStatus,
    pub last_tested_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Provider {
    pub fn new(
        name: String,
        provider_type: ProviderType,
        base_url: String,
        api_key: String,
        auth_scheme: AuthScheme,
        default_model: String,
        enable_streaming: bool,
        notes: Option<String>,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            provider_type,
            base_url,
            api_key,
            auth_scheme,
            default_model,
            enable_streaming,
            notes,
            status: ProviderStatus::Untested,
            last_tested_at: None,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}
