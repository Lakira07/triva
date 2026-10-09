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
  MessageCircle,
} from 'lucide-react';
import { supabase, type Player, type Question, type Team, type AppSettings, type WellbeingEntry, type DevelopmentGoal, type Assessment, type TrainingSession, type TrainingCompletion, type TrainingAssignment, type DevelopmentArea, type IupQuarterlyPlan, type IupQuarterlyPlanChange, WELLBEING_METRICS, AREA_LABELS, SESSION_TYPE_LABELS } from '@/lib/supabase';
import IupChangeHistory from '@/components/IupChangeHistory';
import { SkillChecklist } from '@/components/PlayerDevelopmentView';
import ChatPrototype from '@/components/ChatPrototype';

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

type View = 'account-login' | 'team-login' | 'player-login' | 'hub' | 'survey' | 'wellbeing' | 'survey-done' | 'wellbeing-done';
type PlayerSection = 'dashboard' | 'iup' | 'training' | 'status' | 'development' | 'messages';

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
  const [view, setView] = useState<View>('account-login');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ weekly_survey_required: 1, weekly_wellbeing_required: 1 });
  const [weeklyWellbeingCount, setWeeklyWellbeingCount] = useState(0);
  const [recentWellbeing, setRecentWellbeing] = useState<WellbeingEntry[]>([]);
  const [section, setSection] = useState<PlayerSection>('dashboard');
  const [loading, setLoading] = useState(true);
  const [restoringAccount, setRestoringAccount] = useState(true);

  const fetchProgress = useCallback(async (playerId: string) => {
    const weekStart = startOfWeek(new Date()).toISOString();
    const { count: wCount } = await supabase
      .from('wellbeing_entries')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('team_id', team!.id)
      .gte('created_at', weekStart);
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
    let active = true;
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: link } = await supabase
            .from('player_auth_links')
            .select('player_id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (link) {
            const { data: linkedPlayer } = await supabase
              .from('players')
              .select('*')
              .eq('id', link.player_id)
              .maybeSingle();
            if (linkedPlayer?.team_id) {
              const { data: linkedTeam } = await supabase
                .from('teams')
                .select('*')
                .eq('id', linkedPlayer.team_id)
                .maybeSingle();
              if (active && linkedTeam) {
                setPlayer(linkedPlayer as Player);
                setTeam(linkedTeam as Team);
                setView('hub');
              }
            }
          }
        }
      } finally {
        if (active) setRestoringAccount(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (restoringAccount) return;
    if (team) {
      (async () => {
        await loadData();
        setLoading(false);
      })();
    } else {
      setLoading(false);
    }
  }, [loadData, restoringAccount, team]);

  useEffect(() => {
    if (!player || !team) return;
    void Promise.all([fetchProgress(player.id), fetchRecentWellbeing(player.id)]);
  }, [fetchProgress, fetchRecentWellbeing, player, team]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTeam(null);
    setPlayer(null);
    setView('account-login');
  };

  const handleTeamLogout = () => {
    setTeam(null);
    setPlayer(null);
    setView('account-login');
  };

  const handleAccountLogin = async (email: string, password: string): Promise<string | null> => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return 'Kunde inte logga in. Kontrollera e-post och lösenord.';
    }

    const { data: link, error: linkError } = await supabase
      .from('player_auth_links')
      .select('player_id')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (linkError || !link) {
      await supabase.auth.signOut();
      setLoading(false);
      return 'Kontot är inte kopplat till en spelare. Be tränaren skicka en inbjudan.';
    }

    const { data: linkedPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('id', link.player_id)
      .maybeSingle();
    if (!linkedPlayer?.team_id) {
      await supabase.auth.signOut();
      setLoading(false);
      return 'Spelarprofilen kunde inte hittas. Kontakta tränaren.';
    }
    const { data: linkedTeam } = await supabase
      .from('teams')
      .select('*')
      .eq('id', linkedPlayer.team_id)
      .maybeSingle();
    if (!linkedTeam) {
      await supabase.auth.signOut();
      setLoading(false);
      return 'Laget kunde inte hittas. Kontakta tränaren.';
    }

    setTeam(linkedTeam as Team);
    setPlayer(linkedPlayer as Player);
    setSection('dashboard');
    setView('hub');
    return null;
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

  if (view === 'account-login') {
    return (
      <PlayerAccountLoginScreen
        onLogin={handleAccountLogin}
        onLegacyLogin={() => setView('team-login')}
      />
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
    { id: 'messages', label: 'Meddelanden', icon: MessageCircle },
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
                  <ProgressRing icon={<Heart className="w-5 h-5" />} label="Välmående" done={Math.min(weeklyWellbeingCount, wbTarget)} target={wbTarget} pct={wbPct} complete={wbComplete} />
                  <ActionCard onClick={() => setView('wellbeing')} icon={<Heart className="w-6 h-6" />} title="Välmående" subtitle={wbComplete ? 'Klar för denna vecka' : `${wbTarget - weeklyWellbeingCount} rapport(er) kvar`} complete={wbComplete} />
                </div>
              </section>
            </div>
          </>
        )}

        {section === 'iup' && <PlayerIUPSection playerId={player.id} teamId={team!.id} />}
        {section === 'training' && (
          <PlayerTrainingSection
            playerId={player.id}
            teamId={team!.id}
          />
        )}
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
        {section === 'development' && <PlayerDevelopmentSection playerId={player.id} recentWellbeing={recentWellbeing} />}
        {section === 'messages' && <ChatPrototype role="athlete" />}
      </main>
    </div>
  );
}

// --- PLAYER IUP SECTION ---

function PlayerIUPSection({ playerId, teamId }: { playerId: string; teamId: string }) {
  const [goals, setGoals] = useState<DevelopmentGoal[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [quarterlyPlans, setQuarterlyPlans] = useState<IupQuarterlyPlan[]>([]);
  const [planChanges, setPlanChanges] = useState<IupQuarterlyPlanChange[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshIup = useCallback(async () => {
    const [
      { data: gData },
      { data: aData },
      { data: pData },
      { data: cData },
    ] = await Promise.all([
      supabase.from('development_goals').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      supabase.from('assessments').select('*').eq('player_id', playerId).eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('iup_quarterly_plans').select('*').eq('player_id', playerId).eq('team_id', teamId).order('quarter', { ascending: true }),
      supabase.from('iup_quarterly_plan_changes').select('*').eq('player_id', playerId).eq('team_id', teamId).order('created_at', { ascending: false }),
    ]);
    setGoals((gData || []) as DevelopmentGoal[]);
    setAssessments((aData || []) as Assessment[]);
    setQuarterlyPlans((pData || []) as IupQuarterlyPlan[]);
    setPlanChanges((cData || []) as IupQuarterlyPlanChange[]);
  }, [playerId, teamId]);

  useEffect(() => {
    (async () => {
      await refreshIup();
      setLoading(false);
    })();
  }, [refreshIup]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>;

  const areas: DevelopmentArea[] = ['teknik', 'spelförståelse', 'fysik', 'psykologi'];

  return (
    <div className="max-w-3xl">
      <SectionHeading icon={<Target className="w-5 h-5" />} eyebrow="Min IUP" title="Din personliga utvecklingskarta" description="Följ tränarens plan, lägg till dina egna mål och se vad ni båda har ändrat." />
      {goals.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 sm:p-8">
          <p className="text-sm font-semibold text-gray-700">Ingen plan upplagd ännu</p>
          <p className="mt-1 text-sm leading-6 text-gray-500">När tränaren lägger in dina mål kan du komplettera dem med egna delmål och reflektioner.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {areas.map((area) => {
            const areaGoals = goals.filter((g) => g.area === area);
            const areaAssessments = assessments.filter((a) => a.area === area);
            if (areaGoals.length === 0 && areaAssessments.length === 0) return null;
            return (
              <div key={area} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                  <span className="h-7 w-1 rounded-full bg-[#315c43]" />
                  <p className="text-base font-extrabold text-gray-950">{AREA_LABELS[area]}</p>
                </div>
                {areaGoals.map((g) => (
                  <div key={g.id} className="mt-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[#f2f6f1] p-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[#557461]">Övergripande mål</p>
                        <p className="mt-1 text-base font-bold leading-6 text-gray-950">{g.target_description}</p>
                        {g.football_action && <p className="mt-1 text-sm text-gray-600">Fotbollsaktion: {g.football_action}</p>}
                      </div>
                      <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${g.is_active ? 'bg-white text-[#315c43]' : 'bg-gray-200 text-gray-600'}`}>{g.is_active ? 'Aktivt' : 'Avslutat'}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {Array.from({ length: 4 }, (_, index) => {
                        const quarter = index + 1;
                        const plan = quarterlyPlans.find((item) => item.goal_id === g.id && item.quarter === quarter);
                        return (
                          <PlayerQuarterContribution
                            key={quarter}
                            goal={g}
                            quarter={quarter}
                            plan={plan}
                            changes={planChanges.filter((change) => change.goal_id === g.id && change.plan_id === plan?.id)}
                            playerId={playerId}
                            teamId={teamId}
                            onSaved={refreshIup}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
                {areaAssessments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {areaAssessments.map((a) => (
                      <div key={a.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#234633] text-white flex items-center justify-center text-xs font-bold">{a.assessment_number}</span>
                          <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('sv-SE')}</span>
                          {a.coach_rating && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md font-bold">Betyg: {a.coach_rating}/5</span>}
                        </div>
                        {a.coach_observation && <p className="text-sm text-gray-600 mt-1.5"><span className="font-bold text-gray-700">Observation:</span> {a.coach_observation}</p>}
                        {a.feedback && <p className="text-sm text-gray-600 mt-1"><span className="font-bold text-gray-700">Feedback:</span> {a.feedback}</p>}
                        {a.next_steps && <p className="text-sm text-gray-600 mt-1"><span className="font-bold text-gray-700">Nästa steg:</span> {a.next_steps}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayerQuarterContribution({
  goal,
  quarter,
  plan,
  changes,
  playerId,
  teamId,
  onSaved,
}: {
  goal: DevelopmentGoal;
  quarter: number;
  plan?: IupQuarterlyPlan;
  changes: IupQuarterlyPlanChange[];
  playerId: string;
  teamId: string;
  onSaved: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [playerGoal, setPlayerGoal] = useState(plan?.player_goal ?? '');
  const [playerEvaluation, setPlayerEvaluation] = useState(plan?.player_evaluation ?? '');
  const [focus, setFocus] = useState(plan?.focus ?? `Kvartal ${quarter}`);
  const [whatToDevelop, setWhatToDevelop] = useState(plan?.what_to_develop ?? '');
  const [howToDevelop, setHowToDevelop] = useState(plan?.how_to_develop ?? '');
  const [measurement, setMeasurement] = useState(plan?.measurement ?? '');
  const [startMonth, setStartMonth] = useState(plan?.start_month ?? (quarter - 1) * 3 + 1);
  const [endMonth, setEndMonth] = useState(plan?.end_month ?? quarter * 3);
  const [status, setStatus] = useState<IupQuarterlyPlan['status']>(plan?.status ?? 'ej_paborjat');
  const [selectedSkills, setSelectedSkills] = useState(plan?.selected_skills ?? {});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setPlayerGoal(plan?.player_goal ?? '');
    setPlayerEvaluation(plan?.player_evaluation ?? '');
    setFocus(plan?.focus ?? `Kvartal ${quarter}`);
    setWhatToDevelop(plan?.what_to_develop ?? '');
    setHowToDevelop(plan?.how_to_develop ?? '');
    setMeasurement(plan?.measurement ?? '');
    setStartMonth(plan?.start_month ?? (quarter - 1) * 3 + 1);
    setEndMonth(plan?.end_month ?? quarter * 3);
    setStatus(plan?.status ?? 'ej_paborjat');
    setSelectedSkills(plan?.selected_skills ?? {});
  }, [plan, quarter]);

  const monthLabels = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
  const statusLabel = status === 'klart' ? 'Klar' : status === 'pagar' ? 'Pågår' : 'Ej påbörjad';
  const statusStyle = status === 'klart' ? 'bg-[#c8e0c8] text-[#173b25]' : status === 'pagar' ? 'bg-[#d5e8ce] text-[#173b25]' : 'bg-white/15 text-white';

  const saveContribution = async () => {
    if (saving) return;
    setSaving(true);
    setFeedback(null);

    const playerFields = {
      focus: focus.trim() || `Kvartal ${quarter}`,
      start_month: startMonth,
      end_month: endMonth,
      what_to_develop: whatToDevelop.trim() || null,
      how_to_develop: howToDevelop.trim() || null,
      measurement: measurement.trim() || null,
      status,
      selected_skills: selectedSkills,
      player_goal: playerGoal.trim() || null,
      player_evaluation: playerEvaluation.trim() || null,
      updated_by: 'player' as const,
      updated_at: new Date().toISOString(),
    };

    const { error } = plan
      ? await supabase.from('iup_quarterly_plans').update(playerFields).eq('id', plan.id)
      : await supabase.from('iup_quarterly_plans').insert({
          goal_id: goal.id,
          player_id: playerId,
          team_id: teamId,
          quarter,
          coach_evaluation: null,
          ...playerFields,
        });
    if (error) {
      setFeedback(`Kunde inte spara: ${error.message}`);
      setSaving(false);
      return;
    }

    await onSaved();
    setFeedback('Dina ändringar har sparats.');
    setSaving(false);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex min-h-[68px] w-full items-center justify-between gap-3 bg-[#234633] px-4 py-3 text-left text-white transition-colors hover:bg-[#183525] sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg font-extrabold">{quarter}</span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold">Kvartal {quarter}</span>
            <span className="mt-0.5 block truncate text-xs font-medium text-green-50/75">{monthLabels[startMonth - 1]}–{monthLabels[endMonth - 1]}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusStyle}`}>{statusLabel}</span>
          <ChevronRight className={`h-4 w-4 text-green-50 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-gray-200 bg-[#f7f9f6] p-4 sm:p-5">
          <div className="space-y-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#557461]">Plan för kvartalet</p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-800">Fokus för kvartalet</span>
              <input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Exempel: Mottagning med insidan" className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-800">Vad ska spelaren utveckla?</span>
              <textarea value={whatToDevelop} onChange={(event) => setWhatToDevelop(event.target.value)} rows={2} placeholder="Beskriv utvecklingsmålet" className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-800">Hur ska den utvecklas?</span>
              <textarea value={howToDevelop} onChange={(event) => setHowToDevelop(event.target.value)} rows={2} placeholder="Vilka aktiviteter och träningstillfällen?" className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-800">Mätning</span>
              <textarea value={measurement} onChange={(event) => setMeasurement(event.target.value)} rows={2} placeholder="Hur mäts framsteg?" className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-800">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as IupQuarterlyPlan['status'])} className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]">
                <option value="ej_paborjat">Ej påbörjad</option>
                <option value="pagar">Pågår</option>
                <option value="klart">Klar</option>
              </select>
            </label>
          </div>

          {plan ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Tränarens plan</p>
              {plan.coach_evaluation && <p className="mt-2 text-sm text-gray-600"><span className="font-semibold text-gray-800">Tränarens utvärdering:</span> {plan.coach_evaluation}</p>}
              {!plan.coach_evaluation && <p className="mt-2 text-sm text-gray-500">Tränaren har inte lagt till någon utvärdering ännu.</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Tränaren har inte lagt upp en kvartalsplan ännu. Du kan ändå skriva ett eget mål.</p>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-gray-900">Månadsspann</p>
              <span className="rounded-md bg-[#edf3ec] px-2 py-1 text-xs font-bold text-[#315c43]">{monthLabels[startMonth - 1]}–{monthLabels[endMonth - 1]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={startMonth}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setStartMonth(value);
                  setEndMonth((current) => Math.max(value, current));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]"
              >
                {monthLabels.map((month, index) => <option key={month} value={index + 1}>Från {month}</option>)}
              </select>
              <select
                value={endMonth}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setEndMonth(value);
                  setStartMonth((current) => Math.min(value, current));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-semibold shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]"
              >
                {monthLabels.map((month, index) => <option key={month} value={index + 1}>Till {month}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <SkillChecklist area={goal.area} selectedSkills={selectedSkills} onChange={setSelectedSkills} />
          </div>

          <div className="rounded-xl border border-[#c8d9c8] bg-[#edf3ec] p-4 sm:p-5">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-[#315c43]">Spelarens del</p>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-800">Spelarens eget mål</span>
              <textarea value={playerGoal} onChange={(event) => setPlayerGoal(event.target.value)} rows={2} placeholder="Vad vill du själv utveckla?" className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]" />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-bold text-gray-800">Spelarens utvärdering</span>
              <textarea value={playerEvaluation} onChange={(event) => setPlayerEvaluation(event.target.value)} rows={2} placeholder="Hur går arbetet? Vad känns bra eller svårt?" className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-[#315c43] focus:outline-none focus:ring-2 focus:ring-[#d7e3d9]" />
            </label>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-gray-500">Ändringshistorik</p>
            <IupChangeHistory changes={changes} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
            {feedback && <p role={feedback.startsWith('Kunde inte') ? 'alert' : 'status'} className={`text-sm font-semibold ${feedback.startsWith('Kunde inte') ? 'text-red-700' : 'text-green-700'}`}>{feedback}</p>}
            <button type="button" onClick={saveContribution} disabled={saving} className="ml-auto inline-flex min-h-11 min-w-40 items-center justify-center gap-2 rounded-lg bg-[#234633] px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#183525] hover:shadow-md disabled:cursor-wait disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Sparar...' : 'Spara mina ändringar'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// --- PLAYER TRAINING SECTION ---

function PlayerTrainingSection({
  playerId,
  teamId,
}: {
  playerId: string;
  teamId: string;
}) {
  const [allSessions, setAllSessions] = useState<TrainingSession[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [completions, setCompletions] = useState<TrainingCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

  const refetchCompletions = async () => {
    const { data: cData } = await supabase
      .from('training_completions')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    setCompletions((cData || []) as TrainingCompletion[]);
  };

  useEffect(() => {
    (async () => {
      const [{ data: sData }, { data: aData }, { data: cData }] = await Promise.all([
        supabase.from('training_sessions').select('*').eq('team_id', teamId).order('scheduled_at', { ascending: false }),
        supabase.from('training_assignments').select('*').or(`player_id.eq.${playerId},is_all_team.eq.true`),
        supabase.from('training_completions').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      ]);
      setAllSessions((sData || []) as TrainingSession[]);
      setAssignments((aData || []) as TrainingAssignment[]);
      setCompletions((cData || []) as TrainingCompletion[]);
      setLoading(false);
    })();
  }, [playerId, teamId]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>;

  const assignedSessionIds = new Set(assignments.map((a) => a.session_id));
  const mySessions = allSessions.filter((s) => assignedSessionIds.has(s.id));
  const completedSessionIds = new Set(completions.map((c) => c.session_id));
  const completedSessions = mySessions.filter((s) => completedSessionIds.has(s.id));
  const upcomingSessions = mySessions.filter((s) => !completedSessionIds.has(s.id));
  const totalActualMin = completions.reduce((sum, c) => sum + (c.actual_duration_min ?? 0), 0);
  const totalActualLoad = completions.reduce((sum, c) => sum + (c.actual_duration_min && c.player_rpe ? c.actual_duration_min * c.player_rpe : 0), 0);
  const totalPlannedLoad = mySessions.reduce((sum, s) => sum + s.planned_duration_min * s.planned_rpe, 0);
  const painCount = completions.filter((c) => c.has_pain).length;
  const avgRpe = completions.filter((c) => c.player_rpe).length > 0
    ? completions.filter((c) => c.player_rpe).reduce((sum, c) => sum + (c.player_rpe ?? 0), 0) / completions.filter((c) => c.player_rpe).length
    : null;

  return (
    <div className="max-w-3xl">
      <SectionHeading icon={<CalendarDays className="w-5 h-5" />} eyebrow="Träning & belastning" title="Träningen kopplas till dina mål" description="Planerade pass, genomförd tid, faktisk belastning och berörda utvecklingsområden visas här när tränaren har lagt upp träningsplanen." />

      {mySessions.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 sm:p-8">
          <p className="text-sm font-semibold text-gray-700">Inga träningspass tilldelade ännu</p>
          <p className="mt-1 text-sm leading-6 text-gray-500">När tränaren lägger upp träningsplanen visas dina pass här.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-extrabold text-gray-950">{totalActualMin}</p>
              <p className="text-xs text-gray-400 mt-0.5">min genomförd</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-extrabold text-gray-950">{totalActualLoad}</p>
              <p className="text-xs text-gray-400 mt-0.5">AU faktisk belastning</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-extrabold text-gray-950">{completedSessions.length}/{mySessions.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">pass genomförda</p>
            </div>
            <div className={`rounded-xl border p-4 text-center ${painCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
              <p className={`text-2xl font-extrabold ${painCount > 0 ? 'text-red-600' : 'text-gray-950'}`}>{painCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">känningar</p>
            </div>
          </div>
          {avgRpe !== null && (
            <p className="text-xs text-gray-400 mt-2 text-center">Snitt RPE: <span className="font-bold text-gray-700">{avgRpe.toFixed(1)}</span> · Planerad belastning: <span className="font-bold text-gray-700">{totalPlannedLoad} AU</span></p>
          )}

          {upcomingSessions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Planerade pass</h3>
              <div className="space-y-3">
                {upcomingSessions.map((s) => {
                  const plannedLoad = s.planned_duration_min * s.planned_rpe;
                  const isCompleting = completingSessionId === s.id;
                  const justSaved = savedSessionId === s.id;
                  return (
                    <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <p className="font-bold text-gray-900">{s.title}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(s.scheduled_at).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'long' })} kl {new Date(s.scheduled_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} · {SESSION_TYPE_LABELS[s.session_type]}
                          </p>
                          {s.purpose && <p className="text-sm text-gray-500 mt-1.5">{s.purpose}</p>}
                          {s.content && <p className="text-xs text-gray-400 mt-1">{s.content}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">{plannedLoad} AU</p>
                          <p className="text-xs text-gray-400">{s.planned_duration_min} min · RPE {s.planned_rpe}</p>
                        </div>
                      </div>

                      {justSaved ? (
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          <p className="text-sm font-bold text-green-700">Sparat! Din rapport har skickats till tränaren.</p>
                        </div>
                      ) : isCompleting ? (
                        <CompletionForm
                          session={s}
                          playerId={playerId}
                          teamId={teamId}
                          onCancel={() => setCompletingSessionId(null)}
                          onSaved={async () => {
                            await refetchCompletions();
                            setCompletingSessionId(null);
                            setSavedSessionId(s.id);
                            setTimeout(() => setSavedSessionId(null), 4000);
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setCompletingSessionId(s.id)}
                          className="mt-3 w-full rounded-lg bg-[#234633] py-2.5 text-sm font-bold text-white hover:bg-[#183525] transition-colors"
                        >
                          Fyll i genomförande
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {completedSessions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">Genomförda pass</h3>
              <div className="space-y-3">
                {completedSessions.map((s) => {
                  const comp = completions.find((c) => c.session_id === s.id);
                  const actualLoad = comp?.actual_duration_min && comp?.player_rpe ? comp.actual_duration_min * comp.player_rpe : null;
                  const plannedLoad = s.planned_duration_min * s.planned_rpe;
                  return (
                    <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <p className="font-bold text-gray-900">{s.title}</p>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(s.scheduled_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })} · {SESSION_TYPE_LABELS[s.session_type]}
                          </p>
                          {s.purpose && <p className="text-sm text-gray-500 mt-1.5">{s.purpose}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          {actualLoad !== null && <p className="text-sm font-bold text-gray-900">{actualLoad} AU</p>}
                          <p className="text-xs text-gray-400">plan: {plannedLoad} AU</p>
                        </div>
                      </div>
                      {comp && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-gray-50 rounded-lg px-3 py-2"><span className="text-gray-400">Faktisk tid:</span> <span className="font-bold text-gray-700">{comp.actual_duration_min ?? '—'} min</span></div>
                          <div className="bg-gray-50 rounded-lg px-3 py-2"><span className="text-gray-400">RPE:</span> <span className="font-bold text-gray-700">{comp.player_rpe ?? '—'}</span></div>
                        </div>
                      )}
                      {comp?.has_pain && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <p className="text-xs font-bold text-red-600">Känning/smärta: {comp.pain_note || 'Ingen beskrivning'}</p>
                        </div>
                      )}
                      {comp?.player_reflection && (
                        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">{comp.player_reflection}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- PLAYER DEVELOPMENT SECTION ---

function PlayerDevelopmentSection({ playerId, recentWellbeing }: { playerId: string; recentWellbeing: WellbeingEntry[] }) {
  const [goals, setGoals] = useState<DevelopmentGoal[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: gData }, { data: aData }] = await Promise.all([
        supabase.from('development_goals').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
        supabase.from('assessments').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      ]);
      setGoals((gData || []) as DevelopmentGoal[]);
      setAssessments((aData || []) as Assessment[]);
      setLoading(false);
    })();
  }, [playerId]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>;

  const areas: DevelopmentArea[] = ['teknik', 'spelförståelse', 'fysik', 'psykologi'];

  return (
    <div className="max-w-3xl">
      <SectionHeading icon={<BarChart3 className="w-5 h-5" />} eyebrow="Utveckling" title="Följ arbetet över tid" description="Mål, träningsinsatser, återhämtning och reflektion hör ihop. Din utvecklingsbild blir komplett när IUP och träning finns upplagda." />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {areas.map((area) => {
          const areaGoals = goals.filter((g) => g.area === area);
          const areaAssessments = assessments.filter((a) => a.area === area);
          const latest = areaAssessments[0];
          const hasData = areaGoals.length > 0 || areaAssessments.length > 0;
          return (
            <div key={area} className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="font-bold text-gray-900">{AREA_LABELS[area]}</p>
              {!hasData ? (
                <>
                  <p className="mt-2 text-sm text-gray-500">Ingen bedömning registrerad ännu</p>
                  <div className="mt-4 h-1.5 rounded-full bg-gray-100" />
                </>
              ) : (
                <>
                  {latest?.coach_rating && (
                    <>
                      <p className="mt-2 text-sm text-gray-500">Senaste betyg: <span className="font-bold text-gray-800">{latest.coach_rating}/5</span></p>
                      <div className="mt-3 h-1.5 rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full bg-[#315c43]" style={{ width: `${(latest.coach_rating / 5) * 100}%` }} />
                      </div>
                    </>
                  )}
                  {latest?.next_steps && <p className="mt-3 text-xs text-gray-500"><span className="font-bold">Nästa steg:</span> {latest.next_steps}</p>}
                  <p className="mt-2 text-xs text-gray-400">{areaAssessments.length} bedömning(ar) · {areaGoals.length} mål</p>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#315c43]" /><h3 className="font-bold text-gray-900">Återhämtning</h3></div>
        <p className="mt-2 text-sm text-gray-500">{recentWellbeing.length ? `${recentWellbeing.length} statusrapport(er) finns registrerade.` : 'Statushistorik visas när du har registrerat din första check-in.'}</p>
        {recentWellbeing.length > 0 && <div className="mt-4 space-y-3">{(['sleep', 'energy', 'stress', 'soreness'] as const).map((key) => <MetricTrend key={key} label={WELLBEING_METRICS.find((metric) => metric.key === key)!.label} entries={recentWellbeing} metric={key} />)}</div>}
      </div>
    </div>
  );
}

function SectionHeading({ icon, eyebrow, title, description }: { icon: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return <div><div className="flex items-center gap-2 text-[#315c43]">{icon}<p className="text-xs font-bold uppercase tracking-wider">{eyebrow}</p></div><h2 className="mt-3 text-2xl font-extrabold text-gray-950">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{description}</p></div>;
}

function EmptyPlanningSection({ icon, eyebrow, title, description }: { icon: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return <div className="max-w-3xl"><SectionHeading icon={icon} eyebrow={eyebrow} title={title} description={description} /><div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white/70 p-6 sm:p-8"><p className="text-sm font-semibold text-gray-700">Ingen plan upplagd ännu</p><p className="mt-1 text-sm leading-6 text-gray-500">När innehållet är på plats visas det här tillsammans med din utvecklingshistorik.</p></div></div>;
}

function CompletionForm({
  session,
  playerId,
  teamId,
  onCancel,
  onSaved,
}: {
  session: TrainingSession;
  playerId: string;
  teamId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [actualMin, setActualMin] = useState<string>(String(session.planned_duration_min));
  const [rpe, setRpe] = useState<number>(session.planned_rpe);
  const [hasPain, setHasPain] = useState(false);
  const [painNote, setPainNote] = useState('');
  const [reflection, setReflection] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const minVal = parseInt(actualMin, 10);
    if (isNaN(minVal) || minVal < 0) {
      setError('Fyll i giltig tid i minuter.');
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('training_completions').insert({
      session_id: session.id,
      player_id: playerId,
      team_id: teamId,
      actual_duration_min: minVal,
      player_rpe: rpe,
      has_pain: hasPain,
      pain_note: hasPain ? painNote.trim() || null : null,
      player_reflection: reflection.trim() || null,
      completed_at: new Date().toISOString(),
    });

    if (insertError) {
      setError('Kunde inte spara. Försök igen.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-bold text-gray-900 mb-3">Hur gick det, {session.title}?</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-500">Faktisk tid (min)</label>
          <input
            type="number"
            min={0}
            value={actualMin}
            onChange={(e) => setActualMin(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 focus:border-[#315c43] focus:outline-none focus:ring-1 focus:ring-[#315c43]"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500">Spelarens RPE (1–10)</label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              className="flex-1 accent-[#315c43]"
            />
            <span className="w-10 text-center rounded-lg bg-white border border-gray-200 py-1 text-sm font-extrabold text-gray-900">{rpe}</span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-400">
            <span>Vila</span><span>Måttlig</span><span>Max</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500">Känning/smärta?</label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setHasPain(false)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${!hasPain ? 'bg-[#234633] text-white' : 'bg-white border border-gray-200 text-gray-500'}`}
            >
              Nej
            </button>
            <button
              type="button"
              onClick={() => setHasPain(true)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${hasPain ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}
            >
              Ja
            </button>
          </div>
          {hasPain && (
            <input
              type="text"
              placeholder="Beskriv var och hur"
              value={painNote}
              onChange={(e) => setPainNote(e.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500">Reflektion (frivilligt)</label>
          <textarea
            rows={2}
            placeholder="Hur kändes passet?"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-[#315c43] focus:outline-none focus:ring-1 focus:ring-[#315c43] resize-none"
          />
        </div>

        {error && <p className="text-xs font-bold text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-[2] rounded-lg bg-[#234633] py-2.5 text-sm font-bold text-white hover:bg-[#183525] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Sparar...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Spara
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
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

function PlayerAccountLoginScreen({
  onLogin,
  onLegacyLogin,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>;
  onLegacyLogin: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError(null);
    const loginError = await onLogin(email.trim(), password);
    if (loginError) setError(loginError);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f6f2] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#172b22] text-white">
            <ShieldIcon className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-950">Spelarinloggning</h1>
          <p className="mt-2 text-sm text-gray-500">Logga in med uppgifterna från din inbjudan.</p>
        </div>
        <form className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm" onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
          <div>
            <label htmlFor="player-account-email" className="mb-1.5 block text-sm font-semibold text-gray-700">E-post</label>
            <input
              id="player-account-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-[#557461] focus:outline-none focus:ring-2 focus:ring-[#557461]/15"
            />
          </div>
          <div>
            <label htmlFor="player-account-password" className="mb-1.5 block text-sm font-semibold text-gray-700">Lösenord</label>
            <input
              id="player-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-[#557461] focus:outline-none focus:ring-2 focus:ring-[#557461]/15"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={!email.trim() || !password || submitting}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#234633] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#183525] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn className="h-4 w-4" /> Logga in</>}
          </button>
        </form>
        <button onClick={onLegacyLogin} className="mt-4 w-full py-2 text-sm font-semibold text-gray-500 hover:text-gray-900">
          Har du inte fått en konto-inbjudan? Använd lagkod
        </button>
      </div>
    </div>
  );
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
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setValue = (key: string, val: number) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const setNote = (key: string, value: string) => {
    setNotes((prev) => ({ ...prev, [key]: value }));
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
      sleep_note: notes.sleep?.trim() || null,
      energy_note: notes.energy?.trim() || null,
      mood_note: notes.mood?.trim() || null,
      stress_note: notes.stress?.trim() || null,
      soreness_note: notes.soreness?.trim() || null,
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
              <label className="mt-3 block text-xs font-medium text-gray-500">
                Varför tyckte du så? <span className="text-gray-400">(frivilligt)</span>
              </label>
              <textarea
                value={notes[m.key] ?? ''}
                onChange={(e) => setNote(m.key, e.target.value)}
                placeholder={`Skriv en kort kommentar om ${m.label.toLowerCase()}`}
                rows={2}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none transition-colors"
              />
            </div>
          );
        })}
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
