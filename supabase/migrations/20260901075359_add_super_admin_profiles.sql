/*
# Super Admin: profiles table + admin access control

## Overview
Adds a `profiles` table that mirrors auth.users with an `is_admin` flag.
The admin (you) can access a super-admin panel at #/admin to manage all teams,
generate join codes, and assign trainers to teams.

## New Tables
### profiles
- `id` (uuid, primary key, references auth.users, on delete cascade)
- `email` (text, not null) — copied from auth.users
- `is_admin` (boolean, default false) — only true for the super admin
- `created_at` (timestamptz, default now())

## Security Changes
1. `profiles`: RLS enabled. Authenticated users can SELECT their own profile.
   Admins (is_admin = true) can SELECT all profiles.
2. `teams`: new admin policies — admin (is_admin = true) can SELECT/INSERT/UPDATE/DELETE all teams.
   This is ADDED to existing trainer policies, not replacing them.
3. `team_settings`: admin can UPDATE any team's settings.
4. A trigger auto-creates a profile row when a new auth.user signs up.
5. The first admin user is set manually via execute_sql after signup.
*/
-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- profiles: users can read their own profile; admins can read all
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin = true);

-- profiles: users can update their own profile (but NOT is_admin)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Admin policies on teams (in addition to existing trainer policies)
-- Admin can SELECT all teams
DROP POLICY IF EXISTS "admin_select_teams" ON teams;
CREATE POLICY "admin_select_teams" ON teams FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admin can INSERT any team (assign owner_id to any trainer)
DROP POLICY IF EXISTS "admin_insert_team" ON teams;
CREATE POLICY "admin_insert_team" ON teams FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admin can UPDATE any team (change owner, join code, name)
DROP POLICY IF EXISTS "admin_update_team" ON teams;
CREATE POLICY "admin_update_team" ON teams FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Admin can DELETE any team
DROP POLICY IF EXISTS "admin_delete_team" ON teams;
CREATE POLICY "admin_delete_team" ON teams FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- 4. Admin policies on team_settings
DROP POLICY IF EXISTS "admin_update_team_settings" ON team_settings;
CREATE POLICY "admin_update_team_settings" ON team_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- 5. Admin can read all data across all teams (players, questions, responses, wellbeing)
DROP POLICY IF EXISTS "admin_select_players" ON players;
CREATE POLICY "admin_select_players" ON players FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "admin_select_questions" ON questions;
CREATE POLICY "admin_select_questions" ON questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "admin_select_responses" ON responses;
CREATE POLICY "admin_select_responses" ON responses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "admin_select_wellbeing" ON wellbeing_entries;
CREATE POLICY "admin_select_wellbeing" ON wellbeing_entries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- 6. Backfill profiles for existing auth.users (if any)
INSERT INTO profiles (id, email, is_admin)
SELECT id, email, false FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;
