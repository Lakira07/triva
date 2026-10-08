ALTER TABLE iup_quarterly_plans
  ADD COLUMN IF NOT EXISTS player_goal text,
  ADD COLUMN IF NOT EXISTS updated_by text NOT NULL DEFAULT 'coach';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'iup_quarterly_plans_updated_by_check'
      AND conrelid = 'iup_quarterly_plans'::regclass
  ) THEN
    ALTER TABLE iup_quarterly_plans
      ADD CONSTRAINT iup_quarterly_plans_updated_by_check
      CHECK (updated_by IN ('coach', 'player'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS iup_quarterly_plan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES iup_quarterly_plans(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES development_goals(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  actor text NOT NULL CHECK (actor IN ('coach', 'player')),
  changes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE iup_quarterly_plan_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_iup_quarterly_plan_changes" ON iup_quarterly_plan_changes;
CREATE POLICY "anon_select_iup_quarterly_plan_changes"
  ON iup_quarterly_plan_changes FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_insert_iup_quarterly_plan_changes" ON iup_quarterly_plan_changes;
CREATE POLICY "anon_insert_iup_quarterly_plan_changes"
  ON iup_quarterly_plan_changes FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_iup_quarterly_plan_changes_player_created
  ON iup_quarterly_plan_changes (player_id, created_at DESC);

CREATE OR REPLACE FUNCTION log_iup_quarterly_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_values jsonb;
  new_values jsonb;
  changed_values jsonb := '{}'::jsonb;
  field_name text;
BEGIN
  new_values := to_jsonb(NEW) - ARRAY['id', 'created_at', 'updated_at', 'updated_by'];

  IF TG_OP = 'INSERT' THEN
    changed_values := jsonb_build_object('created', new_values);
  ELSE
    old_values := to_jsonb(OLD) - ARRAY['id', 'created_at', 'updated_at', 'updated_by'];
    FOR field_name IN SELECT jsonb_object_keys(new_values) LOOP
      IF old_values -> field_name IS DISTINCT FROM new_values -> field_name THEN
        changed_values := changed_values || jsonb_build_object(
          field_name,
          jsonb_build_object('from', old_values -> field_name, 'to', new_values -> field_name)
        );
      END IF;
    END LOOP;
  END IF;

  IF changed_values <> '{}'::jsonb THEN
    INSERT INTO iup_quarterly_plan_changes (plan_id, goal_id, player_id, team_id, actor, changes)
    VALUES (NEW.id, NEW.goal_id, NEW.player_id, NEW.team_id, NEW.updated_by, changed_values);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_iup_quarterly_plan_change_trigger ON iup_quarterly_plans;
CREATE TRIGGER log_iup_quarterly_plan_change_trigger
  AFTER INSERT OR UPDATE ON iup_quarterly_plans
  FOR EACH ROW EXECUTE FUNCTION log_iup_quarterly_plan_change();
