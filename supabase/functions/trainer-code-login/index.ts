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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Trainer code login is not configured.' }, 500);
  }

  let payload: { trainerCode?: string };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const trainerCode = payload.trainerCode?.trim().toUpperCase();
  if (!trainerCode || trainerCode.length > 64) {
    return jsonResponse({ error: 'Enter a valid trainer code.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: team, error } = await adminClient
    .from('teams')
    .select('*')
    .eq('trainer_code', trainerCode)
    .maybeSingle();

  if (error) return jsonResponse({ error: 'Could not verify the trainer code.' }, 500);
  if (!team) return jsonResponse({ error: 'Invalid trainer code.' }, 401);
  if (team.code_expires_at && new Date(team.code_expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: 'The trainer code has expired.' }, 401);
  }

  return jsonResponse({ team });
});