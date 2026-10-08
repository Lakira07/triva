/*
# Add quarterly and monthly development plans

Each IUP goal can contain a plan for each quarter. Every quarter contains
three month-level sub-goals for player-led tracking and coach feedback.
*/

CREATE TABLE IF NOT EXISTS iup_quarterly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES development_goals(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  focus text NOT NULL,
  what_to_develop text,
  how_to_develop text,
  measurement text,
  player_evaluation text,
  coach_evaluation text,
  status text NOT NULL DEFAULT 'ej_paborjat' CHECK (status IN ('ej_paborjat', 'pagar', 'klart')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (goal_id, quarter)
);

ALTER TABLE iup_quarterly_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_iup_quarterly_plans" ON iup_quarterly_plans;
CREATE POLICY "anon_select_iup_quarterly_plans" ON iup_quarterly_plans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_iup_quarterly_plans" ON iup_quarterly_plans;
CREATE POLICY "anon_insert_iup_quarterly_plans" ON iup_quarterly_plans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_iup_quarterly_plans" ON iup_quarterly_plans;
CREATE POLICY "anon_update_iup_quarterly_plans" ON iup_quarterly_plans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_iup_quarterly_plans" ON iup_quarterly_plans;
CREATE POLICY "anon_delete_iup_quarterly_plans" ON iup_quarterly_plans FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS iup_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES iup_quarterly_plans(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES development_goals(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 3),
  title text NOT NULL,
  what_to_develop text,
  how_to_develop text,
  measurement text,
  status text NOT NULL DEFAULT 'ej_paborjat' CHECK (status IN ('ej_paborjat', 'pagar', 'klart')),
  player_evaluation text,
  coach_evaluation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (plan_id, month)
);

ALTER TABLE iup_monthly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_iup_monthly_goals" ON iup_monthly_goals;
CREATE POLICY "anon_select_iup_monthly_goals" ON iup_monthly_goals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_iup_monthly_goals" ON iup_monthly_goals;
CREATE POLICY "anon_insert_iup_monthly_goals" ON iup_monthly_goals FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_iup_monthly_goals" ON iup_monthly_goals;
CREATE POLICY "anon_update_iup_monthly_goals" ON iup_monthly_goals FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_iup_monthly_goals" ON iup_monthly_goals;
CREATE POLICY "anon_delete_iup_monthly_goals" ON iup_monthly_goals FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_iup_plans_goal ON iup_quarterly_plans(goal_id);
CREATE INDEX IF NOT EXISTS idx_iup_plans_player ON iup_quarterly_plans(player_id);
CREATE INDEX IF NOT EXISTS idx_iup_monthly_goals_plan ON iup_monthly_goals(plan_id);
CREATE INDEX IF NOT EXISTS idx_iup_monthly_goals_player ON iup_monthly_goals(player_id);
