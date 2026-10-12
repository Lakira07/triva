import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type PermissionState = NotificationPermission | 'unsupported';

interface PublicPushConfig {
  vapid_public_key: string;
}

function decodeApplicationKey(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

function bufferToBase64Url(value: ArrayBuffer | ArrayBufferView | null): string | null {
  if (!value) return null;
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isPushSupported(): boolean {
  return window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

async function readPublicKey(): Promise<string> {
  const { data, error } = await supabase
    .from('push_public_config')
    .select('vapid_public_key')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error('Kunde inte läsa push-nyckeln.');
  const config = data as PublicPushConfig | null;
  if (!config?.vapid_public_key) throw new Error('Pushnotiser är inte konfigurerade ännu.');
  return config.vapid_public_key;
}

async function saveSubscription(userId: string, subscription: PushSubscription, publicKey: string): Promise<void> {
  const payload = subscription.toJSON();
  const p256dh = payload.keys?.p256dh;
  const auth = payload.keys?.auth;
  if (!subscription.endpoint || !p256dh || !auth) throw new Error('Enheten returnerade ingen giltig push-prenumeration.');

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent.slice(0, 500),
    vapid_public_key: publicKey,
    status: 'active',
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw new Error('Kunde inte spara enhetens push-prenumeration.');
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('Den här webbläsaren saknar service worker-stöd.');
  return navigator.serviceWorker.ready;
}

export function usePushNotifications() {
  const [userId, setUserId] = useState<string | null>(null);
  const [pushEnabled, setPushEnabledState] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const [supported, setSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;
    setSupported(isPushSupported());
    setPermission('Notification' in window ? Notification.permission : 'unsupported');
    setIsIOS(ios);
    setIsInstalled(standalone);

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user.id ?? null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const syncPreference = useCallback(async (id: string) => {
    const { data, error: preferenceError } = await supabase
      .from('push_preferences')
      .select('push_enabled')
      .eq('user_id', id)
      .maybeSingle();
    if (preferenceError) throw new Error('Kunde inte läsa pushinställningen.');
    setPushEnabledState(data?.push_enabled ?? false);
    return data?.push_enabled ?? false;
  }, []);

  useEffect(() => {
    if (!userId) {
      setPushEnabledState(false);
      setEndpoint(null);
      return;
    }
    let active = true;
    void syncPreference(userId).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Kunde inte läsa pushinställningen.');
    });
    return () => { active = false; };
  }, [syncPreference, userId]);

  const persistPreference = useCallback(async (id: string, enabled: boolean) => {
    const { error: preferenceError } = await supabase.from('push_preferences').upsert({
      user_id: id,
      push_enabled: enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (preferenceError) throw new Error('Kunde inte spara pushinställningen.');
    setPushEnabledState(enabled);
  }, []);

  const setPushEnabled = useCallback(async (enabled: boolean) => {
    if (!userId || working) return;
    setWorking(true);
    setError('');
    try {
      if (!isPushSupported()) throw new Error('Pushnotiser stöds inte i den här webbläsaren eller anslutningen.');

      if (!enabled) {
        await persistPreference(userId, false);
        const registration = await getPushRegistration();
        const localSubscription = await registration.pushManager.getSubscription();
        const endpointToRemove = localSubscription?.endpoint;
        if (localSubscription) await localSubscription.unsubscribe();
        let deletion = supabase.from('push_subscriptions').delete().eq('user_id', userId);
        if (endpointToRemove) deletion = deletion.eq('endpoint', endpointToRemove);
        const { error: deleteError } = await deletion;
        if (deleteError) throw new Error('Push har stängts av, men enheten kunde inte tas bort från servern.');
        setEndpoint(null);
        return;
      }

      let currentPermission = Notification.permission;
      if (currentPermission === 'default') currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);
      if (currentPermission !== 'granted') {
        if (currentPermission === 'denied') throw new Error('Notiser är blockerade i webbläsarens inställningar.');
        throw new Error('Tillåtelse för notiser beviljades inte.');
      }

      const registration = await getPushRegistration();
      const publicKey = await readPublicKey();
      let subscription = await registration.pushManager.getSubscription();
      const localKey = bufferToBase64Url(subscription?.options.applicationServerKey ?? null);
      if (subscription && localKey !== publicKey) {
        await subscription.unsubscribe();
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationKey(publicKey),
        });
      }
      await saveSubscription(userId, subscription, publicKey);
      await persistPreference(userId, true);
      setEndpoint(subscription.endpoint);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Pushinställningen kunde inte uppdateras.';
      setError(message);
      console.error('[push] subscription setting failed', cause);
    } finally {
      setWorking(false);
    }
  }, [persistPreference, userId, working]);

  useEffect(() => {
    if (!userId || !pushEnabled || permission !== 'granted' || !supported) return;
    let active = true;
    const reconcile = async () => {
      try {
        const registration = await getPushRegistration();
        const publicKey = await readPublicKey();
        let subscription = await registration.pushManager.getSubscription();
        const localKey = bufferToBase64Url(subscription?.options.applicationServerKey ?? null);
        const serverRecord = subscription
          ? await supabase.from('push_subscriptions').select('id, status, vapid_public_key').eq('user_id', userId).eq('endpoint', subscription.endpoint).maybeSingle()
          : { data: null, error: null };
        if (serverRecord.error) throw new Error('Kunde inte verifiera enhetens prenumeration.');

        if (subscription && localKey !== publicKey) {
          await subscription.unsubscribe();
          subscription = null;
        }
        if (subscription && (!serverRecord.data || serverRecord.data.status !== 'active' || serverRecord.data.vapid_public_key !== publicKey)) {
          if (serverRecord.data) {
            await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', subscription.endpoint);
          }
          await subscription.unsubscribe();
          subscription = null;
        }
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeApplicationKey(publicKey),
          });
        }
        await saveSubscription(userId, subscription, publicKey);
        if (active) {
          setEndpoint(subscription.endpoint);
          setError('');
        }
        localStorage.setItem(`triva-push-checked:${userId}`, String(Date.now()));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Enhetens push-prenumeration kunde inte kontrolleras.');
        console.error('[push] subscription self-heal failed', cause);
      }
    };

    void reconcile();
    const timer = window.setInterval(() => void reconcile(), 7 * 24 * 60 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [permission, pushEnabled, supported, userId]);

  return {
    userId,
    pushEnabled,
    setPushEnabled,
    permission,
    supported,
    isIOS,
    isInstalled,
    endpoint,
    error,
    working,
  };
}