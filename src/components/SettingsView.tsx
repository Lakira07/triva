import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, CheckCircle2, ListChecks, Heart, Calendar, Clock, X } from 'lucide-react';
import { supabase, type AppSettings } from '@/lib/supabase';

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

export default function SettingsView({ teamId }: { teamId: string }) {
  const [surveyRequired, setSurveyRequired] = useState(1);
  const [wellbeingRequired, setWellbeingRequired] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('never');
  const [customDate, setCustomDate] = useState('');
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [expirySaved, setExpirySaved] = useState(false);
  const [expiryError, setExpiryError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: teamData }, { data: sData }] = await Promise.all([
        supabase.from('teams').select('code_expires_at').eq('id', teamId).maybeSingle(),
        supabase.from('team_settings').select('*').eq('team_id', teamId).maybeSingle(),
      ]);

      if (sData) {
        const s = sData as AppSettings;
        setSurveyRequired(s.weekly_survey_required);
        setWellbeingRequired(s.weekly_wellbeing_required);
      }

      const expiresAt = (teamData as any)?.code_expires_at ?? null;
      setCodeExpiresAt(expiresAt);
      if (expiresAt) {
        const d = new Date(expiresAt);
        setCustomDate(toLocalDateInput(d));
        setExpiryPreset('custom');
      } else {
        setExpiryPreset('never');
      }

      setLoading(false);
    })();
  }, [teamId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('team_settings')
      .upsert({
        team_id: teamId,
        weekly_survey_required: surveyRequired,
        weekly_wellbeing_required: wellbeingRequired,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      console.error('Error saving settings:', error);
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const applyExpiryPreset = (preset: ExpiryPreset) => {
    setExpiryPreset(preset);
    setExpiryError(null);
    if (preset === 'never') {
      saveExpiry(null);
    } else {
      const match = PRESETS.find((p) => p.key === preset);
      if (match?.days) {
        const d = new Date();
        d.setDate(d.getDate() + match.days);
        d.setHours(23, 59, 0, 0);
        setCustomDate(toLocalDateInput(d));
        saveExpiry(d.toISOString());
      }
    }
  };

  const applyCustomDate = () => {
    if (!customDate) {
      setExpiryError('Välj ett datum och tid.');
      return;
    }
    const d = new Date(customDate);
    if (d.getTime() <= Date.now()) {
      setExpiryError('Datumet måste ligga i framtiden.');
      return;
    }
    setExpiryError(null);
    setExpiryPreset('custom');
    saveExpiry(d.toISOString());
  };

  const clearExpiry = () => {
    setExpiryPreset('never');
    setCustomDate('');
    saveExpiry(null);
  };

  const saveExpiry = async (value: string | null) => {
    setSavingExpiry(true);
    setExpiryError(null);
    const { error } = await supabase
      .from('teams')
      .update({ code_expires_at: value })
      .eq('id', teamId);
    if (error) {
      console.error('Error saving code expiry:', error);
      setExpiryError('Kunde inte spara. Försök igen.');
      setSavingExpiry(false);
      return;
    }
    setCodeExpiresAt(value);
    setSavingExpiry(false);
    setExpirySaved(true);
    setTimeout(() => setExpirySaved(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  const isExpired = codeExpiresAt ? new Date(codeExpiresAt).getTime() <= Date.now() : false;

  return (
    <div className="space-y-6">
      {/* Code expiry card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-black">Kodens giltighetstid</h3>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Ställ in hur länge spelarkoden och tränarkoden ska fungera. När tiden löper ut kan ingen logga in med koderna förrän du förlänger dem.
        </p>

        {/* Current status */}
        {codeExpiresAt ? (
          <div className={`flex items-center gap-3 rounded-xl p-3 mb-4 ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
            <Clock className={`w-5 h-5 flex-shrink-0 ${isExpired ? 'text-red-500' : 'text-gray-400'}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-black'}`}>
                {isExpired ? 'Koden har löpt ut' : 'Giltig tills'}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(codeExpiresAt).toLocaleDateString('sv-SE', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <button
              onClick={clearExpiry}
              disabled={savingExpiry}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors px-2 py-1"
            >
              <X className="w-3.5 h-3.5" /> Ta bort
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-3 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-sm font-medium text-green-700">Koden gäller tills vidare (ingen tidsgräns)</p>
          </div>
        )}

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyExpiryPreset(p.key)}
              disabled={savingExpiry}
              className={`px-3.5 py-2 rounded-xl border-2 text-sm font-bold transition-colors disabled:opacity-50 ${
                expiryPreset === p.key
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="datetime-local"
            value={customDate}
            onChange={(e) => {
              setCustomDate(e.target.value);
              setExpiryPreset('custom');
            }}
            disabled={savingExpiry}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
          <button
            onClick={applyCustomDate}
            disabled={savingExpiry || !customDate}
            className="flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
          >
            {savingExpiry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Spara datum
          </button>
        </div>

        {expiryError && (
          <p className="text-sm text-red-500 mt-2 font-medium">{expiryError}</p>
        )}
        {expirySaved && (
          <p className="text-sm text-green-600 mt-2 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Giltighetstid uppdaterad!
          </p>
        )}
      </div>

      {/* Weekly requirements card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-black">Veckokrav</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Ställ in hur ofta spelarna ska göra enkäten och rapportera välmående varje vecka.
        </p>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <ListChecks className="w-4 h-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-700">Enkätkrav per vecka</label>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Antal gånger varje spelare måste slutföra enkäten under en vecka (måndag–söndag).
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setSurveyRequired(n)}
                className={`w-12 h-12 rounded-xl border-2 text-sm font-bold transition-colors ${
                  surveyRequired === n
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-700">Välmåendekrav per vecka</label>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Antal gånger varje spelare måste rapportera sitt välmående under en vecka (måndag–söndag).
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setWellbeingRequired(n)}
                className={`w-12 h-12 rounded-xl border-2 text-sm font-bold transition-colors ${
                  wellbeingRequired === n
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Spara
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" /> Sparat!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
