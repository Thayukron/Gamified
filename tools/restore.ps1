# ARCANA PROFILE — restore a database backup (and app.key if the backup includes one)
# Usage:  .\tools\restore.ps1 -BackupFile backups\gamified-20261029-120000.sql [-Yes]
# The dump is restored INTO the existing database (tables are replaced, the database itself is kept).
# A matching app.key file (same name, .key instead of .sql) is restored to storage\app.key.
param(
    [Parameter(Mandatory)][string]$BackupFile,
    [switch]$Yes
)

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

$backupPath = (Resolve-Path $BackupFile).Path
$keyPath = [System.IO.Path]::ChangeExtension($backupPath, '.key')

Write-Host "About to restore into database '$($env:DB_NAME)' on $($env:DB_HOST):$($env:DB_PORT):"
Write-Host "  database dump: $backupPath"
if (Test-Path $keyPath) { Write-Host "  app.key:       $keyPath -> storage\app.key" }
if (-not $Yes) {
    $answer = Read-Host 'Type YES to continue'
    if ($answer -ne 'YES') { Write-Host 'Aborted.'; exit 1 }
}

# 1) database
Get-Content $backupPath -Raw | & mariadb -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER `
    $(if ($env:DB_PASSWORD) { "-p$($env:DB_PASSWORD)" }) $env:DB_NAME
if ($LASTEXITCODE -ne 0) { throw "mariadb restore failed (exit $LASTEXITCODE)" }

# 2) app.key
if (Test-Path $keyPath) {
    $target = Join-Path $root 'storage\app.key'
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    Copy-Item $keyPath $target -Force
    Write-Host "app.key restored to $target"
}

Write-Host 'Restore complete. Restart the app to pick up the restored data.'
