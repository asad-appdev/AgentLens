#!/usr/bin/env bash
# ==============================================================================
# AgentLens — One-Click Setup & Installer
# ==============================================================================

set -eo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Terminal ANSI styling
BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "  AgentLens — Initial Setup & Dependency Installer        "
echo "=========================================================="
echo -e "${RESET}"

# 1. Verify macOS
echo -n "Checking operating system... "
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo -e "${RED}FAILED${RESET}"
  echo -e "${RED}Error: This application strictly requires macOS (Darwin).${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ macOS ($(sw_vers -productVersion 2>/dev/null || uname -r))${RESET}"

# 2. Check Node.js
echo -n "Checking Node.js... "
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}NOT FOUND${RESET}"
  echo ""
  if command -v brew >/dev/null 2>&1; then
    echo -e "${YELLOW}Homebrew detected. Installing Node.js via Homebrew...${RESET}"
    brew install node
  else
    echo -e "${RED}Node.js (v18+ recommended) is required to run this application.${RESET}"
    echo "Please download and install Node.js from https://nodejs.org or install Homebrew first."
    exit 1
  fi
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js detected: ${NODE_VERSION}${RESET}"

# 3. Check npm
echo -n "Checking npm... "
if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}NOT FOUND${RESET}"
  echo -e "${RED}Error: npm package manager is required.${RESET}"
  exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm detected: v${NPM_VERSION}${RESET}"

# 4. Check macOS Utilities (lsof, nettop)
echo -n "Checking macOS network tools (lsof, nettop)... "
if ! command -v lsof >/dev/null 2>&1; then
  echo -e "${RED}lsof missing${RESET}"
  exit 1
fi
if ! command -v nettop >/dev/null 2>&1; then
  echo -e "${RED}nettop missing${RESET}"
  exit 1
fi
echo -e "${GREEN}✓ lsof & nettop available${RESET}"

# 5. Create local directories
echo -n "Creating application data directories... "
mkdir -p data logs backups exports
echo -e "${GREEN}✓ data/, logs/, backups/, exports/${RESET}"

# 6. Setup .env file
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    echo -n "Creating .env from .env.example... "
    cp .env.example .env
    echo -e "${GREEN}✓ .env created${RESET}"
  else
    echo -n "Generating safe default .env... "
    cat <<EOF > .env
HOST=127.0.0.1
PORT=3000
NODE_ENV=development
WS_HEARTBEAT_INTERVAL_MS=15000
CONNECTION_POLL_INTERVAL_MS=2000
ENABLE_DRY_RUN_MODE=true
ALLOW_PRIVILEGED_OPERATIONS=true
LLM_ENABLED=false
OLLAMA_ENDPOINT=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:latest
EOF
    echo -e "${GREEN}✓ default .env generated${RESET}"
  fi
else
  echo -e "${GREEN}✓ .env configuration already present${RESET}"
fi

# 7. Install Dependencies
echo ""
echo -e "${CYAN}Installing project dependencies across workspaces...${RESET}"
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi

# 8. Build shared and backend packages
echo ""
echo -e "${CYAN}Building TypeScript packages...${RESET}"
npm run build --workspace=@network-monitor/shared
npm run build --workspace=@network-monitor/backend
npm run build --workspace=@network-monitor/frontend

# 9. Set permissions on command files
chmod +x start.command stop.command install.command 2>/dev/null || true
if [[ -f "start-production.command" ]]; then
  chmod +x start-production.command 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}${BOLD}==========================================================${RESET}"
echo -e "${GREEN}${BOLD}  Setup Complete!                                        ${RESET}"
echo -e "${GREEN}${BOLD}==========================================================${RESET}"
echo ""
echo "To start the application, double-click:"
echo "  👉 start.command"
echo ""
echo "To stop the application, double-click:"
echo "  👉 stop.command"
echo ""
