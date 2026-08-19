@echo off
title PZ Build 42 Dashboard - Instalando Dependencias
cd /d "%~dp0\.."

echo ===============================================================
echo  PROJECT ZOMBOID BUILD 42 - INSTALACION DE DEPENDENCIAS
echo ===============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Node.js desde https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Ejecutando npm install...
call npm install

if %errorlevel% equ 0 (
    echo.
    echo [EXITO] Dependencias instaladas correctamente.
    echo Ahora puedes iniciar el dashboard con start.bat
) else (
    echo.
    echo [ERROR] Ocurrio un error al instalar las dependencias con npm.
)

echo.
pause
