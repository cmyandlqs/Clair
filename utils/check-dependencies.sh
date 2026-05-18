#!/bin/bash
# Dependency Checker for Clair Project
# Analyzes package.json and Cargo.toml to check for missing dependencies

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "========================================"
echo "Clair Dependency Checker"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to extract version from package.json
get_npm_version() {
    local package=$1
    local scope=$2
    local search_path="${PROJECT_ROOT}"
    if [ -f "${search_path}/package.json" ]; then
        if [ -n "$scope" ]; then
            grep -o "\"${scope}/${package}\": *[^,]*" "${search_path}/package.json" 2>/dev/null | sed 's/.*"version": *"\([^"]*\)".*/\1/' | head -1
        else
            grep -o "\"${package}\": *[^,]*" "${search_path}/package.json" 2>/dev/null | sed 's/.*"version": *"\([^"]*\)".*/\1/' | head -1
        fi
    fi
}

# Function to check if crate exists in Cargo.toml
check_cargo_toml() {
    local crate=$1
    local search_path="${PROJECT_ROOT}/src-tauri"
    if [ -d "$search_path" ]; then
        find "$search_path" -name "Cargo.toml" -exec grep -l "^${crate} " {} \; 2>/dev/null | head -1
    fi
}

echo -e "${CYAN}Checking package.json...${NC}"
if [ -f "${PROJECT_ROOT}/package.json" ]; then
    echo -e "${GREEN}Found package.json${NC}"
    echo ""
    echo "========================================"
    echo "Required npm packages (from tech stack)"
    echo "========================================"

    REQUIRED_NPM=(
        "react:^18.0.0"
        "typescript:^5.0.0"
        "vite:^5.0.0"
        "tailwindcss:^3.0.0"
        "framer-motion:^11.0.0"
        "lucide-react:latest"
        "@tanstack/react-query:^5.0.0"
        "zustand:^4.0.0"
        "zod:^3.0.0"
        "@tauri-apps/api:^2.0.0"
    )

    for dep in "${REQUIRED_NPM[@]}"; do
        IFS=':' read -r name version <<< "$dep"
        installed=$(get_npm_version "$name" | grep -o '[0-9]\.[0-9]*\.[0-9]*' | head -1)
        if [ -n "$installed" ]; then
            echo -e "${GREEN}✓${NC} $name@$installed"
        else
            echo -e "${RED}✗${NC} $name (required: $version)"
        fi
    done
else
    echo -e "${YELLOW}No package.json found - frontend not initialized${NC}"
    echo ""
    echo "Frontend packages needed:"
    for dep in "react@^18.0.0" "typescript@^5.0.0" "vite@^5.0.0" "tailwindcss@^3.0.0" "framer-motion@^11.0.0" "lucide-react" "@tanstack/react-query@^5.0.0" "zustand@^4.0.0" "zod@^3.0.0" "@tauri-apps/api@^2.0.0"; do
        echo "  - $dep"
    done
fi

echo ""
echo "========================================"
echo "Required Rust crates (from tech stack)"
echo "========================================"

REQUIRED_CARGO=(
    "tauri"
    "axum"
    "tokio"
    "rusqlite"
    "serde"
    "serde_json"
    "tracing"
    "tracing-subscriber"
)

found_cargo=false
for crate in "${REQUIRED_CARGO[@]}"; do
    if check_cargo_toml "$crate" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $crate"
        found_cargo=true
    else
        echo -e "${RED}✗${NC} $crate"
    fi
done

if [ "$found_cargo" = false ]; then
    echo ""
    echo -e "${YELLOW}No Cargo.toml found - backend not initialized${NC}"
    echo ""
    echo "Rust crates needed:"
    for crate in "tauri" "axum" "tokio" "rusqlite" "serde" "serde_json" "tracing" "tracing-subscriber"; do
        echo "  - $crate"
    done
fi

echo ""
echo "========================================"
echo "Project Status"
echo "========================================"

frontend_init=false
backend_init=false

[ -f "${PROJECT_ROOT}/package.json" ] && frontend_init=true
[ -d "${PROJECT_ROOT}/src-tauri" ] && backend_init=true

if $frontend_init; then
    echo -e "${GREEN}✓${NC} Frontend initialized (package.json exists)"
else
    echo -e "${RED}✗${NC} Frontend not initialized (no package.json)"
fi

if $backend_init; then
    echo -e "${GREEN}✓${NC} Backend initialized (src-tauri/ exists)"
else
    echo -e "${RED}✗${NC} Backend not initialized (no src-tauri/)"
fi

echo ""
echo "========================================"
echo "To Initialize Project"
echo "========================================"

if ! $frontend_init; then
    echo "# Initialize frontend:"
    echo "cd ${PROJECT_ROOT}"
    echo "npm create vite@latest . -- --template react-ts"
    echo "npm install"
    echo ""
fi

if ! $backend_init; then
    echo "# Initialize Tauri backend:"
    echo "npm run tauri init"
    echo ""
fi

echo "# Install frontend dependencies:"
echo "npm install react@^18.0.0 typescript@^5.0.0 vite@^5.0.0"
echo "npm install tailwindcss@^3.0.0 framer-motion@^11.0.0 lucide-react"
echo "npm install @tanstack/react-query@^5.0.0 zustand@^4.0.0 zod@^3.0.0"
echo "npm install @tauri-apps/api@^2.0.0 @tauri-apps/cli@^2.0.0"
echo ""
echo "# Rust dependencies (add to src-tauri/Cargo.toml):"
echo "tauri = \"2\""
echo "axum = \"0.7\""
echo "tokio = { version = \"1\", features = [\"full\"] }"
echo "rusqlite = { version = \"0.31\", features = [\"bundled\"] }"
echo "serde = { version = \"1\", features = [\"derive\"] }"
echo "tracing = \"0.1\""
echo "tracing-subscriber = { version = \"0.3\", features = [\"fmt\"] }"