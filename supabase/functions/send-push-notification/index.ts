import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanError, processDueQueues, response } from '../_shared/push.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TITLE_TYPES: Record<string, string> = {
  'Nytt privat meddelande': 'chat_message',
  'Ny välmåenderapport': 'wellbeing_submitted',
  'Ny enkätsvar': 'survey_submitted',
  'Kommande träning': 'training_upcoming',
  'Träningen behöver rapporteras': 'training_missing',
};
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function validRelativeUrl(value: unknown): value is string {
  if (value == null) return true;
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return false;
  try {
    return new URL(value, 'https://triva.invalid').origin === 'https://triva.invalid';
  } catch {
    return false;
  }
}

function sanitizeBody(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceRoleKey || !anonKey) return response({ error: 'Push sending is not configured.' }, 500);

  let input: { title?: unknown; body?: unknown; url?: unknown; recipient_user_ids?: unknown };
  try {
    input = await request.json();
  } catch {
    return response({ error: 'Request body must be valid JSON.' }, 400);
  }
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const rawBody = typeof input.body === 'string' ? input.body.trim() : '';
  const urlPath = input.url == null ? '/' : input.url;
  const recipientIds = Array.isArray(input.recipient_user_ids) ? [...new Set(input.recipient_user_ids)] : [];
  if (!title || title.length > 120) return response({ error: 'Title must contain 1 to 120 characters.' }, 400);
  if (!rawBody || rawBody.length > 300) return response({ error: 'Body must contain 1 to 300 characters.' }, 400);
  if (!validRelativeUrl(urlPath)) return response({ error: 'URL must be a same-origin relative path.' }, 400);
  if (!recipientIds.length || recipientIds.length > 500 || recipientIds.some((id) => typeof id !== 'string' || !UUID_RE.test(id))) {
    return response({ error: 'Provide 1 to 500 valid recipient UUIDs.' }, 400);
  }

  const authorization = request.headers.get('Authorization') ?? '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response({ error: 'Authentication required.' }, 401);
  const isServiceRole = token === serviceRoleKey;
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let senderUserId: string | null = null;
  let isAdmin = false;
  let ownedTeamId: string | null = null;

  if (!isServiceRole) {
    const userClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return response({ error: 'Valid user session required.' }, 401);
    senderUserId = user.id;

    const { data: profile, error: profileError } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (profileError) return response({ error: 'Could not verify caller role.' }, 500);
    isAdmin = profile?.is_admin === true;
    const { data: team, error: teamError } = await admin.from('teams').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (teamError) return response({ error: 'Could not verify team ownership.' }, 500);
    ownedTeamId = team?.id ?? null;
    if (!isAdmin && !ownedTeamId) return response({ error: 'Only admins and team coaches can send push notifications.' }, 403);
  }

  let body = rawBody;
  if (!isAdmin && !isServiceRole) {
    if (!TITLE_TYPES[title]) return response({ error: 'This notification title is not allowed for coach-triggered sends.' }, 403);
    body = sanitizeBody(rawBody);
    if (!body || body.length > 300) return response({ error: 'Message body is empty after safety filtering.' }, 400);

    const { data: recentNotifications, error: recentError } = await admin
      .from('notifications')
      .select('recipient_user_id')
      .eq('team_id', ownedTeamId)
      .eq('title', title)
      .eq('notification_type', TITLE_TYPES[title])
      .in('recipient_user_id', recipientIds)
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if (recentError) return response({ error: 'Could not verify a matching recent in-app notification.' }, 500);
    const allowedRecipients = new Set((recentNotifications ?? []).map((row: { recipient_user_id: string }) => row.recipient_user_id));
    if (recipientIds.some((id) => !allowedRecipients.has(id))) {
      return response({ error: 'Each recipient must have the matching in-app notification from the last 10 minutes.' }, 403);
    }
  }

  const queueRows = recipientIds.map((recipientId) => ({
    recipient_user_id: recipientId,
    team_id: ownedTeamId,
    title,
    body,
    url: urlPath as string,
    origin: isServiceRole ? 'system' : 'app',
    idempotency_key: `direct-push:${crypto.randomUUID()}:${recipientId}`,
  }));
  const { data: queued, error: queueError } = await admin.from('push_queue').insert(queueRows).select('id');
  if (queueError) {
    console.error('[push] queue insert failed', queueError);
    return response({ error: 'Could not enqueue notifications; no push was attempted.' }, 500);
  }

  try {
    const results = await processDueQueues(admin, Math.min(100, queued?.length || 1));
    const { error: auditError } = await admin.from('push_audit_log').insert({
      sender_user_id: senderUserId,
      action: isServiceRole ? 'system_send' : 'user_send',
      recipient_count: recipientIds.length,
      devices_delivered: results.reduce((sum, item) => sum + item.devicesSent, 0),
      retries: results.reduce((sum, item) => sum + item.retries, 0),
      expired: results.reduce((sum, item) => sum + item.expired, 0),
      repaired: results.reduce((sum, item) => sum + item.repaired, 0),
      details: { queue_ids: (queued ?? []).map((row: { id: string }) => row.id) },
    });
    if (auditError) console.error('[push] audit insert failed', auditError);
    return response({ queued: queued?.length ?? 0, results });
  } catch (error) {
    const message = cleanError(error);
    console.error('[push] immediate delivery failed; queued rows remain retryable', message);
    return response({ error: message, queued: queued?.length ?? 0 }, 500);
  }
});