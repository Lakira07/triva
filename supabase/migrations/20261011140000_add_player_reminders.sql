CREATE TABLE public.player_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('wellbeing', 'training_load')),
  training_session_id uuid REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  completed_at timestamptz,
  CHECK (
    (reminder_type = 'wellbeing' AND training_session_id IS NULL)
    OR (reminder_type = 'training_load' AND training_session_id IS NOT NULL)
  )
);

CREATE INDEX player_reminders_player_pending_idx
  ON public.player_reminders (player_id, created_at DESC)
  WHERE completed_at IS NULL;

ALTER TABLE public.player_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_reminders FROM anon, PUBLIC;
GRANT SELECT ON public.player_reminders TO authenticated;
GRANT UPDATE (read_at, completed_at) ON public.player_reminders TO authenticated;
GRANT ALL ON public.player_reminders TO service_role;

CREATE POLICY "invited_players_read_own_reminders"
  ON public.player_reminders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_auth_links AS link
      WHERE link.player_id = player_reminders.player_id
        AND link.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "invited_players_update_own_reminders"
  ON public.player_reminders FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_auth_links AS link
      WHERE link.player_id = player_reminders.player_id
        AND link.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.player_auth_links AS link
      WHERE link.player_id = player_reminders.player_id
        AND link.user_id = (SELECT auth.uid())
    )
  );