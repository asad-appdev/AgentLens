# start.ps1 - AgentLens Windows Startup Script
# Starts backend and frontend services, records PIDs, polls readiness, and launches dashboard.

param (
    [switch]$Dev = $false,
    [switch]$NoBrowser = $false,
    [int]$BackendPort = 3000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "              AgentLens — Windows Startup         " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$rootDir = $PSScriptRoot
$pidFile = Join-Path $rootDir ".agentlens.pids"

# 1. Stop any existing AgentLens processes tracked in pid file
if (Test-Path $pidFile) {
    Write-Host "[INFO] Cleaning up previous process sessions..." -ForegroundColor Yellow
    try {
        & "$rootDir\stop.ps1"
    } catch {
        # Ignore cleanup errors
    }
}

# 2. Check build artifacts if running production mode
$sharedDist = Join-Path $rootDir "packages\shared\dist"
$backendDist = Join-Path $rootDir "apps\backend\dist"

if (-not $Dev -and (-not (Test-Path $sharedDist) -or -not (Test-Path $backendDist))) {
    Write-Host "[INFO] Build artifacts missing. Executing build..." -ForegroundColor Yellow
    npm run build --workspace=@network-monitor/shared
    npm run build --workspace=@network-monitor/backend
}

# 3. Launch Backend
Write-Host "[1/3] Starting AgentLens Backend API on port $BackendPort..." -ForegroundColor Cyan
$backendCmd = if ($Dev) { "npm run dev --workspace=@network-monitor/backend" } else { "node apps/backend/dist/index.js" }

$backendProcess = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-Command", "cd `"$rootDir`"; $backendCmd" `
    -PassThru -WindowStyle Hidden

Write-Host "      Backend PID: $($backendProcess.Id)" -ForegroundColor DarkGray

# 4. Launch Frontend
Write-Host "[2/3] Starting AgentLens Dashboard on port $FrontendPort..." -ForegroundColor Cyan
$frontendCmd = "npm run dev --workspace=@network-monitor/frontend -- --port $FrontendPort"

$frontendProcess = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-Command", "cd `"$rootDir`"; $frontendCmd" `
    -PassThru -WindowStyle Hidden

Write-Host "      Frontend PID: $($frontendProcess.Id)" -ForegroundColor DarkGray

# 5. Save PIDs to .agentlens.pids
$pidsData = @{
    backendPid = $backendProcess.Id
    frontendPid = $frontendProcess.Id
    startedAt = (Get-Date).ToString("o")
} | ConvertTo-Json

Set-Content -Path $pidFile -Value $pidsData
Write-Host "[3/3] Process tracking saved to .agentlens.pids" -ForegroundColor DarkGray

# 6. Poll Backend Readiness
Write-Host "`nWaiting for AgentLens services to initialize..." -ForegroundColor Yellow
$readyUrl = "http://127.0.0.1:$BackendPort/api/ready"
$retries = 30
$isReady = $false

for ($i = 1; $i -le $retries; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $readyUrl -Method Get -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($response -and $response.ready) {
            $isReady = $true
            break
        }
    } catch {
        # Retry
    }
    Start-Sleep -Milliseconds 500
    Write-Host -NoNewline "."
}

Write-Host ""

if ($isReady) {
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host "  AgentLens is active and monitoring network!     " -ForegroundColor Green
    Write-Host "  Dashboard: http://127.0.0.1:$FrontendPort       " -ForegroundColor White
    Write-Host "  Backend API: http://127.0.0.1:$BackendPort      " -ForegroundColor White
    Write-Host "  To stop services, run: .\stop.ps1               " -ForegroundColor Yellow
    Write-Host "==================================================" -ForegroundColor Green

    if (-not $NoBrowser) {
        Start-Process "http://127.0.0.1:$FrontendPort"
    }
} else {
    Write-Warning "Backend initialization is taking longer than expected. Check logs or verify port $BackendPort."
}
