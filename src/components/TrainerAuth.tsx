import { useState } from 'react';
import { Shield, Loader2, LogIn, ArrowLeft, AlertCircle, KeyRound, Mail } from 'lucide-react';
import { supabase, type Team } from '@/lib/supabase';

interface TrainerAuthProps {
  onAuthed: (team: Team) => void;
  onBack: () => void;
}

export default function TrainerAuth({ onAuthed, onBack }: TrainerAuthProps) {
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCodeLogin = async () => {
    if (!codeInput.trim() || loading) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('trainer_code', codeInput.trim().toUpperCase())
      .maybeSingle();
    if (error || !data) {
      setError('Ogiltig tränarkod. Kontrollera koden och försök igen.');
      setLoading(false);
      return;
    }
    setLoading(false);
    onAuthed(data as Team);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-semibold text-gray-400 hover:text-black transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Tillbaka
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 ring-4 ring-black/5 shadow-elevated">
            <Shield className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl text-heading text-black mb-1">Tränarinloggning</h1>
          <p className="text-sm text-gray-500 font-medium">
            Logga in med din tränarkod
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-card">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Tränarkod</label>
              <input
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCodeLogin()}
                placeholder="T.ex. 76C26F"
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base text-center tracking-widest font-mono font-extrabold focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent uppercase"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1.5 font-medium">
                Ange koden du fick från administratören.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-500 flex items-start gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </p>
            )}
            <button
              onClick={handleCodeLogin}
              disabled={loading || !codeInput.trim()}
              className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-3.5 rounded-xl text-sm font-bold transition-all hover:shadow-elevated"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <KeyRound className="w-5 h-5" strokeWidth={2.5} /> Logga in
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-900">Saknar du en kod?</p>
              <p className="text-xs text-blue-700 mt-0.5 font-medium">
                Kontakta administratören på lakirasasnima2007@gmail.com för att få en tränarkod till ditt lag.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
