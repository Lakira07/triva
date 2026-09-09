/*
# Add code expiry to teams

1. New Columns
- `teams.code_expires_at` (timestamptz, nullable) — optional expiry date for both join_code and trainer_code. When set and the current time is past this date, login with either code is rejected.

2. Modified Tables
- `teams` — gains `code_expires_at` column.

3. Security
- No RLS changes needed; existing policies on teams remain unchanged.
- The column is writable by the team owner (via existing UPDATE policy).

4. Important Notes
- NULL means codes never expire (backward compatible).
- Enforcement happens in the application layer at login time.
*/

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS code_expires_at timestamptz;
