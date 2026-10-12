ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS parent_session_id uuid
  REFERENCES public.training_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_training_sessions_parent_session_id
  ON public.training_sessions(parent_session_id);