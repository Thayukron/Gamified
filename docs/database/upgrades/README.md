# Schema upgrades

When the database structure changes after a deployment:

1. Update `../schema.sql` (used for brand-new installs).
2. Add a file here named with a sortable prefix, e.g. `2026-10-01_add_xyz.sql`, containing only the change
   (`ALTER TABLE …`, `CREATE TABLE IF NOT EXISTS …`).

`tools/scripts/upgrade-db.mjs` (`npm run db:upgrade`) applies each file once (tracked in `schema_migrations`).
A brand-new install records all existing files as applied, because `schema.sql` already contains them.

For an existing database, run `npm run db:upgrade` after pulling schema changes;
building or restarting the app does not apply migrations. The upgrade script creates
the migration ledger if missing. Neither command resets existing data. The schema is kept the
same as the `main` branch's (the former `background_jobs.lease_until` column is no longer used;
an existing database may keep it, it is simply ignored).
