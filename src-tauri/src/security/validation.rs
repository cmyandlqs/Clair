pub const RESERVED_ROUTES: &[&str] = &[
    "/health",
    "/status",
    "/api",
    "/admin",
    "/logs",
];

pub const DANGEROUS_COMMANDS: &[&str] = &[
    "rm",
    "sudo",
    "chmod",
    "chown",
    "kill",
    "pkill",
];

pub fn is_reserved_route(route: &str) -> bool {
    RESERVED_ROUTES.contains(&route)
}

pub fn is_dangerous_command(cmd: &str) -> bool {
    DANGEROUS_COMMANDS.contains(&cmd)
}