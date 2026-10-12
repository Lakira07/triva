import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { usePushNotifications } from '@/lib/usePushNotifications';

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  target_url: string | null;
  created_at: string;
}

function relativeTime(value: string): string {
  return new Date(value).toLocaleString('sv-SE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function NotificationBell() {
  const push = usePushNotifications();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [inboxError, setInboxError] = useState('');

  const refresh = useCallback(async () => {
    if (!push.userId) return;
    const [{ data, error }, { count, error: countError }] = await Promise.all([
      supabase.from('notifications')
        .select('id, title, message, is_read, target_url, created_at')
        .eq('recipient_user_id', push.userId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', push.userId)
        .eq('is_read', false),
    ]);
    if (error || countError) {
      setInboxError('Kunde inte uppdatera aviseringar.');
      console.error('[notifications] inbox refresh failed', error ?? countError);
      return;
    }
    setItems((data ?? []) as InAppNotification[]);
    setUnreadCount(count ?? 0);
    setInboxError('');
  }, [push.userId]);

  useEffect(() => {
    if (!push.userId) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => { void refresh(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [push.userId, refresh]);

  const markAllRead = async () => {
    if (!push.userId || unreadCount === 0) return;
    const { error } = await supabase.from('notifications')
      .update({ is_read: true })
      .eq('recipient_user_id', push.userId)
      .eq('is_read', false);
    if (error) {
      setInboxError('Aviseringarna kunde inte markeras som lästa.');
      console.error('[notifications] mark all read failed', error);
      return;
    }
    await refresh();
  };

  const openNotification = async (item: InAppNotification) => {
    if (!push.userId) return;
    if (!item.is_read) {
      const { error } = await supabase.from('notifications')
        .update({ is_read: true })
        .eq('id', item.id)
        .eq('recipient_user_id', push.userId);
      if (error) console.error('[notifications] mark read failed', error);
    }
    setOpen(false);
    if (item.target_url) {
      try {
        const target = new URL(item.target_url, window.location.origin);
        if (target.origin === window.location.origin) window.location.assign(target.href);
      } catch (error) {
        console.error('[notifications] invalid target URL', error);
      }
    } else {
      await refresh();
    }
  };

  if (!push.userId) return null;

  const showIOSPermissionPrompt = push.isIOS
    && push.isInstalled
    && push.permission === 'default'
    && !dismissedPrompt;
  const showIOSInstallHint = push.isIOS && !push.isInstalled && push.permission !== 'denied';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void refresh();
        }}
        aria-label={`Aviseringar${unreadCount ? `, ${unreadCount} olästa` : ''}`}
        aria-expanded={open}
        title="Aviseringar"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-950"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-gray-950">Aviseringar</h2>
              <p className="text-xs text-gray-500">{unreadCount} olästa</p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1.5 text-xs font-semibold text-[#315c43] hover:text-[#172b22]">
                <CheckCheck className="h-4 w-4" /> Markera alla lästa
              </button>
            )}
          </div>

          {(showIOSInstallHint || showIOSPermissionPrompt) && (
            <div className="border-b border-gray-100 bg-[#f5f6f2] px-4 py-3">
              {showIOSInstallHint ? (
                <p className="text-xs leading-5 text-gray-700">Installera Triva från Safari: tryck på Dela och välj Lägg till på hemskärmen för att använda pushnotiser.</p>
              ) : (
                <div className="flex items-start gap-3">
                  <p className="flex-1 text-xs leading-5 text-gray-700">Tillåt notiser så får du viktiga uppdateringar även när Triva är stängt.</p>
                  <button type="button" onClick={() => void push.setPushEnabled(true)} disabled={push.working} className="shrink-0 rounded-md bg-[#234633] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                    Tillåt notiser
                  </button>
                  <button type="button" onClick={() => setDismissedPrompt(true)} aria-label="Dölj notispåminnelse för sessionen" className="p-1 text-gray-400 hover:text-gray-800">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {inboxError && <p role="alert" className="px-4 py-2 text-xs text-red-700">{inboxError}</p>}
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Inga aviseringar ännu.</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => void openNotification(item)} className={`w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${item.is_read ? '' : 'bg-[#f4f7f4]'}`}>
                      <span className="flex items-start gap-2.5">
                        {!item.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#315c43]" />}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-gray-900">{item.title}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-gray-600">{item.message}</span>
                          <span className="mt-1 block text-[11px] text-gray-400">{relativeTime(item.created_at)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-800">Pushnotiser</p>
                <p className="text-[11px] text-gray-500">
                  {push.permission === 'denied' ? 'Blockerade i webbläsaren' : push.supported ? 'Till denna enhet' : 'Stöds inte här'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={push.pushEnabled}
                aria-label="Pushnotiser"
                onClick={() => void push.setPushEnabled(!push.pushEnabled)}
                disabled={push.working || (!push.pushEnabled && (!push.supported || push.permission === 'denied'))}
                className={`relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${push.pushEnabled ? 'bg-[#315c43]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${push.pushEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {push.error && <p role="alert" className="mt-2 text-xs text-red-700">{push.error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}