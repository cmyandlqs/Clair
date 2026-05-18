use crate::db::Database;
use crate::domain::AppSettings;
use crate::proxy::ProxyServer;
use crate::proxy::server::ActiveRoute as ProxyActiveRoute;
use crate::services::SettingsService;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;

#[derive(Debug, Serialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub host: String,
    pub port: u16,
    pub active_routes: Vec<ProxyActiveRoute>,
}

pub struct ProxyState {
    pub server: Mutex<Option<Arc<RwLock<ProxyServer>>>>,
    pub shutdown_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

impl ProxyState {
    pub fn new() -> Self {
        Self {
            server: Mutex::new(None),
            shutdown_tx: Mutex::new(None),
        }
    }
}

impl Default for ProxyState {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub async fn get_proxy_status(state: tauri::State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    // Clone Arc out of mutex before awaiting
    let server_arc = {
        let guard = state.server.lock().unwrap();
        guard.clone()
    };

    match server_arc {
        Some(server) => {
            let server = server.read().await;
            Ok(ProxyStatus {
                running: true,
                host: server.host.clone(),
                port: server.port,
                active_routes: server.get_active_routes().await,
            })
        }
        None => Ok(ProxyStatus {
            running: false,
            host: "127.0.0.1".to_string(),
            port: 28789,
            active_routes: vec![],
        }),
    }
}

#[tauri::command]
pub async fn start_proxy(
    state: tauri::State<'_, ProxyState>,
    db: tauri::State<'_, Database>,
) -> Result<ProxyStatus, String> {
    // Stop existing server first
    stop_server(&state);

    // Load config from database
    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let providers = db.list_providers().map_err(|e| e.to_string())?;
    let settings = load_settings(&db);

    let host = settings.proxy_host.clone();
    let port = settings.proxy_port;
    let auth_token = settings.proxy_auth_token.clone();

    let server = ProxyServer::new(host.clone(), port, profiles, providers, auth_token)?;

    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await.map_err(|e| e.to_string())?;

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    let server_arc = Arc::new(RwLock::new(server));
    let server_clone = server_arc.clone();

    tokio::spawn(async move {
        let app = server_clone.read().await.build_router().into_make_service();
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .ok();
    });

    // Update state (no await, so mutex is fine)
    {
        *state.server.lock().unwrap() = Some(server_arc);
    }
    {
        *state.shutdown_tx.lock().unwrap() = Some(tx);
    }

    tracing::info!(host = %host, port = %port, "Proxy server started");

    get_proxy_status(state).await
}

#[tauri::command]
pub async fn stop_proxy(state: tauri::State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    stop_server(&state);

    Ok(ProxyStatus {
        running: false,
        host: "127.0.0.1".to_string(),
        port: 28789,
        active_routes: vec![],
    })
}

#[tauri::command]
pub async fn reload_proxy_config(
    state: tauri::State<'_, ProxyState>,
    db: tauri::State<'_, Database>,
) -> Result<ProxyStatus, String> {
    let server_arc = {
        let guard = state.server.lock().unwrap();
        guard.clone()
    };

    if let Some(server) = server_arc {
        let profiles = db.list_profiles().map_err(|e| e.to_string())?;
        let providers = db.list_providers().map_err(|e| e.to_string())?;
        let mut server = server.write().await;
        server.reload_config(profiles, providers);
    }

    get_proxy_status(state).await
}

#[tauri::command]
pub async fn restart_proxy(
    state: tauri::State<'_, ProxyState>,
    db: tauri::State<'_, Database>,
) -> Result<ProxyStatus, String> {
    stop_server(&state);
    start_proxy(state, db).await
}

fn stop_server(state: &tauri::State<'_, ProxyState>) {
    // Send shutdown signal
    if let Some(tx) = state.shutdown_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }
    // Clear server reference
    state.server.lock().unwrap().take();
}

fn load_settings(db: &Database) -> AppSettings {
    SettingsService::load_settings(db).unwrap_or_default()
}

/// Reload proxy config if the proxy is currently running. No-op if stopped.
pub async fn reload_proxy_config_if_running(
    state: &tauri::State<'_, ProxyState>,
    db: &Database,
) -> Result<(), String> {
    let server_arc = {
        let guard = state.server.lock().unwrap();
        guard.clone()
    };

    if let Some(server) = server_arc {
        let profiles = db.list_profiles().map_err(|e| e.to_string())?;
        let providers = db.list_providers().map_err(|e| e.to_string())?;
        let mut server = server.write().await;
        server.reload_config(profiles, providers);
    }

    Ok(())
}
