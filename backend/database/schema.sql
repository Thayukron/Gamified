-- Gamified Universal Student Profiling System
-- MySQL / MariaDB schema (utf8mb4)

CREATE DATABASE IF NOT EXISTS gamified CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gamified;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS lesson_plans, password_reset_requests, course_groupings, user_ai_settings, player_progress, auth_tokens, ai_insights_cache, game_sessions, assessment_results,
    archetype_master, scenarios, enrollments, courses, users, departments, settings;
SET FOREIGN_KEY_CHECKS = 1;

-- แผนกวิชา
CREATE TABLE departments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(20)  NOT NULL UNIQUE,
    name        VARCHAR(150) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ผู้ใช้งาน (student / teacher / admin)
CREATE TABLE users (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    full_name      VARCHAR(150) NOT NULL,
    role           ENUM('student','teacher','admin') NOT NULL DEFAULT 'student',
    department_id  INT UNSIGNED NULL,
    student_code   VARCHAR(30)  NULL,
    class_group    VARCHAR(30)  NULL COMMENT 'กลุ่มเรียน/ห้อง เช่น ปวส.1/1',
    is_active      TINYINT(1)   NOT NULL DEFAULT 1,
    must_change_password TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'บังคับตั้งรหัสผ่านใหม่เมื่อเข้าสู่ระบบ',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_group (class_group),
    CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- รายวิชา / กลุ่มเรียน
CREATE TABLE courses (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(30)  NOT NULL,
    name            VARCHAR(200) NOT NULL,
    section         VARCHAR(20)  NOT NULL DEFAULT '1',
    semester        TINYINT      NOT NULL DEFAULT 1,
    academic_year   SMALLINT     NOT NULL,
    department_id   INT UNSIGNED NULL,
    teacher_id      INT UNSIGNED NULL,
    course_type     ENUM('theory','practice','mixed') NOT NULL DEFAULT 'mixed' COMMENT 'ทฤษฎี/ปฏิบัติ/ผสม',
    level           VARCHAR(30) NULL COMMENT 'เช่น ปวช.1, ปวส.1',
    topics          TEXT NULL COMMENT 'JSON array หัวข้อ/หน่วยการเรียน',
    context_note    TEXT NULL COMMENT 'บริบทรายวิชา ใช้ประกอบไกด์และ prompt AI',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_course_section (code, section, semester, academic_year),
    CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- การลงทะเบียนเรียน
CREATE TABLE enrollments (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id   INT UNSIGNED NOT NULL,
    student_id  INT UNSIGNED NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_enrollment (course_id, student_id),
    CONSTRAINT fk_enroll_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_enroll_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- คลังเนื้อเรื่อง (โครงสร้างฉากทั้งหมดเก็บเป็น JSON)
CREATE TABLE scenarios (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    description     TEXT NULL,
    cover_image     VARCHAR(255) NULL,
    owner_id        INT UNSIGNED NULL,
    is_universal    TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ชุดเนื้อเรื่องสากล (Core Profile)',
    is_active       TINYINT(1) NOT NULL DEFAULT 0,
    status          ENUM('draft','published') NOT NULL DEFAULT 'draft',
    copied_from_id  INT UNSIGNED NULL,
    content         LONGTEXT NOT NULL COMMENT 'JSON: { start, scenes: {...} }',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_scen_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_scen_copied FOREIGN KEY (copied_from_id) REFERENCES scenarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- การ์ดตัวละคร (Archetype)
CREATE TABLE archetype_master (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code         VARCHAR(30)  NOT NULL UNIQUE,
    name         VARCHAR(100) NOT NULL,
    title        VARCHAR(150) NOT NULL,
    description  TEXT NOT NULL,
    strengths    TEXT NOT NULL COMMENT 'JSON array',
    tips         TEXT NULL COMMENT 'JSON array: คำแนะนำการเรียน',
    riasec_key   CHAR(1) NULL COMMENT 'R I A S E C ที่เป็นแกนของ archetype',
    color        VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    icon         VARCHAR(20) NULL,
    image        VARCHAR(255) NULL
) ENGINE=InnoDB;

-- ผลการประเมิน
CREATE TABLE assessment_results (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL,
    scenario_id     INT UNSIGNED NULL,
    semester        TINYINT  NOT NULL,
    academic_year   SMALLINT NOT NULL,
    vark_v          SMALLINT NOT NULL DEFAULT 0,
    vark_a          SMALLINT NOT NULL DEFAULT 0,
    vark_r          SMALLINT NOT NULL DEFAULT 0,
    vark_k          SMALLINT NOT NULL DEFAULT 0,
    riasec_r        SMALLINT NOT NULL DEFAULT 0,
    riasec_i        SMALLINT NOT NULL DEFAULT 0,
    riasec_a        SMALLINT NOT NULL DEFAULT 0,
    riasec_s        SMALLINT NOT NULL DEFAULT 0,
    riasec_e        SMALLINT NOT NULL DEFAULT 0,
    riasec_c        SMALLINT NOT NULL DEFAULT 0,
    mindset_growth  SMALLINT NOT NULL DEFAULT 0,
    mindset_fixed   SMALLINT NOT NULL DEFAULT 0,
    dominant_vark   VARCHAR(10) NULL,
    dominant_riasec VARCHAR(10) NULL,
    mindset_type    ENUM('growth','fixed','mixed') NULL,
    archetype_id    INT UNSIGNED NULL,
    rarity          ENUM('rare','epic','legendary') NOT NULL DEFAULT 'rare',
    xp_gained       INT NOT NULL DEFAULT 0,
    coins_gained    INT NOT NULL DEFAULT 0,
    choices_log     LONGTEXT NULL COMMENT 'JSON log ของการตัดสินใจ',
    completed_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_result_term (user_id, scenario_id, semester, academic_year),
    INDEX idx_result_term (academic_year, semester),
    CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_res_scen FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_res_arch FOREIGN KEY (archetype_id) REFERENCES archetype_master(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Save State ระหว่างเล่น (กรณีออกกลางคัน)
CREATE TABLE game_sessions (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id        INT UNSIGNED NOT NULL,
    scenario_id    INT UNSIGNED NOT NULL,
    current_scene  VARCHAR(100) NOT NULL,
    choices_log    LONGTEXT NOT NULL COMMENT 'JSON array',
    status         ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
    started_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_session (user_id, scenario_id),
    CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sess_scen FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Cache คำแนะนำจาก AI (1 แถวต่อ รายวิชา + ประเภท + หัวข้อ; สร้างใหม่เมื่อครูกดเท่านั้น)
CREATE TABLE ai_insights_cache (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    course_id    INT UNSIGNED NULL,
    cache_key    CHAR(64) NOT NULL UNIQUE COMMENT 'sha256(course_id|insight_type|topic)',
    fingerprint  CHAR(64) NOT NULL COMMENT 'sha256 ของสถิติห้อง+บริบทวิชา ตอนสร้าง → ใช้บอกว่าข้อมูลเปลี่ยนแล้ว',
    insight_type VARCHAR(50) NOT NULL DEFAULT 'course',
    topic        VARCHAR(100) NULL,
    prompt       LONGTEXT NOT NULL,
    response     LONGTEXT NOT NULL,
    provider     VARCHAR(30) NULL,
    model        VARCHAR(80) NULL,
    key_source   ENUM('own','central') NULL,
    prompt_tokens INT NULL,
    output_tokens INT NULL,
    created_by   INT UNSIGNED NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- การตั้งค่าระบบ (รวม API Key แบบ BYOK)
CREATE TABLE settings (
    setting_key    VARCHAR(80) PRIMARY KEY,
    setting_value  TEXT NULL,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Token สำหรับยืนยันตัวตน API
CREATE TABLE auth_tokens (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    expires_at  DATETIME NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ความก้าวหน้าของผู้เล่น (สะสมข้ามเควสต์) + avatar
CREATE TABLE player_progress (
    user_id     INT UNSIGNED PRIMARY KEY,
    xp          INT NOT NULL DEFAULT 0,
    coins       INT NOT NULL DEFAULT 0,
    avatar      TEXT NULL COMMENT 'JSON: gender, hairStyle, hair, skin, eyes, robe',
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_prog_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ตั้งค่า AI รายครู (BYOK): API Key ของครูเอง เข้ารหัส AES-256-GCM
CREATE TABLE user_ai_settings (
    user_id          INT UNSIGNED PRIMARY KEY,
    provider         VARCHAR(30) NOT NULL DEFAULT 'gemini',
    api_key_enc      TEXT NULL,
    key_hint         VARCHAR(20) NULL COMMENT 'แสดงผลแบบปิดบัง เช่น AIza…1234',
    model            VARCHAR(80) NULL,
    central_allowed  TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'แอดมินอนุญาตให้ใช้ Key กลาง',
    verified_at      DATETIME NULL,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_user_settings FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- การจัดกลุ่มที่ครูบันทึกไว้ (1 ชุดล่าสุดต่อรายวิชา) — ใช้ในรายงาน ว.PA
CREATE TABLE course_groupings (
    course_id    INT UNSIGNED PRIMARY KEY,
    mode         ENUM('mixed','similar') NOT NULL DEFAULT 'mixed',
    group_size   TINYINT NOT NULL,
    member_ids   TEXT NOT NULL COMMENT 'JSON: [[student_id,...], ...]',
    saved_by     INT UNSIGNED NULL,
    saved_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_grp_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_grp_user FOREIGN KEY (saved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- คำขอรีเซ็ตรหัสผ่าน (ลืมรหัสผ่าน) — แอดมิน/ครูประจำวิชาเป็นผู้รีเซ็ต
CREATE TABLE password_reset_requests (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    note        VARCHAR(200) NULL,
    status      ENUM('pending','done','dismissed') NOT NULL DEFAULT 'pending',
    handled_by  INT UNSIGNED NULL,
    handled_at  DATETIME NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reset_status (status, user_id),
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- แผนการจัดการเรียนรู้รายหน่วย (แบบฟอร์ม สอศ. 2567 ข้อ 1–10)
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
