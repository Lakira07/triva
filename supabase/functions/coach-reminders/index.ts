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
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Reminders are not configured.' }, 500);

  let payload: {
    action?: 'options' | 'send';
    teamId?: string;
    trainerCode?: string;
    reminderType?: 'wellbeing' | 'training_load';
    trainingSessionId?: string;
    playerIds?: string[];
    allPlayers?: boolean;
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

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: team, error: teamError } = await admin
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

  const [{ data: allPlayers, error: playersError }, { data: links, error: linksError }, { data: sessions, error: sessionsError }] = await Promise.all([
    admin.from('players').select('id, name').eq('team_id', teamId).order('name', { ascending: true }),
    admin.from('player_auth_links').select('player_id'),
    admin.from('training_sessions').select('id, title, scheduled_at').eq('team_id', teamId).order('scheduled_at', { ascending: false }).limit(100),
  ]);
  if (playersError || linksError || sessionsError) return jsonResponse({ error: 'Could not load reminder options.' }, 500);

  const linkedPlayerIds = new Set((links ?? []).map((link) => link.player_id));
  const eligiblePlayers = (allPlayers ?? []).filter((player) => linkedPlayerIds.has(player.id));
  if (payload.action === 'options') {
    return jsonResponse({ players: eligiblePlayers, sessions: sessions ?? [] });
  }
  if (payload.action !== 'send') return jsonResponse({ error: 'Unknown reminder action.' }, 400);

  const reminderType = payload.reminderType;
  if (reminderType !== 'wellbeing' && reminderType !== 'training_load') {
    return jsonResponse({ error: 'Choose a valid reminder type.' }, 400);
  }
  const customBody = payload.body?.trim();
  if (customBody && customBody.length > 500) return jsonResponse({ error: 'Reminder text must be 500 characters or fewer.' }, 400);

  const sessionId = payload.trainingSessionId?.trim() || null;
  if (reminderType === 'training_load' && !sessionId) {
    return jsonResponse({ error: 'Choose the training session for the load form.' }, 400);
  }
  if (reminderType === 'wellbeing' && sessionId) {
    return jsonResponse({ error: 'Wellbeing reminders cannot be linked to a training session.' }, 400);
  }

  let eligibleIds = eligiblePlayers.map((player) => player.id);
  if (reminderType === 'training_load' && sessionId) {
    const session = (sessions ?? []).find((item) => item.id === sessionId);
    if (!session) return jsonResponse({ error: 'That training session does not belong to this team.' }, 404);
    const { data: assignments, error: assignmentError } = await admin
      .from('training_assignments')
      .select('player_id, is_all_team')
      .eq('session_id', sessionId);
    if (assignmentError) return jsonResponse({ error: 'Could not load session assignments.' }, 500);
    eligibleIds = assignments?.some((assignment) => assignment.is_all_team)
      ? eligibleIds
      : eligibleIds.filter((id) => assignments?.some((assignment) => assignment.player_id === id));
  }

  const requestedIds = payload.allPlayers
    ? eligibleIds
    : [...new Set(payload.playerIds ?? [])].filter((id) => eligibleIds.includes(id));
  if (!requestedIds.length) return jsonResponse({ error: 'Choose at least one invited player who is assigned to the session.' }, 400);

  const playersById = new Map(eligiblePlayers.map((player) => [player.id, player]));
  const session = sessionId ? (sessions ?? []).find((item) => item.id === sessionId) : null;
  const title = reminderType === 'wellbeing' ? 'Påminnelse: välmående' : `Påminnelse: ${session?.title ?? 'belastningsformulär'}`;
  const body = customBody || (reminderType === 'wellbeing'
    ? 'Kom ihåg att fylla i din välmåenderapport.'
    : 'Kom ihåg att rapportera faktisk tid och belastning efter träningspasset.');
  const { error: insertError } = await admin.from('player_reminders').insert(
    requestedIds.map((playerId) => ({
      team_id: teamId,
      player_id: playerId,
      reminder_type: reminderType,
      training_session_id: sessionId,
      title,
      body,
    })),
  );
  if (insertError) return jsonResponse({ error: 'Could not create the reminders.' }, 500);

  return jsonResponse({ sentCount: requestedIds.length, playerNames: requestedIds.map((id) => playersById.get(id)?.name).filter(Boolean) });
});