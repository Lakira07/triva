import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, CheckCircle2, ListChecks, Heart } from 'lucide-react';
import { supabase, type AppSettings } from '@/lib/supabase';

export default function SettingsView({ teamId }: { teamId: string }) {
  const [surveyRequired, setSurveyRequired] = useState(1);
  const [wellbeingRequired, setWellbeingRequired] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('team_settings')
        .select('*')
        .eq('team_id', teamId)
        .maybeSingle();
      if (error) {
        console.error('Error fetching settings:', error);
        setLoading(false);
        return;
      }
      if (data) {
        const s = data as AppSettings;
        setSurveyRequired(s.weekly_survey_required);
        setWellbeingRequired(s.weekly_wellbeing_required);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-5 h-5 text-gray-400" />
        <h3 className="font-semibold text-black">Inställningar</h3>
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
  );
}
