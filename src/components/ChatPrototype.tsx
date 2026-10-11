import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LockKeyhole, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ChatRole = 'coach' | 'player';

interface ChatMessage {
  id: string;
  sender_role: ChatRole;
  body: string;
  created_at: string;
}

interface ChatPlayer {
  id: string;
  name: string;
}

type ChatPrototypeProps =
  | { role: 'coach'; teamId: string; trainerCode: string }
  | { role: 'player'; teamId: string; playerId: string; canMessage: boolean };

async function edgeError(error: { message: string; context?: unknown }): Promise<string> {
  if (error.context instanceof Response) {
    const body = await error.context.clone().json().catch(() => null) as { error?: string } | null;
    if (body?.error) return body.error;
  }
  return error.message;
}

export default function ChatPrototype(props: ChatPrototypeProps) {
  const [players, setPlayers] = useState<ChatPlayer[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId);

  const loadPlayers = useCallback(async () => {
    if (props.role !== 'coach') return;
    const { data, error: invokeError } = await supabase.functions.invoke<{ players?: ChatPlayer[]; error?: string }>(
      'coach-chat',
      { body: { action: 'players', teamId: props.teamId, trainerCode: props.trainerCode } },
    );
    if (invokeError) throw new Error(await edgeError(invokeError));
    if (data?.error) throw new Error(data.error);
    const nextPlayers = data?.players ?? [];
    setPlayers(nextPlayers);
    setSelectedPlayerId((current) => current || nextPlayers[0]?.id || '');
  }, [props]);

  const fetchMessages = useCallback(async (): Promise<ChatMessage[]> => {
    if (props.role === 'coach') {
      if (!selectedPlayerId) return [];
      const { data, error: invokeError } = await supabase.functions.invoke<{ messages?: ChatMessage[]; error?: string }>(
        'coach-chat',
        { body: { action: 'messages', teamId: props.teamId, trainerCode: props.trainerCode, playerId: selectedPlayerId } },
      );
      if (invokeError) throw new Error(await edgeError(invokeError));
      if (data?.error) throw new Error(data.error);
      return data?.messages ?? [];
    }

    if (!props.canMessage) return [];
    const { data, error: queryError } = await supabase
      .from('coach_player_messages')
      .select('id, sender_role, body, created_at')
      .eq('team_id', props.teamId)
      .eq('player_id', props.playerId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (queryError) throw queryError;
    return (data ?? []) as ChatMessage[];
  }, [props, selectedPlayerId]);

  useEffect(() => {
    if (props.role !== 'coach') return;
    let active = true;
    void loadPlayers().catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Kunde inte hämta spelarna.');
    });
    return () => { active = false; };
  }, [loadPlayers, props.role]);

  useEffect(() => {
    let active = true;
    let firstLoad = true;
    const refresh = async () => {
      if ((props.role === 'coach' && !selectedPlayerId) || (props.role === 'player' && !props.canMessage)) {
        setMessages([]);
        setLoading(false);
        return;
      }
      try {
        const nextMessages = await fetchMessages();
        if (active) setMessages(nextMessages);
        if (active) setError('');
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Kunde inte hämta meddelanden.');
      } finally {
        if (active && firstLoad) setLoading(false);
        firstLoad = false;
      }
    };

    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [fetchMessages, props, refreshKey, selectedPlayerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');

    try {
      let message: ChatMessage;
      if (props.role === 'coach') {
        if (!selectedPlayerId) return;
        const { data, error: invokeError } = await supabase.functions.invoke<{ message?: ChatMessage; error?: string }>(
          'coach-chat',
          { body: { action: 'send', teamId: props.teamId, trainerCode: props.trainerCode, playerId: selectedPlayerId, body } },
        );
        if (invokeError) throw new Error(await edgeError(invokeError));
        if (data?.error || !data?.message) throw new Error(data?.error ?? 'Kunde inte skicka meddelandet.');
        message = data.message;
      } else {
        if (!props.canMessage) return;
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error('Logga in med din e-postinbjudan för att skriva till tränaren.');
        const { data, error: insertError } = await supabase
          .from('coach_player_messages')
          .insert({
            team_id: props.teamId,
            player_id: props.playerId,
            sender_id: user.id,
            sender_role: 'player',
            body,
          })
          .select('id, sender_role, body, created_at')
          .single();
        if (insertError) throw insertError;
        message = data as ChatMessage;
      }
      setMessages((current) => [...current, message]);
      setDraft('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Meddelandet kunde inte skickas.');
    } finally {
      setSending(false);
    }
  };

  const canUseChat = props.role === 'coach' || props.canMessage;
  const contactName = props.role === 'coach' ? selectedPlayer?.name ?? '' : 'Din tränare';

  return (
    <section className="mx-auto flex min-h-[min(680px,calc(100dvh-190px))] max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-4 sm:flex-nowrap sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eee9] text-[#234633]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold text-gray-950">{props.role === 'coach' ? 'Spelarmeddelanden' : contactName}</h2>
          <p className="text-xs text-gray-500">{props.role === 'coach' ? 'Privat samtal med en spelare' : 'Endast du och din tränare kan läsa samtalet'}</p>
        </div>
        {props.role === 'coach' && players.length > 0 && (
          <label className="w-full sm:w-52">
            <span className="sr-only">Välj spelare</span>
            <select
              aria-label="Välj spelare"
              value={selectedPlayerId}
              onChange={(event) => setSelectedPlayerId(event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#557461] focus:ring-2 focus:ring-[#557461]/15"
            >
              {players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          aria-label="Uppdatera meddelanden"
          title="Uppdatera meddelanden"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {!canUseChat ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <LockKeyhole className="h-8 w-8 text-gray-400" />
          <h3 className="mt-4 font-bold text-gray-900">Logga in med din spelarinbjudan</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">För att hålla varje samtal privat mellan dig och tränaren behöver du använda kontot från inbjudningsmejlet. Inloggning med lagkod har ingen personlig spelarkoppling.</p>
        </div>
      ) : (
        <>
          {error && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-5">{error}</p>}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f8f6] px-4 py-5 sm:px-6" aria-live="polite" aria-label="Meddelanden">
            {loading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#315c43]" /></div>
            ) : !selectedPlayer && props.role === 'coach' ? (
              <p className="py-12 text-center text-sm text-gray-500">Inga spelare finns i laget ännu.</p>
            ) : messages.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">Inga meddelanden ännu. Skriv det första meddelandet.</p>
            ) : messages.map((message) => {
              const isOwn = message.sender_role === props.role;
              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%] ${isOwn ? 'rounded-br-md bg-[#234633] text-white' : 'rounded-bl-md border border-gray-200 bg-white text-gray-800'}`}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>
                    <p className={`mt-1 text-right text-[10px] ${isOwn ? 'text-white/65' : 'text-gray-400'}`}>
                      {new Date(message.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-gray-100 bg-white p-3 sm:gap-3 sm:p-4">
            <label htmlFor="chat-message" className="sr-only">Skriv ett meddelande</label>
            <textarea
              id="chat-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Skriv ett meddelande..."
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-y rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-[#557461] focus:ring-2 focus:ring-[#557461]/15"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending || (props.role === 'coach' && !selectedPlayerId)}
              aria-label="Skicka meddelande"
              title="Skicka meddelande"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#234633] text-white transition hover:bg-[#183525] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </>
      )}
    </section>
  );
}