@echo off
title AgentLens — Network & AI Agent Monitor
cd /d "%~dp0"

echo ==================================================
echo         AgentLens — Starting on Windows
echo ==================================================

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to start AgentLens.
    pause
)
