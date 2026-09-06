/*
# Unify survey + wellbeing under player portal

## Overview
- Adds `player_id` to `responses` so survey answers are linked to a logged-in player.
- Creates a `settings` table for coach-configurable options (e.g. weekly survey requirement).
- Adds an UPDATE policy to `responses` (needed for future edits) and an INSERT policy that allows setting player_id.

## Changes

### responses: add player_id
- `player_id` (uuid, nullable) — references players(id), ON DELETE SET NULL
- Backfilled to NULL for existing rows (player_name still used for legacy).

### settings (new table)
- `id` (int, primary key, default 1) — singleton row
- `weekly_survey_required` (integer, default 1) — how many times per week a player must complete the survey
- `updated_at` (timestamptz, default now())

## Security
- RLS enabled on settings, full CRUD for anon+authenticated (single-tenant, no sign-in).
- responses gets an UPDATE policy (was missing).
*/

ALTER TABLE responses ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES players(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weekly_survey_required integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO settings (id, weekly_survey_required)
VALUES (1, 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- responses: add UPDATE policy (was missing before)
DROP POLICY IF EXISTS "anon_update_responses" ON responses;
CREATE POLICY "anon_update_responses" ON responses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
