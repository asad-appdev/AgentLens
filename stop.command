#!/usr/bin/env bash
# ==============================================================================
# macOS Real-Time Network Monitor — Stop Script
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

log_msg() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[$timestamp] [STOP] $1" >> "$LOG_FILE"
}

echo -e "${CYAN}${BOLD}"
echo "=========================================================="
echo "  Stopping AgentLens                                      "
echo "=========================================================="
echo -e "${RESET}"

if [[ ! -f "$PID_FILE" ]]; then
  echo -e "${YELLOW}No active AgentLens PID file found.${RESET}"
  log_msg "No active PID file found."
  exit 0
fi

# Read stored PIDs
BACKEND_PID=$(grep "^BACKEND_PID=" "$PID_FILE" | cut -d '=' -f2)
FRONTEND_PID=$(grep "^FRONTEND_PID=" "$PID_FILE" | cut -d '=' -f2)

stopped_any=false

if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
  echo -n "Stopping Frontend process (PID $FRONTEND_PID)... "
  pkill -P "$FRONTEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  echo -e "${GREEN}✓ Stopped${RESET}"
  log_msg "Stopped Frontend PID $FRONTEND_PID"
  stopped_any=true
fi

if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo -n "Stopping Backend process (PID $BACKEND_PID)... "
  pkill -P "$BACKEND_PID" 2>/dev/null || true
  kill "$BACKEND_PID" 2>/dev/null || true
  echo -e "${GREEN}✓ Stopped${RESET}"
  log_msg "Stopped Backend PID $BACKEND_PID"
  stopped_any=true
fi

rm -f "$PID_FILE" 2>/dev/null || true

echo ""
if [[ "$stopped_any" == true ]]; then
  echo -e "${GREEN}${BOLD}✓ Network Monitor stopped cleanly.${RESET}"
else
  echo -e "${YELLOW}Services were already stopped.${RESET}"
fi
echo ""
