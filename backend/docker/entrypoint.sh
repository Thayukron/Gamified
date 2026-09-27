#!/bin/sh
set -e
cd /var/www/html

# storage holds app.key (encrypts teachers' API keys) — it lives in a volume
mkdir -p storage
chown -R www-data:www-data storage
chmod 700 storage

# create the database on first start, apply pending upgrades afterwards (never drops data)
php database/install.php

exec "$@"
