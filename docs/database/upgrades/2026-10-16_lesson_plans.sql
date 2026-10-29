-- Unit lesson plans in the OVEC 2567 form (sections 1–10), one row per unit + teaching session
CREATE TABLE IF NOT EXISTS lesson_plans (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id       INT UNSIGNED NOT NULL,
    unit_no         SMALLINT UNSIGNED NOT NULL,
    session_no      SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'สอนครั้งที่',
    unit_name       VARCHAR(200) NOT NULL,
    title           VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'ชื่อเรื่อง/งาน',
    hours_theory    DECIMAL(4,1) NOT NULL DEFAULT 0,
    hours_practice  DECIMAL(4,1) NOT NULL DEFAULT 0,
    content         LONGTEXT NOT NULL COMMENT 'JSON: sections 1–10 of the plan',
    ai_model        VARCHAR(80) NULL,
    ai_at           DATETIME NULL,
    created_by      INT UNSIGNED NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plan_session (course_id, unit_no, session_no),
    CONSTRAINT fk_plan_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_plan_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
