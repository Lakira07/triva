import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const siteUrl = Deno.env.get('SITE_URL');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !siteUrl) {
    return jsonResponse({ error: 'Player invitations are not configured.' }, 500);
  }
  if (!authorization) return jsonResponse({ error: 'Sign in as the team coach first.' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: coach }, error: authError } = await userClient.auth.getUser();
  if (authError || !coach) return jsonResponse({ error: 'Your session has expired. Sign in again.' }, 401);

  let payload: {
    teamId?: string;
    playerId?: string;
    name?: string;
    email?: string;
    position?: string | null;
    jerseyNumber?: number | null;
  };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const teamId = payload.teamId?.trim();
  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();
  if (!teamId || !name || name.length > 100 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Enter a valid player name and email address.' }, 400);
  }
  if (payload.jerseyNumber != null && (!Number.isInteger(payload.jerseyNumber) || payload.jerseyNumber < 0 || payload.jerseyNumber > 999)) {
    return jsonResponse({ error: 'Invalid jersey number.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const inviteRedirectUrl = `${siteUrl.replace(/\/+$/, '')}/?invite=1`;

  const { data: team } = await adminClient
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('owner_id', coach.id)
    .maybeSingle();
  if (!team) return jsonResponse({ error: 'Your account is not assigned as this team’s coach.' }, 403);

  let playerId = payload.playerId?.trim();
  let createdPlayer = false;
  if (playerId) {
    const { data: player } = await adminClient
      .from('players')
      .select('id')
      .eq('id', playerId)
      .eq('team_id', teamId)
      .maybeSingle();
    if (!player) return jsonResponse({ error: 'Player not found in this team.' }, 404);

    const { data: existingLink } = await adminClient
      .from('player_auth_links')
      .select('player_id')
      .eq('player_id', playerId)
      .maybeSingle();
    if (existingLink) return jsonResponse({ error: 'This player already has a linked account.' }, 409);
  }

  const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirectUrl,
  });
  if (inviteError || !invitation.user) {
    return jsonResponse({
      error: inviteError?.message.includes('already')
        ? 'This email already has an account. Ask the athlete to sign in before linking it.'
        : inviteError?.message ?? 'Could not send the invitation.',
    }, 400);
  }

  if (!playerId) {
    const { data: player, error: playerError } = await adminClient
      .from('players')
      .insert({
        name,
        position: payload.position?.trim() || null,
        jersey_number: payload.jerseyNumber ?? null,
        team_id: teamId,
      })
      .select('id')
      .single();
    if (playerError || !player) {
      await adminClient.auth.admin.deleteUser(invitation.user.id);
      return jsonResponse({ error: 'Invitation created, but the player profile could not be saved.' }, 500);
    }
    playerId = player.id;
    createdPlayer = true;
  }

  const { error: linkError } = await adminClient
    .from('player_auth_links')
    .insert({ player_id: playerId, user_id: invitation.user.id });
  if (linkError) {
    if (createdPlayer) await adminClient.from('players').delete().eq('id', playerId);
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return jsonResponse({ error: 'The account could not be linked to the player profile.' }, 500);
  }

  return jsonResponse({ playerId, invitationSent: true });
});