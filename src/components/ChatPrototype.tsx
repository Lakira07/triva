import { FormEvent, useState } from 'react';
import { MessageCircle, Send, ShieldAlert } from 'lucide-react';

type ChatRole = 'coach' | 'athlete';

interface ChatMessage {
  id: number;
  sender: ChatRole;
  text: string;
  time: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 1, sender: 'coach', text: 'Hej! Hur kändes träningen idag?', time: '15:42' },
  { id: 2, sender: 'athlete', text: 'Bra, men jag blev lite trött mot slutet.', time: '15:46' },
  { id: 3, sender: 'coach', text: 'Tack för att du säger till. Vi kan prata mer före nästa pass.', time: '15:48' },
];

export default function ChatPrototype({ role }: { role: ChatRole }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const ownRole = role;
  const contactName = role === 'coach' ? 'Demo-spelare' : 'Demo-tränare';

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), sender: ownRole, text, time: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setDraft('');
  };

  return (
    <section className="mx-auto flex min-h-[min(680px,calc(100dvh-190px))] max-w-3xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eee9] text-[#234633]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-bold text-gray-950">{contactName}</h2>
          <p className="text-xs text-gray-500">Exempelkonversation</p>
        </div>
        <span className="ml-auto shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800">PROTOTYP</span>
      </header>

      <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950 sm:px-5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Meddelanden skickas inte och sparas inte. Det här är bara en förhandsvisning av chatten.</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7f8f6] px-4 py-5 sm:px-6" aria-live="polite" aria-label="Exempelmeddelanden">
        <p className="mx-auto w-fit rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-gray-400 shadow-sm">Idag</p>
        {messages.map((message) => {
          const isOwn = message.sender === ownRole;
          return (
            <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%] ${isOwn ? 'rounded-br-md bg-[#234633] text-white' : 'rounded-bl-md border border-gray-200 bg-white text-gray-800'}`}>
                <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.text}</p>
                <p className={`mt-1 text-right text-[10px] ${isOwn ? 'text-white/65' : 'text-gray-400'}`}>{message.time}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-gray-100 bg-white p-3 sm:gap-3 sm:p-4">
        <label htmlFor="chat-prototype-message" className="sr-only">Skriv ett meddelande</label>
        <textarea
          id="chat-prototype-message"
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
          disabled={!draft.trim()}
          aria-label="Skicka exempelmeddelande"
          title="Lägg till i prototypen"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#234633] text-white transition hover:bg-[#183525] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}