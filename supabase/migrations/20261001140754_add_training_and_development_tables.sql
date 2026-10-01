/*
# Add training, development goals, and assessment tables

1. New Tables
- `development_goals` — IUP goals per player, linking to development area and football action
- `training_sessions` — planned training sessions with date, duration, intensity (RPE), content, and IUP linkage
- `training_assignments` — links a session to team/group/individual players
- `training_completions` — per-player completion data: actual time, actual RPE, pain/notes, reflection
- `assessments` — coach assessments per player per development area, with observation, rating, feedback, next steps

2. Security
- All tables use TO anon, authenticated with USING (true) / WITH CHECK (true) — same single-tenant pattern as existing tables (players, wellbeing_entries, etc.)
- RLS enabled on every table
- 4 CRUD policies per table

3. Important Notes
- Load is calculated in the app layer: planned load = planned_duration_min × planned_rpe; actual load = actual_duration_min × player_rpe
- development_goals links to players and stores: area (teknik/spelförståelse/fysik/psykologi), football_action, target description
- assessments track progression: assessment_number, observation, player_reflection, training_done, load_recovery, next_steps
*/

-- Development goals (IUP)
CREATE TABLE IF NOT EXISTS development_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  area text NOT NULL CHECK (area IN ('teknik', 'spelförståelse', 'fysik', 'psykologi')),
  football_action text,
  target_description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE development_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dev_goals" ON development_goals;
CREATE POLICY "anon_select_dev_goals" ON development_goals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_dev_goals" ON development_goals;
CREATE POLICY "anon_insert_dev_goals" ON development_goals FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_dev_goals" ON development_goals;
CREATE POLICY "anon_update_dev_goals" ON development_goals FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_dev_goals" ON development_goals;
CREATE POLICY "anon_delete_dev_goals" ON development_goals FOR DELETE
  TO anon, authenticated USING (true);

-- Training sessions
CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  title text NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('lag', 'grupp', 'individuell')),
  scheduled_at timestamptz NOT NULL,
  planned_duration_min integer NOT NULL DEFAULT 60,
  planned_rpe integer NOT NULL DEFAULT 5 CHECK (planned_rpe >= 1 AND planned_rpe <= 10),
  content text,
  purpose text,
  exercises text,
  goal_id uuid REFERENCES development_goals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_training_sessions" ON training_sessions;
CREATE POLICY "anon_select_training_sessions" ON training_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_training_sessions" ON training_sessions;
CREATE POLICY "anon_insert_training_sessions" ON training_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_training_sessions" ON training_sessions;
CREATE POLICY "anon_update_training_sessions" ON training_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_training_sessions" ON training_sessions;
CREATE POLICY "anon_delete_training_sessions" ON training_sessions FOR DELETE
  TO anon, authenticated USING (true);

-- Training assignments (which players/groups are assigned)
CREATE TABLE IF NOT EXISTS training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  is_all_team boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_training_assignments" ON training_assignments;
CREATE POLICY "anon_select_training_assignments" ON training_assignments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_training_assignments" ON training_assignments;
CREATE POLICY "anon_insert_training_assignments" ON training_assignments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_training_assignments" ON training_assignments;
CREATE POLICY "anon_update_training_assignments" ON training_assignments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_training_assignments" ON training_assignments;
CREATE POLICY "anon_delete_training_assignments" ON training_assignments FOR DELETE
  TO anon, authenticated USING (true);

-- Training completions (per-player follow-up)
CREATE TABLE IF NOT EXISTS training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  actual_duration_min integer,
  player_rpe integer CHECK (player_rpe >= 1 AND player_rpe <= 10),
  has_pain boolean NOT NULL DEFAULT false,
  pain_note text,
  player_reflection text,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (session_id, player_id)
);

ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_training_completions" ON training_completions;
CREATE POLICY "anon_select_training_completions" ON training_completions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_training_completions" ON training_completions;
CREATE POLICY "anon_insert_training_completions" ON training_completions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_training_completions" ON training_completions;
CREATE POLICY "anon_update_training_completions" ON training_completions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_training_completions" ON training_completions;
CREATE POLICY "anon_delete_training_completions" ON training_completions FOR DELETE
  TO anon, authenticated USING (true);

-- Assessments (development tracking)
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  goal_id uuid REFERENCES development_goals(id) ON DELETE SET NULL,
  area text NOT NULL CHECK (area IN ('teknik', 'spelförståelse', 'fysik', 'psykologi')),
  assessment_number integer NOT NULL DEFAULT 1,
  football_action text,
  physical_quality text,
  psychological_focus text,
  coach_observation text,
  coach_rating integer CHECK (coach_rating >= 1 AND coach_rating <= 5),
  player_reflection text,
  training_done_summary text,
  load_recovery_summary text,
  feedback text,
  next_steps text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_assessments" ON assessments;
CREATE POLICY "anon_select_assessments" ON assessments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_assessments" ON assessments;
CREATE POLICY "anon_insert_assessments" ON assessments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_assessments" ON assessments;
CREATE POLICY "anon_update_assessments" ON assessments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_assessments" ON assessments;
CREATE POLICY "anon_delete_assessments" ON assessments FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dev_goals_player ON development_goals(player_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_team ON training_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_training_assignments_session ON training_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_session ON training_completions(session_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_player ON training_completions(player_id);
CREATE INDEX IF NOT EXISTS idx_assessments_player ON assessments(player_id);
CREATE INDEX IF NOT EXISTS idx_assessments_area ON assessments(area);
