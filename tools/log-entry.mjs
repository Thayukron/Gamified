#!/usr/bin/env node
/**
 * Prepend a change-log entry to CHANGELOG.md (newest first).
 * Usage: node tools/log-entry.mjs path/to/entry.md
 * The entry file must start with "## YYYY-MM-DD — title". Refuses empty/malformed input.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entryFile = process.argv[2] ?? '';
const entry = entryFile ? readFileSync(entryFile, 'utf8').trim() : '';

if (!/^## \d{4}-\d{2}-\d{2} /u.test(entry)) {
  console.error("entry must exist and start with '## YYYY-MM-DD — title'");
  process.exit(1);
}

const logFile = join(root, 'CHANGELOG.md');
const log = readFileSync(logFile, 'utf8');
const firstEntry = log.search(/^## /mu);
if (firstEntry === -1) {
  console.error('CHANGELOG.md has no "## " entry to insert before');
  process.exit(1);
}

// header + new entry + everything that followed
const head = log.slice(0, firstEntry);
const rest = log.slice(firstEntry);
writeFileSync(logFile, head + entry + '\n\n' + rest, 'utf8');
console.log('CHANGELOG.md: added "' + entry.split('\n')[0] + '"');
