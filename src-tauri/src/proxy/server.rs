use crate::domain::{Profile, Provider};
use crate::security::secret::mask_api_key;
use axum::{
    body::Body,
    extract::State,
    http::{HeaderName, Request, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use std::{collections::HashMap, sync::Arc};
use tracing::{info, warn};
use uuid::Uuid;

const MAX_REQUEST_BODY: usize = 10_000_000;

#[derive(Clone)]
pub struct ProxyServer {
    pub host: String,
    pub port: u16,
    pub profiles: Vec<Profile>,
    pub providers: HashMap<String, Provider>,
    pub auth_token: String,
    client: reqwest::Client,
}

impl ProxyServer {
    pub fn reload_config(&mut self, profiles: Vec<Profile>, providers: Vec<Provider>) {
        self.profiles = profiles;
        self.providers = providers.into_iter().map(|p| (p.id.clone(), p)).collect();
        info!(
            profiles = self.profiles.iter().map(|p| p.route_path.as_str()).collect::<Vec<_>>().join(", "),
            providers = self.providers.len(),
            "Proxy config reloaded"
        );
    }
}

#[derive(Clone)]
struct ProxyServerState {
    server: Arc<ProxyServer>,
}

impl ProxyServer {
    pub fn new(
        host: String,
        port: u16,
        profiles: Vec<Profile>,
        providers: Vec<Provider>,
        auth_token: String,
    ) -> Result<Self, String> {
        let providers: HashMap<String, Provider> = providers.into_iter()
            .map(|p| (p.id.clone(), p))
            .collect();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .connect_timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        Ok(Self {
            host,
            port,
            profiles,
            providers,
            auth_token,
            client,
        })
    }

    pub fn build_router(&self) -> Router {
        let state = ProxyServerState {
            server: Arc::new(self.clone()),
        };

        Router::new()
            .route("/health", get(Self::health_handler))
            .route("/status", get(Self::status_handler))
            .fallback(Self::proxy_handler)
            .with_state(state)
    }

    async fn health_handler() -> &'static str {
        "ok"
    }

    async fn status_handler(State(state): State<ProxyServerState>) -> String {
        let profiles = state.server.profiles.len();
        let providers = state.server.providers.len();
        format!("Clair Proxy: {} profiles, {} providers", profiles, providers)
    }

    async fn proxy_handler(
        State(state): State<ProxyServerState>,
        request: Request<Body>,
    ) -> Response {
        let method = request.method().clone();
        let path = request.uri().path().to_string();
        let path_trimmed = path.trim_start_matches('/');

        info!(path = %path, method = %method, "Incoming proxy request");

        // Validate auth token
        if let Some(auth_header) = request.headers().get("authorization") {
            if let Ok(auth_str) = auth_header.to_str() {
                let token = auth_str.strip_prefix("Bearer ").unwrap_or(auth_str);
                if token != state.server.auth_token {
                    warn!(path = %path, "Auth failed: invalid Bearer token");
                    return json_error_response(StatusCode::UNAUTHORIZED, "unauthorized", "Invalid auth token");
                }
            }
        } else if let Some(token_header) = request.headers().get("x-api-key") {
            if let Ok(token) = token_header.to_str() {
                if token != state.server.auth_token {
                    warn!(path = %path, "Auth failed: invalid x-api-key");
                    return json_error_response(StatusCode::UNAUTHORIZED, "unauthorized", "Invalid auth token");
                }
            }
        }

        // Parse route from path: "/minimax/v1/messages" -> route="/minimax", remaining="/v1/messages"
        let parts: Vec<&str> = path_trimmed.splitn(2, '/').filter(|s| !s.is_empty()).collect();
        if parts.is_empty() {
            warn!(path = %path, "Empty route path");
            return json_error_response(StatusCode::NOT_FOUND, "route_not_found", "Empty route path");
        }

        let route = format!("/{}", parts[0]);
        let remaining_path = parts.get(1).map(|p| format!("/{}", p)).unwrap_or_default();

        // Find profile by route
        let profile = match state.server.profiles.iter().find(|p| p.route_path == route) {
            Some(p) => p.clone(),
            None => {
                let available: Vec<&str> = state.server.profiles.iter().map(|p| p.route_path.as_str()).collect();
                warn!(path = %path, route = %route, available_routes = ?available, "No profile matched route");
                return json_error_response(
                    StatusCode::NOT_FOUND,
                    "profile_not_found",
                    &format!("No profile for route: {} (available: {})", route, available.join(", ")),
                );
            }
        };

        // Get provider
        let provider = match state.server.providers.get(&profile.provider_id) {
            Some(p) => p.clone(),
            None => {
                warn!(route = %route, provider_id = %profile.provider_id, "Provider not found for profile");
                return json_error_response(StatusCode::NOT_FOUND, "provider_not_found", "Provider not found for profile");
            }
        };

        let request_id = Uuid::new_v4().to_string();
        let start = std::time::Instant::now();

        info!(
            request_id = %request_id,
            route = %route,
            remaining = %remaining_path,
            provider = %provider.name,
            api_key = %mask_api_key(&provider.api_key),
            "Proxying request"
        );

        // Build upstream URL, avoiding /v1 duplication
        let upstream_url = build_upstream_url(&provider.base_url, &remaining_path);
        info!(request_id = %request_id, upstream_url = %upstream_url, "Upstream URL built");

        // Forward request
        let result = state.server.forward_request(&upstream_url, &provider, &profile, request).await;

        let latency_ms = start.elapsed().as_millis() as u64;
        match &result {
            Ok(resp) => info!(
                request_id = %request_id,
                status = %resp.status(),
                latency_ms = latency_ms,
                "Request completed"
            ),
            Err(e) => warn!(
                request_id = %request_id,
                error = %e,
                latency_ms = latency_ms,
                "Request failed"
            ),
        }

        match result {
            Ok(response) => response,
            Err(e) => {
                let error_body = serde_json::json!({
                    "type": "error",
                    "error": {
                        "type": "provider_connection_error",
                        "message": e.to_string()
                    }
                }).to_string();

                Response::builder()
                    .status(StatusCode::BAD_GATEWAY)
                    .header("Content-Type", "application/json")
                    .body(Body::from(error_body))
                    .unwrap()
            }
        }
    }

    async fn forward_request(
        &self,
        upstream_url: &str,
        provider: &Provider,
        profile: &Profile,
        request: Request<Body>,
    ) -> Result<Response, String> {
        let method = request.method().clone();
        let mut req_builder = self.client.request(method.clone(), upstream_url);

        // Set auth header based on provider auth scheme
        match provider.auth_scheme {
            crate::domain::AuthScheme::XApiKey => {
                req_builder = req_builder.header("x-api-key", &provider.api_key);
            }
            crate::domain::AuthScheme::Bearer => {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", provider.api_key));
            }
        }

        // Copy headers (filtered)
        let hop_by_hop = [
            "authorization",
            "x-api-key",
            "host",
            "content-length",
            "transfer-encoding",
            "connection",
            "keep-alive",
            "upgrade",
        ];
        for (key, value) in request.headers() {
            let key_str = key.as_str();
            if hop_by_hop.iter().any(|h| h.eq_ignore_ascii_case(key_str)) {
                continue;
            }
            req_builder = req_builder.header(key_str, value);
        }

        // Collect body
        let body = axum::body::to_bytes(request.into_body(), MAX_REQUEST_BODY)
            .await
            .map_err(|e| format!("Failed to read request body: {}", e))?
            .to_vec();

        // Override model in body if present
        let body = if let Ok(mut json) = serde_json::from_slice::<serde_json::Value>(&body) {
            if json.get("model").is_some() {
                json["model"] = serde_json::Value::String(profile.model.clone());
                serde_json::to_vec(&json).map_err(|e| e.to_string())?
            } else {
                body
            }
        } else {
            body
        };

        req_builder = req_builder.body(body);

        // Send request
        let response = req_builder.send().await.map_err(|e| e.to_string())?;

        let status = response.status();
        let headers = response.headers().clone();

        let stream = response.bytes_stream();

        // Build response with forwarded headers
        let mut builder = Response::builder().status(status);

        // Forward relevant response headers
        let forward_headers = [
            "content-type",
            "cache-control",
            "x-request-id",
            "x-ratelimit-remaining",
            "x-ratelimit-limit",
            "x-ratelimit-reset",
            "retry-after",
        ];
        for header_name in &forward_headers {
            if let Some(value) = headers.get(*header_name) {
                let name = HeaderName::from_bytes(header_name.as_bytes()).unwrap();
                builder = builder.header(name, value);
            }
        }

        // Ensure content-type is set
        if !builder.headers_ref().map_or(false, |h| h.contains_key("content-type")) {
            builder = builder.header("content-type", "application/json");
        }

        builder
            .body(Body::from_stream(stream))
            .map_err(|e| e.to_string())
    }

    pub async fn get_active_routes(&self) -> Vec<ActiveRoute> {
        self.profiles
            .iter()
            .map(|p| {
                let provider_name = self
                    .providers
                    .get(&p.provider_id)
                    .map(|pr| pr.name.clone())
                    .unwrap_or_default();
                ActiveRoute {
                    route_path: p.route_path.clone(),
                    profile_name: p.name.clone(),
                    provider_name,
                }
            })
            .collect()
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ActiveRoute {
    pub route_path: String,
    pub profile_name: String,
    pub provider_name: String,
}

fn json_error_response(status: StatusCode, error_type: &str, message: &str) -> Response {
    let body = serde_json::json!({
        "type": "error",
        "error": {
            "type": error_type,
            "message": message
        }
    }).to_string();
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .body(Body::from(body))
        .unwrap()
}

/// Build upstream URL avoiding path duplication.
///
/// Rules:
///   base_url="https://api.example.com/v1", remaining="/v1/messages"
///     → "https://api.example.com/v1/messages"  (strip leading /v1 from remaining)
///
///   base_url="https://api.example.com", remaining="/v1/messages"
///     → "https://api.example.com/v1/messages"  (no stripping)
fn build_upstream_url(base_url: &str, remaining_path: &str) -> String {
    let base = base_url.trim_end_matches('/');
    let base_ends_with_v1 = base.ends_with("/v1");

    if base_ends_with_v1 && remaining_path.starts_with("/v1") {
        // Avoid /v1/v1 duplication: strip the /v1 prefix from remaining
        let stripped = &remaining_path[3..]; // skip "/v1"
        format!("{}{}", base, stripped)
    } else {
        format!("{}{}", base, remaining_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_upstream_url_no_duplication() {
        // base_url contains /v1, remaining starts with /v1 → strip duplicate
        assert_eq!(
            build_upstream_url("https://api.minimax.chat/v1", "/v1/messages"),
            "https://api.minimax.chat/v1/messages"
        );
    }

    #[test]
    fn test_build_upstream_url_no_v1_in_base() {
        // base_url has no /v1 → keep remaining as-is
        assert_eq!(
            build_upstream_url("https://api.example.com", "/v1/messages"),
            "https://api.example.com/v1/messages"
        );
    }

    #[test]
    fn test_build_upstream_url_trailing_slash() {
        assert_eq!(
            build_upstream_url("https://api.example.com/v1/", "/v1/messages"),
            "https://api.example.com/v1/messages"
        );
    }

    #[test]
    fn test_build_upstream_url_no_v1_in_remaining() {
        assert_eq!(
            build_upstream_url("https://api.example.com/v1", "/messages"),
            "https://api.example.com/v1/messages"
        );
    }

    #[test]
    fn test_build_upstream_url_neither_has_v1() {
        assert_eq!(
            build_upstream_url("https://api.example.com", "/messages"),
            "https://api.example.com/messages"
        );
    }

    #[test]
    fn test_route_path_parsing() {
        // Simulates the parsing logic in proxy_handler
        let path = "/minimax/v1/messages";
        let path_trimmed = path.trim_start_matches('/');
        let parts: Vec<&str> = path_trimmed.splitn(2, '/').filter(|s| !s.is_empty()).collect();
        assert_eq!(parts, vec!["minimax", "v1/messages"]);

        let route = format!("/{}", parts[0]);
        let remaining = parts.get(1).map(|p| format!("/{}", p)).unwrap_or_default();
        assert_eq!(route, "/minimax");
        assert_eq!(remaining, "/v1/messages");
    }

    #[test]
    fn test_route_path_parsing_no_subpath() {
        let path = "/minimax";
        let path_trimmed = path.trim_start_matches('/');
        let parts: Vec<&str> = path_trimmed.splitn(2, '/').filter(|s| !s.is_empty()).collect();
        assert_eq!(parts, vec!["minimax"]);

        let route = format!("/{}", parts[0]);
        let remaining = parts.get(1).map(|p| format!("/{}", p)).unwrap_or_default();
        assert_eq!(route, "/minimax");
        assert_eq!(remaining, "");
    }

    #[test]
    fn test_route_path_parsing_trailing_slash() {
        let path = "/minimax/";
        let path_trimmed = path.trim_start_matches('/');
        let parts: Vec<&str> = path_trimmed.splitn(2, '/').filter(|s| !s.is_empty()).collect();
        assert_eq!(parts, vec!["minimax"]);

        let route = format!("/{}", parts[0]);
        let remaining = parts.get(1).map(|p| format!("/{}", p)).unwrap_or_default();
        assert_eq!(route, "/minimax");
        assert_eq!(remaining, "");
    }

    #[test]
    fn test_route_path_parsing_deep_path() {
        let path = "/glm/v1/messages/completions";
        let path_trimmed = path.trim_start_matches('/');
        let parts: Vec<&str> = path_trimmed.splitn(2, '/').filter(|s| !s.is_empty()).collect();
        assert_eq!(parts, vec!["glm", "v1/messages/completions"]);

        let route = format!("/{}", parts[0]);
        let remaining = parts.get(1).map(|p| format!("/{}", p)).unwrap_or_default();
        assert_eq!(route, "/glm");
        assert_eq!(remaining, "/v1/messages/completions");
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::util::ServiceExt;

    fn create_test_server() -> ProxyServer {
        use crate::domain::Profile;
        let profile = Profile {
            id: "test-profile".into(),
            name: "test".into(),
            route_path: "/minimax".into(),
            provider_id: "test-provider".into(),
            model: "test-model".into(),
            command_name: "claude-test".into(),
            is_default: false,
            wrapper_enabled: false,
            wrapper_path: None,
            created_at: "2025-01-01T00:00:00Z".into(),
            updated_at: "2025-01-01T00:00:00Z".into(),
        };
        ProxyServer::new(
            "127.0.0.1".into(),
            28789,
            vec![profile],
            vec![],
            "test-token".into(),
        ).unwrap()
    }

    #[tokio::test]
    async fn test_fallback_catches_minimax_route() {
        let server = create_test_server();
        let app = server.build_router();

        let response = app
            .oneshot(Request::builder().uri("/minimax/v1/messages").body(Body::from("")).unwrap())
            .await
            .unwrap();

        // Should NOT be 404 page not found - fallback should catch it
        // Since provider doesn't exist, it should return provider_not_found (still 404 but with JSON body)
        let ct = response.headers().get("content-type").unwrap().to_str().unwrap();
        assert_ne!(ct, "text/plain", "Should return JSON, not Axum default text/plain");

        let body = axum::body::to_bytes(response.into_body(), 10000).await.unwrap();
        let body_str = String::from_utf8(body.to_vec()).unwrap();
        assert!(!body_str.contains("404 page not found"), "Should not return default Axum 404");
    }

    #[tokio::test]
    async fn test_health_works() {
        let server = create_test_server();
        let app = server.build_router();

        let response = app
            .oneshot(Request::builder().uri("/health").body(Body::from("")).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
