# Schema upgrades

When the database structure changes after a deployment:

1. Update `../schema.sql` (used for brand-new installs).
2. Add a file here named with a sortable prefix, e.g. `2026-10-01_add_xyz.sql`, containing only the change
   (`ALTER TABLE …`, `CREATE TABLE IF NOT EXISTS …`).

`tools/scripts/upgrade-db.mjs` (`npm run db:upgrade`) applies each file once (tracked in `schema_migrations`).
A brand-new install records all existing files as applied, because `schema.sql` already contains them.

For an existing database, run `npm run db:upgrade` after pulling schema changes;
building or restarting the app does not apply migrations. The upgrade script creates
the migration ledger if missing and also repairs a missing `background_jobs.lease_until`
even when its migration was previously recorded. Fresh installation verifies that
column before recording migrations as applied. Neither command resets existing data.
