pub mod connection;
pub mod migrations;

pub use connection::Database;

use crate::domain::{AuthScheme, Profile, Provider, ProviderStatus, ProviderType};
use chrono::Utc;
use rusqlite::params;
use std::collections::HashMap;

impl Database {
    // ============ Provider Repository ============

    pub fn list_providers(&self) -> rusqlite::Result<Vec<Provider>> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, name, provider_type, base_url, api_key, auth_scheme,
                    default_model, enable_streaming, notes, status, last_tested_at,
                    created_at, updated_at FROM providers ORDER BY name",
        )?;

        let providers = stmt
            .query_map([], |row| {
                Ok(Provider {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    provider_type: parse_provider_type(&row.get::<_, String>(2)?),
                    base_url: row.get(3)?,
                    api_key: row.get(4)?,
                    auth_scheme: parse_auth_scheme(&row.get::<_, String>(5)?),
                    default_model: row.get(6)?,
                    enable_streaming: row.get::<_, i32>(7)? == 1,
                    notes: row.get(8)?,
                    status: parse_provider_status(&row.get::<_, String>(9)?),
                    last_tested_at: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(providers)
    }

    pub fn create_provider(&self, provider: &Provider) -> rusqlite::Result<()> {
        let conn = self.connection();
        conn.execute(
            "INSERT INTO providers (id, name, provider_type, base_url, api_key,
             auth_scheme, default_model, enable_streaming, notes, status,
             created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                provider.id,
                provider.name,
                provider.provider_type.to_string(),
                provider.base_url,
                provider.api_key,
                provider.auth_scheme.to_string(),
                provider.default_model,
                provider.enable_streaming as i32,
                provider.notes,
                provider.status.to_string(),
                provider.created_at,
                provider.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_provider(&self, id: &str) -> rusqlite::Result<Option<Provider>> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, name, provider_type, base_url, api_key, auth_scheme,
                    default_model, enable_streaming, notes, status, last_tested_at,
                    created_at, updated_at FROM providers WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Provider {
                id: row.get(0)?,
                name: row.get(1)?,
                provider_type: parse_provider_type(&row.get::<_, String>(2)?),
                base_url: row.get(3)?,
                api_key: row.get(4)?,
                auth_scheme: parse_auth_scheme(&row.get::<_, String>(5)?),
                default_model: row.get(6)?,
                enable_streaming: row.get::<_, i32>(7)? == 1,
                notes: row.get(8)?,
                status: parse_provider_status(&row.get::<_, String>(9)?),
                last_tested_at: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_provider(&self, provider: &Provider) -> rusqlite::Result<()> {
        let conn = self.connection();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE providers SET name = ?1, provider_type = ?2, base_url = ?3,
             api_key = ?4, auth_scheme = ?5, default_model = ?6, enable_streaming = ?7,
             notes = ?8, status = ?9, last_tested_at = ?10, updated_at = ?11
             WHERE id = ?12",
            params![
                provider.name,
                provider.provider_type.to_string(),
                provider.base_url,
                provider.api_key,
                provider.auth_scheme.to_string(),
                provider.default_model,
                provider.enable_streaming as i32,
                provider.notes,
                provider.status.to_string(),
                provider.last_tested_at,
                now,
                provider.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_provider(&self, id: &str) -> rusqlite::Result<bool> {
        let conn = self.connection();
        let affected = conn.execute("DELETE FROM providers WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }

    pub fn provider_has_profiles(&self, id: &str) -> rusqlite::Result<bool> {
        let conn = self.connection();
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM profiles WHERE provider_id = ?1",
            params![id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    // ============ Profile Repository ============

    pub fn list_profiles(&self) -> rusqlite::Result<Vec<Profile>> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, name, route_path, provider_id, model, command_name,
                    is_default, wrapper_enabled, wrapper_path, created_at, updated_at
             FROM profiles ORDER BY is_default DESC, name",
        )?;

        let profiles = stmt
            .query_map([], |row| {
                Ok(Profile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    route_path: row.get(2)?,
                    provider_id: row.get(3)?,
                    model: row.get(4)?,
                    command_name: row.get(5)?,
                    is_default: row.get::<_, i32>(6)? == 1,
                    wrapper_enabled: row.get::<_, i32>(7)? == 1,
                    wrapper_path: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(profiles)
    }

    pub fn create_profile(&self, profile: &Profile) -> rusqlite::Result<()> {
        let conn = self.connection();
        conn.execute(
            "INSERT INTO profiles (id, name, route_path, provider_id, model, command_name,
             is_default, wrapper_enabled, wrapper_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                profile.id,
                profile.name,
                profile.route_path,
                profile.provider_id,
                profile.model,
                profile.command_name,
                profile.is_default as i32,
                profile.wrapper_enabled as i32,
                profile.wrapper_path,
                profile.created_at,
                profile.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_profile_by_route(&self, route: &str) -> rusqlite::Result<Option<Profile>> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, name, route_path, provider_id, model, command_name,
                    is_default, wrapper_enabled, wrapper_path, created_at, updated_at
             FROM profiles WHERE route_path = ?1",
        )?;

        let mut rows = stmt.query(params![route])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                route_path: row.get(2)?,
                provider_id: row.get(3)?,
                model: row.get(4)?,
                command_name: row.get(5)?,
                is_default: row.get::<_, i32>(6)? == 1,
                wrapper_enabled: row.get::<_, i32>(7)? == 1,
                wrapper_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn get_profile(&self, id: &str) -> rusqlite::Result<Option<Profile>> {
        let conn = self.connection();
        let mut stmt = conn.prepare(
            "SELECT id, name, route_path, provider_id, model, command_name,
                    is_default, wrapper_enabled, wrapper_path, created_at, updated_at
             FROM profiles WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                route_path: row.get(2)?,
                provider_id: row.get(3)?,
                model: row.get(4)?,
                command_name: row.get(5)?,
                is_default: row.get::<_, i32>(6)? == 1,
                wrapper_enabled: row.get::<_, i32>(7)? == 1,
                wrapper_path: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_profile(&self, profile: &Profile) -> rusqlite::Result<()> {
        let conn = self.connection();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE profiles SET name = ?1, route_path = ?2, provider_id = ?3, model = ?4,
             command_name = ?5, is_default = ?6, wrapper_enabled = ?7, wrapper_path = ?8,
             updated_at = ?9 WHERE id = ?10",
            params![
                profile.name,
                profile.route_path,
                profile.provider_id,
                profile.model,
                profile.command_name,
                profile.is_default as i32,
                profile.wrapper_enabled as i32,
                profile.wrapper_path,
                now,
                profile.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_profile(&self, id: &str) -> rusqlite::Result<bool> {
        let conn = self.connection();
        let affected = conn.execute("DELETE FROM profiles WHERE id = ?1", params![id])?;
        Ok(affected > 0)
    }

    pub fn clear_default_profile(&self) -> rusqlite::Result<()> {
        let conn = self.connection();
        conn.execute(
            "UPDATE profiles SET is_default = 0 WHERE is_default = 1",
            [],
        )?;
        Ok(())
    }

    pub fn set_default_profile(&self, id: &str) -> rusqlite::Result<bool> {
        let mut conn = self.connection();
        let tx = conn.transaction()?;

        let exists: i32 = tx.query_row(
            "SELECT COUNT(*) FROM profiles WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        if exists == 0 {
            tx.rollback()?;
            return Ok(false);
        }

        tx.execute("UPDATE profiles SET is_default = 0", [])?;
        tx.execute(
            "UPDATE profiles SET is_default = 1 WHERE id = ?1",
            params![id],
        )?;
        tx.commit()?;
        Ok(true)
    }

    // ============ Settings Repository ============

    pub fn set_setting(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        let conn = self.connection();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn delete_setting(&self, key: &str) -> rusqlite::Result<()> {
        let conn = self.connection();
        conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> rusqlite::Result<HashMap<String, String>> {
        let conn = self.connection();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut map = HashMap::new();
        for row in rows {
            let (k, v) = row?;
            map.insert(k, v);
        }
        Ok(map)
    }
}

// ============ Helper Functions ============

fn parse_provider_type(s: &str) -> ProviderType {
    match s {
        "anthropic_compatible" => ProviderType::AnthropicCompatible,
        "openai_compatible" => ProviderType::OpenaiCompatible,
        _ => ProviderType::Custom,
    }
}

fn parse_auth_scheme(s: &str) -> AuthScheme {
    match s {
        "bearer" => AuthScheme::Bearer,
        _ => AuthScheme::XApiKey,
    }
}

fn parse_provider_status(s: &str) -> ProviderStatus {
    match s {
        "ready" => ProviderStatus::Ready,
        "error" => ProviderStatus::Error,
        "disabled" => ProviderStatus::Disabled,
        _ => ProviderStatus::Untested,
    }
}
