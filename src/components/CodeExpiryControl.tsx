import { useState } from 'react';
import { Calendar, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ExpiryPreset = 'never' | '1d' | '3d' | '1w' | '2w' | '1m' | '3m' | 'custom';

const PRESETS: { key: ExpiryPreset; label: string; days: number | null }[] = [
  { key: 'never', label: 'Aldrig', days: null },
  { key: '1d', label: '1 dag', days: 1 },
  { key: '3d', label: '3 dagar', days: 3 },
  { key: '1w', label: '1 vecka', days: 7 },
  { key: '2w', label: '2 veckor', days: 14 },
  { key: '1m', label: '1 månad', days: 30 },
  { key: '3m', label: '3 månader', days: 90 },
];

function toLocalDateInput(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function CodeExpiryControl({
  teamId,
  codeExpiresAt,
  onSaved,
}: {
  teamId: string;
  codeExpiresAt: string | null;
  onSaved: (expiresAt: string | null) => void;
}) {
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>(codeExpiresAt ? 'custom' : 'never');
  const [customDate, setCustomDate] = useState(codeExpiresAt ? toLocalDateInput(new Date(codeExpiresAt)) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveExpiry = async (value: string | null) => {
    setSaving(true);
    setError(null);
    const { error: saveError } = await supabase.from('teams').update({ code_expires_at: value }).eq('id', teamId);
    if (saveError) {
      console.error('Error saving code expiry:', saveError);
      setError('Kunde inte spara. Försök igen.');
      setSaving(false);
      return;
    }
    onSaved(value);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const applyPreset = (preset: ExpiryPreset) => {
    setExpiryPreset(preset);
    setError(null);
    if (preset === 'never') {
      setCustomDate('');
      void saveExpiry(null);
      return;
    }
    const match = PRESETS.find((item) => item.key === preset);
    if (match?.days) {
      const date = new Date();
      date.setDate(date.getDate() + match.days);
      date.setHours(23, 59, 0, 0);
      setCustomDate(toLocalDateInput(date));
      void saveExpiry(date.toISOString());
    }
  };

  const applyCustomDate = () => {
    if (!customDate) {
      setError('Välj ett datum och tid.');
      return;
    }
    const date = new Date(customDate);
    if (date.getTime() <= Date.now()) {
      setError('Datumet måste ligga i framtiden.');
      return;
    }
    setExpiryPreset('custom');
    void saveExpiry(date.toISOString());
  };

  const isExpired = codeExpiresAt ? new Date(codeExpiresAt).getTime() <= Date.now() : false;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <Calendar className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-black">Kodens giltighetstid</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">Ställ in hur länge spelar- och tränarkoden ska fungera.</p>
      {codeExpiresAt ? (
        <div className={`flex items-center gap-2 rounded-lg p-2.5 mb-3 ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
          <Clock className={`w-4 h-4 flex-shrink-0 ${isExpired ? 'text-red-500' : 'text-gray-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${isExpired ? 'text-red-600' : 'text-black'}`}>{isExpired ? 'Koderna har löpt ut' : 'Giltig tills'}</p>
            <p className="text-xs text-gray-500 truncate">{new Date(codeExpiresAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <button onClick={() => { setExpiryPreset('never'); setCustomDate(''); void saveExpiry(null); }} disabled={saving} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors px-1">
            <X className="w-3 h-3" /> Ta bort
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-2.5 mb-3">
          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          <p className="text-xs font-medium text-green-700">Koden gäller tills vidare</p>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((preset) => (
          <button key={preset.key} onClick={() => applyPreset(preset.key)} disabled={saving} className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors disabled:opacity-50 ${expiryPreset === preset.key ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input type="datetime-local" value={customDate} onChange={(event) => { setCustomDate(event.target.value); setExpiryPreset('custom'); }} disabled={saving} className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent" />
        <button onClick={applyCustomDate} disabled={saving || !customDate} className="flex items-center justify-center gap-1.5 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
          Spara datum
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
      {saved && <p className="text-xs text-green-600 mt-2 flex items-center gap-1 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Giltighetstid uppdaterad!</p>}
    </div>
  );
}
