# Start the dev stack on the ONE database: the Docker MariaDB (127.0.0.1:3320, credentials from .env)
#   - database: docker compose service "db" (same data as http://localhost:8090)
#   - PHP API:  http://127.0.0.1:8100 (backend/config.php reads .env)
#   - Nuxt:     http://localhost:3100
# Never run backend/database/migrate.php here — it wipes the real data (it refuses unless --wipe-real-data).

$root = $PSScriptRoot
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
if (-not (Test-Path $docker)) { $docker = 'docker' }

& $docker compose -f "$root\docker-compose.yml" up -d db

Start-Process -FilePath 'php' -ArgumentList '-S', '127.0.0.1:8100', '-t', 'public', 'public/index.php' `
  -WorkingDirectory "$root\backend" -WindowStyle Minimized

Start-Process -FilePath 'npm' -ArgumentList 'run', 'dev' -WorkingDirectory "$root\frontend"

Write-Host 'Database: Docker 127.0.0.1:3320 (ชุดเดียวกับ http://localhost:8090)'
Write-Host 'API:      http://127.0.0.1:8100/api/health'
Write-Host 'Frontend: http://localhost:3100'
