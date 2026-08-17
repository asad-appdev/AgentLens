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

BACKEND_PORT=43121
if [[ -f ".env" ]] && grep -q "^PORT=" .env; then
  BACKEND_PORT=$(grep "^PORT=" .env | cut -d '=' -f2 | tr -d ' "\r')
fi
FRONTEND_PORT=5174
if [[ -f ".env" ]] && grep -q "^FRONTEND_PORT=" .env; then
  FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d '=' -f2 | tr -d ' "\r')
fi

my_pid=$$

kill_recursive() {
  local parent=$1
  [ -z "$parent" ] || [ "$parent" -le 1 ] || [ "$parent" -eq "$my_pid" ] && return
  local children
  children=$(pgrep -P "$parent" 2>/dev/null || true)
  for child in $children; do
    kill_recursive "$child"
  done
  kill -15 "$parent" 2>/dev/null || true
  kill -9 "$parent" 2>/dev/null || true
}

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null || true)
  for pid in $pids; do
    if [ -n "$pid" ] && [ "$pid" -gt 1 ] && [ "$pid" -ne "$my_pid" ]; then
      local ppid
      ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)
      if [ -n "$ppid" ] && [ "$ppid" -gt 1 ] && [ "$ppid" -ne "$my_pid" ]; then
        local gppid
        gppid=$(ps -o ppid= -p "$ppid" 2>/dev/null | tr -d ' ' || true)
        if [ -n "$gppid" ] && [ "$gppid" -gt 1 ] && [ "$gppid" -ne "$my_pid" ]; then
          kill_recursive "$gppid"
        fi
        kill_recursive "$ppid"
      fi
      kill_recursive "$pid"
    fi
  done
}

stopped_any=false

if [[ -f "$PID_FILE" ]]; then
  BACKEND_PID=$(grep "^BACKEND_PID=" "$PID_FILE" | cut -d '=' -f2)
  FRONTEND_PID=$(grep "^FRONTEND_PID=" "$PID_FILE" | cut -d '=' -f2)

  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo -n "Stopping Frontend process tree (PID $FRONTEND_PID)... "
    kill_recursive "$FRONTEND_PID"
    echo -e "${GREEN}✓ Stopped${RESET}"
    log_msg "Stopped Frontend PID $FRONTEND_PID"
    stopped_any=true
  fi

  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -n "Stopping Backend process tree (PID $BACKEND_PID)... "
    kill_recursive "$BACKEND_PID"
    echo -e "${GREEN}✓ Stopped${RESET}"
    log_msg "Stopped Backend PID $BACKEND_PID"
    stopped_any=true
  fi

  rm -f "$PID_FILE" 2>/dev/null || true
fi

# Clean up any listening processes on configured ports
echo -n "Releasing ports (:$BACKEND_PORT, :$FRONTEND_PORT)... "
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"
echo -e "${GREEN}✓ Freed${RESET}"

# Clean up lingering workspace processes
ps -eo pid,ppid,command 2>/dev/null | grep "$PROJECT_ROOT" | grep -E "tsx|vite|node_modules" | grep -v grep | awk '{print $1}' | while read -r p; do
  if [ -n "$p" ] && [ "$p" -gt 1 ] && [ "$p" -ne "$my_pid" ]; then
    kill_recursive "$p"
  fi
done

echo ""
echo -e "${GREEN}${BOLD}✓ AgentLens services stopped cleanly.${RESET}"
echo ""
