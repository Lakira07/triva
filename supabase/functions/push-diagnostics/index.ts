import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processDueQueues, response } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceRoleKey || !anonKey) return response({ error: 'Push diagnostics are not configured.' }, 500);
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === serviceRoleKey) return response({ error: 'A signed-in admin or coach account is required.' }, 401);

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) return response({ error: 'Valid user session required.' }, 401);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: profile, error: profileError }, { data: team, error: teamError }] = await Promise.all([
    admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
    admin.from('teams').select('id').eq('owner_id', user.id).limit(1).maybeSingle(),
  ]);
  if (profileError || teamError) return response({ error: 'Could not verify caller role.' }, 500);
  const isAdmin = profile?.is_admin === true;
  if (!isAdmin && !team?.id) return response({ error: 'Only admins and team coaches can view push diagnostics.' }, 403);

  let input: { action?: string; endpoint?: string };
  try {
    input = await request.json();
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400);
  }

  if (input.action === 'test') {
    const key = `push-test:${user.id}:${crypto.randomUUID()}`;
    const { data: notificationId, error: enqueueError } = await admin.rpc('enqueue_user_notification', {
      p_recipient_user_id: user.id,
      p_team_id: team?.id ?? null,
      p_notification_type: 'push_test',
      p_title: 'Testnotis',
      p_message: 'Det här är ett test av pushnotiser.',
      p_target_url: '/',
      p_target_id: null,
      p_idempotency_key: key,
      p_origin: 'app',
    });
    if (enqueueError || !notificationId) {
      console.error('[push] test enqueue failed', enqueueError);
      return response({ error: enqueueError?.message ?? 'Could not enqueue test notification.' }, 500);
    }

    try {
      const results = await processDueQueues(admin, 50);
      const { data: queueRow, error: queueError } = await admin
        .from('push_queue')
        .select('id, status, attempts, last_error, devices_sent, created_at')
        .eq('notification_id', notificationId)
        .maybeSingle();
      if (queueError) throw new Error(queueError.message);
      await admin.from('push_audit_log').insert({
        sender_user_id: user.id,
        action: 'test_push',
        recipient_count: 1,
        devices_delivered: queueRow?.devices_sent ?? 0,
        details: { queue_id: queueRow?.id, status: queueRow?.status },
      });
      console.info('[push] self-test complete', JSON.stringify({ user_id: user.id, queue_status: queueRow?.status }));
      return response({ ok: true, queue: queueRow, processed: results.length });
    } catch (error) {
      console.error('[push] self-test delivery failed', error);
      return response({ error: error instanceof Error ? error.message : 'Test push delivery failed.' }, 500);
    }
  }

  if (input.action !== 'inspect') return response({ error: 'Unknown diagnostics action.' }, 400);
  if (input.endpoint != null && (typeof input.endpoint !== 'string' || input.endpoint.length > 4096 || !input.endpoint.startsWith('https://'))) {
    return response({ error: 'Invalid push endpoint.' }, 400);
  }

  const [{ data: config, error: configError }, { data: preference }, subscriptionResult, { data: jobRuns, error: jobRunsError }, { data: cronRuns, error: cronRunsError }] = await Promise.all([
    admin.from('push_public_config').select('vapid_public_key, updated_at').eq('id', true).maybeSingle(),
    admin.from('push_preferences').select('push_enabled').eq('user_id', user.id).maybeSingle(),
    input.endpoint
      ? admin.from('push_subscriptions').select('id, status, vapid_public_key, last_seen_at').eq('user_id', user.id).eq('endpoint', input.endpoint).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from('notification_job_runs').select('id, job_name, status, processed_count, error, started_at, finished_at').order('started_at', { ascending: false }).limit(10),
    admin.rpc('get_notification_cron_runs', { p_limit: 10 }),
  ]);
  if (configError || subscriptionResult.error || jobRunsError || cronRunsError) return response({ error: 'Could not inspect push configuration or job history.' }, 500);

  let queueQuery = admin.from('push_queue')
    .select('id, recipient_user_id, title, status, attempts, last_error, devices_sent, created_at')
    .order('created_at', { ascending: false })
    .limit(25);
  if (!isAdmin && team?.id) queueQuery = queueQuery.eq('team_id', team.id);
  const { data: recentQueue, error: queueError } = await queueQuery;
  if (queueError) return response({ error: 'Could not load recent queue diagnostics.' }, 500);

  const subscription = subscriptionResult.data;
  return response({
    push_enabled: preference?.push_enabled ?? false,
    vapid_public_key: config?.vapid_public_key ?? null,
    subscription_exists: Boolean(subscription),
    subscription_status: subscription?.status ?? null,
    key_matches: Boolean(subscription && config?.vapid_public_key && subscription.vapid_public_key === config.vapid_public_key),
    subscription_last_seen_at: subscription?.last_seen_at ?? null,
    recent_queue: recentQueue ?? [],
    recent_jobs: jobRuns ?? [],
    recent_cron_runs: cronRuns ?? [],
  });
});