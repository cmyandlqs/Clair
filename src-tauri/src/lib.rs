mod commands;
mod db;
mod domain;
mod proxy;
mod security;
mod services;
mod utils;

use db::Database;
use std::path::PathBuf;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

pub fn run() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(EnvFilter::from_default_env())
        .init();

    // Setup database path
    let config_dir = dirs::config_dir()
        .map(|p| p.join("clair"))
        .unwrap_or_else(|| PathBuf::from(".clair"));

    std::fs::create_dir_all(&config_dir).expect("Failed to create config directory");

    let db_path = config_dir.join("clair.db");
    let log_dir = config_dir.join("logs");
    std::fs::create_dir_all(&log_dir).expect("Failed to create log directory");

    // Initialize database
    let db = Database::new(db_path).expect("Failed to initialize database");
    db::migrations::run_migrations(&db.connection()).expect("Failed to run migrations");

    // Initialize proxy state
    let proxy_state = commands::proxy::ProxyState::new();

    // Build Tauri app
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(db)
        .manage(proxy_state)
        .invoke_handler(tauri::generate_handler![
            // Provider commands
            commands::provider::list_providers,
            commands::provider::create_provider,
            commands::provider::update_provider,
            commands::provider::delete_provider,
            commands::provider::test_provider,
            commands::provider::test_provider_config,
            // Profile commands
            commands::profile::list_profiles,
            commands::profile::create_profile,
            commands::profile::update_profile,
            commands::profile::delete_profile,
            commands::profile::set_default_profile,
            commands::profile::test_profile,
            // Proxy commands
            commands::proxy::get_proxy_status,
            commands::proxy::start_proxy,
            commands::proxy::stop_proxy,
            commands::proxy::restart_proxy,
            commands::proxy::reload_proxy_config,
            commands::proxy::get_proxy_evidence,
            // Wrapper commands
            commands::wrapper::detect_claude_binary,
            commands::wrapper::generate_wrapper,
            commands::wrapper::generate_all_wrappers,
            commands::wrapper::check_wrapper_status,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
