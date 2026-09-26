import { useEffect, useState, useCallback } from 'react';
import {
  Moon,
  Zap,
  Heart,
  Brain,
  Dumbbell,
  Send,
  Loader2,
  CheckCircle2,
  LogIn,
  LogOut,
  ListChecks,
  Star,
  ArrowLeft,
  TrendingUp,
  ChevronRight,
  ArrowLeft as BackArrow,
  Home,
  Target,
  CalendarDays,
  BarChart3,
} from 'lucide-react';
import { supabase, type Player, type Question, type Team, type AppSettings, type WellbeingEntry, WELLBEING_METRICS } from '@/lib/supabase';

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

const METRIC_COLORS: Record<string, string> = {
  sleep: '#4f46e5',
  energy: '#f59e0b',
  mood: '#ec4899',
  stress: '#ef4444',
  soreness: '#10b981',
};

type View = 'team-login' | 'player-login' | 'hub' | 'survey' | 'wellbeing' | 'survey-done' | 'wellbeing-done';
type PlayerSection = 'dashboard' | 'iup' | 'training' | 'status' | 'development';

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function PlayerPortal() {
  const [team, setTeam] = useState<Team | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [view, setView] = useState<View>('team-login');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ weekly_survey_required: 1, weekly_wellbeing_required: 1 });
  const [weeklySurveyCount, setWeeklySurveyCount] = useState(0);
  const [weeklyWellbeingCount, setWeeklyWellbeingCount] = useState(0);
  const [recentWellbeing, setRecentWellbeing] = useState<WellbeingEntry[]>([]);
  const [section, setSection] = useState<PlayerSection>('dashboard');
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async (playerId: string) => {
    const weekStart = startOfWeek(new Date()).toISOString();
    const [{ count: sCount }, { count: wCount }] = await Promise.all([
      supabase
        .from('responses')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', playerId)
        .eq('team_id', team!.id)
        .gte('created_at', weekStart),
      supabase
        .from('wellbeing_entries')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', playerId)
        .eq('team_id', team!.id)
        .gte('created_at', weekStart),
    ]);
    setWeeklySurveyCount(sCount ?? 0);
    setWeeklyWellbeingCount(wCount ?? 0);
  }, [team]);

  const fetchRecentWellbeing = useCallback(async (playerId: string) => {
    if (!team) return;
    const { data } = await supabase
      .from('wellbeing_entries')
      .select('*')
      .eq('player_id', playerId)
      .eq('team_id', team.id)
      .order('created_at', { ascending: false })
      .limit(7);
    setRecentWellbeing((data || []) as WellbeingEntry[]);
  }, [team]);

  const loadData = useCallback(async () => {
    if (!team) return;
    const [{ data: qData }, { data: sData }] = await Promise.all([
      supabase.from('questions').select('*').eq('team_id', team.id).order('order_index', { ascending: true }),
      supabase.from('team_settings').select('*').eq('team_id', team.id).maybeSingle(),
    ]);
    setQuestions((qData || []) as Question[]);
    if (sData) setSettings(sData as AppSettings);
  }, [team]);

  useEffect(() => {
    if (team) {
      (async () => {
        await loadData();
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, [loadData, team]);

  const handleLogout = () => {
    setPlayer(null);
    setView('player-login');
  };

  const handleTeamLogout = () => {
    setTeam(null);
    setPlayer(null);
    setView('team-login');
  };

  const refreshAfterSubmit = async () => {
    if (player) await Promise.all([fetchProgress(player.id), fetchRecentWellbeing(player.id)]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  // TEAM LOGIN
  if (view === 'team-login' || (!team && view !== 'player-login')) {
    return (
      <TeamLoginScreen
        onTeamFound={async (t) => {
          setTeam(t);
          setView('player-login');
        }}
      />
    );
  }

  // PLAYER LOGIN
  if (view === 'player-login' || !player) {
    return (
      <PlayerLoginScreen
        team={team!}
        onLogin={async (p) => {
          setPlayer(p);
          await Promise.all([fetchProgress(p.id), fetchRecentWellbeing(p.id)]);
          setSection('dashboard');
          setView('hub');
        }}
        onBack={handleTeamLogout}
      />
    );
  }

  // SURVEY DONE
  if (view === 'survey-done') {
    return (
      <DoneScreen
        title={`Tack, ${player.name}!`}
        message="Dina svar har skickats in till tränaren."
        onBack={() => {
          refreshAfterSubmit();
          setView('hub');
        }}
      />
    );
  }

  // WELLBEING DONE
  if (view === 'wellbeing-done') {
    return (
      <DoneScreen
        title={`Tack, ${player.name}!`}
        message="Din välmående-rapport har skickats in."
        onBack={() => {
          refreshAfterSubmit();
          setView('hub');
        }}
      />
    );
  }

  // SURVEY FORM
  if (view === 'survey') {
    return (
      <SurveyForm
        player={player}
        teamId={team!.id}
        questions={questions}
        onBack={() => setView('hub')}
        onSubmitted={() => setView('survey-done')}
      />
    );
  }

  // WELLBEING FORM
  if (view === 'wellbeing') {
    return (
      <WellbeingForm
        player={player}
        teamId={team!.id}
        onBack={() => setView('hub')}
        onSubmitted={() => setView('wellbeing-done')}
      />
    );
  }

  // PLAYER WORKSPACE
  const surveyTarget = settings.weekly_survey_required;
  const surveyComplete = weeklySurveyCount >= surveyTarget;
  const surveyPct = surveyTarget > 0 ? Math.min((weeklySurveyCount / surveyTarget) * 100, 100) : 100;

  const wbTarget = settings.weekly_wellbeing_required;
  const wbComplete = weeklyWellbeingCount >= wbTarget;
  const wbPct = wbTarget > 0 ? Math.min((weeklyWellbeingCount / wbTarget) * 100, 100) : 100;

  const latestWellbeing = recentWellbeing[0];
  const sections: { id: PlayerSection; label: string; icon: typeof Home }[] = [
    { id: 'dashboard', label: 'Översikt', icon: Home },
    { id: 'iup', label: 'Min IUP', icon: Target },
    { id: 'training', label: 'Träning', icon: CalendarDays },
    { id: 'status', label: 'Min status', icon: Heart },
    { id: 'development', label: 'Utveckling', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6f2]">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="h-[72px] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#172b22] flex items-center justify-center">
                <ShieldIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-gray-950">Triva</h1>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{team!.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-gray-800">{player.name}</p>
                <p className="text-xs text-gray-400">{player.position || 'Spelare'}</p>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Logga ut"
                title="Logga ut"
                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-950 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <nav aria-label="Huvudmeny" className="flex gap-1 overflow-x-auto -mb-px">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={section === id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${section === id ? 'border-[#315c43] text-[#234633]' : 'border-transparent text-gray-500 hover:text-gray-900'}`}
              >
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-7 sm:px-6 sm:py-9">
        {section === 'dashboard' && (
          <>
            <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#557461]">{new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <h2 className="mt-1 text-3xl font-extrabold text-gray-950">Hej {player.name.split(' ')[0]}</h2>
                <p className="mt-1 text-sm text-gray-500">Små steg i vardagen bygger din utveckling.</p>
              </div>
              <button onClick={() => setSection('iup')} className="inline-flex items-center gap-2 self-start rounded-lg bg-[#234633] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#183525] transition-colors">
                <Target className="w-4 h-4" /> Se min utvecklingsplan
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <section className="rounded-xl bg-[#234633] p-5 text-white sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-green-100/70">Nästa steg</p>
                    <h3 className="mt-3 max-w-lg text-xl font-bold">Din personliga utvecklingsplan börjar här</h3>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-green-50/75">Samla mål, träning, återhämtning och reflektion på ett ställe. Be din tränare lägga in ditt första mål.</p>
                  </div>
                  <Target className="hidden h-8 w-8 shrink-0 text-[#b5d0aa] sm:block" />
                </div>
                <button onClick={() => setSection('iup')} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-green-100">
                  Öppna Min IUP <ChevronRight className="w-4 h-4" />
                </button>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Morgonstatus</p>
                    <h3 className="mt-1 text-base font-bold text-gray-900">{latestWellbeing ? 'Senaste rapport' : 'Hur känns kroppen idag?'}</h3>
                  </div>
                  <Heart className="h-5 w-5 text-[#557461]" />
                </div>
                {latestWellbeing ? (
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    {WELLBEING_METRICS.map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-500">{label}</span><span className="font-bold text-gray-900">{latestWellbeing[key]}/5</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 text-sm text-gray-500">Ingen status registrerad ännu.</p>}
                <button onClick={() => setView('wellbeing')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#315c43] hover:text-[#172b22]">
                  {wbComplete ? 'Visa eller uppdatera status' : 'Registrera status'} <ChevronRight className="w-4 h-4" />
                </button>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Den här veckan</p>
                    <h3 className="mt-1 text-base font-bold text-gray-900">Dina uppföljningar</h3>
                  </div>
                  <button onClick={() => setSection('status')} className="text-sm font-semibold text-[#315c43] hover:underline">Visa status</button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ProgressRing icon={<ListChecks className="w-5 h-5" />} label="Spelarenkät" done={Math.min(weeklySurveyCount, surveyTarget)} target={surveyTarget} pct={surveyPct} complete={surveyComplete} />
                  <ProgressRing icon={<Heart className="w-5 h-5" />} label="Välmående" done={Math.min(weeklyWellbeingCount, wbTarget)} target={wbTarget} pct={wbPct} complete={wbComplete} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ActionCard onClick={() => setView('survey')} disabled={questions.length === 0} icon={<ListChecks className="w-6 h-6" />} title="Spelarenkät" subtitle={questions.length === 0 ? 'Inga frågor just nu' : surveyComplete ? 'Klar för denna vecka' : `${surveyTarget - weeklySurveyCount} inlämning(ar) kvar`} complete={surveyComplete && questions.length > 0} />
                  <ActionCard onClick={() => setView('wellbeing')} icon={<Heart className="w-6 h-6" />} title="Välmående" subtitle={wbComplete ? 'Klar för denna vecka' : `${wbTarget - weeklyWellbeingCount} rapport(er) kvar`} complete={wbComplete} />
                </div>
              </section>
            </div>
          </>
        )}

        {section === 'iup' && <EmptyPlanningSection icon={<Target className="w-6 h-6" />} eyebrow="Min IUP" title="Din personliga utvecklingskarta" description="Här samlas karriärmål, utvecklingsområden och konkreta fotbollsaktioner. Be tränaren lägga in din plan så kan ni följa arbetet tillsammans." />}
        {section === 'training' && <EmptyPlanningSection icon={<CalendarDays className="w-6 h-6" />} eyebrow="Träning & belastning" title="Träningen kopplas till dina mål" description="Planerade pass, genomförd tid, faktisk belastning och berörda utvecklingsområden visas här när tränaren har lagt upp träningsplanen." />}
        {section === 'status' && (
          <div className="max-w-3xl">
            <SectionHeading icon={<Heart className="w-5 h-5" />} eyebrow="Min status" title="Återhämtning börjar med en enkel check-in" description="Registrera sömn, energi, sinneslag, stress och stelhet. Det tar ungefär en minut." />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <button onClick={() => setView('wellbeing')} className="flex min-h-36 flex-col items-start justify-between rounded-xl bg-[#234633] p-5 text-left text-white hover:bg-[#183525] transition-colors">
                <Heart className="h-6 w-6 text-[#b5d0aa]" />
                <span><span className="block font-bold">{wbComplete ? 'Uppdatera dagens status' : 'Fyll i morgonstatus'}</span><span className="mt-1 block text-sm text-green-50/70">Sömn · energi · sinneslag · stress · stelhet</span></span>
              </button>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Senaste registrering</p>
                {latestWellbeing ? <>
                  <p className="mt-1 font-bold text-gray-900">{new Date(latestWellbeing.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}</p>
                  <div className="mt-4 space-y-2">{WELLBEING_METRICS.map(({ key, label }) => <MetricBar key={key} label={label} value={latestWellbeing[key]} />)}</div>
                </> : <p className="mt-2 text-sm text-gray-500">Dina rapporter visas här när du har skickat in en status.</p>}
              </div>
            </div>
          </div>
        )}
        {section === 'development' && (
          <div className="max-w-3xl">
            <SectionHeading icon={<BarChart3 className="w-5 h-5" />} eyebrow="Utveckling" title="Följ arbetet över tid" description="Mål, träningsinsatser, återhämtning och reflektion hör ihop. Din utvecklingsbild blir komplett när IUP och träning finns upplagda." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {['Teknik', 'Spelförståelse', 'Fysik', 'Psykologi'].map((area) => (
                <div key={area} className="rounded-xl border border-gray-200 bg-white p-5">
                  <p className="font-bold text-gray-900">{area}</p><p className="mt-2 text-sm text-gray-500">Ingen bedömning registrerad ännu</p>
                  <div className="mt-4 h-1.5 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#315c43]" /><h3 className="font-bold text-gray-900">Återhämtning</h3></div>
              <p className="mt-2 text-sm text-gray-500">{recentWellbeing.length ? `${recentWellbeing.length} statusrapport(er) finns registrerade.` : 'Statushistorik visas när du har registrerat din första check-in.'}</p>
              {recentWellbeing.length > 0 && <div className="mt-4 space-y-3">{(['sleep', 'energy', 'stress', 'soreness'] as const).map((key) => <MetricTrend key={key} label={WELLBEING_METRICS.find((metric) => metric.key === key)!.label} entries={recentWellbeing} metric={key} />)}</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SectionHeading({ icon, eyebrow, title, description }: { icon: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return <div><div className="flex items-center gap-2 text-[#315c43]">{icon}<p className="text-xs font-bold uppercase tracking-wider">{eyebrow}</p></div><h2 className="mt-3 text-2xl font-extrabold text-gray-950">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{description}</p></div>;
}

function EmptyPlanningSection({ icon, eyebrow, title, description }: { icon: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return <div className="max-w-3xl"><SectionHeading icon={icon} eyebrow={eyebrow} title={title} description={description} /><div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 sm:p-8"><p className="text-sm font-semibold text-gray-700">Ingen plan upplagd ännu</p><p className="mt-1 text-sm leading-6 text-gray-500">När innehållet är på plats visas det här tillsammans med din utvecklingshistorik.</p></div></div>;
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-1 flex justify-between text-xs"><span className="text-gray-500">{label}</span><span className="font-bold text-gray-800">{value}/5</span></div><div className="h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-[#557461]" style={{ width: `${Math.max(0, Math.min(value, 5)) * 20}%` }} /></div></div>;
}

function MetricTrend({ label, entries, metric }: { label: string; entries: WellbeingEntry[]; metric: 'sleep' | 'energy' | 'stress' | 'soreness' }) {
  const values = [...entries].reverse().map((entry) => entry[metric]);
  const first = values[0];
  const last = values[values.length - 1];
  const direction = last > first ? 'Stiger' : last < first ? 'Sjunker' : 'Stabil';
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="w-24 text-gray-500">{label}</span><div className="flex flex-1 items-end gap-1" aria-label={`${label}: ${values.join(', ')}`}>
    {values.map((value, index) => <div key={`${index}-${value}`} className="flex-1 rounded-t bg-[#86a38d]" style={{ height: `${Math.max(8, value * 7)}px` }} />)}
  </div><span className="w-14 text-right text-xs font-semibold text-gray-600">{direction}</span></div>;
}

// --- TEAM LOGIN SCREEN ---

function TeamLoginScreen({ onTeamFound }: { onTeamFound: (team: Team) => void }) {
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const [expired, setExpired] = useState(false);

  const handleLogin = async () => {
    if (!codeInput.trim() || loading) return;
    setLoading(true);
    setError(false);
    setExpired(false);
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('join_code', codeInput.trim().toUpperCase())
      .maybeSingle();
    if (error || !data) {
      setError(true);
      setLoading(false);
      return;
    }
    const team = data as Team;
    if (team.code_expires_at && new Date(team.code_expires_at).getTime() <= Date.now()) {
      setExpired(true);
      setLoading(false);
      return;
    }
    setLoading(false);
    onTeamFound(team);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 bg-black rounded-3xl rotate-6 opacity-10" />
          <div className="absolute inset-0 bg-black rounded-3xl flex items-center justify-center shadow-xl ring-4 ring-black/5">
            <ShieldIcon className="w-10 h-10" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-black tracking-tight mb-1">Triva</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Ange din lagkod för att hitta ditt lag.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Lagkod</label>
        <input
          value={codeInput}
          onChange={(e) => {
            setCodeInput(e.target.value.toUpperCase());
            setError(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="T.ex. OU17S2"
          className={`w-full border rounded-xl px-4 py-3 text-sm text-center tracking-widest font-mono font-bold focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-colors uppercase ${
            error ? 'border-red-400' : 'border-gray-300'
          }`}
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
            Ogiltig lagkod. Kontrollera med din tränare.
          </p>
        )}
        {expired && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-600 font-medium">
              Lagkoden har löpt ut. Be din tränare förnya koden.
            </p>
          </div>
        )}
        <button
          onClick={handleLogin}
          disabled={!codeInput.trim() || loading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5" /> Fortsätt
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// --- PLAYER LOGIN SCREEN ---

function PlayerLoginScreen({
  team,
  onLogin,
  onBack,
}: {
  team: Team;
  onLogin: (player: Player) => void;
  onBack: () => void;
}) {
  const [nameInput, setNameInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(false);

  const handleLogin = async () => {
    if (!nameInput.trim() || loginLoading) return;
    setLoginLoading(true);
    setLoginError(false);
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .ilike('name', nameInput.trim())
      .maybeSingle();
    if (error || !data) {
      setLoginError(true);
      setLoginLoading(false);
      return;
    }
    setLoginLoading(false);
    onLogin(data as Player);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12 sm:px-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-black transition-colors mb-6"
      >
        <BackArrow className="w-4 h-4" /> Byt lag
      </button>

      <div className="mb-8 text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 bg-black rounded-3xl rotate-6 opacity-10" />
          <div className="absolute inset-0 bg-black rounded-3xl flex items-center justify-center shadow-xl ring-4 ring-black/5">
            <ShieldIcon className="w-10 h-10" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-black tracking-tight mb-1">Triva</h1>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          {team.name}
        </p>
        <p className="text-gray-500 text-sm leading-relaxed">
          Logga in med ditt namn för att svara på enkät och rapportera välmående.
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
          className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-colors ${
            loginError ? 'border-red-400' : 'border-gray-300'
          }`}
          autoFocus
        />
        {loginError && (
          <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
            Inget namn hittades. Kontrollera stavningen eller kontakta tränaren.
          </p>
        )}
        <button
          onClick={handleLogin}
          disabled={!nameInput.trim() || loginLoading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
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

// --- PROGRESS RING ---

function ProgressRing({
  icon,
  label,
  done,
  target,
  pct,
  complete,
}: {
  icon: React.ReactNode;
  label: string;
  done: number;
  target: number;
  pct: number;
  complete: boolean;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col items-center">
      <div className="relative w-20 h-20 mb-2">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={complete ? '#10b981' : '#000000'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {complete ? (
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          ) : (
            <span className="text-sm font-bold text-black">{done}/{target}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">{icon}</span>
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      {complete ? (
        <p className="text-xs text-green-600 mt-0.5">Klar!</p>
      ) : (
        <p className="text-xs text-gray-400 mt-0.5">{target - done} kvar</p>
      )}
    </div>
  );
}

// --- ACTION CARD ---

function ActionCard({
  onClick,
  disabled,
  icon,
  title,
  subtitle,
  complete,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  complete?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-black hover:shadow-lg hover:-translate-y-0.5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm group"
    >
      <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-bold text-black text-base">{title}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {complete ? (
        <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        </div>
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
      )}
    </button>
  );
}

// --- DONE SCREEN ---

function DoneScreen({
  title,
  message,
  onBack,
}: {
  title: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 text-center">
      <div className="relative w-24 h-24 mx-auto mb-6">
        <div className="absolute inset-0 bg-green-500 rounded-full opacity-10 animate-ping" />
        <div className="relative w-24 h-24 rounded-full bg-black flex items-center justify-center shadow-xl">
          <CheckCircle2 className="w-14 h-14 text-white" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-black mb-2">{title}</h1>
      <p className="text-gray-500 mb-8">{message}</p>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black font-medium transition-colors bg-white border border-gray-200 px-4 py-2.5 rounded-xl hover:shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Tillbaka till portalen
      </button>
    </div>
  );
}

// --- SURVEY FORM ---

function SurveyForm({
  player,
  teamId,
  questions,
  onBack,
  onSubmitted,
}: {
  player: Player;
  teamId: string;
  questions: Question[];
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setAnswer = (qid: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: val }));
  };

  const allAnswered = questions.every((q) => answers[q.id] && answers[q.id].trim());
  const answeredCount = questions.filter((q) => answers[q.id] && answers[q.id].trim()).length;

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    const { data: respData, error: respError } = await supabase
      .from('responses')
      .insert({ player_id: player.id, player_name: player.name, team_id: teamId })
      .select()
      .single();
    if (respError) {
      console.error('Error creating response:', respError);
      setSubmitting(false);
      return;
    }
    const answerRows = questions.map((q) => ({
      response_id: respData.id,
      question_id: q.id,
      answer_text: answers[q.id],
    }));
    const { error: ansError } = await supabase.from('answers').insert(answerRows);
    if (ansError) {
      console.error('Error saving answers:', ansError);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSubmitted();
  };

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        <BackBar onBack={onBack} title="Spelarenkät" />
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Det finns inga frågor att besvara just nu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <BackBar onBack={onBack} title="Spelarenkät" />

      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-black rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
          {answeredCount}/{questions.length}
        </span>
      </div>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div
            key={q.id}
            className={`bg-white rounded-2xl border p-5 shadow-sm transition-colors ${
              answers[q.id] && answers[q.id].trim() ? 'border-black/20' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <div className="flex-1 pt-0.5">
                <p className="font-medium text-black">{q.text}</p>
              </div>
              {answers[q.id] && answers[q.id].trim() && (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
            </div>
            <div className="pl-11">
              {q.type === 'text' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="Skriv ditt svar här..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none transition-colors"
                />
              )}
              {q.type === 'rating' && (
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAnswer(q.id, String(n))}
                      className="group transition-transform hover:scale-110 active:scale-95"
                    >
                      <Star
                        className={`w-9 h-9 transition-colors ${
                          n <= parseInt(answers[q.id] || '0')
                            ? 'fill-black text-black'
                            : 'text-gray-200 group-hover:text-gray-400'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-sm text-gray-400 ml-2 font-medium">
                    {answers[q.id] ? `${answers[q.id]}/5` : ''}
                  </span>
                </div>
              )}
              {q.type === 'choice' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, idx) => (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition-all ${
                        answers[q.id] === opt
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                        className="accent-black"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Send className="w-5 h-5" /> Skicka in svar
          </>
        )}
      </button>
      {!allAnswered && (
        <p className="text-center text-sm text-gray-400 mt-3">
          Besvara alla frågor för att skicka in.
        </p>
      )}
    </div>
  );
}

// --- WELLBEING FORM ---

function WellbeingForm({
  player,
  teamId,
  onBack,
  onSubmitted,
}: {
  player: Player;
  teamId: string;
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const allRated = WELLBEING_METRICS.every((m) => values[m.key] != null);
  const ratedCount = WELLBEING_METRICS.filter((m) => values[m.key] != null).length;

  const handleSubmit = async () => {
    if (!allRated || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from('wellbeing_entries').insert({
      player_id: player.id,
      team_id: teamId,
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
    onSubmitted();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
      <BackBar onBack={onBack} title="Välmående" />

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 font-bold text-sm">
          {player.jersey_number != null ? player.jersey_number : <Heart className="w-5 h-5" />}
        </div>
        <p className="text-gray-600 text-sm">
          Hej <span className="font-semibold text-black">{player.name}</span>! Hur mår du idag?
        </p>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-black rounded-full transition-all duration-300"
            style={{ width: `${(ratedCount / WELLBEING_METRICS.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
          {ratedCount}/{WELLBEING_METRICS.length}
        </span>
      </div>

      <div className="space-y-4">
        {WELLBEING_METRICS.map((m) => {
          const Icon = METRIC_ICONS[m.key];
          const val = values[m.key];
          const color = METRIC_COLORS[m.key];
          return (
            <div
              key={m.key}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                val != null ? 'border-black/20' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-black">{m.label}</p>
                  <p className="text-xs text-gray-400">{METRIC_HINTS[m.key]}</p>
                </div>
                {val != null && (
                  <span className="text-sm font-bold text-black">{val}/5</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setValue(m.key, n)}
                    className={`flex-1 h-11 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                      val === n
                        ? 'border-black bg-black text-white shadow-sm'
                        : 'border-gray-200 text-gray-400 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Övrigt <span className="text-gray-400">(frivilligt)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Något tränaren bör veta?"
            rows={2}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none transition-colors"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allRated || submitting}
        className="mt-6 w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
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

// --- SHARED COMPONENTS ---

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className={className}>
      <path d="M12 2L3 6v6c0 5 3.8 9.5 9 11 5.2-1.5 9-6 9-11V6l-9-4z" strokeLinejoin="round" />
    </svg>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-black font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Tillbaka
      </button>
      {title && <span className="text-gray-300">·</span>}
      {title && <h2 className="text-lg font-bold text-black">{title}</h2>}
    </div>
  );
}
