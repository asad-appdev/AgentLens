# stop.ps1 - AgentLens Windows Shutdown Script
# Safely terminates tracked AgentLens processes without affecting unrelated system processes.

$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "              AgentLens — Windows Shutdown        " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$rootDir = $PSScriptRoot
$pidFile = Join-Path $rootDir ".agentlens.pids"

if (-not (Test-Path $pidFile)) {
    Write-Host "[INFO] No running AgentLens session found (.agentlens.pids does not exist)." -ForegroundColor Yellow
    exit 0
}

try {
    $rawJson = Get-Content -Path $pidFile -Raw
    $data = $rawJson | ConvertFrom-Json

    $backendPid = $data.backendPid
    $frontendPid = $data.frontendPid

    if ($backendPid -and $backendPid -gt 4) {
        Write-Host "Terminating Backend process (PID: $backendPid)..." -ForegroundColor Cyan
        & taskkill.exe /PID $backendPid /T /F 2>&1 | Out-Null
    }

    if ($frontendPid -and $frontendPid -gt 4) {
        Write-Host "Terminating Frontend process (PID: $frontendPid)..." -ForegroundColor Cyan
        & taskkill.exe /PID $frontendPid /T /F 2>&1 | Out-Null
    }

    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] AgentLens processes terminated successfully." -ForegroundColor Green
} catch {
    Write-Warning "Error shutting down processes: $_"
}
