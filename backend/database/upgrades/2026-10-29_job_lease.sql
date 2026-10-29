ALTER TABLE background_jobs ADD COLUMN IF NOT EXISTS lease_until DATETIME NULL COMMENT 'Node job heartbeat; expired jobs fail instead of staying running';
