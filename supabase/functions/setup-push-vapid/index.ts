import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { response } from '../_shared/push.ts';

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
  const authorization = request.headers.get('Authorization') ?? '';
  if (!url || !serviceRoleKey) return response({ error: 'Push setup is not configured.' }, 500);
  if (authorization !== `Bearer ${serviceRoleKey}`) return response({ error: 'Service role authorization required.' }, 401);

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data: current, error: readError } = await admin.rpc('get_push_vapid_secrets');
    if (readError) throw new Error(readError.message);
    const existing = Array.isArray(current) ? current[0] : current;
    let publicKey = existing?.public_key as string | undefined;
    let initialized = false;

    if (!existing?.public_key || !existing?.private_key) {
      const keys = webpush.generateVAPIDKeys();
      const { data, error } = await admin.rpc('store_push_vapid_secrets', {
        p_public_key: keys.publicKey,
        p_private_key: keys.privateKey,
      });
      if (error) throw new Error(error.message);
      publicKey = data as string;
      initialized = true;
    }

    if (!publicKey) throw new Error('VAPID public key was not returned by secure storage.');
    const { error: configError } = await admin.from('push_public_config').upsert({
      id: true,
      vapid_public_key: publicKey,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (configError) throw new Error(configError.message);

    const { error: cronError } = await admin.rpc('configure_notification_cron', {
      p_project_url: url,
      p_service_role_key: serviceRoleKey,
    });
    if (cronError) throw new Error(cronError.message);

    console.info('[push] VAPID setup complete', JSON.stringify({ initialized }));
    return response({ ok: true, initialized, public_key: publicKey });
  } catch (error) {
    console.error('[push] VAPID setup failed', error);
    return response({ error: error instanceof Error ? error.message : 'Push setup failed.' }, 500);
  }
});