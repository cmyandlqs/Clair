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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TestProtocol {
    Anthropic,
    OpenAi,
}

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

        let protocol = detect_test_protocol(provider);
        let url = build_test_endpoint(provider, protocol);

        tracing::info!("[test_provider] testing URL: {}", url);

        let request_body = build_test_request_body(provider, protocol);

        let start = Instant::now();

        let mut req_builder = client.post(&url).header("Content-Type", "application/json");

        match provider.auth_scheme {
            crate::domain::AuthScheme::XApiKey => {
                req_builder = req_builder.header("x-api-key", &provider.api_key);
            }
            crate::domain::AuthScheme::Bearer => {
                req_builder =
                    req_builder.header("Authorization", format!("Bearer {}", provider.api_key));
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

fn detect_test_protocol(provider: &Provider) -> TestProtocol {
    let trimmed = provider.base_url.trim_end_matches('/');

    match provider.provider_type {
        ProviderType::AnthropicCompatible => TestProtocol::Anthropic,
        ProviderType::OpenaiCompatible => TestProtocol::OpenAi,
        ProviderType::Custom => {
            if trimmed.ends_with("/messages") || trimmed.ends_with("/v1/messages") {
                TestProtocol::Anthropic
            } else if trimmed.ends_with("/chat/completions")
                || trimmed.ends_with("/v1/chat/completions")
            {
                TestProtocol::OpenAi
            } else {
                TestProtocol::Anthropic
            }
        }
    }
}

fn build_test_endpoint(provider: &Provider, protocol: TestProtocol) -> String {
    let base = provider.base_url.trim_end_matches('/');

    match protocol {
        TestProtocol::Anthropic => {
            if base.ends_with("/messages") || base.ends_with("/v1/messages") {
                base.to_string()
            } else {
                format!("{base}/v1/messages")
            }
        }
        TestProtocol::OpenAi => {
            if base.ends_with("/chat/completions") || base.ends_with("/v1/chat/completions") {
                base.to_string()
            } else {
                format!("{base}/v1/chat/completions")
            }
        }
    }
}

fn build_test_request_body(provider: &Provider, protocol: TestProtocol) -> serde_json::Value {
    match protocol {
        TestProtocol::Anthropic => serde_json::json!({
            "model": provider.default_model,
            "messages": [{"role": "user", "content": "Say ok."}],
            "max_tokens": 8
        }),
        TestProtocol::OpenAi => serde_json::json!({
            "model": provider.default_model,
            "messages": [{"role": "user", "content": "Say ok."}],
            "max_tokens": 8
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{AuthScheme, Provider};

    fn build_provider(provider_type: ProviderType, base_url: &str) -> Provider {
        Provider {
            id: "provider-1".to_string(),
            name: "Provider".to_string(),
            provider_type,
            base_url: base_url.to_string(),
            api_key: "secret".to_string(),
            auth_scheme: AuthScheme::Bearer,
            default_model: "test-model".to_string(),
            enable_streaming: true,
            notes: None,
            status: ProviderStatus::Untested,
            last_tested_at: None,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }

    #[test]
    fn openai_provider_uses_v1_chat_completions() {
        let provider = build_provider(ProviderType::OpenaiCompatible, "https://api.example.com");
        assert_eq!(
            build_test_endpoint(&provider, detect_test_protocol(&provider)),
            "https://api.example.com/v1/chat/completions"
        );
    }

    #[test]
    fn custom_provider_preserves_messages_endpoint() {
        let provider = build_provider(
            ProviderType::Custom,
            "https://api.example.com/custom/messages",
        );
        assert_eq!(detect_test_protocol(&provider), TestProtocol::Anthropic);
        assert_eq!(
            build_test_endpoint(&provider, detect_test_protocol(&provider)),
            "https://api.example.com/custom/messages"
        );
    }
}
