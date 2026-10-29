# Start the dev stack on the ONE database: the local MariaDB service (127.0.0.1:3306, credentials from .env)
#   - database: local MariaDB service (same data as the production Docker stack)
#   - app:      http://localhost:3100 (Nuxt dev — serves the web app AND the API under /api)
# Never run destructive DB scripts here — the single live DB holds real user data.

$root = $PSScriptRoot

Start-Process -FilePath 'npm' -ArgumentList 'run', 'dev' -WorkingDirectory $root

Write-Host 'Database: local MariaDB 127.0.0.1:3306 (credentials from .env)'
Write-Host 'App:      http://localhost:3100 (API under /api)'