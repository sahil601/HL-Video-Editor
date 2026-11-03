@echo off
setlocal enabledelayedexpansion

title HL Video Editor - 1-Click Update & Launch
echo =====================================================================
echo                HL VIDEO EDITOR - 1-CLICK LAUNCHER
echo =====================================================================
echo.

cd /d "%~dp0"

REM Step 1: Check Git and Pull Latest Updates if repo is present
if exist ".git" (
    echo [1/4] Checking for latest repository updates from GitHub...
    git --version >nul 2>&1
    if !errorlevel! equ 0 (
        git pull origin main
        echo [OK] Repository updated to latest version.
    ) else (
        echo [INFO] Git not found on PATH. Using existing local files.
    )
) else (
    echo [1/4] Standalone folder detected, skipping git pull.
)
echo.

REM Step 2: Check Node.js and NPM
echo [2/4] Checking Node.js environment...
node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js (LTS version) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
node -v
echo [OK] Node.js is ready.
echo.

REM Step 3: Check node_modules dependencies
echo [3/4] Verifying dependencies...
if not exist "node_modules\" (
    echo Installing node dependencies (this may take a minute on first run)...
    call npm install
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencies are present.
)
echo.

REM Step 4: Build & Launch
echo [4/4] Launching HL Video Editor Desktop...
echo.
call npm run desktop:dev

if !errorlevel! neq 0 (
    echo.
    echo [NOTICE] If dev server closed, trying desktop production mode...
    call npm run build
    call npm run desktop
)

echo.
echo Application closed.
exit /b 0
