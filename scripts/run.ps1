<#
.SYNOPSIS
    Project Zomboid Build 42 Dedicated Server - Local Web Dashboard Launcher
.DESCRIPTION
    Script PowerShell para Windows 11 que verifica requisitos, instala dependencias y ejecuta el dashboard.
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host " PROJECT ZOMBOID BUILD 42 - LOCAL SERVER DASHBOARD (PWSH)" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Comprobar Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js no está instalado o no se encuentra en el PATH." -ForegroundColor Red
    Write-Host "Descarga e instala Node.js LTS desde: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Presiona Enter para salir..."
    exit 1
}

# 2. Comprobar node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Instalando dependencias de Node.js..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Falló la instalación de dependencias." -ForegroundColor Red
        exit 1
    }
}

# 3. Lanzar navegador en segundo plano
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:3000"
} | Out-Null

Write-Host "[INFO] Iniciando dashboard en http://127.0.0.1:3000..." -ForegroundColor Green
Write-Host "[INFO] Presiona Ctrl+C para detener el dashboard." -ForegroundColor Gray
Write-Host ""

# 4. Iniciar servidor
node server.js
