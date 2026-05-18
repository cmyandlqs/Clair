use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub route_path: String,
    pub provider_id: String,
    pub model: String,
    pub command_name: String,
    pub is_default: bool,
    pub wrapper_enabled: bool,
    pub wrapper_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
