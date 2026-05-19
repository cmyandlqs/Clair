use crate::db::Database;
use crate::domain::AppSettings;
use crate::proxy::server::{
    recent_evidence, ActiveRoute as ProxyActiveRoute, EvidenceStore, ProxyEvidenceEntry,
};
use crate::proxy::ProxyServer;
use crate::services::SettingsService;
use serde::Serialize;
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};
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
    pub evidence: Mutex<EvidenceStore>,
}

impl ProxyState {
    pub fn new() -> Self {
        Self {
            server: Mutex::new(None),
            shutdown_tx: Mutex::new(None),
            evidence: Mutex::new(Arc::new(Mutex::new(VecDeque::new()))),
        }
    }
}

impl Default for ProxyState {
    fn default() -> Self {
        Self::new()
    }
}

pub fn lock_safe<T>(lock: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    lock.lock().unwrap_or_else(|e| e.into_inner())
}

#[tauri::command]
pub async fn get_proxy_status(state: tauri::State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    let server_arc = {
        let guard = lock_safe(&state.server);
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
    stop_server(&state);

    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    let profiles = db.list_profiles().map_err(|e| e.to_string())?;
    let providers = db.list_providers().map_err(|e| e.to_string())?;
    let settings = load_settings(&db);

    let host = settings.proxy_host.clone();
    let port = settings.proxy_port;
    let auth_token = settings.proxy_auth_token.clone();

    let server = ProxyServer::new(host.clone(), port, profiles, providers, auth_token)?;

    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| e.to_string())?;

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    let server_arc = Arc::new(RwLock::new(server));
    let server_clone = server_arc.clone();
    let evidence_store: EvidenceStore = Arc::new(Mutex::new(VecDeque::new()));
    let evidence_clone = evidence_store.clone();

    tokio::spawn(async move {
        let app = ProxyServer::build_router(server_clone, evidence_clone).into_make_service();
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .ok();
    });

    // Update state (no await, so mutex is fine)
    {
        *lock_safe(&state.server) = Some(server_arc);
    }
    {
        *lock_safe(&state.shutdown_tx) = Some(tx);
    }
    {
        *lock_safe(&state.evidence) = evidence_store;
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
        let guard = lock_safe(&state.server);
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

#[tauri::command]
pub async fn get_proxy_evidence(
    state: tauri::State<'_, ProxyState>,
    limit: Option<usize>,
) -> Result<Vec<ProxyEvidenceEntry>, String> {
    let evidence = {
        let guard = lock_safe(&state.evidence);
        guard.clone()
    };

    Ok(recent_evidence(&evidence, limit.unwrap_or(20).min(100)))
}

fn stop_server(state: &tauri::State<'_, ProxyState>) {
    if let Some(tx) = lock_safe(&state.shutdown_tx).take() {
        let _ = tx.send(());
    }
    lock_safe(&state.server).take();
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
        let guard = lock_safe(&state.server);
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
