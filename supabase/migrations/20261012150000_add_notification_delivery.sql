CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  message text NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 300),
  is_read boolean NOT NULL DEFAULT false,
  target_url text,
  target_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC);
CREATE INDEX notifications_unread_idx
  ON public.notifications (recipient_user_id, created_at DESC)
  WHERE is_read = false;

CREATE TABLE public.push_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  vapid_public_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired'))
);

CREATE INDEX push_subscriptions_user_active_idx
  ON public.push_subscriptions (user_id)
  WHERE status = 'active';

CREATE TABLE public.push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 300),
  url text NOT NULL DEFAULT '/',
  origin text NOT NULL CHECK (origin IN ('app', 'system')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  devices_sent integer NOT NULL DEFAULT 0 CHECK (devices_sent >= 0),
  sent_at timestamptz,
  locked_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_queue_due_idx
  ON public.push_queue (next_attempt_at, created_at)
  WHERE status = 'pending';
CREATE INDEX push_queue_recipient_created_idx
  ON public.push_queue (recipient_user_id, created_at DESC);

CREATE TABLE public.push_queue_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.push_queue(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'expired')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (queue_id, subscription_id)
);

CREATE INDEX push_queue_deliveries_due_idx
  ON public.push_queue_deliveries (next_attempt_at, created_at)
  WHERE status = 'pending';

CREATE TABLE public.push_public_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  vapid_public_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.push_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  devices_delivered integer NOT NULL DEFAULT 0,
  retries integer NOT NULL DEFAULT 0,
  expired integer NOT NULL DEFAULT 0,
  repaired integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  processed_count integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX notification_job_runs_recent_idx ON public.notification_job_runs (started_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_queue_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_public_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_job_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.notifications, public.push_queue, public.push_queue_deliveries, public.push_audit_log FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (is_read) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications, public.push_preferences, public.push_subscriptions,
  public.push_queue, public.push_queue_deliveries, public.push_audit_log TO service_role;
GRANT ALL ON public.notification_job_runs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_preferences, public.push_subscriptions TO authenticated;
GRANT SELECT ON public.push_public_config TO anon, authenticated;

CREATE POLICY notifications_read_own ON public.notifications
  FOR SELECT TO authenticated USING (recipient_user_id = (SELECT auth.uid()));
CREATE POLICY notifications_mark_own_read ON public.notifications
  FOR UPDATE TO authenticated USING (recipient_user_id = (SELECT auth.uid()))
  WITH CHECK (recipient_user_id = (SELECT auth.uid()));

CREATE POLICY push_preferences_manage_own ON public.push_preferences
  FOR ALL TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY push_subscriptions_manage_own ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY push_public_config_read ON public.push_public_config
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.enqueue_user_notification(
  p_recipient_user_id uuid,
  p_team_id uuid,
  p_notification_type text,
  p_title text,
  p_message text,
  p_target_url text,
  p_target_id uuid,
  p_idempotency_key text,
  p_origin text DEFAULT 'app'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_notification_id uuid;
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    recipient_user_id, team_id, notification_type, title, message,
    target_url, target_id, idempotency_key
  ) VALUES (
    p_recipient_user_id, p_team_id, p_notification_type, p_title, p_message,
    p_target_url, p_target_id, p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO new_notification_id;

  IF new_notification_id IS NOT NULL THEN
    INSERT INTO public.push_queue (
      recipient_user_id, team_id, notification_id, title, body, url, origin, idempotency_key
    ) VALUES (
      p_recipient_user_id, p_team_id, new_notification_id, p_title, p_message,
      COALESCE(p_target_url, '/'), p_origin, p_idempotency_key
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO public.push_audit_log (sender_user_id, action, recipient_count, details)
    VALUES (
      auth.uid(), 'notification_enqueued', 1,
      jsonb_build_object('notification_id', new_notification_id, 'type', p_notification_type, 'origin', p_origin)
    );
  END IF;

  RETURN new_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_user_notification(uuid, uuid, text, text, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_user_notification(uuid, uuid, text, text, text, text, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_push_queue(p_limit integer DEFAULT 50)
RETURNS SETOF public.push_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH due AS (
    SELECT queue.id
    FROM public.push_queue AS queue
    WHERE queue.status = 'pending'
      AND queue.next_attempt_at <= now()
      AND (queue.locked_at IS NULL OR queue.locked_at < now() - interval '10 minutes')
    ORDER BY queue.next_attempt_at, queue.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  UPDATE public.push_queue AS queue
  SET locked_at = now()
  FROM due
  WHERE queue.id = due.id
  RETURNING queue.*
$$;

REVOKE ALL ON FUNCTION public.claim_due_push_queue(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_push_queue(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_private_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recipient_user_id uuid;
  recipient_team_id uuid;
  recipient_url text;
BEGIN
  SELECT player.team_id INTO recipient_team_id
  FROM public.players AS player WHERE player.id = NEW.player_id;

  IF NEW.sender_role = 'coach' THEN
    SELECT link.user_id INTO recipient_user_id
    FROM public.player_auth_links AS link WHERE link.player_id = NEW.player_id;
    recipient_url := '/#/player';
  ELSE
    SELECT team.owner_id INTO recipient_user_id
    FROM public.teams AS team WHERE team.id = NEW.team_id;
    recipient_url := '/#/dashboard';
  END IF;

  IF recipient_user_id IS NOT NULL THEN
    PERFORM public.enqueue_user_notification(
      recipient_user_id, recipient_team_id, 'chat_message', 'Nytt privat meddelande',
      'Du har fått ett nytt privat meddelande.', recipient_url, NEW.id,
      'chat:' || NEW.id::text || ':' || recipient_user_id::text, 'app'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_after_private_chat_message
  AFTER INSERT ON public.coach_player_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_private_chat_message();

CREATE OR REPLACE FUNCTION public.notify_wellbeing_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  resolved_team_id uuid;
  coach_user_id uuid;
BEGIN
  SELECT COALESCE(NEW.team_id, player.team_id), team.owner_id
  INTO resolved_team_id, coach_user_id
  FROM public.players AS player
  LEFT JOIN public.teams AS team ON team.id = COALESCE(NEW.team_id, player.team_id)
  WHERE player.id = NEW.player_id;

  IF coach_user_id IS NOT NULL THEN
    PERFORM public.enqueue_user_notification(
      coach_user_id, resolved_team_id, 'wellbeing_submitted', 'Ny välmåenderapport',
      'En spelare har skickat in sin välmåenderapport.', '/#/dashboard', NEW.id,
      'wellbeing:' || NEW.id::text || ':' || coach_user_id::text, 'app'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_after_wellbeing_submission
  AFTER INSERT ON public.wellbeing_entries
  FOR EACH ROW EXECUTE FUNCTION public.notify_wellbeing_submission();

CREATE OR REPLACE FUNCTION public.notify_survey_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  response_team_id uuid;
  response_id uuid;
  answer_count integer;
  question_count integer;
  coach_user_id uuid;
BEGIN
  response_id := NEW.response_id;
  SELECT response.team_id INTO response_team_id
  FROM public.responses AS response WHERE response.id = response_id;
  IF response_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO answer_count
  FROM public.answers AS answer WHERE answer.response_id = response_id;
  SELECT count(*) INTO question_count
  FROM public.questions AS question WHERE question.team_id = response_team_id;
  IF question_count = 0 OR answer_count < question_count THEN
    RETURN NEW;
  END IF;

  SELECT team.owner_id INTO coach_user_id
  FROM public.teams AS team WHERE team.id = response_team_id;
  IF coach_user_id IS NOT NULL THEN
    PERFORM public.enqueue_user_notification(
      coach_user_id, response_team_id, 'survey_submitted', 'Ny enkätsvar',
      'En spelare har skickat in en enkät.', '/#/dashboard', response_id,
      'survey:' || response_id::text || ':' || coach_user_id::text, 'app'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_after_survey_submission ON public.responses;
CREATE TRIGGER notify_after_survey_completion
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION public.notify_survey_submission();

CREATE OR REPLACE FUNCTION public.store_push_vapid_secrets(p_public_key text, p_private_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  existing_public text;
  existing_private text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('triva-push-vapid'));
  SELECT decrypted_secret INTO existing_public
  FROM vault.decrypted_secrets WHERE name = 'triva_vapid_public_key';
  SELECT decrypted_secret INTO existing_private
  FROM vault.decrypted_secrets WHERE name = 'triva_vapid_private_key';

  IF existing_public IS NULL OR existing_private IS NULL THEN
    DELETE FROM vault.secrets WHERE name IN ('triva_vapid_public_key', 'triva_vapid_private_key');
    PERFORM vault.create_secret(p_public_key, 'triva_vapid_public_key', 'Triva Web Push VAPID public key');
    PERFORM vault.create_secret(p_private_key, 'triva_vapid_private_key', 'Triva Web Push VAPID private key');
    existing_public := p_public_key;
  END IF;
  RETURN existing_public;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_push_vapid_secrets()
RETURNS TABLE (public_key text, private_key text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'triva_vapid_public_key'),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'triva_vapid_private_key')
$$;

CREATE OR REPLACE FUNCTION public.configure_notification_cron(p_project_url text, p_service_role_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, cron, pg_temp
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name IN ('triva_supabase_url', 'triva_service_role_key');
  PERFORM vault.create_secret(p_project_url, 'triva_supabase_url', 'Supabase project URL for notification cron');
  PERFORM vault.create_secret(p_service_role_key, 'triva_service_role_key', 'Service role token for notification cron');

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'triva-process-push-queue') THEN
    PERFORM cron.schedule('triva-process-push-queue', '*/2 * * * *', $job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'triva_supabase_url') || '/functions/v1/process-push-queue',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'triva_service_role_key')),
        body := '{}'::jsonb
      );
    $job$);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'triva-notification-reminders') THEN
    PERFORM cron.schedule('triva-notification-reminders', '* * * * *', $job$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'triva_supabase_url') || '/functions/v1/run-notification-reminders',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'triva_service_role_key')),
        body := '{}'::jsonb
      );
    $job$);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_notification_cron_runs(p_limit integer DEFAULT 20)
RETURNS TABLE (job_name text, status text, return_message text, started_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $$
  SELECT job.jobname, run.status, run.return_message, run.start_time
  FROM cron.job_run_details AS run
  JOIN cron.job AS job ON job.jobid = run.jobid
  WHERE job.jobname IN ('triva-process-push-queue', 'triva-notification-reminders')
  ORDER BY run.start_time DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
$$;

REVOKE ALL ON FUNCTION public.store_push_vapid_secrets(text, text), public.get_push_vapid_secrets(), public.configure_notification_cron(text, text), public.get_notification_cron_runs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_push_vapid_secrets(text, text), public.get_push_vapid_secrets(), public.configure_notification_cron(text, text), public.get_notification_cron_runs(integer) TO service_role;