@echo off
setlocal enabledelayedexpansion
title Dramatis Server Daemon (dramatisd v2.1.0)
chcp 65001 >nul

echo ========================================================
echo   🎭 DRAMATIS — Agentic Tabletop RPG Harness
echo   Démon Serveur v2.1.0 (Windows Launcher)
echo ========================================================
echo.

where cargo >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERREUR] Rust / Cargo n'est pas installe ou n'est pas dans le PATH.
    echo Veuillez installer Rust depuis https://rustup.rs/
    pause
    exit /b 1
)

if not exist "%~dp0..\workspaces" (
    echo [INFO] Creation du repertoire des Theatres : workspaces/
    mkdir "%~dp0..\workspaces"
)

echo [1/2] Verification et compilation du workspace Cargo...
cd /d "%~dp0.."
cargo check -p dramatis-server
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERREUR] La verification de dramatis-server a echoue.
    pause
    exit /b 1
)

echo.
echo [2/2] Lancement du serveur dramatis-server sur http://127.0.0.1:4780 ...
echo [INFO] Pressez Ctrl+C pour arreter le demon.
echo.

cargo run -p dramatis-server

if %ERRORLEVEL% neq 0 (
    echo.
    echo [INFO] Le serveur s'est arrete avec le code %ERRORLEVEL%.
    pause
)

