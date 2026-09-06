import { useState } from 'react';
import {
  Moon,
  Zap,
  Heart,
  Brain,
  Dumbbell,
  Send,
  Loader2,
  CheckCircle2,
  Users,
  LogIn,
  LogOut,
} from 'lucide-react';
import { supabase, type Player, WELLBEING_METRICS } from '@/lib/supabase';

const METRIC_ICONS: Record<string, typeof Moon> = {
  sleep: Moon,
  energy: Zap,
  mood: Heart,
  stress: Brain,
  soreness: Dumbbell,
};

const METRIC_HINTS: Record<string, string> = {
  sleep: 'Hur sov du i natt?',
  energy: 'Hur är din energinivå?',
  mood: 'Hur känner du dig allmänt?',
  stress: 'Hur stressad känner du dig?',
  soreness: 'Hur stel/ömm är du i musklerna?',
};

export default function WellbeingSubmitView() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);

  const [values, setValues] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleLogin = async () => {
    if (!nameInput.trim() || loginLoading) return;
    setLoginLoading(true);
    setLoginError(false);
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .ilike('name', nameInput.trim())
      .maybeSingle();
    if (error) {
      console.error('Error looking up player:', error);
      setLoginError(true);
      setLoginLoading(false);
      return;
    }
    if (!data) {
      setLoginError(true);
      setLoginLoading(false);
      return;
    }
    setPlayer(data as Player);
    setLoginLoading(false);
  };

  const handleLogout = () => {
    setPlayer(null);
    setNameInput('');
    setValues({});
    setNote('');
    setSubmitted(false);
  };

  const setValue = (key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const allRated = WELLBEING_METRICS.every((m) => values[m.key] != null);

  const handleSubmit = async () => {
    if (!player || !allRated || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from('wellbeing_entries').insert({
      player_id: player.id,
      sleep: values.sleep,
      energy: values.energy,
      mood: values.mood,
      stress: values.stress,
      soreness: values.soreness,
      note: note.trim() || null,
    });
    if (error) {
      console.error('Error saving wellbeing entry:', error);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-black mb-2">Tack, {player?.name}!</h1>
        <p className="text-gray-500 mb-6">Din välmående-rapport har skickats in till tränaren.</p>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-black transition-colors"
        >
          Logga ut
        </button>
      </div>
    );
  }

  // Step 1: Login with name
  if (!player) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 ring-2 ring-black/10">
            <Heart className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-black tracking-tight mb-1">Välmående</h1>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Österåker United · U2
          </p>
          <p className="text-gray-500 text-sm">
            Logga in med ditt namn för att rapportera ditt välmående.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Ditt namn</label>
          <input
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setLoginError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="T.ex. Anders Svensson"
            className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${
              loginError ? 'border-red-400' : 'border-gray-300'
            }`}
            autoFocus
          />
          {loginError && (
            <p className="text-sm text-red-500 mt-2">
              Inget namn hittades. Kontrollera stavningen eller kontakta tränaren.
            </p>
          )}
          <button
            onClick={handleLogin}
            disabled={!nameInput.trim() || loginLoading}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {loginLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" /> Logga in
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Inte registrerad? Be din tränare skapa en profil åt dig.
        </p>
      </div>
    );
  }

  // Step 2: Rate wellbeing
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center ring-2 ring-black/10">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black tracking-tight">Välmående</h1>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Österåker United · U2
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-black transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logga ut
          </button>
        </div>
        <p className="text-gray-500 ml-14">
          Hej {player.name}! Hur mår du idag?
        </p>
      </div>

      <div className="space-y-5">
        {WELLBEING_METRICS.map((m) => {
          const Icon = METRIC_ICONS[m.key];
          const val = values[m.key];
          return (
            <div key={m.key} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-black">{m.label}</p>
                  <p className="text-xs text-gray-400">{METRIC_HINTS[m.key]}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setValue(m.key, n)}
                    className={`flex-1 h-10 rounded-lg border-2 text-sm font-bold transition-colors ${
                      val === n
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Note */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Övrigt <span className="text-gray-400">(frivilligt)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Något tränaren bör veta?"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allRated || submitting}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" /> Skicka in
          </>
        )}
      </button>
      {!allRated && (
        <p className="text-center text-sm text-gray-400 mt-3">
          Sätt ett betyg på alla fem kategorier för att skicka.
        </p>
      )}
    </div>
  );
}
