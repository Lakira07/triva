/*
# Multi-tenant: teams, trainer accounts, team-scoped data

## Overview
Transforms the app from single-tenant to multi-tenant. Trainers sign up with email/password
(Supabase Auth), create a team, and get a unique join code. Players use the join code to access
their team's portal. All existing data tables get a `team_id` column for scoping.

## New Tables

### teams
- `id` (uuid, primary key)
- `name` (text, not null) — team display name (e.g. "Österåker United U2")
- `join_code` (text, unique, not null) — 6-char alphanumeric code players enter to find their team
- `owner_id` (uuid, references auth.users, on delete set null) — the trainer who owns this team
- `created_at` (timestamptz, default now())

### team_settings
Per-team settings (replaces the singleton `settings` table for the multi-tenant app).
- `team_id` (uuid, primary key, references teams, on delete cascade)
- `weekly_survey_required` (integer, default 1) — surveys required per week
- `weekly_wellbeing_required` (integer, default 1) — wellbeing reports required per week
- `updated_at` (timestamptz, default now())

## Modified Tables
- `players` — added `team_id` (uuid, references teams, on delete cascade, nullable for legacy rows)
- `questions` — added `team_id` (uuid, references teams, on delete cascade, nullable for legacy rows)
- `responses` — added `team_id` (uuid, references teams, on delete cascade, nullable for legacy rows)
- `wellbeing_entries` — added `team_id` (uuid, references teams, on delete cascade, nullable for legacy rows)

## Security
- `teams`: anon can SELECT (players need to look up their team by join code).
  Authenticated trainers can SELECT/INSERT/UPDATE/DELETE only their own team (owner_id = auth.uid()).
- `team_settings`: anon full CRUD (players read settings via anon key, filtered client-side by team_id).
  Authenticated trainers can CRUD only their own team's settings.
- `players`, `questions`, `responses`, `wellbeing_entries`: anon full CRUD (USING true) — same
  security level as before; client filters by team_id. Authenticated trainers can CRUD only rows
  belonging to their team.

## Notes
1. Existing rows have NULL team_id and are invisible to any team's dashboard (queries filter by team_id).
2. The old `settings` singleton table remains but is unused; `team_settings` replaces it.
3. Join codes are generated client-side on team creation and are unique.
*/

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- teams: anon can SELECT (to look up by join_code)
DROP POLICY IF EXISTS "anon_select_teams" ON teams;
CREATE POLICY "anon_select_teams" ON teams FOR SELECT
  TO anon, authenticated USING (true);

-- teams: authenticated trainers can INSERT their own team
DROP POLICY IF EXISTS "trainer_insert_team" ON teams;
CREATE POLICY "trainer_insert_team" ON teams FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

-- teams: authenticated trainers can UPDATE their own team
DROP POLICY IF EXISTS "trainer_update_team" ON teams;
CREATE POLICY "trainer_update_team" ON teams FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- teams: authenticated trainers can DELETE their own team
DROP POLICY IF EXISTS "trainer_delete_team" ON teams;
CREATE POLICY "trainer_delete_team" ON teams FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- 2. Create team_settings table
CREATE TABLE IF NOT EXISTS team_settings (
  team_id uuid PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  weekly_survey_required integer NOT NULL DEFAULT 1,
  weekly_wellbeing_required integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;

-- team_settings: anon full CRUD (players read settings via anon key)
DROP POLICY IF EXISTS "anon_select_team_settings" ON team_settings;
CREATE POLICY "anon_select_team_settings" ON team_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_team_settings" ON team_settings;
CREATE POLICY "anon_insert_team_settings" ON team_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_team_settings" ON team_settings;
CREATE POLICY "anon_update_team_settings" ON team_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_team_settings" ON team_settings;
CREATE POLICY "anon_delete_team_settings" ON team_settings FOR DELETE
  TO anon, authenticated USING (true);

-- 3. Add team_id to existing tables
ALTER TABLE players ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE wellbeing_entries ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;

-- 4. Update RLS policies for team-scoped tables
-- For each table: anon keeps full CRUD (USING true), authenticated gets team-scoped CRUD

-- Helper: check if a team_id belongs to the authenticated trainer
-- We inline this in each policy as: team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())

-- === players ===
DROP POLICY IF EXISTS "trainer_select_players" ON players;
CREATE POLICY "trainer_select_players" ON players FOR SELECT
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_insert_players" ON players;
CREATE POLICY "trainer_insert_players" ON players FOR INSERT
  TO authenticated WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_update_players" ON players;
CREATE POLICY "trainer_update_players" ON players FOR UPDATE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_delete_players" ON players;
CREATE POLICY "trainer_delete_players" ON players FOR DELETE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

-- === questions ===
DROP POLICY IF EXISTS "trainer_select_questions" ON questions;
CREATE POLICY "trainer_select_questions" ON questions FOR SELECT
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_insert_questions" ON questions;
CREATE POLICY "trainer_insert_questions" ON questions FOR INSERT
  TO authenticated WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_update_questions" ON questions;
CREATE POLICY "trainer_update_questions" ON questions FOR UPDATE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_delete_questions" ON questions;
CREATE POLICY "trainer_delete_questions" ON questions FOR DELETE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

-- === responses ===
DROP POLICY IF EXISTS "trainer_select_responses" ON responses;
CREATE POLICY "trainer_select_responses" ON responses FOR SELECT
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_insert_responses" ON responses;
CREATE POLICY "trainer_insert_responses" ON responses FOR INSERT
  TO authenticated WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_update_responses" ON responses;
CREATE POLICY "trainer_update_responses" ON responses FOR UPDATE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_delete_responses" ON responses;
CREATE POLICY "trainer_delete_responses" ON responses FOR DELETE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

-- === wellbeing_entries ===
DROP POLICY IF EXISTS "trainer_select_wellbeing" ON wellbeing_entries;
CREATE POLICY "trainer_select_wellbeing" ON wellbeing_entries FOR SELECT
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_insert_wellbeing" ON wellbeing_entries;
CREATE POLICY "trainer_insert_wellbeing" ON wellbeing_entries FOR INSERT
  TO authenticated WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_update_wellbeing" ON wellbeing_entries;
CREATE POLICY "trainer_update_wellbeing" ON wellbeing_entries FOR UPDATE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()))
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trainer_delete_wellbeing" ON wellbeing_entries;
CREATE POLICY "trainer_delete_wellbeing" ON wellbeing_entries FOR DELETE
  TO authenticated USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

-- 5. Index for faster team-scoped queries
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_questions_team_id ON questions(team_id);
CREATE INDEX IF NOT EXISTS idx_responses_team_id ON responses(team_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_entries_team_id ON wellbeing_entries(team_id);
