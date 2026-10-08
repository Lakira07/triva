/*
# Replace the three individual month records with a selectable month span per quarter.

Each quarterly plan stores one start and one end month in the range 1–12.
The selected skills are also stored at the quarterly level.
*/

ALTER TABLE iup_quarterly_plans
  ADD COLUMN IF NOT EXISTS start_month integer CHECK (start_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS end_month integer CHECK (end_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS selected_skills jsonb NOT NULL DEFAULT '{}';

UPDATE iup_quarterly_plans
SET start_month = 1,
    end_month = 3
WHERE start_month IS NULL AND end_month IS NULL;

ALTER TABLE iup_quarterly_plans
  ALTER COLUMN start_month SET NOT NULL,
  ALTER COLUMN end_month SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_iup_quarterly_plans_month_range
  ON iup_quarterly_plans (start_month, end_month);

CREATE INDEX IF NOT EXISTS idx_iup_quarterly_plans_selected_skills
  ON iup_quarterly_plans USING gin (selected_skills);
