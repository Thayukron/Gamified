<?php
/**
 * Prepend a change-log entry to CHANGELOG.md (newest first).
 * Usage: php tools/log-entry.php path/to/entry.md
 * The entry file must start with "## YYYY-MM-DD — title". Refuses empty/malformed input.
 */
$entryFile = $argv[1] ?? '';
$entry = is_file($entryFile) ? trim(file_get_contents($entryFile)) : '';
if (!preg_match('/^## \d{4}-\d{2}-\d{2} /u', $entry)) {
    fwrite(STDERR, "entry must exist and start with '## YYYY-MM-DD — title'\n");
    exit(1);
}
$logFile = __DIR__ . '/../CHANGELOG.md';
$log = file_get_contents($logFile);
$marker = "\n---\n";
$pos = strpos($log, $marker);
if ($pos === false) {
    fwrite(STDERR, "CHANGELOG.md has no '---' separator after its header\n");
    exit(1);
}
// header + "---" + new entry + "---" + everything that followed
$head = substr($log, 0, $pos + strlen($marker));
$rest = ltrim(substr($log, $pos + strlen($marker)));
file_put_contents($logFile, $head . "\n" . $entry . "\n\n---\n\n" . $rest);
echo "CHANGELOG.md: added \"" . strtok($entry, "\n") . "\"\n";
