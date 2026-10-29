# ARCANA PROFILE — backup the database AND app.key together (they must be restored as a pair)
# Usage:  .\tools\backup.ps1 [-Tag phase6]
# Output: backups\gamified-<date>-<time>.sql + backups\app.key-<date>-<time>.key
param([string]$Tag = '')

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot | Split-Path -Parent
$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) { throw ".env not found at $envFile" }

$env:DB_HOST = $env:DB_PORT = $env:DB_USER = $env:DB_PASSWORD = $env:DB_NAME = $null
foreach ($line in (Get-Content $envFile)) {
    if ($line -match '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=(.*)$') {
        Set-Item "env:$($matches[1])" $matches[2]
    }
}
if (-not $env:DB_HOST) { $env:DB_HOST = '127.0.0.1' }
if (-not $env:DB_PORT) { $env:DB_PORT = '3306' }
if (-not $env:DB_NAME) { $env:DB_NAME = 'gamified' }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if ($Tag) { $stamp = "$stamp-$Tag" }
$backupDir = Join-Path $root 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$sqlFile = Join-Path $backupDir "gamified-$stamp.sql"
$keyFile = Join-Path $backupDir "app.key-$stamp.key"

# 1) database dump (consistent snapshot)
& mariadb-dump -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER `
    $(if ($env:DB_PASSWORD) { "-p$($env:DB_PASSWORD)" }) `
    --single-transaction --routines $env:DB_NAME > $sqlFile
if ($LASTEXITCODE -ne 0) { throw "mariadb-dump failed (exit $LASTEXITCODE)" }

# 2) app.key (Gemini key encryption key) — copy whichever copy exists
$appKey = Join-Path $root 'frontend\storage\app.key'
if (-not (Test-Path $appKey)) { $appKey = Join-Path $root 'backend\storage\app.key' }
if (Test-Path $appKey) {
    Copy-Item $appKey $keyFile
} else {
    Write-Warning "app.key not found — no encrypted Gemini keys exist yet; database backup only"
}

Write-Host "Backup complete:"
Write-Host "  database: $sqlFile"
if (Test-Path $keyFile) { Write-Host "  app.key:  $keyFile" }
Write-Host 'Keep both files together and copy them off this machine.'
