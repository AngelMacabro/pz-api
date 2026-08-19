@echo off
title PZ Build 42 Dedicated Server - Dashboard Local
cd /d "%~dp0\.."

echo ===============================================================
echo  PROJECT ZOMBOID BUILD 42 - LOCAL SERVER DASHBOARD
echo ===============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js desde https://nodejs.org/ (Version 18 o superior).
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Carpeta node_modules no encontrada. Instalando dependencias automaticamente...
    call npm install
    echo.
)

echo [INFO] Iniciando servidor del dashboard en http://127.0.0.1:3000...
echo.

:: Abre el navegador predeterminado tras 1.5 segundos
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:3000"

:: Inicia la aplicacion Node.js
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] El dashboard se detuvo inesperadamente.
    pause
)
