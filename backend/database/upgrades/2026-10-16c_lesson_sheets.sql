-- Supporting documents of a unit plan (OVEC 2567 form): knowledge sheet, job sheet, activity sheet,
-- assignment sheet, assessment rubric
CREATE TABLE IF NOT EXISTS lesson_sheets (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    plan_id     INT UNSIGNED NOT NULL,
    type        ENUM('knowledge','job','activity','assignment','assessment') NOT NULL,
    number      VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'ใบ…ที่',
    title       VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'ชื่อเรื่อง/ชื่องาน',
    content     LONGTEXT NOT NULL COMMENT 'JSON',
    ai_model    VARCHAR(80) NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sheet_plan (plan_id, type),
    CONSTRAINT fk_sheet_plan FOREIGN KEY (plan_id) REFERENCES lesson_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
