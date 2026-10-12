import { useEffect, useState } from 'react';
import { BellRing, Loader2, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface QueueDiagnostic {
  id: string;
  recipient_user_id: string;
  title: string;
  status: string;
  attempts: number;
  last_error: string | null;
  devices_sent: number;
  created_at: string;
}

interface JobRunDiagnostic {
  id: string;
  job_name: string;
  status: string;
  processed_count: number;
  error: string | null;
  started_at: string;
}

interface CronRunDiagnostic {
  job_name: string;
  status: string;
  return_message: string;
  started_at: string;
}

interface ServerDiagnostics {
  push_enabled: boolean;
  vapid_public_key: string | null;
  subscription_exists: boolean;
  subscription_status: string | null;
  key_matches: boolean;
  subscription_last_seen_at: string | null;
  recent_queue: QueueDiagnostic[];
  recent_jobs: JobRunDiagnostic[];
  recent_cron_runs: CronRunDiagnostic[];
}

function installationState(): string {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
  return standalone ? 'Installerad' : 'Webbläsare';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function PushDiagnostics() {
  const [browserSupported, setBrowserSupported] = useState(false);
  const [permission, setPermission] = useState('Okänd');
  const [installed, setInstalled] = useState('Okänd');
  const [workerState, setWorkerState] = useState('Kontrollerar');
  const [localEndpoint, setLocalEndpoint] = useState<string | null>(null);
  const [server, setServer] = useState<ServerDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    const supported = window.isSecureContext
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
    setBrowserSupported(supported);
    setPermission('Notification' in window ? Notification.permission : 'Ej stöds');
    setInstalled(installationState());

    let endpoint: string | null = null;
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        setWorkerState(registration?.active?.state ?? registration?.installing?.state ?? 'Inte registrerad');
        endpoint = (await registration?.pushManager.getSubscription())?.endpoint ?? null;
      } else {
        setWorkerState('Ej stöds');
      }
    } catch (cause) {
      setWorkerState('Fel');
      console.error('[push] diagnostics browser inspection failed', cause);
    }
    setLocalEndpoint(endpoint);

    const { data, error: invokeError } = await supabase.functions.invoke<ServerDiagnostics & { error?: string }>(
      'push-diagnostics',
      { body: { action: 'inspect', endpoint } },
    );
    if (invokeError || data?.error) {
      setError(data?.error ?? invokeError?.message ?? 'Kunde inte läsa serverdiagnostik.');
      setServer(null);
    } else {
      setServer(data as ServerDiagnostics);
    }
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const testPush = async () => {
    setTesting(true);
    setTestResult('');
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke<{ error?: string; queue?: QueueDiagnostic }>(
      'push-diagnostics',
      { body: { action: 'test' } },
    );
    if (invokeError || data?.error) {
      setError(data?.error ?? invokeError?.message ?? 'Testnotisen kunde inte skickas.');
    } else {
      setTestResult(`Köstatus: ${data?.queue?.status ?? 'okänd'}${data?.queue?.last_error ? ` · ${data.queue.last_error}` : ''}`);
    }
    setTesting(false);
    await refresh();
  };

  const errorRows = (server?.recent_queue ?? []).filter((row) => row.last_error);

  return (
    <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-[#315c43]" />
          <div>
            <h2 className="font-bold text-gray-950">Pushdiagnostik</h2>
            <p className="text-xs text-gray-500">Webbläsare, enhetsprenumeration och leveranskök</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void refresh()} disabled={loading} aria-label="Uppdatera pushdiagnostik" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => void testPush()} disabled={testing || loading} className="flex items-center gap-2 rounded-lg bg-[#234633] px-3 py-2 text-xs font-bold text-white hover:bg-[#183525] disabled:opacity-50">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Testnotis till mig
          </button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-4">
        <div><dt className="text-gray-500">Web Push-stöd</dt><dd className="mt-0.5 font-semibold text-gray-900">{browserSupported ? 'Tillgängligt' : 'Ej tillgängligt'}</dd></div>
        <div><dt className="text-gray-500">Tillåtelse</dt><dd className="mt-0.5 font-semibold text-gray-900">{permission}</dd></div>
        <div><dt className="text-gray-500">Installation</dt><dd className="mt-0.5 font-semibold text-gray-900">{installed}</dd></div>
        <div><dt className="text-gray-500">Service worker</dt><dd className="mt-0.5 font-semibold text-gray-900">{workerState}</dd></div>
        <div><dt className="text-gray-500">Pushinställning</dt><dd className="mt-0.5 font-semibold text-gray-900">{server?.push_enabled ? 'På' : server ? 'Av' : 'Okänd'}</dd></div>
        <div><dt className="text-gray-500">Prenumeration på servern</dt><dd className="mt-0.5 font-semibold text-gray-900">{server ? server.subscription_exists ? server.subscription_status ?? 'Finns' : 'Saknas' : 'Okänd'}</dd></div>
        <div><dt className="text-gray-500">VAPID-nyckel</dt><dd className="mt-0.5 font-semibold text-gray-900">{server?.subscription_exists ? server.key_matches ? 'Matchar' : 'Matchar inte' : 'Ingen enhet'}</dd></div>
        <div><dt className="text-gray-500">Den här enheten</dt><dd className="mt-0.5 font-semibold text-gray-900">{localEndpoint ? 'Prenumererad' : 'Inte prenumererad'}</dd></div>
      </dl>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      {testResult && <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">{testResult}</p>}

      <div className="mt-5 border-t border-gray-100 pt-4">
        <h3 className="text-xs font-bold text-gray-700">Senaste köfel</h3>
        {errorRows.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500">Inga fel bland de senaste köposterna.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {errorRows.slice(0, 10).map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-gray-900">{row.title}</span>
                  <span className="ml-2 text-gray-500">{row.status} · {row.attempts} försök · {row.devices_sent} enheter</span>
                  <span className="mt-1 block break-words text-red-700">{row.last_error}</span>
                </span>
                <time className="shrink-0 text-gray-400">{formatDate(row.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4">
        <h3 className="text-xs font-bold text-gray-700">Schemalagda jobb</h3>
        {server?.recent_jobs.length || server?.recent_cron_runs.length ? (
          <ul className="mt-2 divide-y divide-gray-100">
            {[...(server?.recent_jobs ?? []).map((run) => ({
              id: run.id,
              name: run.job_name,
              status: run.status,
              time: run.started_at,
              error: run.error,
            })), ...(server?.recent_cron_runs ?? []).map((run, index) => ({
              id: `${run.job_name}:${run.started_at}:${index}`,
              name: `${run.job_name} · cron`,
              status: run.status,
              time: run.started_at,
              error: run.status === 'succeeded' ? null : run.return_message,
            }))].slice(0, 10).map((run) => (
              <li key={run.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-gray-900">{run.name}</span>
                  <span className={`ml-2 font-semibold ${run.status === 'failed' ? 'text-red-700' : 'text-gray-500'}`}>{run.status}</span>
                  {run.error && <span className="mt-1 block break-words text-red-700">{run.error}</span>}
                </span>
                <time className="shrink-0 text-gray-400">{formatDate(run.time)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-gray-500">Inga jobb har körts ännu.</p>
        )}
      </div>
    </section>
  );
}