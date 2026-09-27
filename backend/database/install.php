<?php
/**
 * Safe installer / upgrader — runs on every API container start. NEVER drops data.
 *   empty database    -> schema.sql + seed (SEED_DEMO=1: demo college, otherwise base data only),
 *                        and every file in upgrades/ is recorded as already applied
 *   existing database -> applies upgrades/*.sql not yet recorded in schema_migrations (in name order)
 * Usage: php backend/database/install.php
 */
require __DIR__ . '/../bootstrap.php';

use App\Core\Database;

$cfg = app_config('db');

// wait for the database container (up to ~60 s)
for ($i = 1; ; $i++) {
    try {
        $pdo = Database::connect($cfg);
        break;
    } catch (PDOException $e) {
        if ($i >= 30) {
            fwrite(STDERR, "install: database not reachable: {$e->getMessage()}\n");
            exit(1);
        }
        sleep(2);
    }
}

$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
$upgrades = glob(__DIR__ . '/upgrades/*.sql') ?: [];
sort($upgrades);
$record = $pdo->prepare('INSERT IGNORE INTO schema_migrations (name) VALUES (?)');

$hasUsers = (bool) $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'")->fetchColumn();
if (!$hasUsers) {
    $demo = in_array(strtolower((string) getenv('SEED_DEMO')), ['1', 'true', 'yes'], true);
    echo "install: empty database -> creating tables (" . ($demo ? 'with demo data' : 'base data only') . ")\n";
    $args = $demo ? '' : ' --base-only';
    passthru(PHP_BINARY . ' ' . escapeshellarg(__DIR__ . '/migrate.php') . $args, $code);
    if ($code !== 0) {
        exit($code);
    }
    // schema.sql is already the latest version
    foreach ($upgrades as $file) {
        $record->execute([basename($file)]);
    }
    exit(0);
}

$done = $pdo->query('SELECT name FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
$pending = array_filter($upgrades, fn ($f) => !in_array(basename($f), $done, true));
foreach ($pending as $file) {
    echo 'install: applying ' . basename($file) . "\n";
    $pdo->exec(file_get_contents($file));
    $record->execute([basename($file)]);
}
echo 'install: database ready (' . count($pending) . " upgrade(s) applied)\n";
