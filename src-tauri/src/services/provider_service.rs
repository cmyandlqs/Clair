use crate::domain::{Provider, ProviderStatus, ProviderType};
use reqwest::Client;
use serde::Serialize;
use std::time::Instant;

#[derive(Debug, Serialize)]
pub struct TestProviderResult {
    pub ok: bool,
    pub latency_ms: Option<u64>,
    pub message: String,
    pub model: Option<String>,
    pub streaming_supported: Option<bool>,
}

pub struct ProviderService;

impl ProviderService {
    pub async fn test_config(
        provider_type: &ProviderType,
        base_url: &str,
        api_key: &str,
        auth_scheme: &crate::domain::AuthScheme,
        default_model: &str,
    ) -> Result<TestProviderResult, String> {
        let provider = Provider {
            id: String::new(),
            name: String::new(),
            provider_type: provider_type.clone(),
            base_url: base_url.to_string(),
            api_key: api_key.to_string(),
            auth_scheme: auth_scheme.clone(),
            default_model: default_model.to_string(),
            enable_streaming: true,
            notes: None,
            status: ProviderStatus::Untested,
            last_tested_at: None,
            created_at: String::new(),
            updated_at: String::new(),
        };
        Self::test_provider(&provider).await
    }

    pub async fn test_provider(provider: &Provider) -> Result<TestProviderResult, String> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        // Determine endpoint based on provider type
        // Anthropic uses /v1/messages, OpenAI/GLM use /v1/chat/completions
        let url = match provider.provider_type {
            ProviderType::AnthropicCompatible => {
                format!("{}/v1/messages", provider.base_url.trim_end_matches('/'))
            }
            ProviderType::OpenaiCompatible | ProviderType::Custom => {
                // GLM and OpenAI compatible APIs use chat completions
                format!("{}/v4/chat/completions", provider.base_url.trim_end_matches('/'))
            }
        };

        tracing::info!("[test_provider] testing URL: {}", url);

        // Build request body based on provider type
        let request_body = match provider.provider_type {
            ProviderType::AnthropicCompatible => {
                serde_json::json!({
                    "model": provider.default_model,
                    "messages": [{"role": "user", "content": "Say ok."}],
                    "max_tokens": 8
                })
            }
            ProviderType::OpenaiCompatible | ProviderType::Custom => {
                serde_json::json!({
                    "model": provider.default_model,
                    "messages": [{"role": "user", "content": "Say ok."}],
                    "max_tokens": 8
                })
            }
        };

        let start = Instant::now();

        let mut req_builder = client.post(&url).header("Content-Type", "application/json");

        match provider.auth_scheme {
            crate::domain::AuthScheme::XApiKey => {
                req_builder = req_builder.header("x-api-key", &provider.api_key);
            }
            crate::domain::AuthScheme::Bearer => {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", provider.api_key));
            }
        }

        let response = req_builder.body(request_body.to_string()).send().await;

        let latency_ms = start.elapsed().as_millis() as u64;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    Ok(TestProviderResult {
                        ok: true,
                        latency_ms: Some(latency_ms),
                        message: "Connected".to_string(),
                        model: Some(provider.default_model.clone()),
                        streaming_supported: Some(provider.enable_streaming),
                    })
                } else {
                    let error_message = match resp.status().as_u16() {
                        401 => "401 Unauthorized: Please check API key or auth scheme.",
                        403 => "403 Forbidden: Please check API key permissions.",
                        404 => "404 Not Found: Please check base URL or API endpoint.",
                        422 => "422 Unprocessable: Model may not exist.",
                        _ => resp.status().canonical_reason().unwrap_or("Unknown error"),
                    };

                    Ok(TestProviderResult {
                        ok: false,
                        latency_ms: Some(latency_ms),
                        message: error_message.to_string(),
                        model: None,
                        streaming_supported: None,
                    })
                }
            }
            Err(e) => {
                let message = if e.is_timeout() {
                    "Timeout: Provider did not respond within 15s.".to_string()
                } else if e.is_connect() {
                    "Connection failed: Please check base URL.".to_string()
                } else {
                    e.to_string()
                };

                Ok(TestProviderResult {
                    ok: false,
                    latency_ms: Some(latency_ms),
                    message,
                    model: None,
                    streaming_supported: None,
                })
            }
        }
    }
}