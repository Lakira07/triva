import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Coach chat is not configured.' }, 500);
  }

  let payload: {
    action?: 'players' | 'messages' | 'send';
    teamId?: string;
    trainerCode?: string;
    playerId?: string;
    body?: string;
  };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const teamId = payload.teamId?.trim();
  const trainerCode = payload.trainerCode?.trim().toUpperCase();
  if (!teamId || !trainerCode) return jsonResponse({ error: 'Team and trainer code are required.' }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: team, error: teamError } = await adminClient
    .from('teams')
    .select('id, code_expires_at')
    .eq('id', teamId)
    .eq('trainer_code', trainerCode)
    .maybeSingle();
  if (teamError) return jsonResponse({ error: 'Could not verify the trainer code.' }, 500);
  if (!team) return jsonResponse({ error: 'Invalid trainer code. Sign in again with your team code.' }, 401);
  if (team.code_expires_at && new Date(team.code_expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: 'The trainer code has expired. Ask the admin for a new code.' }, 401);
  }

  if (payload.action === 'players') {
    const { data, error } = await adminClient
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .order('name', { ascending: true });
    if (error) return jsonResponse({ error: 'Could not load team players.' }, 500);
    return jsonResponse({ players: data ?? [] });
  }

  const playerId = payload.playerId?.trim();
  if (!playerId) return jsonResponse({ error: 'Choose a player first.' }, 400);

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id')
    .eq('id', playerId)
    .eq('team_id', teamId)
    .maybeSingle();
  if (playerError) return jsonResponse({ error: 'Could not verify the player.' }, 500);
  if (!player) return jsonResponse({ error: 'That player does not belong to this team.' }, 404);

  if (payload.action === 'messages') {
    const { data, error } = await adminClient
      .from('coach_player_messages')
      .select('id, sender_role, body, created_at')
      .eq('team_id', teamId)
      .eq('player_id', playerId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) return jsonResponse({ error: 'Could not load this conversation.' }, 500);
    return jsonResponse({ messages: data ?? [] });
  }

  if (payload.action === 'send') {
    const body = payload.body?.trim();
    if (!body || body.length > 1000) {
      return jsonResponse({ error: 'Messages must contain 1 to 1000 characters.' }, 400);
    }
    const { data, error } = await adminClient
      .from('coach_player_messages')
      .insert({ team_id: teamId, player_id: playerId, sender_role: 'coach', body })
      .select('id, sender_role, body, created_at')
      .single();
    if (error) return jsonResponse({ error: 'Could not send this message.' }, 500);
    return jsonResponse({ message: data });
  }

  return jsonResponse({ error: 'Unknown chat action.' }, 400);
});