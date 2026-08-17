#!/usr/bin/env bash
# ==============================================================================
# AgentLens — Quick Graphical UI Launcher
# Double-click this file from macOS Finder to launch the AgentLens Control Center
# ==============================================================================

set -eo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "  Launching AgentLens Control Center...                   "
echo "=========================================================="

# Build launcher if not built yet
if [[ ! -d "AgentLens Launcher.app" || ! -f "AgentLens Launcher.app/Contents/MacOS/AgentLensLauncher" ]]; then
  echo "Building AgentLens Launcher UI..."
  bash launcher/build-launcher.sh
fi

echo "Opening AgentLens Launcher..."
open "AgentLens Launcher.app"

echo "AgentLens UI is open! You can close this terminal window."
exit 0
