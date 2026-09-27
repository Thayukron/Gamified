<?php
namespace App\Core;

/**
 * AES-256-GCM encryption for secrets at rest (teachers' API keys).
 * The key lives in backend/storage/app.key (git-ignored), created on first use.
 */
class Crypto
{
    private static function key(): string
    {
        $file = dirname(__DIR__, 2) . '/storage/app.key';
        if (!is_file($file)) {
            @mkdir(dirname($file), 0700, true);
            file_put_contents($file, base64_encode(random_bytes(32)));
        }
        return base64_decode(trim(file_get_contents($file)));
    }

    public static function encrypt(string $plain): string
    {
        $iv = random_bytes(12);
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        return base64_encode($iv . $tag . $cipher);
    }

    public static function decrypt(?string $blob): ?string
    {
        if (!$blob) {
            return null;
        }
        $raw = base64_decode($blob);
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        return $plain === false ? null : $plain;
    }

    /** "AIzaSyD…9xQ2" — enough to recognise a key without revealing it. */
    public static function hint(string $key): string
    {
        return strlen($key) <= 8 ? '••••' : substr($key, 0, 4) . '…' . substr($key, -4);
    }
}
