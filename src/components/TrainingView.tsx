import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Clock,
  Dumbbell,
  Loader2,
  Trash2,
  X,
  Users,
  User,
  ChevronRight,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Filter,
} from 'lucide-react';
import {
  supabase,
  type Player,
  type TrainingSession,
  type TrainingAssignment,
  type TrainingCompletion,
  type DevelopmentGoal,
  type SessionType,
  AREA_LABELS,
  SESSION_TYPE_LABELS,
} from '@/lib/supabase';

interface SessionWithDetails extends TrainingSession {
  assignments: TrainingAssignment[];
  completions: TrainingCompletion[];
  goal: DevelopmentGoal | null;
}

export default function TrainingView({ teamId }: { teamId: string }) {
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [goals, setGoals] = useState<DevelopmentGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: sessionData }, { data: playerData }, { data: assignData }, { data: compData }, { data: goalData }] =
      await Promise.all([
        supabase.from('training_sessions').select('*').eq('team_id', teamId).order('scheduled_at', { ascending: false }),
        supabase.from('players').select('*').eq('team_id', teamId).order('name', { ascending: true }),
        supabase.from('training_assignments').select('*'),
        supabase.from('training_completions').select('*'),
        supabase.from('development_goals').select('*').eq('team_id', teamId).eq('is_active', true),
      ]);

    const sData = (sessionData || []) as TrainingSession[];
    const aData = (assignData || []) as TrainingAssignment[];
    const cData = (compData || []) as TrainingCompletion[];
    const gData = (goalData || []) as DevelopmentGoal[];

    const withDetails: SessionWithDetails[] = sData.map((s) => ({
      ...s,
      assignments: aData.filter((a) => a.session_id === s.id),
      completions: cData.filter((c) => c.session_id === s.id),
      goal: gData.find((g) => g.id === s.goal_id) || null,
    }));

    setSessions(withDetails);
    setPlayers((playerData || []) as Player[]);
    setGoals(gData);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addSession = async (data: SessionFormData) => {
    const { data: session, error } = await supabase
      .from('training_sessions')
      .insert({
        team_id: teamId,
        title: data.title,
        session_type: data.session_type,
        scheduled_at: data.scheduled_at,
        planned_duration_min: data.planned_duration_min,
        planned_rpe: data.planned_rpe,
        content: data.content || null,
        purpose: data.purpose || null,
        exercises: data.exercises || null,
        goal_id: data.goal_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return;
    }

    const assignments: { session_id: string; player_id: string | null; is_all_team: boolean }[] = [];
    if (data.assign_all) {
      assignments.push({ session_id: session.id, player_id: null, is_all_team: true });
    } else {
      data.assigned_player_ids.forEach((pid) => {
        assignments.push({ session_id: session.id, player_id: pid, is_all_team: false });
      });
    }
    if (assignments.length > 0) {
      await supabase.from('training_assignments').insert(assignments);
    }

    setShowForm(false);
    await fetchAll();
  };

  const deleteSession = async (id: string) => {
    const { error } = await supabase.from('training_sessions').delete().eq('id', id);
    if (error) {
      console.error('Error deleting session:', error);
      return;
    }
    setSelectedSession(null);
    await fetchAll();
  };

  const saveCompletion = async (sessionId: string, playerId: string, comp: Partial<TrainingCompletion>) => {
    const { error } = await supabase
      .from('training_completions')
      .upsert({
        session_id: sessionId,
        player_id: playerId,
        team_id: teamId,
        actual_duration_min: comp.actual_duration_min ?? null,
        player_rpe: comp.player_rpe ?? null,
        has_pain: comp.has_pain ?? false,
        pain_note: comp.pain_note ?? null,
        player_reflection: comp.player_reflection ?? null,
      });
    if (error) {
      console.error('Error saving completion:', error);
      return;
    }
    await fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  const allCompletions = sessions.flatMap((s) => s.completions);
  const allSessionsList = sessions;

  if (selectedSession) {
    return (
      <SessionDetail
        session={selectedSession}
        players={players}
        onBack={() => setSelectedSession(null)}
        onDelete={() => deleteSession(selectedSession.id)}
        onSaveCompletion={saveCompletion}
      />
    );
  }

  const now = new Date();
  const upcoming = sessions.filter((s) => new Date(s.scheduled_at) >= now);
  const past = sessions.filter((s) => new Date(s.scheduled_at) < now);

  return (
    <div>
      {sessions.length === 0 && !showForm && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Inga träningspass skapade ännu.</p>
        </div>
      )}

      {showForm ? (
        <SessionForm
          players={players}
          goals={goals}
          onSave={addSession}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <>
          <LoadSummary
            sessions={allSessionsList}
            players={players}
          />
          {upcoming.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Kommande pass</h3>
              <div className="space-y-3">
                {upcoming.map((s) => (
                  <SessionCard key={s.id} session={s} players={players} onClick={() => setSelectedSession(s)} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Genomförda pass</h3>
              <div className="space-y-3">
                {past.map((s) => (
                  <SessionCard key={s.id} session={s} players={players} onClick={() => setSelectedSession(s)} />
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 w-full bg-white border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50 text-gray-500 hover:text-black px-4 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Skapa träningspass
          </button>
        </>
      )}
    </div>
  );
}

interface SessionFormData {
  title: string;
  session_type: SessionType;
  scheduled_at: string;
  planned_duration_min: number;
  planned_rpe: number;
  content: string;
  purpose: string;
  exercises: string;
  goal_id: string | null;
  assign_all: boolean;
  assigned_player_ids: string[];
}

function LoadSummary({
  sessions,
  players,
}: {
  sessions: SessionWithDetails[];
  players: Player[];
}) {
  const months = useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();
    sessions.forEach((s) => {
      const d = new Date(s.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          label: d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
          value: key,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.value.localeCompare(a.value));
  }, [sessions]);

  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const filteredSessions = useMemo(() => {
    if (selectedMonth === 'all') return sessions;
    return sessions.filter((s) => {
      const d = new Date(s.scheduled_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [sessions, selectedMonth]);

  const completions = filteredSessions.flatMap((s) =>
    s.completions.map((c) => ({ ...c, sessionTitle: s.title, scheduledAt: s.scheduled_at }))
  );

  const totalActualMin = completions.reduce((sum, c) => sum + (c.actual_duration_min ?? 0), 0);
  const totalPlannedMin = filteredSessions.reduce((sum, s) => sum + s.planned_duration_min, 0);
  const totalActualLoad = completions.reduce(
    (sum, c) => sum + (c.actual_duration_min && c.player_rpe ? c.actual_duration_min * c.player_rpe : 0), 0
  );
  const totalPlannedLoad = filteredSessions.reduce(
    (sum, s) => sum + s.planned_duration_min * s.planned_rpe, 0
  );
  const painCount = completions.filter((c) => c.has_pain).length;
  const avgRpe = completions.filter((c) => c.player_rpe).length > 0
    ? completions.filter((c) => c.player_rpe).reduce((sum, c) => sum + (c.player_rpe ?? 0), 0) / completions.filter((c) => c.player_rpe).length
    : null;
  const sessionCount = filteredSessions.length;
  const completionCount = completions.length;

  const playerStats = players
    .map((p) => {
      const playerCompletions = completions.filter((c) => c.player_id === p.id);
      const totalMin = playerCompletions.reduce((sum, c) => sum + (c.actual_duration_min ?? 0), 0);
      const totalLoad = playerCompletions.reduce(
        (sum, c) => sum + (c.actual_duration_min && c.player_rpe ? c.actual_duration_min * c.player_rpe : 0), 0
      );
      const rpeValues = playerCompletions.filter((c) => c.player_rpe).map((c) => c.player_rpe!);
      const avgRpe = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;
      const painCount = playerCompletions.filter((c) => c.has_pain).length;
      return { player: p, totalMin, totalLoad, avgRpe, painCount, completionCount: playerCompletions.length };
    })
    .filter((s) => s.completionCount > 0)
    .sort((a, b) => b.totalLoad - a.totalLoad);

  const maxLoad = Math.max(...playerStats.map((s) => s.totalLoad), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-gray-700" />
        <h3 className="font-bold text-black">Belastningssammanfattning</h3>
      </div>

      {/* Month filter */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <button
          onClick={() => setSelectedMonth('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
            selectedMonth === 'all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Alla
        </button>
        {months.map((m) => (
          <button
            key={m.value}
            onClick={() => setSelectedMonth(m.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors capitalize ${
              selectedMonth === m.value ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-black">{totalActualMin}</p>
          <p className="text-xs text-gray-400 mt-0.5">min genomförd</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-black">{totalActualLoad}</p>
          <p className="text-xs text-gray-400 mt-0.5">AU faktisk belastning</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-black">{avgRpe !== null ? avgRpe.toFixed(1) : '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">snitt RPE</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${painCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <p className={`text-2xl font-extrabold ${painCount > 0 ? 'text-red-600' : 'text-black'}`}>{painCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">känningar</p>
        </div>
      </div>

      {/* Planned vs actual */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
        <span>{sessionCount} pass · {completionCount} genomföranden</span>
        <span>Planerad: {totalPlannedMin} min · {totalPlannedLoad} AU</span>
      </div>

      {/* Per-player bars */}
      {playerStats.length > 0 ? (
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Belastning per spelare</h4>
          <div className="space-y-2.5">
            {playerStats.map((s) => (
              <div key={s.player.id} className="flex items-center gap-3">
                <div className="w-28 flex-shrink-0 flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                    {s.player.jersey_number ?? <User className="w-3 h-3" />}
                  </div>
                  <span className="text-sm font-bold text-gray-700 truncate">{s.player.name}</span>
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-[#315c43] to-[#557461] rounded-lg flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max((s.totalLoad / maxLoad) * 100, 8)}%` }}
                  >
                    <span className="text-[10px] font-bold text-white">{s.totalLoad} AU</span>
                  </div>
                </div>
                <div className="w-20 flex-shrink-0 text-right">
                  <span className="text-xs font-bold text-gray-600">{s.totalMin} min</span>
                  {s.painCount > 0 && (
                    <span className="ml-1 text-[10px] font-bold text-red-500">{s.painCount}x känning</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">Inga genomförda pass att visa än.</p>
      )}
    </div>
  );
}

function SessionForm({
  players,
  goals,
  onSave,
  onCancel,
}: {
  players: Player[];
  goals: DevelopmentGoal[];
  onSave: (data: SessionFormData) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('lag');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [rpe, setRpe] = useState('5');
  const [content, setContent] = useState('');
  const [purpose, setPurpose] = useState('');
  const [exercises, setExercises] = useState('');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [assignAll, setAssignAll] = useState(true);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !date || !time) return;
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    await onSave({
      title: title.trim(),
      session_type: sessionType,
      scheduled_at: scheduledAt,
      planned_duration_min: parseInt(duration) || 60,
      planned_rpe: parseInt(rpe) || 5,
      content: content.trim(),
      purpose: purpose.trim(),
      exercises: exercises.trim(),
      goal_id: goalId,
      assign_all: assignAll,
      assigned_player_ids: assignedIds,
    });
    setSaving(false);
  };

  const togglePlayer = (id: string) => {
    setAssignedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-black">Nytt träningspass</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-black">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Titel</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="T.ex. Pass 1 - Teknik och spel"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Typ av träning</label>
          <div className="grid grid-cols-3 gap-2">
            {(['lag', 'grupp', 'individuell'] as SessionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setSessionType(t)}
                className={`py-2.5 rounded-lg border-2 text-sm font-bold transition-colors ${
                  sessionType === t ? 'border-black bg-gray-50 text-black' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {SESSION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Tid</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Längd (min)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={1}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Planerad RPE (1–10)</label>
            <input
              type="number"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              min={1}
              max={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 font-medium">
            Planerad belastning: <span className="font-bold text-black">{(parseInt(duration) || 60) * (parseInt(rpe) || 5)} AU</span>
            <span className="text-gray-400"> (min × RPE)</span>
          </p>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Syfte</label>
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="T.ex. Förbättra passningsprecision under press"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Innehåll</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Beskriv träningsinnehållet..."
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Övningar & instruktioner</label>
          <textarea
            value={exercises}
            onChange={(e) => setExercises(e.target.value)}
            placeholder="Övningar, instruktioner, video eller material..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
          />
        </div>

        {goals.length > 0 && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Koppla till IUP-mål (valfritt)</label>
            <select
              value={goalId || ''}
              onChange={(e) => setGoalId(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            >
              <option value="">Inget mål valt</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {AREA_LABELS[g.area]} — {g.target_description.slice(0, 50)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Tilldela träningen</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setAssignAll(true)}
              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-bold transition-colors ${
                assignAll ? 'border-black bg-gray-50 text-black' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-1" /> Hela laget
            </button>
            <button
              onClick={() => setAssignAll(false)}
              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-bold transition-colors ${
                !assignAll ? 'border-black bg-gray-50 text-black' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <User className="w-4 h-4 inline mr-1" />&nbsp;Välj spelare
            </button>
          </div>
          {!assignAll && (
            <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
              {players.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={assignedIds.includes(p.id)}
                    onChange={() => togglePlayer(p.id)}
                    className="accent-black"
                  />
                  <span className="text-sm text-gray-700">{p.name}</span>
                  {p.position && <span className="text-xs text-gray-400">· {p.position}</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !date || !time || saving}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Skapa pass
          </button>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-black px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionCard({
  session,
  players,
  onClick,
}: {
  session: SessionWithDetails;
  players: Player[];
  onClick: () => void;
}) {
  const plannedLoad = session.planned_duration_min * session.planned_rpe;
  const assignedCount = session.assignments.some((a) => a.is_all_team)
    ? players.length
    : session.assignments.filter((a) => a.player_id).length;
  const completionCount = session.completions.length;

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:border-black hover:shadow-md transition-all text-left"
    >
      <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center flex-shrink-0">
        <Dumbbell className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-black truncate">{session.title}</p>
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(session.scheduled_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
          <span>·</span>
          <Clock className="w-3.5 h-3.5" />
          {new Date(session.scheduled_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-bold text-gray-400">{SESSION_TYPE_LABELS[session.session_type]}</p>
        <p className="text-xs text-gray-400">
          {assignedCount} spelare · {completionCount} klara
        </p>
        <p className="text-xs font-bold text-black mt-0.5">{plannedLoad} AU</p>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
    </button>
  );
}

function SessionDetail({
  session,
  players,
  onBack,
  onDelete,
  onSaveCompletion,
}: {
  session: SessionWithDetails;
  players: Player[];
  onBack: () => void;
  onDelete: () => void;
  onSaveCompletion: (sessionId: string, playerId: string, comp: Partial<TrainingCompletion>) => void;
}) {
  const plannedLoad = session.planned_duration_min * session.planned_rpe;
  const assignedPlayerIds = session.assignments.some((a) => a.is_all_team)
    ? players.map((p) => p.id)
    : session.assignments.filter((a) => a.player_id).map((a) => a.player_id!);
  const assignedPlayers = players.filter((p) => assignedPlayerIds.includes(p.id));

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-black font-bold mb-4 transition-colors"
      >
        ← Tillbaka
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-bold text-lg text-black">{session.title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(session.scheduled_at).toLocaleDateString('sv-SE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}{' '}
              kl. {new Date(session.scheduled_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-500 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Clock className="w-4 h-4 mx-auto mb-1 text-gray-400" />
            <p className="text-lg font-bold text-black">{session.planned_duration_min}</p>
            <p className="text-xs text-gray-400">min planerat</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Activity className="w-4 h-4 mx-auto mb-1 text-gray-400" />
            <p className="text-lg font-bold text-black">{session.planned_rpe}</p>
            <p className="text-xs text-gray-400">RPE</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto mb-1 text-gray-400" />
            <p className="text-lg font-bold text-black">{plannedLoad}</p>
            <p className="text-xs text-gray-400">AU belastning</p>
          </div>
        </div>

        {session.purpose && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Syfte</p>
            <p className="text-sm text-gray-700">{session.purpose}</p>
          </div>
        )}
        {session.content && (
          <div className="mt-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Innehåll</p>
            <p className="text-sm text-gray-700">{session.content}</p>
          </div>
        )}
        {session.exercises && (
          <div className="mt-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Övningar</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{session.exercises}</p>
          </div>
        )}
        {session.goal && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs font-bold text-green-700">Kopplat till IUP-mål</p>
            <p className="text-sm text-green-600 mt-0.5">
              {AREA_LABELS[session.goal.area]} — {session.goal.target_description}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="font-bold text-black mb-4">Spelarnas genomförande</h4>
        {assignedPlayers.length === 0 ? (
          <p className="text-sm text-gray-400">Inga spelare tilldelade detta pass.</p>
        ) : (
          <div className="space-y-3">
            {assignedPlayers.map((p) => {
              const comp = session.completions.find((c) => c.player_id === p.id);
              return (
                <CompletionRow
                  key={p.id}
                  player={p}
                  completion={comp || null}
                  plannedDuration={session.planned_duration_min}
                  plannedRpe={session.planned_rpe}
                  onSave={(data) => onSaveCompletion(session.id, p.id, data)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CompletionRow({
  player,
  completion,
  plannedDuration,
  plannedRpe,
  onSave,
}: {
  player: Player;
  completion: TrainingCompletion | null;
  plannedDuration: number;
  plannedRpe: number;
  onSave: (data: Partial<TrainingCompletion>) => void;
}) {
  const [editing, setEditing] = useState(!completion);
  const [actualDur, setActualDur] = useState(completion?.actual_duration_min?.toString() || '');
  const [rpe, setRpe] = useState(completion?.player_rpe?.toString() || '');
  const [hasPain, setHasPain] = useState(completion?.has_pain ?? false);
  const [painNote, setPainNote] = useState(completion?.pain_note || '');
  const [reflection, setReflection] = useState(completion?.player_reflection || '');
  const [saving, setSaving] = useState(false);

  const actualLoad = completion?.actual_duration_min && completion?.player_rpe
    ? completion.actual_duration_min * completion.player_rpe
    : null;
  const plannedLoad = plannedDuration * plannedRpe;

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      actual_duration_min: actualDur ? parseInt(actualDur) : null,
      player_rpe: rpe ? parseInt(rpe) : null,
      has_pain: hasPain,
      pain_note: painNote || null,
      player_reflection: reflection || null,
    });
    setSaving(false);
    setEditing(false);
  };

  if (!editing && completion) {
    return (
      <div className="border border-gray-200 rounded-xl p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">
            {player.jersey_number ?? <User className="w-4 h-4" />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-black text-sm">{player.name}</p>
            <p className="text-xs text-gray-400">
              Faktisk: {completion.actual_duration_min ?? '—'} min · RPE {completion.player_rpe ?? '—'} · {actualLoad ?? '—'} AU
            </p>
          </div>
          {completion.has_pain && (
            <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Känning
            </span>
          )}
          <button onClick={() => setEditing(true)} className="text-xs font-bold text-gray-500 hover:text-black">
            Ändra
          </button>
        </div>
        {completion.player_reflection && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mt-2">{completion.player_reflection}</p>
        )}
      </div>
    );
  }

  return (
    <div className="border-2 border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">
          {player.jersey_number ?? <User className="w-4 h-4" />}
        </div>
        <p className="font-bold text-black text-sm">{player.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Faktisk tid (min)</label>
          <input
            type="number"
            value={actualDur}
            onChange={(e) => setActualDur(e.target.value)}
            placeholder={String(plannedDuration)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 mb-1">Spelarens RPE (1–10)</label>
          <input
            type="number"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            placeholder={String(plannedRpe)}
            min={1}
            max={10}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 mb-2 cursor-pointer">
        <input type="checkbox" checked={hasPain} onChange={(e) => setHasPain(e.target.checked)} className="accent-black" />
        <span className="text-sm text-gray-700 font-medium">Känning/smärta</span>
      </label>

      {hasPain && (
        <input
          value={painNote}
          onChange={(e) => setPainNote(e.target.value)}
          placeholder="Beskriv känningen..."
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
        />
      )}

      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="Spelarens kommentar och reflektion..."
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Spara
        </button>
        {completion && (
          <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold">
            Avbryt
          </button>
        )}
      </div>
    </div>
  );
}
