CREATE TABLE public.coach_player_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('coach', 'player')),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coach_player_messages_conversation_idx
  ON public.coach_player_messages (team_id, player_id, created_at);

ALTER TABLE public.coach_player_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_player_messages FROM anon, PUBLIC;
GRANT SELECT, INSERT ON public.coach_player_messages TO authenticated;
GRANT ALL ON public.coach_player_messages TO service_role;

CREATE POLICY "players_and_coaches_read_own_conversations"
  ON public.coach_player_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.player_auth_links AS link
      WHERE link.player_id = coach_player_messages.player_id
        AND link.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.teams AS team
      WHERE team.id = coach_player_messages.team_id
        AND team.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "invited_players_send_as_themselves"
  ON public.coach_player_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_role = 'player'
    AND sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.player_auth_links AS link
      JOIN public.players AS player ON player.id = link.player_id
      WHERE link.player_id = coach_player_messages.player_id
        AND link.user_id = (SELECT auth.uid())
        AND player.team_id = coach_player_messages.team_id
    )
  );