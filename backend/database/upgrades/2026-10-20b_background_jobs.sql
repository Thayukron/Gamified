-- Results of long AI requests run in the background (polled by the browser; deleted after 2 days)
CREATE TABLE IF NOT EXISTS background_jobs (
    id           CHAR(32) PRIMARY KEY,
    user_id      INT UNSIGNED NOT NULL,
    path         VARCHAR(255) NOT NULL,
    status       ENUM('running','done','error') NOT NULL DEFAULT 'running',
    http_status  SMALLINT NULL,
    result       MEDIUMTEXT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_jobs_user (user_id),
    INDEX idx_jobs_created (created_at)
) ENGINE=InnoDB;
