# Start the full dev stack: MariaDB (port 3310), PHP API (8000), Nuxt (3000)
# First-time DB setup:
#   & C:\xampp\mysql\bin\mysql_install_db.exe --datadir=$env:USERPROFILE\.gamified-mysql\data --port=3310
#   php backend/database/migrate.php

$root = $PSScriptRoot
$dataDir = "$env:USERPROFILE\.gamified-mysql\data"

Start-Process -FilePath 'C:\xampp\mysql\bin\mysqld.exe' `
  -ArgumentList "--defaults-file=$dataDir\my.ini", '--character-set-server=utf8mb4', '--collation-server=utf8mb4_unicode_ci' `
  -WindowStyle Minimized

Start-Process -FilePath 'php' -ArgumentList '-S', '127.0.0.1:8000', '-t', 'public', 'public/index.php' `
  -WorkingDirectory "$root\backend" -WindowStyle Minimized

Start-Process -FilePath 'npm' -ArgumentList 'run', 'dev' -WorkingDirectory "$root\frontend"

Write-Host 'API:      http://127.0.0.1:8000/api/health'
Write-Host 'Frontend: http://localhost:3100'
