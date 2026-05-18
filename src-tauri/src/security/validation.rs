pub const RESERVED_ROUTES: &[&str] = &["/health", "/status", "/api", "/admin", "/logs"];

pub const DANGEROUS_COMMANDS: &[&str] = &[
    "bash", "sh", "sudo", "rm", "cp", "mv", "python", "node", "npm", "git", "docker", "kubectl",
    "aws", "gcloud", "cargo", "go", "java", "chmod", "chown", "kill", "pkill",
];

pub fn is_reserved_route(route: &str) -> bool {
    RESERVED_ROUTES.contains(&route)
}

pub fn is_dangerous_command(cmd: &str) -> bool {
    DANGEROUS_COMMANDS.contains(&cmd.to_ascii_lowercase().as_str())
}

pub fn is_valid_route_path(route: &str) -> bool {
    let mut chars = route.chars();
    if chars.next() != Some('/') {
        return false;
    }

    let mut has_segment = false;
    for ch in chars {
        if ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_' {
            has_segment = true;
        } else {
            return false;
        }
    }

    has_segment
}

pub fn is_valid_command_name(cmd: &str) -> bool {
    !cmd.is_empty()
        && cmd
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

pub fn is_valid_http_url(url: &str) -> bool {
    match reqwest::Url::parse(url) {
        Ok(parsed) => matches!(parsed.scheme(), "http" | "https") && parsed.host_str().is_some(),
        Err(_) => false,
    }
}
