import webpush from 'npm:web-push@3.6.7';

const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_SECONDS = 6 * 60 * 60;

export interface QueueRow {
  id: string;
  recipient_user_id: string;
  team_id: string | null;
  title: string;
  body: string;
  url: string;
  origin: 'app' | 'system';
  attempts: number;
  devices_sent: number;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  vapid_public_key: string;
}

export interface DeliverySummary {
  queueId: string;
  status: 'sent' | 'failed' | 'pending';
  devicesSent: number;
  retries: number;
  expired: number;
  repaired: number;
  lastError: string | null;
}

export function response(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version', 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  });
}

export function cleanError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/[\r\n]+/g, ' ').slice(0, 500);
}

export async function loadVapidKeys(admin: any): Promise<{ publicKey: string; privateKey: string }> {
  const { data, error } = await admin.rpc('get_push_vapid_secrets');
  if (error) throw new Error(`Could not load VAPID credentials: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.public_key || !row?.private_key) throw new Error('VAPID keys have not been initialized.');

  const { error: configError } = await admin.from('push_public_config').upsert({
    id: true,
    vapid_public_key: row.public_key,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (configError) throw new Error(`Could not publish the VAPID public key: ${configError.message}`);

  webpush.setVapidDetails('mailto:notifications@triva.app', row.public_key, row.private_key);
  return { publicKey: row.public_key, privateKey: row.private_key };
}

function backoffSeconds(attempt: number): number {
  return Math.min(60 * (2 ** Math.max(attempt - 1, 0)), MAX_BACKOFF_SECONDS);
}

export async function deliverQueueRow(admin: any, queue: QueueRow, publicKey: string): Promise<DeliverySummary> {
  const summary: DeliverySummary = {
    queueId: queue.id,
    status: 'pending',
    devicesSent: 0,
    retries: 0,
    expired: 0,
    repaired: 0,
    lastError: null,
  };

  const { data: preference, error: preferenceError } = await admin.from('push_preferences')
    .select('push_enabled')
    .eq('user_id', queue.recipient_user_id)
    .maybeSingle();
  if (preferenceError) throw new Error(`Could not read push preference: ${preferenceError.message}`);
  if (!preference?.push_enabled) {
    const { data: previousDeliveries, error: deliveryError } = await admin.from('push_queue_deliveries')
      .select('status')
      .eq('queue_id', queue.id);
    if (deliveryError) throw new Error(`Could not inspect prior device deliveries: ${deliveryError.message}`);
    const sentCount = (previousDeliveries ?? []).filter((row: { status: string }) => row.status === 'sent').length;
    summary.status = sentCount ? 'sent' : 'failed';
    summary.devicesSent = sentCount;
    summary.lastError = 'Push is disabled for this account; no further delivery was attempted.';
    const { error } = await admin.from('push_queue').update({
      status: summary.status,
      attempts: queue.attempts + 1,
      last_error: summary.lastError,
      devices_sent: sentCount,
      sent_at: sentCount ? new Date().toISOString() : null,
      locked_at: null,
    }).eq('id', queue.id);
    if (error) throw new Error(`Could not finalize disabled queue row: ${error.message}`);
    return summary;
  }

  const { data: subscriptions, error: subscriptionError } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, vapid_public_key')
    .eq('user_id', queue.recipient_user_id)
    .eq('status', 'active');
  if (subscriptionError) throw new Error(`Could not load subscriptions: ${subscriptionError.message}`);

  if (!subscriptions?.length) {
    const { data: previousDeliveries, error: deliveryError } = await admin.from('push_queue_deliveries')
      .select('status')
      .eq('queue_id', queue.id);
    if (deliveryError) throw new Error(`Could not inspect prior device deliveries: ${deliveryError.message}`);
    const sentCount = (previousDeliveries ?? []).filter((row: { status: string }) => row.status === 'sent').length;
    summary.status = sentCount ? 'sent' : 'failed';
    summary.devicesSent = sentCount;
    summary.lastError = 'No active device subscription; nothing to retry.';
    const { error } = await admin.from('push_queue').update({
      status: summary.status, attempts: queue.attempts + 1, last_error: summary.lastError,
      devices_sent: sentCount, sent_at: sentCount ? new Date().toISOString() : null, locked_at: null,
    }).eq('id', queue.id);
    if (error) throw new Error(`Could not finalize empty queue row: ${error.message}`);
    return summary;
  }

  const usableSubscriptions: SubscriptionRow[] = [];
  for (const subscription of subscriptions as SubscriptionRow[]) {
    if (subscription.vapid_public_key !== publicKey) {
      const { error } = await admin.from('push_subscriptions').delete().eq('id', subscription.id);
      if (error) {
        summary.lastError = `Could not remove an old-key subscription: ${cleanError(error)}`;
      } else {
        summary.repaired += 1;
      }
      continue;
    }
    usableSubscriptions.push(subscription);
  }

  if (!usableSubscriptions.length) {
    summary.status = 'failed';
    summary.lastError ||= 'All subscriptions used an old VAPID key and were removed; the client will recreate them on next launch.';
    await admin.from('push_queue').update({
      status: 'failed', attempts: queue.attempts + 1, last_error: summary.lastError,
      devices_sent: 0, locked_at: null,
    }).eq('id', queue.id);
    return summary;
  }

  const { error: upsertError } = await admin.from('push_queue_deliveries').upsert(
    usableSubscriptions.map((subscription) => ({
      queue_id: queue.id,
      subscription_id: subscription.id,
      status: 'pending',
      next_attempt_at: new Date().toISOString(),
    })),
    { onConflict: 'queue_id,subscription_id', ignoreDuplicates: true },
  );
  if (upsertError) throw new Error(`Could not create device delivery rows: ${upsertError.message}`);

  const { data: deliveryRows, error: deliveriesError } = await admin
    .from('push_queue_deliveries')
    .select('id, subscription_id, status, attempts, next_attempt_at')
    .eq('queue_id', queue.id);
  if (deliveriesError) throw new Error(`Could not load device delivery rows: ${deliveriesError.message}`);
  const byId = new Map(usableSubscriptions.map((subscription) => [subscription.id, subscription]));
  const now = Date.now();

  for (const delivery of deliveryRows ?? []) {
    if (delivery.status !== 'pending' || new Date(delivery.next_attempt_at).getTime() > now) continue;
    const subscription = byId.get(delivery.subscription_id);
    if (!subscription) continue;

    const nextAttempt = delivery.attempts + 1;
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        title: queue.title,
        body: queue.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        data: { url: queue.url },
      }), { TTL: 3600, urgency: 'normal' });

      await admin.from('push_queue_deliveries').update({
        status: 'sent', attempts: nextAttempt, sent_at: new Date().toISOString(), last_error: null,
      }).eq('id', delivery.id);
      await admin.from('push_subscriptions').update({ last_seen_at: new Date().toISOString() }).eq('id', subscription.id);
      summary.devicesSent += 1;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
      const message = cleanError(error);
      const expired = statusCode === 404 || statusCode === 410;
      const retryable = !expired && (statusCode === 0 || statusCode === 408 || statusCode === 429 || statusCode >= 500);
      const retry = retryable && nextAttempt < MAX_ATTEMPTS;
      if (expired) {
        await admin.from('push_subscriptions').update({ status: 'expired' }).eq('id', subscription.id);
        summary.expired += 1;
      }
      const nextAttemptAt = new Date(Date.now() + backoffSeconds(nextAttempt) * 1000).toISOString();
      await admin.from('push_queue_deliveries').update({
        status: expired ? 'expired' : retry ? 'pending' : 'failed',
        attempts: nextAttempt,
        last_error: message,
        next_attempt_at: nextAttemptAt,
      }).eq('id', delivery.id);
      summary.lastError = [summary.lastError, `${statusCode || 'network'}: ${message}`].filter(Boolean).join(' | ').slice(0, 1000);
      if (retry) summary.retries += 1;
    }
  }

  const { data: finalRows, error: finalError } = await admin
    .from('push_queue_deliveries')
    .select('status, attempts, last_error, next_attempt_at')
    .eq('queue_id', queue.id);
  if (finalError) throw new Error(`Could not finalize queue status: ${finalError.message}`);
  const pendingRows = (finalRows ?? []).filter((row: { status: string }) => row.status === 'pending');
  const sentCount = (finalRows ?? []).filter((row: { status: string }) => row.status === 'sent').length;
  const terminalErrors = (finalRows ?? [])
    .filter((row: { status: string; last_error: string | null }) => row.status === 'failed' || row.status === 'expired')
    .map((row: { last_error: string | null }) => row.last_error)
    .filter(Boolean);
  const attempts = Math.max(queue.attempts + 1, ...((finalRows ?? []).map((row: { attempts: number }) => row.attempts)));
  const queueStatus = pendingRows.length ? 'pending' : sentCount ? 'sent' : 'failed';
  const nextAttemptAt = pendingRows.length
    ? pendingRows.map((row: { next_attempt_at: string }) => row.next_attempt_at).sort()[0]
    : new Date().toISOString();
  const lastError = [summary.lastError, ...terminalErrors].filter(Boolean).join(' | ').slice(0, 1000) || null;

  const { error: updateError } = await admin.from('push_queue').update({
    status: queueStatus,
    attempts,
    last_error: lastError,
    next_attempt_at: nextAttemptAt,
    devices_sent: sentCount,
    sent_at: queueStatus === 'sent' ? new Date().toISOString() : null,
    locked_at: null,
  }).eq('id', queue.id);
  if (updateError) throw new Error(`Could not update queue row: ${updateError.message}`);
  summary.status = queueStatus;
  summary.devicesSent = sentCount;
  summary.lastError = lastError;
  return summary;
}

export async function processDueQueues(admin: any, limit = 50): Promise<DeliverySummary[]> {
  const { publicKey } = await loadVapidKeys(admin);
  const { data: queues, error } = await admin.rpc('claim_due_push_queue', { p_limit: limit });
  if (error) throw new Error(`Could not claim due queue rows: ${error.message}`);
  if (!queues?.length) return [];

  const summaries: DeliverySummary[] = [];
  for (const queue of queues as QueueRow[]) {
    try {
      const summary = await deliverQueueRow(admin, queue, publicKey);
      summaries.push(summary);
      console.info('[queue] queue processed', JSON.stringify(summary));
      await admin.from('push_audit_log').insert({
        action: 'delivery_attempt',
        recipient_count: 1,
        devices_delivered: summary.devicesSent,
        retries: summary.retries,
        expired: summary.expired,
        repaired: summary.repaired,
        details: { queue_id: queue.id, status: summary.status, last_error: summary.lastError },
      });
    } catch (error) {
      const message = cleanError(error);
      console.error('[queue] processing failure', queue.id, message);
      const nextAttempt = queue.attempts + 1;
      const retry = nextAttempt < MAX_ATTEMPTS;
      await admin.from('push_queue').update({
        status: retry ? 'pending' : 'failed',
        attempts: nextAttempt,
        last_error: message,
        next_attempt_at: new Date(Date.now() + backoffSeconds(nextAttempt) * 1000).toISOString(),
        locked_at: null,
      }).eq('id', queue.id);
      await admin.from('push_audit_log').insert({
        action: 'delivery_error', recipient_count: 1,
        details: { queue_id: queue.id, error: message },
      });
      summaries.push({ queueId: queue.id, status: 'pending', devicesSent: 0, retries: 1, expired: 0, repaired: 0, lastError: message });
    }
  }
  return summaries;
}