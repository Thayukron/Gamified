-- Course-level part of the lesson-plan book (OVEC 2567 form): cover, preface, course curriculum,
-- occupational standard, unit analysis, learning-behaviour analysis, unit hours, bibliography
CREATE TABLE IF NOT EXISTS course_plans (
    course_id   INT UNSIGNED PRIMARY KEY,
    content     LONGTEXT NOT NULL COMMENT 'JSON',
    ai_model    VARCHAR(80) NULL,
    updated_by  INT UNSIGNED NULL,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cplan_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_cplan_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
