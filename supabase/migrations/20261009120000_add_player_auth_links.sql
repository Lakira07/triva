CREATE TABLE IF NOT EXISTS public.player_auth_links (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.player_auth_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_auth_links FROM anon, public;
GRANT SELECT ON public.player_auth_links TO authenticated;
GRANT ALL ON public.player_auth_links TO service_role;

CREATE POLICY "player_or_team_owner_select_player_auth_link"
  ON public.player_auth_links FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.players AS player
      JOIN public.teams AS team ON team.id = player.team_id
      WHERE player.id = player_auth_links.player_id
        AND team.owner_id = (SELECT auth.uid())
    )
  );
