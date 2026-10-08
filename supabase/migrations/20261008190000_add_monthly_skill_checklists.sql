/*
# Add selectable skill checklists to monthly goals

The selected skills are stored as a JSON object keyed by development area.
Each key contains an array of selected skill names.
*/

ALTER TABLE iup_monthly_goals
  ADD COLUMN IF NOT EXISTS selected_skills jsonb NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_iup_monthly_goals_selected_skills
  ON iup_monthly_goals USING gin (selected_skills);
