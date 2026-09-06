/*
# Create questionnaire tables for football team

## Overview
Creates a questionnaire system where a coach can create questions, players answer them via a shareable link, and the coach can view all responses.

## New Tables

### questions
- `id` (uuid, primary key)
- `text` (text, not null) — the question text
- `type` (text, not null) — question type: 'text', 'rating', 'choice'
- `options` (jsonb, nullable) — for 'choice' type: array of option strings
- `order_index` (integer, not null, default 0) — display order
- `created_at` (timestamptz, default now())

### responses
- `id` (uuid, primary key)
- `player_name` (text, nullable) — optional player name
- `created_at` (timestamptz, default now())

### answers
- `id` (uuid, primary key)
- `response_id` (uuid, foreign key to responses, on delete cascade)
- `question_id` (uuid, foreign key to questions, on delete cascade)
- `answer_text` (text, not null) — the player's answer
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on all tables.
- This is a single-tenant app with no sign-in, so all policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because the data is intentionally shared/public.
*/

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  options jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_questions" ON questions;
CREATE POLICY "anon_select_questions" ON questions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_questions" ON questions;
CREATE POLICY "anon_insert_questions" ON questions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_questions" ON questions;
CREATE POLICY "anon_update_questions" ON questions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_questions" ON questions;
CREATE POLICY "anon_delete_questions" ON questions FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_responses" ON responses;
CREATE POLICY "anon_select_responses" ON responses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_responses" ON responses;
CREATE POLICY "anon_insert_responses" ON responses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_responses" ON responses;
CREATE POLICY "anon_delete_responses" ON responses FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_answers" ON answers;
CREATE POLICY "anon_select_answers" ON answers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_answers" ON answers;
CREATE POLICY "anon_insert_answers" ON answers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_answers" ON answers;
CREATE POLICY "anon_delete_answers" ON answers FOR DELETE
  TO anon, authenticated USING (true);
