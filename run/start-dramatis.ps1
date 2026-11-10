# Script de démarrage PowerShell pour Dramatis Server Daemon
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "Dramatis Server Daemon (dramatisd v2.1.0)"

Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "  🎭 DRAMATIS — Agentic Tabletop RPG Harness" -ForegroundColor Cyan
Write-Host "  Démon Serveur v2.1.0 (Windows PowerShell)" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host ""

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

# 1. Vérification des prérequis
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] Rust / Cargo n'est pas installé ou n'est pas dans le PATH." -ForegroundColor Red
    Write-Host "Veuillez installer Rust depuis https://rustup.rs/" -ForegroundColor Yellow
    Read-Host "Appuyez sur Entrée pour quitter..."
    exit 1
}

# 2. Préparation du répertoire workspaces
$workspacesDir = Join-Path $repoRoot "workspaces"
if (-not (Test-Path $workspacesDir)) {
    Write-Host "[INFO] Création du répertoire des Théâtres : workspaces/" -ForegroundColor Gray
    New-Item -ItemType Directory -Path $workspacesDir | Out-Null
}

# 3. Lancement du serveur
Write-Host "[INFO] Lancement de dramatis-server sur http://127.0.0.1:4780 ..." -ForegroundColor Green
Write-Host "[INFO] Pressez Ctrl+C pour arrêter le serveur." -ForegroundColor Gray
Write-Host ""

cargo run -p dramatis-server

