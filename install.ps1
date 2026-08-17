# install.ps1 - AgentLens Windows Setup Script
# Checks dependencies, installs packages, builds shared and workspace apps

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "       AgentLens — Windows Setup & Installation    " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Node.js and npm
try {
    $nodeVer = node -v
    Write-Host "[OK] Node.js is installed: $nodeVer" -ForegroundColor Green
} catch {
    Write-Error "[FATAL] Node.js is not found in PATH. Please install Node.js >= 18 from https://nodejs.org/"
    exit 1
}

try {
    $npmVer = npm -v
    Write-Host "[OK] npm is installed: $npmVer" -ForegroundColor Green
} catch {
    Write-Error "[FATAL] npm is not found in PATH."
    exit 1
}

# 2. Check environment file
$envFile = Join-Path $PSScriptRoot ".env"
$envExample = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "[INFO] Created .env configuration from .env.example" -ForegroundColor Yellow
    } else {
        Set-Content -Path $envFile -Value "PORT=3000`nHOST=127.0.0.1`nNODE_ENV=development`nDRY_RUN_MODE=true`n"
        Write-Host "[INFO] Created default .env configuration file" -ForegroundColor Yellow
    }
}

# 3. Install Dependencies
Write-Host "`n[STEP 1/3] Installing workspace dependencies..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] npm install failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# 4. Build Shared Package
Write-Host "`n[STEP 2/3] Building @network-monitor/shared package..." -ForegroundColor Cyan
npm run build --workspace=@network-monitor/shared

if ($LASTEXITCODE -ne 0) {
    Write-Error "[FATAL] Shared package build failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

# 5. Build Backend & Frontend Packages
Write-Host "`n[STEP 3/3] Compiling TypeScript backend and building frontend..." -ForegroundColor Cyan
npm run build --workspace=@network-monitor/backend
npm run build --workspace=@network-monitor/frontend

# 6. Create Application Shortcut with custom logo.ico
try {
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcutPath = Join-Path $PSScriptRoot "AgentLens.lnk"
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\start.ps1`""
    $shortcut.WorkingDirectory = $PSScriptRoot
    $icoPath = Join-Path $PSScriptRoot "assets\logo.ico"
    if (Test-Path $icoPath) {
        $shortcut.IconLocation = "$icoPath,0"
    }
    $shortcut.Description = "AgentLens — AI Agent Security & Activity Monitor"
    $shortcut.Save()
    Write-Host "[INFO] Created AgentLens.lnk application shortcut with custom logo" -ForegroundColor Green
} catch {
    # Non-fatal
}

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  Installation completed successfully!            " -ForegroundColor Green
Write-Host "  To launch AgentLens, run:                       " -ForegroundColor Green
Write-Host "    .\start.ps1  (or double-click AgentLens.lnk)   " -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Green

