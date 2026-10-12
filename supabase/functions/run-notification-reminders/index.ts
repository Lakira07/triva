import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { response } from '../_shared/push.ts';

const TIME_ZONE = 'Europe/Stockholm';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PlayerRow {
  id: string;
  team_id: string;
  name: string;
}

interface SessionRow {
  id: string;
  team_id: string;
  title: string;
  scheduled_at: string;
  planned_duration_min: number;
}

interface LinkRow {
  player_id: string;
  user_id: string;
}

function zonedParts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, ...options })
    .formatToParts(date)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, part.value]));
}

function localDateKey(date: Date): string {
  const parts = zonedParts(date, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function localMinuteOfDay(date: Date): number {
  const parts = zonedParts(date, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function localMidnightUtc(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const targetLocal = Date.UTC(year, month - 1, day);
  let guess = targetLocal;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]));
    const representedLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const adjustment = targetLocal - representedLocal;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(guess);
}

async function getAllRows(admin: any, table: string, select: string): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from(table).select(select).range(offset, offset + 999);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function enqueue(admin: any, input: {
  userId: string;
  teamId: string;
  type: string;
  title: string;
  message: string;
  url: string;
  targetId: string | null;
  key: string;
}) {
  const { data, error } = await admin.rpc('enqueue_user_notification', {
    p_recipient_user_id: input.userId,
    p_team_id: input.teamId,
    p_notification_type: input.type,
    p_title: input.title,
    p_message: input.message,
    p_target_url: input.url,
    p_target_id: input.targetId,
    p_idempotency_key: input.key,
    p_origin: 'system',
  });
  if (error) throw new Error(`Could not enqueue ${input.type}: ${error.message}`);
  return Boolean(data);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return response({ error: 'Notification reminders are not configured.' }, 500);
  if (request.headers.get('Authorization') !== `Bearer ${serviceRoleKey}`) {
    return response({ error: 'Service role authorization required.' }, 401);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const startedAt = new Date().toISOString();
  try {
    const now = new Date();
    const dateKey = localDateKey(now);
    const dayStart = localMidnightUtc(dateKey).toISOString();
    const counts = { wellbeing: 0, upcomingTraining: 0, missingTraining: 0 };
    const [players, links] = await Promise.all([
      getAllRows(admin, 'players', 'id, team_id, name'),
      getAllRows(admin, 'player_auth_links', 'player_id, user_id'),
    ]);
    const playerById = new Map((players as PlayerRow[]).map((player) => [player.id, player]));
    const usersByPlayer = new Map<string, string[]>();
    for (const link of links as LinkRow[]) {
      usersByPlayer.set(link.player_id, [...(usersByPlayer.get(link.player_id) ?? []), link.user_id]);
    }

    if (localMinuteOfDay(now) >= 8 * 60) {
      const entries = await admin.from('wellbeing_entries').select('player_id').gte('created_at', dayStart);
      if (entries.error) throw new Error(`Could not read today's wellbeing entries: ${entries.error.message}`);
      const submitted = new Set((entries.data ?? []).map((entry: { player_id: string }) => entry.player_id));
      for (const [playerId, userIds] of usersByPlayer) {
        const player = playerById.get(playerId);
        if (!player?.team_id || submitted.has(playerId)) continue;
        for (const userId of userIds) {
          const inserted = await enqueue(admin, {
            userId, teamId: player.team_id, type: 'wellbeing_daily',
            title: 'Dags för välmåendecheck',
            message: 'Fyll i dagens välmåenderapport när du har möjlighet.',
            url: '/#/player', targetId: null,
            key: `reminder:wellbeing:${dateKey}:${userId}`,
          });
          if (inserted) counts.wellbeing += 1;
        }
      }
    }

    const recentSessionStart = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const futureSessionEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { data: rootSessions, error: sessionsError } = await admin
      .from('training_sessions')
      .select('id, team_id, title, scheduled_at, planned_duration_min')
      .is('parent_session_id', null)
      .gte('scheduled_at', recentSessionStart)
      .lte('scheduled_at', futureSessionEnd);
    if (sessionsError) throw new Error(`Could not load upcoming/recent sessions: ${sessionsError.message}`);
    const dueUpcoming = rootSessions.filter((session) => {
      const start = new Date(session.scheduled_at).getTime();
      const threshold = start - 24 * 60 * 60 * 1000;
      return threshold <= now.getTime() && start > now.getTime();
    });
    const dueMissing = rootSessions.filter((session) => {
      const end = new Date(session.scheduled_at).getTime() + session.planned_duration_min * 60_000;
      return end + 2 * 60 * 60 * 1000 <= now.getTime()
        && end + 2 * 60 * 60 * 1000 > now.getTime() - 7 * 24 * 60 * 60 * 1000;
    });
    const candidateSessions = [...new Map([...dueUpcoming, ...dueMissing].map((session) => [session.id, session])).values()];
    const sessionIds = candidateSessions.map((session) => session.id);
    const [assignmentsResult, completionsResult] = sessionIds.length ? await Promise.all([
      admin.from('training_assignments').select('session_id, player_id, is_all_team').in('session_id', sessionIds),
      admin.from('training_completions').select('session_id, player_id').in('session_id', sessionIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (assignmentsResult.error || completionsResult.error) {
      throw new Error(`Could not load training reminders: ${assignmentsResult.error?.message ?? completionsResult.error?.message}`);
    }
    const assignments = assignmentsResult.data ?? [];
    const completed = new Set((completionsResult.data ?? []).map((completion: { session_id: string; player_id: string }) => `${completion.session_id}:${completion.player_id}`));

    for (const session of dueUpcoming) {
      const sessionAssignments = assignments.filter((assignment: { session_id: string }) => assignment.session_id === session.id);
      const playerIds = sessionAssignments.some((assignment: { is_all_team: boolean }) => assignment.is_all_team)
        ? (players as PlayerRow[]).filter((player) => player.team_id === session.team_id).map((player) => player.id)
        : sessionAssignments.map((assignment: { player_id: string | null }) => assignment.player_id).filter(Boolean);
      for (const playerId of playerIds as string[]) {
        const player = playerById.get(playerId);
        for (const userId of usersByPlayer.get(playerId) ?? []) {
          const inserted = await enqueue(admin, {
            userId, teamId: session.team_id, type: 'training_upcoming',
            title: 'Kommande träning',
            message: 'Du har ett tilldelat träningspass inom 24 timmar.',
            url: '/#/player', targetId: session.id,
            key: `reminder:training-upcoming:${session.id}:${userId}`,
          });
          if (inserted) counts.upcomingTraining += 1;
        }
      }
    }

    for (const session of dueMissing) {
      const sessionAssignments = assignments.filter((assignment: { session_id: string }) => assignment.session_id === session.id);
      const playerIds = sessionAssignments.some((assignment: { is_all_team: boolean }) => assignment.is_all_team)
        ? (players as PlayerRow[]).filter((player) => player.team_id === session.team_id).map((player) => player.id)
        : sessionAssignments.map((assignment: { player_id: string | null }) => assignment.player_id).filter(Boolean);
      for (const playerId of playerIds as string[]) {
        if (completed.has(`${session.id}:${playerId}`)) continue;
        for (const userId of usersByPlayer.get(playerId) ?? []) {
          const inserted = await enqueue(admin, {
            userId, teamId: session.team_id, type: 'training_missing',
            title: 'Träningen behöver rapporteras',
            message: 'Du har ett träningspass utan registrerat genomförande.',
            url: '/#/player', targetId: session.id,
            key: `reminder:training-missing:${session.id}:${userId}`,
          });
          if (inserted) counts.missingTraining += 1;
        }
      }
    }

    console.info('[reminders] run complete', JSON.stringify({ time_zone: TIME_ZONE, date: dateKey, ...counts }));
    const { error: runLogError } = await admin.from('notification_job_runs').insert({
      job_name: 'run-notification-reminders', status: 'succeeded',
      processed_count: counts.wellbeing + counts.upcomingTraining + counts.missingTraining,
      started_at: startedAt, finished_at: new Date().toISOString(),
    });
    if (runLogError) console.error('[reminders] could not persist job run', runLogError);
    return response({ ok: true, time_zone: TIME_ZONE, local_date: dateKey, ...counts });
  } catch (error) {
    console.error('[reminders] run failed', error);
    await admin.from('notification_job_runs').insert({
      job_name: 'run-notification-reminders', status: 'failed',
      error: error instanceof Error ? error.message : 'Could not run notification reminders.',
      started_at: startedAt, finished_at: new Date().toISOString(),
    });
    return response({ error: error instanceof Error ? error.message : 'Could not run notification reminders.' }, 500);
  }
});