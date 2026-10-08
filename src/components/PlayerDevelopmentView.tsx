import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  User,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Target,
  TrendingUp,
  Brain,
  Dumbbell,
  Heart,
  Calendar,
} from 'lucide-react';
import {
  supabase,
  type Player,
  type DevelopmentGoal,
  type TrainingSession,
  type TrainingCompletion,
  type DevelopmentArea,
  type IupQuarterlyPlan,
  type IupPlanStatus,
  type SkillChecklistArea,
  AREA_LABELS,
} from '@/lib/supabase';
import AIInsightCard from '@/components/AIInsightCard';

const AREA_ICON_MAP: Record<DevelopmentArea, typeof Brain> = {
  teknik: Brain,
  spelförståelse: Target,
  fysik: Dumbbell,
  psykologi: Heart,
};

interface PlayerDevData {
  goals: DevelopmentGoal[];
  sessions: TrainingSession[];
  completions: TrainingCompletion[];
  quarterlyPlans: IupQuarterlyPlan[];
}

const PLAN_STATUS_LABELS: Record<IupPlanStatus, string> = {
  ej_paborjat: 'Ej påbörjad',
  pagar: 'Pågår',
  klart: 'Klar',
};

export default function PlayerDevelopmentView({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [devData, setDevData] = useState<PlayerDevData | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);

  const fetchPlayers = useCallback(async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('name', { ascending: true });
    if (error) {
      console.error('Error fetching players:', error);
      return;
    }
    setPlayers((data || []) as Player[]);
    setLoading(false);
  }, [teamId]);

  const fetchDevData = useCallback(async (playerId: string) => {
    const [
      { data: goals },
      { data: sessions },
      { data: completions },
      { data: quarterlyPlans },
    ] = await Promise.all([
      supabase.from('development_goals').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      supabase.from('training_sessions').select('*').eq('team_id', teamId).order('scheduled_at', { ascending: false }),
      supabase.from('training_completions').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      supabase.from('iup_quarterly_plans').select('*').eq('player_id', playerId).order('quarter', { ascending: true }),
    ]);

    setDevData({
      goals: (goals || []) as DevelopmentGoal[],
      sessions: (sessions || []) as TrainingSession[],
      completions: (completions || []) as TrainingCompletion[],
      quarterlyPlans: (quarterlyPlans || []) as IupQuarterlyPlan[],
    });
  }, [teamId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    if (selectedPlayer) {
      fetchDevData(selectedPlayer.id);
    }
  }, [selectedPlayer, fetchDevData]);

  const addGoal = async (data: { area: DevelopmentArea; football_action: string; target_description: string }) => {
    const { error } = await supabase.from('development_goals').insert({
      player_id: selectedPlayer!.id,
      team_id: teamId,
      area: data.area,
      football_action: data.football_action || null,
      target_description: data.target_description,
    });
    if (error) {
      console.error('Error adding goal:', error);
      return;
    }
    setShowGoalForm(false);
    await fetchDevData(selectedPlayer!.id);
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from('development_goals').delete().eq('id', id);
    if (error) {
      console.error('Error deleting goal:', error);
      return;
    }
    await fetchDevData(selectedPlayer!.id);
  };

  const saveQuarterlyPlan = async (goalId: string, data: Partial<IupQuarterlyPlan>): Promise<string | null> => {
    const payload = {
      goal_id: goalId,
      player_id: selectedPlayer!.id,
      team_id: teamId,
      ...data,
    };
    try {
      const { error } = await supabase.from('iup_quarterly_plans').upsert({
        ...payload,
        selected_skills: payload.selected_skills ?? {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'goal_id,quarter' });
      if (error) {
        console.error('Error saving quarterly plan:', error);
        return error.message;
      }
      await fetchDevData(selectedPlayer!.id);
      return null;
    } catch (error) {
      console.error('Error saving quarterly plan:', error);
      return error instanceof Error ? error.message : 'Ett oväntat fel uppstod.';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Skapa spelarprofiler först för att hantera utveckling.</p>
      </div>
    );
  }

  if (selectedPlayer && devData) {
    return (
      <PlayerDetail
        player={selectedPlayer}
        devData={devData}
        onBack={() => {
          setSelectedPlayer(null);
          setDevData(null);
        }}
        onAddGoal={() => setShowGoalForm(true)}
        onDeleteGoal={deleteGoal}
        showGoalForm={showGoalForm}
        onAddGoalSubmit={addGoal}
        onCancelGoal={() => setShowGoalForm(false)}
        onSaveQuarterlyPlan={saveQuarterlyPlan}
      />
    );
  }

  return (
    <div className="space-y-3">
      {players.map((p) => (
        <button
          key={p.id}
          onClick={() => setSelectedPlayer(p)}
          className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-black hover:shadow-md transition-all text-left"
        >
          <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
            {p.jersey_number != null ? (
              <span className="text-sm font-bold">{p.jersey_number}</span>
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-black">{p.name}</p>
            <p className="text-sm text-gray-500">
              {p.position ? `${p.position} · ` : ''}
              {devData?.goals.length ?? 0} mål
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>
      ))}
    </div>
  );
}

function PlayerDetail({
  player,
  devData,
  onBack,
  onAddGoal,
  onDeleteGoal,
  showGoalForm,
  onAddGoalSubmit,
  onCancelGoal,
  onSaveQuarterlyPlan,
}: {
  player: Player;
  devData: PlayerDevData;
  onBack: () => void;
  onAddGoal: () => void;
  onDeleteGoal: (id: string) => void;
  showGoalForm: boolean;
  onAddGoalSubmit: (data: { area: DevelopmentArea; football_action: string; target_description: string }) => void;
  onCancelGoal: () => void;
  onSaveQuarterlyPlan: (goalId: string, data: Partial<IupQuarterlyPlan>) => Promise<string | null>;
}) {
  const [selectedArea, setSelectedArea] = useState<DevelopmentArea>('teknik');

  const areaGoals = devData.goals.filter((g) => g.area === selectedArea);
  const playerCompletions = devData.completions;
  const playerSessions = devData.sessions.filter((s) =>
    playerCompletions.some((c) => c.session_id === s.id)
  );

  const totalActualLoad = playerCompletions.reduce(
    (sum, c) => sum + (c.actual_duration_min && c.player_rpe ? c.actual_duration_min * c.player_rpe : 0),
    0
  );
  const totalPlannedLoad = playerSessions.reduce(
    (sum, s) => sum + s.planned_duration_min * s.planned_rpe,
    0
  );
  const totalActualMin = playerCompletions.reduce((sum, c) => sum + (c.actual_duration_min ?? 0), 0);
  const avgRpe = playerCompletions.length > 0
    ? playerCompletions.filter((c) => c.player_rpe).reduce((sum, c) => sum + (c.player_rpe!), 0) / playerCompletions.filter((c) => c.player_rpe).length
    : null;
  const painCount = playerCompletions.filter((c) => c.has_pain).length;

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-black font-bold mb-4 transition-colors"
      >
        ← Tillbaka
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold">
            {player.jersey_number != null ? player.jersey_number : <User className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-lg text-black">{player.name}</h3>
            {player.position && <p className="text-sm text-gray-500">{player.position}</p>}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <StatBox label="Träningstid" value={`${totalActualMin} min`} />
          <StatBox label="Belastning" value={`${totalActualLoad} AU`} sub={`plan: ${totalPlannedLoad}`} />
          <StatBox label="Antal pass" value={String(playerCompletions.length)} />
          <StatBox label="Känningar" value={String(painCount)} highlight={painCount > 0} />
        </div>
        {avgRpe !== null && (
          <p className="text-xs text-gray-400 mt-2 text-center">Snitt RPE: <span className="font-bold text-black">{avgRpe.toFixed(1)}</span></p>
        )}
      </div>

      <AIInsightCard
        title={`AI-analys av ${player.name}s utveckling`}
        context={buildPlayerDevContext(player, devData)}
        prompt="Analysera spelarens utveckling baserat på mål och träningsdata. Vilka styrkor och utvecklingsområden ser du? Ge tre konkreta rekommendationer för nästa period. Svara på svenska, max 200 ord."
      />

      {/* Area tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {(['teknik', 'spelförståelse', 'fysik', 'psykologi'] as DevelopmentArea[]).map((area) => {
          const Icon = AREA_ICON_MAP[area];
          return (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                selectedArea === area ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {AREA_LABELS[area]}
            </button>
          );
        })}
      </div>

      {/* IUP chain */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-black flex items-center gap-2">
            <Target className="w-4 h-4" /> IUP-mål — {AREA_LABELS[selectedArea]}
          </h4>
          <button
            onClick={onAddGoal}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-black transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nytt mål
          </button>
        </div>

        {showGoalForm && (
          <GoalForm
            onSubmit={onAddGoalSubmit}
            onCancel={onCancelGoal}
            defaultArea={selectedArea}
          />
        )}

        {areaGoals.length === 0 && !showGoalForm ? (
          <p className="text-sm text-gray-400">Inga IUP-mål för detta område ännu.</p>
        ) : (
          <div className="space-y-3">
            {areaGoals.map((g) => (
              <div key={g.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-black">{g.target_description}</p>
                    {g.football_action && (
                      <p className="text-xs text-gray-500 mt-0.5">Fotbollsaktion: {g.football_action}</p>
                    )}
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-md mt-1.5 font-bold ${
                      g.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {g.is_active ? 'Aktivt' : 'Avslutat'}
                    </span>
                  </div>
                  <button
                    onClick={() => onDeleteGoal(g.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <QuarterlyPlanCard
                  goal={g}
                  plans={devData.quarterlyPlans.filter((plan) => plan.goal_id === g.id)}
                  onSaveQuarterlyPlan={onSaveQuarterlyPlan}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Development chain visualization */}
      {areaGoals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
          <h4 className="font-bold text-black mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Utvecklingskedja
          </h4>
          <div className="space-y-2">
            <ChainStep label="IUP-mål" value={areaGoals[0]?.target_description} />
            <ChainConnector />
            <ChainStep label="Utvecklingsområde" value={AREA_LABELS[selectedArea]} />
            <ChainConnector />
            <ChainStep label="Fotbollsaktion" value={areaGoals[0]?.football_action || '—'} />
            <ChainConnector />
            <ChainStep
              label="Träningsinsatser"
              value={`${playerSessions.length} pass genomförda`}
            />
            <ChainConnector />
            <ChainStep
              label="Belastning"
              value={`${totalActualLoad} AU (plan: ${totalPlannedLoad})`}
            />
          </div>
        </div>
      )}

      {/* Training history */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="font-bold text-black mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Träningshistorik
        </h4>
        {playerSessions.length === 0 ? (
          <p className="text-sm text-gray-400">Inga träningspass genomförda ännu.</p>
        ) : (
          <div className="space-y-2">
            {playerSessions.map((s) => {
              const comp = playerCompletions.find((c) => c.session_id === s.id);
              const actualLoad = comp?.actual_duration_min && comp?.player_rpe
                ? comp.actual_duration_min * comp.player_rpe
                : null;
              return (
                <div key={s.id} className="flex items-center gap-3 border border-gray-200 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-black truncate">{s.title}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.scheduled_at).toLocaleDateString('sv-SE')} ·{' '}
                      {comp?.actual_duration_min ?? '—'} min · RPE {comp?.player_rpe ?? '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    {actualLoad !== null && <p className="text-xs font-bold text-black">{actualLoad} AU</p>}
                    {comp?.has_pain && <p className="text-xs text-red-500 font-bold">Känning</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QuarterlyPlanCard({
  goal,
  plans,
  onSaveQuarterlyPlan,
}: {
  goal: DevelopmentGoal;
  plans: IupQuarterlyPlan[];
  onSaveQuarterlyPlan: (goalId: string, data: Partial<IupQuarterlyPlan>) => Promise<string | null>;
}) {
  const allPlans = Array.from({ length: 4 }, (_, index) => ({
    quarter: index + 1,
    current: plans.find((plan) => plan.quarter === index + 1),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Årskalender och delmål</p>
        <span className="text-xs text-gray-500">{goal.target_description}</span>
      </div>

      {allPlans.map(({ quarter, current }) => (
        <QuarterPlanEditor
          key={quarter}
          goal={goal}
          quarter={quarter}
          plan={current}
          onSaveQuarterlyPlan={onSaveQuarterlyPlan}
        />
      ))}
    </div>
  );
}

function QuarterPlanEditor({
  goal,
  quarter,
  plan,
  onSaveQuarterlyPlan,
}: {
  goal: DevelopmentGoal;
  quarter: number;
  plan?: IupQuarterlyPlan;
  onSaveQuarterlyPlan: (goalId: string, data: Partial<IupQuarterlyPlan>) => Promise<string | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [focus, setFocus] = useState(plan?.focus ?? '');
  const defaultStart = (quarter - 1) * 3 + 1;
  const [startMonth, setStartMonth] = useState(plan?.start_month ?? defaultStart);
  const [endMonth, setEndMonth] = useState(plan?.end_month ?? defaultStart + 2);
  const [whatToDevelop, setWhatToDevelop] = useState(plan?.what_to_develop ?? '');
  const [howToDevelop, setHowToDevelop] = useState(plan?.how_to_develop ?? '');
  const [measurement, setMeasurement] = useState(plan?.measurement ?? '');
  const [playerEvaluation, setPlayerEvaluation] = useState(plan?.player_evaluation ?? '');
  const [coachEvaluation, setCoachEvaluation] = useState(plan?.coach_evaluation ?? '');
  const [selectedSkills, setSelectedSkills] = useState(plan?.selected_skills ?? {});
  const [status, setStatus] = useState<IupPlanStatus>(plan?.status ?? 'ej_paborjat');
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (plan) {
      setFocus(plan.focus);
      setStartMonth(plan.start_month);
      setEndMonth(plan.end_month);
      setWhatToDevelop(plan.what_to_develop ?? '');
      setHowToDevelop(plan.how_to_develop ?? '');
      setMeasurement(plan.measurement ?? '');
      setPlayerEvaluation(plan.player_evaluation ?? '');
      setCoachEvaluation(plan.coach_evaluation ?? '');
      setSelectedSkills(plan.selected_skills ?? {});
      setStatus(plan.status);
    }
  }, [plan]);

  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  const monthLabels = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
  ];
  const monthSpan = `${monthLabels[startMonth - 1]}–${monthLabels[endMonth - 1]}`;

  const handleStartMonthChange = (value: number) => {
    setStartMonth(value);
    setEndMonth((current) => Math.max(value, current));
  };

  const handleEndMonthChange = (value: number) => {
    setEndMonth(value);
    setStartMonth((current) => Math.min(value, current));
  };

  const handleSave = async () => {
    if (startMonth > endMonth || saving) return;

    setSaving(true);
    setSaveFeedback(null);
    const error = await onSaveQuarterlyPlan(goal.id, {
      quarter,
      focus: focus.trim() || `Kvartal ${quarter}`,
      start_month: startMonth,
      end_month: endMonth,
      what_to_develop: whatToDevelop.trim() || null,
      how_to_develop: howToDevelop.trim() || null,
      measurement: measurement.trim() || null,
      player_evaluation: playerEvaluation.trim() || null,
      coach_evaluation: coachEvaluation.trim() || null,
      selected_skills: selectedSkills,
      status,
    });
    setSaving(false);
    setSaveFeedback(error
      ? { type: 'error', message: `Kunde inte spara: ${error}` }
      : { type: 'success', message: 'Kvartalet har sparats.' });
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="w-full min-h-14 flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="min-w-0 flex items-center gap-3">
          <span className="font-bold text-sm text-black">Kvartal {quarter}</span>
          <span className="truncate text-xs text-gray-500">{monthSpan}</span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-bold ${
            plan?.status === 'klart'
              ? 'bg-green-50 text-green-700'
              : plan?.status === 'pagar'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-100 text-gray-500'
          }`}>
            {plan ? PLAN_STATUS_LABELS[plan.status] : 'Ej sparat'}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4 bg-gray-50/60">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Fokus för kvartalet" value={focus} onChange={setFocus} placeholder="Exempel: Mottagning med insidan" />
            <FormField label="Vad ska spelaren utveckla?" value={whatToDevelop} onChange={setWhatToDevelop} placeholder="Beskriv utvecklingsmålet" textarea />
            <FormField label="Hur ska den utvecklas?" value={howToDevelop} onChange={setHowToDevelop} placeholder="Vilka aktiviteter och träningstillfällen?" textarea />
            <FormField label="Mätning" value={measurement} onChange={setMeasurement} placeholder="Hur mäts framsteg?" textarea />
          </div>

          <div className="max-w-xs">
            <label className="block text-xs font-bold text-gray-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as IupPlanStatus)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            >
              {Object.entries(PLAN_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Spelarens utvärdering" value={playerEvaluation} onChange={setPlayerEvaluation} placeholder="Hur har spelaren upplevt utvecklingen?" textarea />
            <FormField label="Tränarens utvärdering" value={coachEvaluation} onChange={setCoachEvaluation} placeholder="Tränarens uppföljning och feedback" textarea />
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
              <p className="text-sm font-bold text-gray-700">Månadsspann</p>
              <p className="text-xs text-gray-500">{monthSpan}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={startMonth}
                onChange={(event) => handleStartMonthChange(Number(event.target.value))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                {monthOptions.map((month) => <option key={month} value={month}>Från {monthLabels[month - 1]}</option>)}
              </select>
              <select
                value={endMonth}
                onChange={(event) => handleEndMonthChange(Number(event.target.value))}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                {monthOptions.map((month) => <option key={month} value={month}>Till {monthLabels[month - 1]}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <SkillChecklist
                area={goal.area}
                selectedSkills={selectedSkills}
                onChange={setSelectedSkills}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-3">
            {saveFeedback && (
              <p
                role={saveFeedback.type === 'error' ? 'alert' : 'status'}
                className={`mr-auto text-sm font-semibold ${saveFeedback.type === 'error' ? 'text-red-700' : 'text-green-700'}`}
              >
                {saveFeedback.message}
              </p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex min-w-36 items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Sparar...' : 'Spara kvartal'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SkillChecklist({
  area,
  selectedSkills,
  onChange,
}: {
  area: DevelopmentArea;
  selectedSkills: Partial<Record<SkillChecklistArea, string[]>>;
  onChange: (skills: Partial<Record<SkillChecklistArea, string[]>>) => void;
}) {
  const skillAreaMap: Record<DevelopmentArea, SkillChecklistArea> = {
    teknik: 'teknik',
    spelförståelse: 'spelforstaelse',
    fysik: 'fysik',
    psykologi: 'psykologiska',
  };

  const checklistAreas: Array<{ key: SkillChecklistArea; label: string; skills: string[] }> = [
    {
      key: 'psykologiska',
      label: 'Psykologiska färdigheter',
      skills: [
        'Göra sitt bästa',
        'Jämföra sig med sig själv',
        'Ge positiv feedback',
        'Ta emot positiv feedback',
        'Ta emot instruktioner',
        'Ta emot feedback',
        'Fortsätta köra när det går dåligt',
        'Ge instruktioner',
        'Ge feedback',
      ],
    },
    {
      key: 'spelforstaelse',
      label: 'Spelförståelse',
      skills: [
        'Spelbarhet', 'Spelavstånd', 'Spelbredd', 'Speldjup', 'Uppflyttning', 'Djupledsspel', 'Offensiv omställning', 'Fasta situationer offensivt',
        'Defensiv omställning', 'Direkt återerövring', 'Indirekt återerövring', 'Täckning', 'Överflyttning – centrering', 'Uppflyttning – falla', 'Försvarssida', 'Fasta situationer defensivt',
        'Speluppbyggnad', 'Komma till avslut och göra mål', 'Kontring', 'Förhindra speluppbyggnad', 'Återerövring', 'Förhindra och rädda avslut',
        '2 skeden efter varandra', '3 skeden efter varandra', '4 eller fler skeden efter varandra',
      ],
    },
    {
      key: 'teknik',
      label: 'Tekniska färdigheter',
      skills: [
        'Mottag – felvänd', 'Mottag – sidled', 'Mottag – rakt fram', 'Mottag – få bollen att stanna',
        'Nick – försvarsnick – bort', 'Nick – försvarsnick – passning', 'Nick – anfallsnick – avslut', 'Nick – anfallsnick – passning',
        'Täcka bollen – driver bollen', 'Täcka bollen – felvänd', 'Täcka bollen – vid passning', 'Täcka bollen – vid avslut',
        'Passning kort – en touch', 'Passning kort – två touch', 'Passning lång – en touch', 'Passning lång – två touch',
        'Skott – ett tillslag', 'Skott – två tillslag', 'Skott – helvolley', 'Skott – halvvolley', 'Skott – med fart', 'Skott – utsida', 'Skott – insida', 'Skott – vrist',
        'Driva / ta fram bollen – framåt', 'Driva / ta fram bollen – med riktningsförändring',
        'Tackling', 'Brytning', 'Skarva', 'Markering', 'Vända', 'Utmana, finta & dribbla', 'Press',
      ],
    },
    {
      key: 'fysik',
      label: 'Fysiska färdigheter',
      skills: ['Koordination', 'Styrka', 'Explosivitet', 'Snabbhet', 'Rörlighet', 'Uthållighet'],
    },
  ];

  const toggleSkill = (area: SkillChecklistArea, skill: string) => {
    const nextSkills = new Set(selectedSkills[area] ?? []);
    if (nextSkills.has(skill)) {
      nextSkills.delete(skill);
    } else {
      nextSkills.add(skill);
    }
    onChange({
      ...selectedSkills,
      [area]: Array.from(nextSkills),
    });
  };

  const activeArea = skillAreaMap[area];
  const activeChecklist = checklistAreas.find((item) => item.key === activeArea)!;

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Färdighetslista</p>
      <div className="border border-gray-200 rounded-xl p-3">
        <h4 className="text-sm font-bold text-black mb-2">{activeChecklist.label}</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {activeChecklist.skills.map((skill) => {
            const checked = selectedSkills[activeChecklist.key]?.includes(skill) ?? false;
            return (
              <label key={skill} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSkill(activeChecklist.key, skill)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span>{skill}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GoalForm({
  onSubmit,
  onCancel,
  defaultArea,
}: {
  onSubmit: (data: { area: DevelopmentArea; football_action: string; target_description: string }) => void;
  onCancel: () => void;
  defaultArea: DevelopmentArea;
}) {
  const [area, setArea] = useState<DevelopmentArea>(defaultArea);
  const [footballAction, setFootballAction] = useState('');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!target.trim()) return;
    setSaving(true);
    await onSubmit({ area, football_action: footballAction.trim(), target_description: target.trim() });
    setSaving(false);
  };

  return (
    <div className="border-2 border-gray-200 rounded-xl p-3 mb-3">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Utvecklingsområde</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['teknik', 'spelförståelse', 'fysik', 'psykologi'] as DevelopmentArea[]).map((a) => (
              <button
                key={a}
                onClick={() => setArea(a)}
                className={`py-2 rounded-lg border-2 text-xs font-bold transition-colors ${
                  area === a ? 'border-black bg-gray-50 text-black' : 'border-gray-200 text-gray-500'
                }`}
              >
                {AREA_LABELS[a]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Målbeskrivning</label>
          <textarea
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Vad ska spelaren utveckla?"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Konkret fotbollsaktion (valfritt)</label>
          <input
            value={footballAction}
            onChange={(e) => setFootballAction(e.target.value)}
            placeholder="T.ex. Passning med insidan under press"
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!target.trim() || saving}
            className="flex items-center gap-1 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Spara mål
          </button>
          <button onClick={onCancel} className="text-gray-500 hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        />
      )}
    </div>
  );
}

function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 text-center ${highlight ? 'bg-red-50' : 'bg-gray-50'}`}>
      <p className={`text-base font-bold ${highlight ? 'text-red-600' : 'text-black'}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      {sub && <p className="text-xs text-gray-300 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChainStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-black flex-shrink-0" />
      <div>
        <p className="text-xs font-bold text-gray-400">{label}</p>
        <p className="text-sm text-gray-700">{value}</p>
      </div>
    </div>
  );
}

function ChainConnector() {
  return <div className="ml-1 h-4 w-px bg-gray-200" />;
}

function buildPlayerDevContext(player: Player, devData: PlayerDevData): string {
  const goalLines = devData.goals.map((g) =>
    `- ${AREA_LABELS[g.area]}: ${g.target_description}${g.football_action ? ` (aktion: ${g.football_action})` : ''}${g.is_active ? ' [aktivt]' : ' [avslutat]'}`
  ).join('\n');

  const sessionLines = devData.sessions.map((s) => {
    const comp = devData.completions.find((c) => c.session_id === s.id);
    return `- ${s.title} (${new Date(s.scheduled_at).toLocaleDateString('sv-SE')}): planerad ${s.planned_duration_min}min RPE ${s.planned_rpe}${comp ? `, faktisk ${comp.actual_duration_min ?? '?'}min RPE ${comp.player_rpe ?? '?'}${comp.has_pain ? ', känning' : ''}` : ', ej genomförd'}`;
  }).join('\n');

  return `Du är en AI-assistent för en fotbollstränare. Här är utvecklingsdata för en spelare:

Spelare: ${player.name}${player.position ? `, position: ${player.position}` : ''}

IUP-mål:
${goalLines || 'Inga mål registrerade'}

Träningspass:
${sessionLines || 'Inga pass registrerade'}

Svara på svenska. Var konkret och använd datan ovan för att ge råd.`;
}
