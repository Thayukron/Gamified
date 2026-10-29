-- Student status: still studying / graduated / dropped out (inactive = account closed by the admin).
-- Only "studying" students can log in and appear in courses; their data is kept for past reports.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS student_status ENUM('studying','graduated','dropped','inactive') NULL
        COMMENT 'นักศึกษา: กำลังศึกษา/สำเร็จการศึกษา/ออกกลางคัน/ปิดบัญชี' AFTER class_group;
UPDATE users SET student_status = IF(is_active = 1, 'studying', 'inactive') WHERE role = 'student' AND student_status IS NULL;
