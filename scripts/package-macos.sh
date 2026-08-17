#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "  Packaging AgentLens (.app) for macOS                    "
echo "=========================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Build all workspaces
echo "--> Building all workspaces (shared, backend, frontend)..."
npm run build

# 2. Prepare .app Bundle Structure
APP_NAME="AgentLens"
BUNDLE_DIR="$ROOT_DIR/dist/${APP_NAME}.app"
CONTENTS_DIR="$BUNDLE_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

echo "--> Creating bundle directory structure: $BUNDLE_DIR"
rm -rf "$BUNDLE_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

# 3. Create Info.plist
cat <<EOF > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>AgentLens</string>
    <key>CFBundleIdentifier</key>
    <string>com.agentlens.app</string>
    <key>CFBundleName</key>
    <string>AgentLens</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# 4. Copy backend and frontend distributions
echo "--> Copying application assets into bundle..."
mkdir -p "$RESOURCES_DIR/backend" "$RESOURCES_DIR/frontend"
cp -R "$ROOT_DIR/apps/backend/dist" "$RESOURCES_DIR/backend/"
cp -R "$ROOT_DIR/apps/backend/node_modules" "$RESOURCES_DIR/backend/" 2>/dev/null || true
cp -R "$ROOT_DIR/apps/frontend/dist" "$RESOURCES_DIR/frontend/"

# 5. Create executable launcher
cat <<'EOF' > "$MACOS_DIR/AgentLens"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/../Resources" && pwd)"
export NODE_ENV="production"
export SERVER_HOST="127.0.0.1"
export SERVER_PORT="${AGENTLENS_PORT:-43121}"

echo "Starting AgentLens on http://${SERVER_HOST}:${SERVER_PORT}..."
# Open local browser to dashboard
(sleep 1.5 && open "http://${SERVER_HOST}:${SERVER_PORT}") &

# Start Node backend
exec node "$DIR/backend/dist/index.js"
EOF

chmod +x "$MACOS_DIR/AgentLens"

echo "=========================================================="
echo "  Packaging Complete: dist/${APP_NAME}.app                "
echo "  To launch: open dist/AgentLens.app                      "
echo "=========================================================="
