REVOKE SELECT ON TABLE public.teams FROM anon, PUBLIC;
GRANT SELECT (id, name, join_code, owner_id, created_at, code_expires_at)
  ON TABLE public.teams TO anon;