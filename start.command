#!/usr/bin/env bash
# ==============================================================================
# macOS Real-Time AI Agent & Network Intelligence — Single-Click Launcher
# ==============================================================================

set -o pipefail

# 1. Determine Project Root
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Terminal ANSI styling
BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

PID_FILE="$PROJECT_ROOT/data/network-monitor.pid"
LOG_FILE="$PROJECT_ROOT/logs/launcher.log"
BACKEND_LOG="$PROJECT_ROOT/logs/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/logs/frontend.log"

mkdir -p "$PROJECT_ROOT/data" "$PROJECT_ROOT/logs" "$PROJECT_ROOT/backups" "$PROJECT_ROOT/exports"

log_msg() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$timestamp] $1" >> "$LOG_FILE"
}

log_msg "Launcher initiated from $PROJECT_ROOT"

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "  AgentLens — macOS AI Agent & Network Intelligence       "
echo "=========================================================="
echo -e "${RESET}"

# 2. Verify macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo -e "${RED}Error: This application strictly requires macOS (Darwin).${RESET}"
  log_msg "ERROR: Non-macOS system detected ($(uname -s))"
  exit 1
fi

# 3. Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}Node.js not detected.${RESET}"
  if command -v brew >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing Node.js via Homebrew...${RESET}"
    brew install node
  else
    echo -e "${RED}Please install Node.js (v18+) from https://nodejs.org${RESET}"
    exit 1
  fi
fi
NODE_VERSION="$(node -v)"
log_msg "Node.js detected: $NODE_VERSION"

# 4. Check npm
if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}Error: npm is missing.${RESET}"
  exit 1
fi

# 5. Check macOS Tools (lsof, nettop)
if ! command -v lsof >/dev/null 2>&1 || ! command -v nettop >/dev/null 2>&1; then
  echo -e "${RED}Error: Required macOS diagnostic tools (lsof, nettop) are missing.${RESET}"
  exit 1
fi

echo -e "Checking system environment..."
echo -e "  ${GREEN}✓${RESET} macOS ($(sw_vers -productVersion 2>/dev/null || uname -r))"
echo -e "  ${GREEN}✓${RESET} Node.js ($NODE_VERSION)"
echo -e "  ${GREEN}✓${RESET} npm ($(npm -v))"
echo -e "  ${GREEN}✓${RESET} lsof & nettop diagnostic tools"

# 6. Environment Configuration
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
  else
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
  fi
  log_msg "Created .env configuration"
fi

# Parse configured ports (defaults 43121 backend, 5174 frontend)
BACKEND_PORT=43121
if grep -q "^PORT=" .env; then
  BACKEND_PORT=$(grep "^PORT=" .env | cut -d '=' -f2 | tr -d ' "')
fi
FRONTEND_PORT=5174
if grep -q "^FRONTEND_PORT=" .env; then
  FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d '=' -f2 | tr -d ' "')
fi

# 7. Check if Already Running
is_health_ready() {
  curl -s -f -m 1 "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1
}

is_frontend_ready() {
  curl -s -f -m 1 "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1
}

if is_health_ready && is_frontend_ready; then
  echo ""
  echo -e "${GREEN}${BOLD}✓ Network Monitor is already running!${RESET}"
  echo -e "Dashboard: ${CYAN}http://127.0.0.1:${FRONTEND_PORT}${RESET}"
  log_msg "Existing running instance detected. Opening browser."
  open "http://127.0.0.1:${FRONTEND_PORT}"
  exit 0
fi

# Check for port conflicts by foreign processes
check_port_conflict() {
  local port="$1"
  local occupying_pid
  occupying_pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $2}' | head -n 1)"
  if [[ -n "$occupying_pid" ]]; then
    local proc_name
    proc_name="$(ps -p "$occupying_pid" -o comm= 2>/dev/null || echo "Unknown")"
    echo -e "${RED}Error: Port $port is already in use by process '$proc_name' (PID $occupying_pid).${RESET}"
    echo "Please stop the conflicting process or change PORT in .env, then relaunch."
    log_msg "ERROR: Port conflict on $port with PID $occupying_pid ($proc_name)"
    exit 1
  fi
}

check_port_conflict "$BACKEND_PORT"
check_port_conflict "$FRONTEND_PORT"

# 8. Check and Install Dependencies if needed
if [[ ! -d "node_modules" || ! -f "packages/shared/dist/index.js" ]]; then
  echo ""
  echo -e "${YELLOW}Installing project dependencies and building shared libraries...${RESET}"
  log_msg "Installing dependencies..."
  if [[ -f "package-lock.json" ]]; then
    npm ci
  else
    npm install
  fi
  npm run build --workspace=@network-monitor/shared
fi

# 9. Optional LLM Check
echo ""
echo -n "Checking optional Local LLM (Ollama)... "
if curl -s -m 1 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo -e "${GREEN}✓ Ollama online at http://127.0.0.1:11434${RESET}"
  log_msg "Ollama detected online at localhost:11434"
else
  echo -e "${YELLOW}Optional Ollama not detected. Network monitoring will run without LLM features.${RESET}"
  log_msg "Ollama not detected; running in standalone local mode."
fi

# 10. Start Services & Track PIDs
echo ""
echo -e "${CYAN}Starting Network Monitor services on 127.0.0.1...${RESET}"

# Start Backend
npm run dev --workspace=@network-monitor/backend > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
log_msg "Backend spawned with PID $BACKEND_PID"

# Start Frontend
npm run dev --workspace=@network-monitor/frontend > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
log_msg "Frontend spawned with PID $FRONTEND_PID"

# Write PID record
cat <<EOF > "$PID_FILE"
BACKEND_PID=$BACKEND_PID
FRONTEND_PID=$FRONTEND_PID
PROJECT_ROOT=$PROJECT_ROOT
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

# Process Tree Cleanup Handler
cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping Network Monitor services cleanly...${RESET}"
  log_msg "Cleanup invoked. Stopping backend (PID $BACKEND_PID) and frontend (PID $FRONTEND_PID)..."

  # Terminate processes and their child sub-processes safely
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    # Kill process group / child tree
    pkill -P "$FRONTEND_PID" 2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    pkill -P "$BACKEND_PID" 2>/dev/null || true
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  rm -f "$PID_FILE" 2>/dev/null || true
  log_msg "Network Monitor stopped cleanly."
  echo -e "${GREEN}Network Monitor stopped.${RESET}"
  exit 0
}

trap cleanup EXIT INT TERM

# 11. Poll Readiness with 60s Timeout
echo -n "Waiting for backend (http://127.0.0.1:${BACKEND_PORT}/api/health)... "
MAX_WAIT=60
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if is_health_ready; then
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  echo -e "${RED}FAILED${RESET}"
  echo -e "${RED}Network Monitor backend failed to become ready within ${MAX_WAIT}s.${RESET}"
  echo "Check logs at: $BACKEND_LOG"
  log_msg "ERROR: Backend readiness timeout reached."
  exit 1
fi
echo -e "${GREEN}✓ Ready${RESET}"

echo -n "Waiting for frontend (http://127.0.0.1:${FRONTEND_PORT})... "
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  if is_frontend_ready; then
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  echo -e "${RED}FAILED${RESET}"
  echo -e "${RED}Network Monitor frontend failed to become ready within ${MAX_WAIT}s.${RESET}"
  echo "Check logs at: $FRONTEND_LOG"
  log_msg "ERROR: Frontend readiness timeout reached."
  exit 1
fi
echo -e "${GREEN}✓ Ready${RESET}"

# 12. Auto-Open Browser
DASHBOARD_URL="http://127.0.0.1:${FRONTEND_PORT}"
echo ""
echo -e "${GREEN}${BOLD}==========================================================${RESET}"
echo -e "${GREEN}${BOLD}  AgentLens is Running!                                   ${RESET}"
echo -e "${GREEN}${BOLD}==========================================================${RESET}"
echo ""
echo -e "Dashboard: ${CYAN}${BOLD}${DASHBOARD_URL}${RESET}"
echo -e "Backend:   ${CYAN}http://127.0.0.1:${BACKEND_PORT}/api/health${RESET}"
echo ""
echo -e "Opening dashboard in default browser..."
open "$DASHBOARD_URL"
log_msg "Dashboard URL opened in browser: $DASHBOARD_URL"

echo ""
echo -e "${YELLOW}Press [Ctrl+C] to stop AgentLens.${RESET}"
echo ""

# Keep launcher alive and tail log or wait
wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
