import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Loader2, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ReminderPlayer {
  id: string;
  name: string;
}

interface ReminderSession {
  id: string;
  title: string;
  scheduled_at: string;
}

export default function CoachRemindersView({ teamId, trainerCode }: { teamId: string; trainerCode: string }) {
  const [players, setPlayers] = useState<ReminderPlayer[]>([]);
  const [sessions, setSessions] = useState<ReminderSession[]>([]);
  const [reminderType, setReminderType] = useState<'wellbeing' | 'training_load'>('wellbeing');
  const [sessionId, setSessionId] = useState('');
  const [allPlayers, setAllPlayers] = useState(true);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.functions.invoke<{ players?: ReminderPlayer[]; sessions?: ReminderSession[]; error?: string }>(
      'coach-reminders',
      { body: { action: 'options', teamId, trainerCode } },
    ).then(async ({ data, error: invokeError }) => {
      if (invokeError) {
        let message = invokeError.message;
        if (invokeError.context instanceof Response) {
          const responseBody = await invokeError.context.clone().json().catch(() => null) as { error?: string } | null;
          message = responseBody?.error ?? message;
        }
        if (active) setError(message);
        return;
      }
      if (data?.error) {
        if (active) setError(data.error);
        return;
      }
      if (active) {
        const nextPlayers = data?.players ?? [];
        setPlayers(nextPlayers);
        setPlayerIds(nextPlayers.map((player) => player.id));
        setSessions(data?.sessions ?? []);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [teamId, trainerCode]);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    setSuccess('');
    const { data, error: invokeError } = await supabase.functions.invoke<{
      sentCount?: number;
      playerNames?: string[];
      error?: string;
    }>('coach-reminders', {
      body: {
        action: 'send',
        teamId,
        trainerCode,
        reminderType,
        trainingSessionId: reminderType === 'training_load' ? sessionId : null,
        allPlayers,
        playerIds: allPlayers ? [] : playerIds,
        body: body.trim() || undefined,
      },
    });

    if (invokeError || data?.error) {
      let message = data?.error ?? invokeError?.message ?? 'Kunde inte skicka påminnelsen.';
      if (invokeError?.context instanceof Response) {
        const responseBody = await invokeError.context.clone().json().catch(() => null) as { error?: string } | null;
        message = responseBody?.error ?? message;
      }
      setError(message);
    } else {
      setSuccess(`Påminnelsen skickades till ${data?.sentCount ?? 0} spelare.`);
      setBody('');
    }
    setSending(false);
  };

  const togglePlayer = (playerId: string) => {
    setPlayerIds((current) => current.includes(playerId)
      ? current.filter((id) => id !== playerId)
      : [...current, playerId]);
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>;

  return (
    <section className="border-t border-gray-200 pt-6">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-black">Spelarpåminnelser</h3>
      </div>
      <p className="mb-5 text-sm text-gray-500">Skicka en påminnelse som visas i spelarens app. Spelare behöver ett personligt konto från en e-postinbjudan.</p>

      {players.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">Inga spelare med personliga konton ännu. Bjud in spelare via e-post först.</p>
      ) : (
        <form onSubmit={(event) => void handleSend(event)} className="max-w-2xl space-y-4">
          <div>
            <label htmlFor="reminder-type" className="mb-1.5 block text-sm font-medium text-gray-700">Typ av påminnelse</label>
            <select
              id="reminder-type"
              value={reminderType}
              onChange={(event) => setReminderType(event.target.value as 'wellbeing' | 'training_load')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
            >
              <option value="wellbeing">Välmåenderapport</option>
              <option value="training_load">Belastningsformulär efter träning</option>
            </select>
          </div>

          {reminderType === 'training_load' && (
            <div>
              <label htmlFor="reminder-session" className="mb-1.5 block text-sm font-medium text-gray-700">Träningspass</label>
              <select
                id="reminder-session"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
              >
                <option value="">Välj träningspass</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title} · {new Date(session.scheduled_at).toLocaleDateString('sv-SE')}
                  </option>
                ))}
              </select>
              {sessions.length === 0 && <p className="mt-1 text-xs text-gray-500">Skapa ett träningspass innan du skickar den här påminnelsen.</p>}
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Mottagare</legend>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={allPlayers} onChange={(event) => setAllPlayers(event.target.checked)} className="accent-black" />
              Alla spelare som kan ta emot påminnelser ({players.length})
            </label>
            {!allPlayers && (
              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {players.map((player) => (
                  <label key={player.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={playerIds.includes(player.id)} onChange={() => togglePlayer(player.id)} className="accent-black" />
                    {player.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div>
            <label htmlFor="reminder-message" className="mb-1.5 block text-sm font-medium text-gray-700">Meddelande (frivilligt)</label>
            <textarea
              id="reminder-message"
              rows={2}
              maxLength={500}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Lägg till en kort personlig påminnelse"
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="text-sm text-green-700">{success}</p>}
          <button
            type="submit"
            disabled={sending || players.length === 0 || (!allPlayers && playerIds.length === 0) || (reminderType === 'training_load' && (!sessionId || sessions.length === 0))}
            className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Skicka påminnelse nu
          </button>
        </form>
      )}
    </section>
  );
}
