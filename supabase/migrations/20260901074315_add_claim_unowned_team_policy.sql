-- Allow authenticated trainers to claim an unowned team (owner_id IS NULL)
-- This is used during signup: if a team name matches an existing unowned team,
-- the new trainer claims it instead of creating a duplicate.
CREATE POLICY "claim_unowned_team" ON teams FOR UPDATE
  TO authenticated USING (owner_id IS NULL) WITH CHECK (owner_id = auth.uid());
