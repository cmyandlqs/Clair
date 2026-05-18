use rusqlite::Connection;

pub fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            auth_scheme TEXT NOT NULL,
            default_model TEXT NOT NULL,
            enable_streaming INTEGER NOT NULL DEFAULT 1,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'untested',
            last_tested_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            route_path TEXT NOT NULL UNIQUE,
            provider_id TEXT NOT NULL,
            model TEXT NOT NULL,
            command_name TEXT NOT NULL UNIQUE,
            is_default INTEGER NOT NULL DEFAULT 0,
            wrapper_enabled INTEGER NOT NULL DEFAULT 1,
            wrapper_path TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(provider_id) REFERENCES providers(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS request_logs (
            id TEXT PRIMARY KEY,
            profile_id TEXT,
            provider_id TEXT,
            model TEXT,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            status_code INTEGER,
            latency_ms INTEGER,
            error TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_profiles_route_path ON profiles(route_path);
        CREATE INDEX IF NOT EXISTS idx_profiles_provider_id ON profiles(provider_id);
        CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_request_logs_profile_id ON request_logs(profile_id);
        "#,
    )?;

    Ok(())
}
