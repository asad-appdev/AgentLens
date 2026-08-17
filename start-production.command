#!/usr/bin/env bash
# ==============================================================================
# AgentLens — Production Launcher
# ==============================================================================

set -o pipefail

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
  echo "[$timestamp] [PROD] $1" >> "$LOG_FILE"
}

log_msg "Production launcher initiated."

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "  AgentLens (Production Launcher)                         "
echo "=========================================================="
echo -e "${RESET}"

# Build all packages
echo -e "${CYAN}Ensuring production bundle is built...${RESET}"
npm run build

# Start production server & vite preview
echo -e "${CYAN}Starting backend (node dist) & frontend preview...${RESET}"
NODE_ENV=production npm run start --workspace=@network-monitor/backend > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

npm run preview --workspace=@network-monitor/frontend > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

cat <<EOF > "$PID_FILE"
BACKEND_PID=$BACKEND_PID
FRONTEND_PID=$FRONTEND_PID
PROJECT_ROOT=$PROJECT_ROOT
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

cleanup() {
  echo ""
  echo -e "${YELLOW}Stopping Production Network Monitor...${RESET}"
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    pkill -P "$FRONTEND_PID" 2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    pkill -P "$BACKEND_PID" 2>/dev/null || true
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" 2>/dev/null || true
  echo -e "${GREEN}Stopped.${RESET}"
  exit 0
}

trap cleanup EXIT INT TERM

# Poll readiness
sleep 2
open "http://127.0.0.1:5173" 2>/dev/null || true

echo -e "${GREEN}${BOLD}✓ Production Network Monitor is running at http://127.0.0.1:5173${RESET}"
echo -e "${YELLOW}Press [Ctrl+C] to stop.${RESET}"

wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
