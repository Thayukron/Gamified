-- Course content copied from the official curriculum: entered when creating/editing a course,
-- shared with the lesson-plan book and used by the AI when drafting plans and sheets
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS theory_hours   VARCHAR(10) NULL COMMENT 'ชม./สัปดาห์',
    ADD COLUMN IF NOT EXISTS practice_hours VARCHAR(10) NULL COMMENT 'ชม./สัปดาห์',
    ADD COLUMN IF NOT EXISTS credits        VARCHAR(10) NULL,
    ADD COLUMN IF NOT EXISTS standards_ref  TEXT NULL COMMENT 'อ้างอิงมาตรฐาน',
    ADD COLUMN IF NOT EXISTS outcome        TEXT NULL COMMENT 'ผลลัพธ์การเรียนรู้ระดับรายวิชา',
    ADD COLUMN IF NOT EXISTS objectives     TEXT NULL COMMENT 'จุดประสงค์รายวิชา (1 บรรทัด = 1 ข้อ)',
    ADD COLUMN IF NOT EXISTS competencies   TEXT NULL COMMENT 'สมรรถนะรายวิชา (1 บรรทัด = 1 ข้อ)',
    ADD COLUMN IF NOT EXISTS description    TEXT NULL COMMENT 'คำอธิบายรายวิชา';
