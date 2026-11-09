-- One plan per unit, covering a range of sessions from the weekly schedule; exam weeks have plans of their own.
-- sessions NULL = a plan made per session before the schedule existed (left as it was).
ALTER TABLE lesson_plans
    ADD COLUMN IF NOT EXISTS kind ENUM('unit','midterm','final') NOT NULL DEFAULT 'unit' COMMENT 'แผนหน่วย/ทดสอบกลางภาค/ทดสอบปลายภาค' AFTER course_id,
    ADD COLUMN IF NOT EXISTS sessions VARCHAR(60) NULL COMMENT 'ครั้งที่สอนจากตารางรายสัปดาห์ เช่น 1-3 หรือ 5-6, 8' AFTER session_no;
