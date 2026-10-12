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

function generateCode(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomValues = new Uint32Array(6);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => characters[value % characters.length]).join('');
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
    return jsonResponse({ error: 'Team invitations are not configured.' }, 500);
  }
  if (!authorization) return jsonResponse({ error: 'Admin sign-in is required.' }, 401);

  let payload: { name?: string; email?: string };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();
  if (!name || name.length > 120 || !email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Ange ett giltigt lagnamn och en giltig tränar-e-post.' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return jsonResponse({ error: 'Adminsessionen har gått ut. Logga in igen.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!adminProfile?.is_admin) return jsonResponse({ error: 'Endast administratörer kan skapa lag.' }, 403);

  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle();
  let ownerId = existingProfile?.id ?? null;
  if (ownerId) {
    const { data: existingTeam } = await adminClient
      .from('teams')
      .select('id')
      .eq('owner_id', ownerId)
      .limit(1)
      .maybeSingle();
    if (existingTeam) return jsonResponse({ error: 'Tränarens konto är redan kopplat till ett lag.' }, 409);
  }

  let team: { id: string } | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const joinCode = generateCode();
    let trainerCode = generateCode();
    while (trainerCode === joinCode) trainerCode = generateCode();

    const { data, error } = await adminClient
      .from('teams')
      .insert({ name, join_code: joinCode, trainer_code: trainerCode, owner_id: ownerId })
      .select('id')
      .single();
    if (!error && data) {
      team = data;
      break;
    }
    if (error?.code !== '23505') {
      return jsonResponse({ error: 'Laget kunde inte skapas. Försök igen.' }, 500);
    }
  }
  if (!team) return jsonResponse({ error: 'Kunde inte skapa unika lagkoder. Försök igen.' }, 500);

  const { error: settingsError } = await adminClient.from('team_settings').insert({
    team_id: team.id,
    weekly_survey_required: 1,
    weekly_wellbeing_required: 1,
  });
  if (settingsError) {
    await adminClient.from('teams').delete().eq('id', team.id);
    return jsonResponse({ error: 'Laget kunde inte färdigställas. Försök igen.' }, 500);
  }

  if (ownerId) return jsonResponse({ email, invitationSent: false });

  const { data: invitation, error: invitationError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl.replace(/\/+$/, '')}/?invite=1`,
    data: { invite_role: 'trainer', team_id: team.id },
  });
  if (invitationError || !invitation.user) {
    await adminClient.from('teams').delete().eq('id', team.id);
    const alreadyExists = invitationError?.message.toLowerCase().includes('already')
      || invitationError?.message.toLowerCase().includes('registered');
    return jsonResponse({
      error: alreadyExists
        ? 'E-postadressen har redan ett konto. Tränaren behöver logga in med sitt befintliga konto innan laget kan kopplas.'
        : 'Inbjudan kunde inte skickas. Kontrollera e-postinställningarna och försök igen.',
    }, 400);
  }

  const { error: ownerError } = await adminClient
    .from('teams')
    .update({ owner_id: invitation.user.id })
    .eq('id', team.id);
  if (ownerError) {
    await adminClient.from('teams').delete().eq('id', team.id);
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return jsonResponse({ error: 'Laget kunde inte kopplas till tränaren. Försök igen.' }, 500);
  }

  return jsonResponse({ email, invitationSent: true });
});