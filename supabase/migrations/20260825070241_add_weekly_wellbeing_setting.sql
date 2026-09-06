/*
# Add weekly wellbeing requirement setting

## Overview
Adds a `weekly_wellbeing_required` column to the `settings` table so the coach
can configure how many wellbeing reports each player must submit per week,
mirroring the existing `weekly_survey_required` for surveys.
*/

ALTER TABLE settings ADD COLUMN IF NOT EXISTS weekly_wellbeing_required integer NOT NULL DEFAULT 1;

UPDATE settings SET weekly_wellbeing_required = 1 WHERE id = 1;
