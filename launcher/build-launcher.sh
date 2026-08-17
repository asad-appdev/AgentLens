#!/usr/bin/env bash
# ==============================================================================
# AgentLens UI Launcher Builder
# Compiles Swift native host and packages macOS .app bundle
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="AgentLens Launcher"
BUNDLE_DIR="$ROOT_DIR/dist/${APP_NAME}.app"
CONTENTS_DIR="$BUNDLE_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

echo "=========================================================="
echo "  Building ${APP_NAME} for macOS                          "
echo "=========================================================="

# 1. Clean & Prepare structure
rm -rf "$BUNDLE_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR/ui"

# 2. Compile Swift binary
echo "--> Compiling native macOS Swift controller..."
swiftc -O \
  -framework Cocoa \
  -framework WebKit \
  "$ROOT_DIR/launcher/main.swift" \
  -o "$MACOS_DIR/AgentLensLauncher"

# 3. Create Info.plist
echo "--> Generating Info.plist..."
cat <<EOF > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>AgentLensLauncher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.agentlens.launcher</string>
    <key>CFBundleName</key>
    <string>AgentLens Launcher</string>
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

# 4. Copy UI assets & App Icon
echo "--> Bundling UI & Icon assets..."
if [ -f "$ROOT_DIR/assets/AppIcon.icns" ]; then
  cp "$ROOT_DIR/assets/AppIcon.icns" "$RESOURCES_DIR/AppIcon.icns"
fi
cp "$ROOT_DIR/launcher/ui/index.html" "$RESOURCES_DIR/ui/"
cp "$ROOT_DIR/launcher/ui/launcher.css" "$RESOURCES_DIR/ui/"
cp "$ROOT_DIR/launcher/ui/launcher.js" "$RESOURCES_DIR/ui/"
if [ -f "$ROOT_DIR/assets/logo.png" ]; then
  cp "$ROOT_DIR/assets/logo.png" "$RESOURCES_DIR/ui/logo.png"
fi


# 5. Make executable
chmod +x "$MACOS_DIR/AgentLensLauncher"

# 6. Copy to root directory for convenient 1-click launch from Finder
rm -rf "$ROOT_DIR/${APP_NAME}.app"
cp -R "$BUNDLE_DIR" "$ROOT_DIR/${APP_NAME}.app"

echo "=========================================================="
echo "  Build Complete!                                         "
echo "  Location: ${APP_NAME}.app (Project Root)                "
echo "  To launch: open \"${APP_NAME}.app\"                     "
echo "=========================================================="
