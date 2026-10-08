/*
# Add per-metric comments to wellbeing entries

Adds optional note columns for each wellbeing rating so a player can explain
why they chose a score. Existing rows remain valid because all columns are nullable.
*/

ALTER TABLE wellbeing_entries
  ADD COLUMN IF NOT EXISTS sleep_note text,
  ADD COLUMN IF NOT EXISTS energy_note text,
  ADD COLUMN IF NOT EXISTS mood_note text,
  ADD COLUMN IF NOT EXISTS stress_note text,
  ADD COLUMN IF NOT EXISTS soreness_note text;
