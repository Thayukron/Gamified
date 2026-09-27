<?php
/**
 * Emergency password reset from the server console (e.g. the only admin forgot their password).
 * Usage: php backend/bin/reset-password.php <username>
 * Sets the password to the username and forces a change at next login.
 */
require __DIR__ . '/../bootstrap.php';

$username = $argv[1] ?? '';
if ($username === '') {
    fwrite(STDERR, "usage: php backend/bin/reset-password.php <username>\n");
    exit(1);
}
$stmt = App\Core\Database::get()->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
$id = $stmt->fetchColumn();
if (!$id) {
    fwrite(STDERR, "user not found: $username\n");
    exit(1);
}
App\Services\PasswordService::resetToDefault((int) $id, (int) $id);
echo "reset: temporary password = $username (must be changed at next login)\n";
