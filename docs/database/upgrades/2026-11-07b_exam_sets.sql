-- Exam questions drafted by AI for the midterm/final week (a service for the teacher, not part of the plan book).
-- One set per course and exam; kept so the teacher can open it again without asking the AI.
CREATE TABLE IF NOT EXISTS exam_sets (
    course_id   INT UNSIGNED NOT NULL,
    kind        ENUM('midterm','final') NOT NULL COMMENT 'ทดสอบกลางภาค/ปลายภาค',
    units       TEXT NOT NULL COMMENT 'JSON: unit numbers the teacher ticked',
    options     TEXT NOT NULL COMMENT 'JSON: counts and points',
    content     LONGTEXT NOT NULL COMMENT 'JSON: questions',
    ai_model    VARCHAR(80) NULL,
    updated_by  INT UNSIGNED NULL,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, kind),
    CONSTRAINT fk_exam_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_exam_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
