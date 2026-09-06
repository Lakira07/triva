/*
# Add trainer_code to teams

## Overview
Adds a separate `trainer_code` column to the `teams` table. This is distinct from
`join_code` (which players use). Trainers log in with only this code — no email
or password needed. The admin generates and distributes both codes.

## Modified Tables
- `teams` — added `trainer_code` (text, unique, not null). Backfilled for the
  existing team with a generated code.

## Security
- `teams` already has RLS enabled. The existing anon SELECT policy already allows
  looking up teams by code. No policy changes needed — both `join_code` and
  `trainer_code` are readable by anon (needed for login lookups).
*/

ALTER TABLE teams ADD COLUMN IF NOT EXISTS trainer_code text UNIQUE;

-- Backfill: generate a trainer code for the existing team that has none
DO $$
DECLARE
  existing_team RECORD;
  new_code text;
  i int;
BEGIN
  FOR existing_team IN SELECT id FROM teams WHERE trainer_code IS NULL LOOP
    i := 0;
    LOOP
      new_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6));
      BEGIN
        UPDATE teams SET trainer_code = new_code WHERE id = existing_team.id AND trainer_code IS NULL;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        i := i + 1;
        IF i > 10 THEN EXIT; END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Make trainer_code NOT NULL after backfill
ALTER TABLE teams ALTER COLUMN trainer_code SET NOT NULL;
