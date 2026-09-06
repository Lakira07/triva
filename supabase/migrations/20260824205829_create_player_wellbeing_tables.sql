/*
# Create player wellbeing tracking tables

## Overview
Adds a player profiling system where the coach can create player profiles and players submit wellbeing entries (sleep, energy, mood, stress, soreness) over time. The coach can view trends and development per player.

## New Tables

### players
- `id` (uuid, primary key)
- `name` (text, not null) — player's display name
- `position` (text, nullable) — playing position (e.g. "Målvakt", "Försvarare")
- `jersey_number` (integer, nullable) — jersey number
- `created_at` (timestamptz, default now())

### wellbeing_entries
- `id` (uuid, primary key)
- `player_id` (uuid, foreign key to players, on delete cascade)
- `sleep` (integer, 1–5) — sleep quality rating
- `energy` (integer, 1–5) — energy level rating
- `mood` (integer, 1–5) — mood rating
- `stress` (integer, 1–5) — stress level rating
- `soreness` (integer, 1–5) — muscle soreness rating
- `note` (text, nullable) — optional free-text comment
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on both tables.
- Single-tenant app with no sign-in: all policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
*/

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text,
  jersey_number integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wellbeing_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sleep integer NOT NULL DEFAULT 3,
  energy integer NOT NULL DEFAULT 3,
  mood integer NOT NULL DEFAULT 3,
  stress integer NOT NULL DEFAULT 3,
  soreness integer NOT NULL DEFAULT 3,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_entries ENABLE ROW LEVEL SECURITY;

-- Players: full CRUD
DROP POLICY IF EXISTS "anon_select_players" ON players;
CREATE POLICY "anon_select_players" ON players FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_players" ON players;
CREATE POLICY "anon_insert_players" ON players FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_players" ON players;
CREATE POLICY "anon_update_players" ON players FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_players" ON players;
CREATE POLICY "anon_delete_players" ON players FOR DELETE
  TO anon, authenticated USING (true);

-- Wellbeing entries: full CRUD
DROP POLICY IF EXISTS "anon_select_wellbeing" ON wellbeing_entries;
CREATE POLICY "anon_select_wellbeing" ON wellbeing_entries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wellbeing" ON wellbeing_entries;
CREATE POLICY "anon_insert_wellbeing" ON wellbeing_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wellbeing" ON wellbeing_entries;
CREATE POLICY "anon_delete_wellbeing" ON wellbeing_entries FOR DELETE
  TO anon, authenticated USING (true);
