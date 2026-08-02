-- Migration: ideas_status_default_draft
--
-- Sets the ideas.status column DEFAULT to 'DRAFT' in a SEPARATE transaction,
-- AFTER the new IdeaStatus enum values ('DRAFT', 'WITHDRAWN') were committed by
-- 20260722130000_align_mvp_schema.
--
-- Why this migration exists: PostgreSQL forbids using a newly added enum value
-- in the SAME transaction that added it (error 55P04, "unsafe use of new value
-- ... of enum type"). Combining ADD VALUE 'DRAFT' with SET DEFAULT 'DRAFT' in a
-- single migration therefore fails. Splitting the SET DEFAULT into this
-- follow-up migration makes the sequence safe and reproducible on a clean DB.
-- Verified applied on PostgreSQL 16.14.

ALTER TABLE "ideas" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
