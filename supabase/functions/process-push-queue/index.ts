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
  if (!url || !serviceRoleKey) return response({ error: 'Push queue is not configured.' }, 500);
  if (request.headers.get('Authorization') !== `Bearer ${serviceRoleKey}`) {
    return response({ error: 'Service role authorization required.' }, 401);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const startedAt = new Date().toISOString();
  try {
    const results = await processDueQueues(admin, 100);
    console.info('[queue] batch complete', JSON.stringify({ processed: results.length }));
    const { error: runLogError } = await admin.from('notification_job_runs').insert({
      job_name: 'process-push-queue', status: 'succeeded', processed_count: results.length,
      started_at: startedAt, finished_at: new Date().toISOString(),
    });
    if (runLogError) console.error('[queue] could not persist job run', runLogError);
    return response({ processed: results.length, results });
  } catch (error) {
    console.error('[queue] batch failed', error);
    await admin.from('notification_job_runs').insert({
      job_name: 'process-push-queue', status: 'failed', error: error instanceof Error ? error.message : 'Could not process push queue.',
      started_at: startedAt, finished_at: new Date().toISOString(),
    });
    return response({ error: error instanceof Error ? error.message : 'Could not process push queue.' }, 500);
  }
});