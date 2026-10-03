import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  User,
  Plus,
  Trash2,
  X,
  ChevronRight,
  Target,
  TrendingUp,
  Brain,
  Dumbbell,
  Heart,
  ClipboardList,
  Calendar,
  Clock,
  Activity,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import {
  supabase,
  type Player,
  type DevelopmentGoal,
  type Assessment,
  type TrainingSession,
  type TrainingCompletion,
  type DevelopmentArea,
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
  assessments: Assessment[];
  sessions: TrainingSession[];
  completions: TrainingCompletion[];
}

export default function PlayerDevelopmentView({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [devData, setDevData] = useState<PlayerDevData | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);

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
    const [{ data: goals }, { data: assessments }, { data: sessions }, { data: completions }] = await Promise.all([
      supabase.from('development_goals').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      supabase.from('assessments').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      supabase.from('training_sessions').select('*').eq('team_id', teamId).order('scheduled_at', { ascending: false }),
      supabase.from('training_completions').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
    ]);

    setDevData({
      goals: (goals || []) as DevelopmentGoal[],
      assessments: (assessments || []) as Assessment[],
      sessions: (sessions || []) as TrainingSession[],
      completions: (completions || []) as TrainingCompletion[],
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

  const addAssessment = async (data: Partial<Assessment> & { area: DevelopmentArea }) => {
    const areaAssessments = devData?.assessments.filter((a) => a.area === data.area) ?? [];
    const nextNumber = areaAssessments.length + 1;
    const { error } = await supabase.from('assessments').insert({
      player_id: selectedPlayer!.id,
      team_id: teamId,
      area: data.area,
      assessment_number: nextNumber,
      goal_id: data.goal_id || null,
      football_action: data.football_action || null,
      physical_quality: data.physical_quality || null,
      psychological_focus: data.psychological_focus || null,
      coach_observation: data.coach_observation || null,
      coach_rating: data.coach_rating || null,
      player_reflection: data.player_reflection || null,
      training_done_summary: data.training_done_summary || null,
      load_recovery_summary: data.load_recovery_summary || null,
      feedback: data.feedback || null,
      next_steps: data.next_steps || null,
    });
    if (error) {
      console.error('Error adding assessment:', error);
      return;
    }
    setShowAssessmentForm(false);
    await fetchDevData(selectedPlayer!.id);
  };

  const deleteAssessment = async (id: string) => {
    const { error } = await supabase.from('assessments').delete().eq('id', id);
    if (error) {
      console.error('Error deleting assessment:', error);
      return;
    }
    await fetchDevData(selectedPlayer!.id);
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
        onAddAssessment={() => setShowAssessmentForm(true)}
        onDeleteAssessment={deleteAssessment}
        showGoalForm={showGoalForm}
        showAssessmentForm={showAssessmentForm}
        onAddGoalSubmit={addGoal}
        onAddAssessmentSubmit={addAssessment}
        onCancelGoal={() => setShowGoalForm(false)}
        onCancelAssessment={() => setShowAssessmentForm(false)}
        goals={devData.goals}
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
  onAddAssessment,
  onDeleteAssessment,
  showGoalForm,
  showAssessmentForm,
  onAddGoalSubmit,
  onAddAssessmentSubmit,
  onCancelGoal,
  onCancelAssessment,
  goals,
}: {
  player: Player;
  devData: PlayerDevData;
  onBack: () => void;
  onAddGoal: () => void;
  onDeleteGoal: (id: string) => void;
  onAddAssessment: () => void;
  onDeleteAssessment: (id: string) => void;
  showGoalForm: boolean;
  showAssessmentForm: boolean;
  onAddGoalSubmit: (data: { area: DevelopmentArea; football_action: string; target_description: string }) => void;
  onAddAssessmentSubmit: (data: Partial<Assessment> & { area: DevelopmentArea }) => void;
  onCancelGoal: () => void;
  onCancelAssessment: () => void;
  goals: DevelopmentGoal[];
}) {
  const [selectedArea, setSelectedArea] = useState<DevelopmentArea>('teknik');

  const areaGoals = devData.goals.filter((g) => g.area === selectedArea);
  const areaAssessments = devData.assessments.filter((a) => a.area === selectedArea);
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
        prompt="Analysera spelarens utveckling baserat på mål, bedömningar och träningsdata. Vilka styrkor och utvecklingsområden ser du? Ge tre konkreta rekommendationer för nästa period. Svara på svenska, max 200 ord."
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
          <div className="space-y-2">
            {areaGoals.map((g) => (
              <div key={g.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
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
            <ChainConnector />
            <ChainStep
              label="Bedömningar"
              value={`${areaAssessments.length} registrerade`}
            />
          </div>
        </div>
      )}

      {/* Assessments */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-black flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Bedömningar — {AREA_LABELS[selectedArea]}
          </h4>
          <button
            onClick={onAddAssessment}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-black transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Ny bedömning
          </button>
        </div>

        {showAssessmentForm && (
          <AssessmentForm
            area={selectedArea}
            goals={areaGoals}
            onSubmit={onAddAssessmentSubmit}
            onCancel={onCancelAssessment}
          />
        )}

        {areaAssessments.length === 0 && !showAssessmentForm ? (
          <div className="text-center py-8">
            <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Ingen bedömning registrerad ännu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...areaAssessments].reverse().map((a) => (
              <div key={a.id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">
                      {a.assessment_number}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(a.created_at).toLocaleDateString('sv-SE')}
                    </span>
                    {a.coach_rating && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-bold">
                        Betyg: {a.coach_rating}/5
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteAssessment(a.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {a.coach_observation && <Field label="Observation" value={a.coach_observation} />}
                {a.player_reflection && <Field label="Spelarens reflektion" value={a.player_reflection} />}
                {a.training_done_summary && <Field label="Genomförd träning" value={a.training_done_summary} />}
                {a.load_recovery_summary && <Field label="Belastning & återhämtning" value={a.load_recovery_summary} />}
                {a.feedback && <Field label="Feedback" value={a.feedback} />}
                {a.next_steps && <Field label="Nästa steg" value={a.next_steps} />}
              </div>
            ))}
          </div>
        )}
      </div>

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

function AssessmentForm({
  area,
  goals,
  onSubmit,
  onCancel,
}: {
  area: DevelopmentArea;
  goals: DevelopmentGoal[];
  onSubmit: (data: Partial<Assessment> & { area: DevelopmentArea }) => void;
  onCancel: () => void;
}) {
  const [goalId, setGoalId] = useState('');
  const [footballAction, setFootballAction] = useState('');
  const [physicalQuality, setPhysicalQuality] = useState('');
  const [psychFocus, setPsychFocus] = useState('');
  const [observation, setObservation] = useState('');
  const [rating, setRating] = useState('');
  const [reflection, setReflection] = useState('');
  const [trainingDone, setTrainingDone] = useState('');
  const [loadRecovery, setLoadRecovery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSubmit({
      area,
      goal_id: goalId || null,
      football_action: footballAction.trim() || null,
      physical_quality: physicalQuality.trim() || null,
      psychological_focus: psychFocus.trim() || null,
      coach_observation: observation.trim() || null,
      coach_rating: rating ? parseInt(rating) : null,
      player_reflection: reflection.trim() || null,
      training_done_summary: trainingDone.trim() || null,
      load_recovery_summary: loadRecovery.trim() || null,
      feedback: feedback.trim() || null,
      next_steps: nextSteps.trim() || null,
    });
    setSaving(false);
  };

  const showField = (field: string) => {
    if (area === 'fysik') return ['physicalQuality', 'observation', 'rating', 'trainingDone', 'feedback', 'nextSteps'].includes(field);
    if (area === 'psykologi') return ['psychFocus', 'observation', 'rating', 'reflection', 'trainingDone', 'feedback', 'nextSteps'].includes(field);
    return ['footballAction', 'observation', 'rating', 'reflection', 'trainingDone', 'feedback', 'nextSteps'].includes(field);
  };

  return (
    <div className="border-2 border-gray-200 rounded-xl p-3 mb-3">
      <div className="space-y-3">
        {goals.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Koppla till IUP-mål</label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="">Inget mål</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.target_description.slice(0, 50)}</option>
              ))}
            </select>
          </div>
        )}

        {showField('footballAction') && (
          <FormField label="Konkret fotbollsaktion" value={footballAction} onChange={setFootballAction} placeholder="T.ex. Mottagning och vrid" />
        )}
        {showField('physicalQuality') && (
          <FormField label="Fysisk egenskap" value={physicalQuality} onChange={setPhysicalQuality} placeholder="T.ex. Explosivitet" />
        )}
        {showField('psychFocus') && (
          <FormField label="Psykologiskt fokus" value={psychFocus} onChange={setPsychFocus} placeholder="T.ex. Koncentration under press" />
        )}

        <FormField label="Tränarens observation" value={observation} onChange={setObservation} placeholder="Vad ser du som tränare?" textarea />

        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Bedömning (1–5)</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(String(n))}
                className={`w-9 h-9 rounded-lg border-2 text-sm font-bold transition-colors ${
                  rating === String(n) ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {showField('reflection') && (
          <FormField label="Spelarens reflektion" value={reflection} onChange={setReflection} placeholder="Hur upplever spelaren sin utveckling?" textarea />
        )}
        <FormField label="Genomförd träning" value={trainingDone} onChange={setTrainingDone} placeholder="Vad har spelaren arbetat med?" textarea />
        <FormField label="Belastning & återhämtning" value={loadRecovery} onChange={setLoadRecovery} placeholder="Hur har spelaren hanterat perioden?" textarea />
        <FormField label="Feedback" value={feedback} onChange={setFeedback} placeholder="Din feedback till spelaren" textarea />
        <FormField label="Nästa steg" value={nextSteps} onChange={setNextSteps} placeholder="Vad ska spelaren fokusera på framåt?" textarea />

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Spara bedömning
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5">{value}</p>
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

  const assessmentLines = devData.assessments.map((a) => {
    const parts: string[] = [`[${AREA_LABELS[a.area]}] bedömning #${a.assessment_number}`];
    if (a.coach_rating) parts.push(`betyg ${a.coach_rating}/5`);
    if (a.coach_observation) parts.push(`observation: ${a.coach_observation}`);
    if (a.player_reflection) parts.push(`spelarreflektion: ${a.player_reflection}`);
    if (a.feedback) parts.push(`feedback: ${a.feedback}`);
    if (a.next_steps) parts.push(`nästa steg: ${a.next_steps}`);
    return `- ${parts.join(', ')}`;
  }).join('\n');

  const sessionLines = devData.sessions.map((s) => {
    const comp = devData.completions.find((c) => c.session_id === s.id);
    return `- ${s.title} (${new Date(s.scheduled_at).toLocaleDateString('sv-SE')}): planerad ${s.planned_duration_min}min RPE ${s.planned_rpe}${comp ? `, faktisk ${comp.actual_duration_min ?? '?'}min RPE ${comp.player_rpe ?? '?'}${comp.has_pain ? ', känning' : ''}` : ', ej genomförd'}`;
  }).join('\n');

  return `Du är en AI-assistent för en fotbollstränare. Här är utvecklingsdata för en spelare:

Spelare: ${player.name}${player.position ? `, position: ${player.position}` : ''}

IUP-mål:
${goalLines || 'Inga mål registrerade'}

Bedömningar:
${assessmentLines || 'Inga bedömningar registrerade'}

Träningspass:
${sessionLines || 'Inga pass registrerade'}

Svara på svenska. Var konkret och använd datan ovan för att ge råd.`;
}
