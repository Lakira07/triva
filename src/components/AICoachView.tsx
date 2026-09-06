import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Brain,
  Dumbbell,
  Moon,
  Zap,
  Heart,
  Users,
  ClipboardList,
  RefreshCw,
  User,
} from 'lucide-react';
import { supabase, type Player, type WellbeingEntry, type Question, type Answer, type Response } from '@/lib/supabase';

interface ResponseWithAnswers extends Response {
  answers: Answer[];
}

type RiskLevel = 'low' | 'moderate' | 'high';

interface PlayerAnalysis {
  player: Player;
  latestEntry: WellbeingEntry | null;
  avgWellbeing: number | null;
  avgSleep: number | null;
  avgEnergy: number | null;
  avgMood: number | null;
  avgStress: number | null;
  avgSoreness: number | null;
  trend: 'up' | 'down' | 'stable' | 'unknown';
  riskLevel: RiskLevel;
  riskFactors: string[];
  recommendations: string[];
  surveyCount: number;
  latestSurveyDate: string | null;
}

interface TeamAnalysis {
  teamAvgWellbeing: number | null;
  teamRiskLevel: RiskLevel;
  highRiskPlayers: PlayerAnalysis[];
  moderateRiskPlayers: PlayerAnalysis[];
  lowRiskPlayers: PlayerAnalysis[];
  teamRecommendations: string[];
  suggestedLineup: { player: Player; reason: string; starter: boolean }[];
  suggestedExercises: { title: string; description: string; target: string; icon: typeof Dumbbell }[];
  playerAnalyses: PlayerAnalysis[];
}

export default function AICoachView({ teamId }: { teamId: string }) {
  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'lineup' | 'exercises' | 'players'>('overview');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: playerData }, { data: entryData }, { data: questionData }, { data: respData }, { data: ansData }] =
      await Promise.all([
        supabase.from('players').select('*').eq('team_id', teamId).order('name', { ascending: true }),
        supabase.from('wellbeing_entries').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
        supabase.from('questions').select('*').eq('team_id', teamId).order('order_index', { ascending: true }),
        supabase.from('responses').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
        supabase.from('answers').select('*'),
      ]);

    const players = (playerData || []) as Player[];
    const entries = (entryData || []) as WellbeingEntry[];
    const questions = (questionData || []) as Question[];
    const responses: ResponseWithAnswers[] = (respData || []).map((r: any) => ({
      ...r,
      answers: (ansData || []).filter((a: any) => a.response_id === r.id),
    }));

    setAnalysis(buildAnalysis(players, entries, questions, responses));
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  if (!analysis || analysis.playerAnalyses.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-card">
        <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={2} />
        <p className="text-gray-500 font-medium">Skapa spelarprofiler och samla in välmåendedata för att få AI-rekommendationer.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Section tabs */}
      <div className="flex gap-1 sm:gap-2 mb-6 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
        {([
          { key: 'overview', label: 'Översikt', icon: Sparkles },
          { key: 'lineup', label: 'Laguttagning', icon: Users },
          { key: 'exercises', label: 'Övningar', icon: Dumbbell },
          { key: 'players', label: 'Spelaranalys', icon: Brain },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeSection === key
                ? 'bg-white text-black shadow-soft'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={2.5} />
            {label}
          </button>
        ))}
        <button
          onClick={fetchAll}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-gray-500 hover:text-black transition-colors"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>

      {activeSection === 'overview' && <OverviewSection analysis={analysis} />}
      {activeSection === 'lineup' && <LineupSection analysis={analysis} />}
      {activeSection === 'exercises' && <ExercisesSection analysis={analysis} />}
      {activeSection === 'players' && <PlayersSection analysis={analysis} />}
    </div>
  );
}

/* ===== Analysis Engine ===== */

function buildAnalysis(
  players: Player[],
  entries: WellbeingEntry[],
  questions: Question[],
  responses: ResponseWithAnswers[]
): TeamAnalysis {
  const playerAnalyses: PlayerAnalysis[] = players.map((player) => {
    const playerEntries = entries
      .filter((e) => e.player_id === player.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const playerResponses = responses.filter((r) => r.player_id === player.id);
    const latestSurvey = playerResponses
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    const latestEntry = playerEntries.length > 0 ? playerEntries[playerEntries.length - 1] : null;

    const avg = (key: keyof WellbeingEntry) => {
      if (playerEntries.length === 0) return null;
      const sum = playerEntries.reduce((acc, e) => acc + (e[key] as number), 0);
      return sum / playerEntries.length;
    };

    const overallScore = (e: WellbeingEntry) =>
      (e.sleep + e.energy + e.mood + (6 - e.stress) + (6 - e.soreness)) / 5;

    const avgWellbeing =
      playerEntries.length > 0
        ? playerEntries.reduce((acc, e) => acc + overallScore(e), 0) / playerEntries.length
        : null;

    let trend: PlayerAnalysis['trend'] = 'unknown';
    if (playerEntries.length >= 2) {
      const recent = playerEntries.slice(-3);
      const firstAvg = recent.slice(0, Math.ceil(recent.length / 2)).reduce((a, e) => a + overallScore(e), 0) / Math.ceil(recent.length / 2);
      const lastAvg = recent.slice(Math.ceil(recent.length / 2)).reduce((a, e) => a + overallScore(e), 0) / Math.ceil(recent.length / 2);
      const diff = lastAvg - firstAvg;
      if (diff > 0.3) trend = 'up';
      else if (diff < -0.3) trend = 'down';
      else trend = 'stable';
    }

    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    const aSleep = avg('sleep');
    const aEnergy = avg('energy');
    const aMood = avg('mood');
    const aStress = avg('stress');
    const aSoreness = avg('soreness');

    if (aSleep !== null && aSleep < 3) {
      riskFactors.push('Låg sömnkvalitet');
      recommendations.push('Prioritera sömn och återhämtning — överväg en lättare träningspass eller vilodag.');
    }
    if (aEnergy !== null && aEnergy < 3) {
      riskFactors.push('Låg energinivå');
      recommendations.push('Fokusera på återhämtning och kost. Undvik högintensiva pass idag.');
    }
    if (aMood !== null && aMood < 3) {
      riskFactors.push('Lågt sinneslag');
      recommendations.push('Kolla in med spelaren individuellt. Positiv bekräftelse och sociala övningar rekommenderas.');
    }
    if (aStress !== null && aStress > 3.5) {
      riskFactors.push('Hög stressnivå');
      recommendations.push('Minska pressen — fokusera på teknik och lagkänsla istället för resultat.');
    }
    if (aSoreness !== null && aSoreness > 3.5) {
      riskFactors.push('Hög stelhet/trötthet i muskler');
      recommendations.push('Inled med extra uppvärmning och rörlighetsövningar. Överväg lättare pass.');
    }

    let riskLevel: RiskLevel = 'low';
    if (riskFactors.length >= 3 || (aSleep !== null && aSleep < 2.5) || (aEnergy !== null && aEnergy < 2.5)) {
      riskLevel = 'high';
    } else if (riskFactors.length >= 1) {
      riskLevel = 'moderate';
    }

    if (riskLevel === 'low' && playerEntries.length > 0) {
      recommendations.push('Spelaren mår bra — utmanas med full intensitet och ledaransvar.');
    }

    if (trend === 'down') {
      riskFactors.push('Negativ trend i välmående');
      recommendations.push('Trenden går ner — överväg en avlastningsvecka eller individuell check.');
    } else if (trend === 'up' && riskLevel !== 'high') {
      recommendations.push('Positiv trend! Spelaren utvecklas väl — bibli rutinen.');
    }

    return {
      player,
      latestEntry,
      avgWellbeing,
      avgSleep: aSleep,
      avgEnergy: aEnergy,
      avgMood: aMood,
      avgStress: aStress,
      avgSoreness: aSoreness,
      trend,
      riskLevel,
      riskFactors,
      recommendations,
      surveyCount: playerResponses.length,
      latestSurveyDate: latestSurvey ? latestSurvey.created_at : null,
    };
  });

  const playersWithData = playerAnalyses.filter((a) => a.avgWellbeing !== null);
  const teamAvgWellbeing =
    playersWithData.length > 0
      ? playersWithData.reduce((acc, a) => acc + (a.avgWellbeing as number), 0) / playersWithData.length
      : null;

  const highRisk = playerAnalyses.filter((a) => a.riskLevel === 'high');
  const moderateRisk = playerAnalyses.filter((a) => a.riskLevel === 'moderate');
  const lowRisk = playerAnalyses.filter((a) => a.riskLevel === 'low');

  let teamRiskLevel: RiskLevel = 'low';
  if (highRisk.length >= 3 || (playersWithData.length > 0 && (teamAvgWellbeing ?? 5) < 3)) {
    teamRiskLevel = 'high';
  } else if (highRisk.length >= 1 || moderateRisk.length >= 2 || (teamAvgWellbeing !== null && teamAvgWellbeing < 3.5)) {
    teamRiskLevel = 'moderate';
  }

  const teamRecommendations: string[] = [];
  if (teamRiskLevel === 'high') {
    teamRecommendations.push('Flera spelare visar tecken på överbelastning — planera en avlastningsvecka med låg intensitet.');
    teamRecommendations.push('Överväg att skjuta upp taktiska moment och fokusera på återhämtning och rörlighet.');
  } else if (teamRiskLevel === 'moderate') {
    teamRecommendations.push('Vissa spelare behöver extra återhämtning — variera intensiteten under passet.');
    teamRecommendations.push('Kombinera teknikövningar med lättare fys för att hålla laget friskt.');
  } else {
    teamRecommendations.push('Laget mår bra — kör full intensitet och utmana med tävlingsliknande övningar.');
  }

  if (teamAvgWellbeing !== null && teamAvgWellbeing < 3.5) {
    teamRecommendations.push('Snittvälmåendet är lågt — prioritera sömn, kost och individuell feedback.');
  }

  const highStressCount = playerAnalyses.filter((a) => a.avgStress !== null && (a.avgStress as number) > 3.5).length;
  if (highStressCount >= Math.ceil(players.length / 3)) {
    teamRecommendations.push('Stora delar av laget rapporterar hög stress — minska pressen och skapa en positiv miljö.');
  }

  const highSorenessCount = playerAnalyses.filter((a) => a.avgSoreness !== null && (a.avgSoreness as number) > 3.5).length;
  if (highSorenessCount >= Math.ceil(players.length / 3)) {
    teamRecommendations.push('Många spelare är stela — inled nästa pass med utökad rörlighet och mjuk träning.');
  }

  const suggestedLineup = buildLineup(playerAnalyses);
  const suggestedExercises = buildExercises(playerAnalyses, teamRiskLevel);

  return {
    teamAvgWellbeing,
    teamRiskLevel,
    highRiskPlayers: highRisk,
    moderateRiskPlayers: moderateRisk,
    lowRiskPlayers: lowRisk,
    teamRecommendations,
    suggestedLineup,
    suggestedExercises,
    playerAnalyses,
  };
}

function buildLineup(analyses: PlayerAnalysis[]): { player: Player; reason: string; starter: boolean }[] {
  const sorted = [...analyses].sort((a, b) => {
    const scoreA = a.avgWellbeing ?? 0;
    const scoreB = b.avgWellbeing ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.riskLevel === 'high' ? 1 : -1;
  });

  return sorted.map((a) => {
    let starter = true;
    let reason = '';

    if (a.riskLevel === 'high') {
      starter = false;
      reason = 'Hög belastning — rekommenderas vila eller inhopp.';
    } else if (a.riskLevel === 'moderate') {
      starter = true;
      reason = 'Måttlig belastning — starta men överväg att byta ut tidigt.';
    } else if (a.avgWellbeing !== null && (a.avgWellbeing as number) >= 4) {
      starter = true;
      reason = 'Toppskick — stark kandidat för startelvan.';
    } else {
      starter = true;
      reason = 'Stabil form — redo att starta.';
    }

    if (a.player.position === 'Målvakt') {
      starter = true;
      reason = a.riskLevel === 'high'
        ? 'Målvakt med hög belastning — överväg reserv om tillgänglig.'
        : 'Målvakt — starta baserat på position och tillgänglighet.';
    }

    return { player: a.player, reason, starter };
  });
}

function buildExercises(
  analyses: PlayerAnalysis[],
  teamRisk: RiskLevel
): { title: string; description: string; target: string; icon: typeof Dumbbell }[] {
  const exercises: { title: string; description: string; target: string; icon: typeof Dumbbell }[] = [];

  const lowEnergyCount = analyses.filter((a) => a.avgEnergy !== null && (a.avgEnergy as number) < 3).length;
  const highStressCount = analyses.filter((a) => a.avgStress !== null && (a.avgStress as number) > 3.5).length;
  const highSorenessCount = analyses.filter((a) => a.avgSoreness !== null && (a.avgSoreness as number) > 3.5).length;
  const lowMoodCount = analyses.filter((a) => a.avgMood !== null && (a.avgMood as number) < 3).length;
  const lowSleepCount = analyses.filter((a) => a.avgSleep !== null && (a.avgSleep as number) < 3).length;

  if (teamRisk === 'high' || highSorenessCount >= 2) {
    exercises.push({
      title: 'Rörlighet & skumrulle',
      description: '20 min mjuk träning: dynamisk stretching, skumrulle och rörlighetsövningar. Fokus på återhämtning och muskelavslappning.',
      target: 'Spelare med hög stelhet eller hela laget vid avlastningspass',
      icon: Moon,
    });
  }

  if (lowEnergyCount >= 2 || teamRisk === 'high') {
    exercises.push({
      title: 'Lågintensiv teknikpass',
      description: 'Fokus på bollkontroll, passningsövningar i låg fart och positionsförståelse. Ingen kontakt eller sprint.',
      target: 'Spelare med låg energi eller hela laget vid avlastning',
      icon: Zap,
    });
  }

  if (highStressCount >= 2) {
    exercises.push({
      title: 'Andning & mental återhämtning',
      description: '10 min guidad andningsövning och mental visualisering. Följs av lekfulla smålagsspel utan resultatfokus.',
      target: 'Spelare med hög stress eller lågt sinneslag',
      icon: Heart,
    });
  }

  if (lowMoodCount >= 2) {
    exercises.push({
      title: 'Sociala lagövningar',
      description: 'Kooperativa lekar och lagbyggnadsövningar. Smålagsspel där samarbete belönas, inte resultat.',
      target: 'Spelare med lågt sinneslag',
      icon: Users,
    });
  }

  if (teamRisk === 'low') {
    exercises.push({
      title: 'Högintensivt smålagsspel',
      description: '4 mot 4 med högt tempo, 3-minuterspass. Fokus på intensitet, pressning och snabba omställningar.',
      target: 'Hela laget — spelare i god form',
      icon: Dumbbell,
    });
    exercises.push({
      title: 'Taktiskt positionsförståelse',
      description: '11 mot 11-liknande övning med fokus på formationsstruktur, presslag och omställningsspel.',
      target: 'Hela laget',
      icon: Brain,
    });
  }

  if (lowSleepCount >= 2) {
    exercises.push({
      title: 'Återhämtningspass & sömnrutin',
      description: 'Lättare raska utan ansträngning. Avsluta med en genomgång av sömnrutiner och tips för bättre återhämtning.',
      target: 'Spelare med låg sömnkvalitet',
      icon: Moon,
    });
  }

  if (exercises.length === 0) {
    exercises.push({
      title: 'Balanserat träningspass',
      description: 'Standardpass med uppvärmning, teknikövningar och smålagsspel. Avsluta med nedvarvning och sträck.',
      target: 'Hela laget',
      icon: Dumbbell,
    });
  }

  return exercises;
}

/* ===== UI Sections ===== */

function OverviewSection({ analysis }: { analysis: TeamAnalysis }) {
  const riskConfig: Record<RiskLevel, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
    low: { label: 'Låg risk', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: CheckCircle2 },
    moderate: { label: 'Måttlig risk', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
    high: { label: 'Hög risk', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
  };

  const rc = riskConfig[analysis.teamRiskLevel];

  return (
    <div className="space-y-6">
      {/* Team status card */}
      <div className={`rounded-3xl border p-5 ${rc.bg}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-11 h-11 rounded-2xl bg-white flex items-center justify-center ${rc.color} shadow-soft`}>
            <rc.icon className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-extrabold text-black text-lg text-heading">Lagstatus: {rc.label}</h3>
            {analysis.teamAvgWellbeing !== null && (
              <p className="text-sm text-gray-600 font-medium">
                Snitt välmående: <span className="font-extrabold">{analysis.teamAvgWellbeing.toFixed(1)}/5</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Team recommendations */}
      <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-card">
        <h3 className="font-bold text-black mb-4 flex items-center gap-2 text-heading">
          <Sparkles className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
          AI-rekommendationer för laget
        </h3>
        <div className="space-y-3">
          {analysis.teamRecommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
              <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                {i + 1}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed pt-0.5 font-medium">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk distribution */}
      <div className="grid grid-cols-3 gap-3">
        <RiskCard count={analysis.highRiskPlayers.length} label="Hög risk" color="text-red-600" bg="bg-red-50" icon={AlertTriangle} />
        <RiskCard count={analysis.moderateRiskPlayers.length} label="Måttlig" color="text-amber-600" bg="bg-amber-50" icon={AlertTriangle} />
        <RiskCard count={analysis.lowRiskPlayers.length} label="Låg risk" color="text-green-600" bg="bg-green-50" icon={CheckCircle2} />
      </div>

      {/* Quick player alerts */}
      {analysis.highRiskPlayers.length > 0 && (
        <div className="bg-white rounded-3xl border border-red-200 p-5 shadow-card">
          <h3 className="font-bold text-black mb-3 flex items-center gap-2 text-heading">
            <AlertTriangle className="w-5 h-5 text-red-500" strokeWidth={2.5} />
            Spelare som behöver uppmärksamhet
          </h3>
          <div className="space-y-2">
            {analysis.highRiskPlayers.map((a) => (
              <div key={a.player.id} className="flex items-center gap-3 bg-red-50 rounded-2xl p-3">
                <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                  {a.player.jersey_number != null ? (
                    <span className="text-xs font-extrabold">{a.player.jersey_number}</span>
                  ) : (
                    <User className="w-4 h-4" strokeWidth={2.5} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-black">{a.player.name}</p>
                  <p className="text-xs text-red-600 font-medium">{a.riskFactors.join(' · ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskCard({ count, label, color, bg, icon: Icon }: { count: number; label: string; color: string; bg: string; icon: typeof AlertTriangle }) {
  return (
    <div className={`${bg} rounded-xl border border-gray-200 p-4 text-center`}>
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function LineupSection({ analysis }: { analysis: TeamAnalysis }) {
  const starters = analysis.suggestedLineup.filter((l) => l.starter);
  const bench = analysis.suggestedLineup.filter((l) => !l.starter);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-card">
        <h3 className="font-bold text-black mb-1 flex items-center gap-2 text-heading">
          <Users className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
          AI-föreslagen laguttagning
        </h3>
        <p className="text-sm text-gray-500 mb-4 font-medium">Baserat på spelarnas välmående, form och position.</p>

        <div className="space-y-2 mb-5">
          <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Startelva</p>
          {starters.map((s) => (
            <LineupRow key={s.player.id} player={s.player} reason={s.reason} starter />
          ))}
        </div>

        {bench.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Bänk / Vila</p>
            {bench.map((s) => (
              <LineupRow key={s.player.id} player={s.player} reason={s.reason} starter={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LineupRow({ player, reason, starter }: { player: Player; reason: string; starter: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-3 border ${starter ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${starter ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
        {player.jersey_number != null ? (
          <span className="text-sm font-extrabold">{player.jersey_number}</span>
        ) : (
          <User className="w-4 h-4" strokeWidth={2.5} />
        )}
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-black">{player.name}</p>
        <p className="text-xs text-gray-500 font-medium">{reason}</p>
      </div>
      {player.position && (
        <span className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-lg font-bold">
          {player.position}
        </span>
      )}
    </div>
  );
}

function ExercisesSection({ analysis }: { analysis: TeamAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-card">
        <h3 className="font-bold text-black mb-1 flex items-center gap-2 text-heading">
          <Dumbbell className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
          AI-föreslagna övningar
        </h3>
        <p className="text-sm text-gray-500 mb-4 font-medium">Anpassade utifrån lagets nuvarande status och individuella behov.</p>
      </div>

      {analysis.suggestedExercises.map((ex, i) => (
        <div key={i} className="bg-white rounded-3xl border border-gray-200 p-5 shadow-card">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center flex-shrink-0">
              <ex.icon className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-black text-heading">{ex.title}</h4>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Målgrupp: {ex.target}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed font-medium">{ex.description}</p>
        </div>
      ))}
    </div>
  );
}

function PlayersSection({ analysis }: { analysis: TeamAnalysis }) {
  const [selected, setSelected] = useState<PlayerAnalysis | null>(null);

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black font-bold mb-4 transition-colors"
        >
          ← Tillbaka
        </button>

        <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-card mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-extrabold">
              {selected.player.jersey_number != null ? (
                <span>{selected.player.jersey_number}</span>
              ) : (
                <User className="w-6 h-6" strokeWidth={2.5} />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-black text-heading">{selected.player.name}</h3>
              {selected.player.position && (
                <p className="text-sm text-gray-500 font-medium">{selected.player.position}</p>
              )}
            </div>
          </div>

          {selected.avgWellbeing !== null && (
            <div className="grid grid-cols-5 gap-2 mt-4">
              <MetricCard label="Sömn" value={selected.avgSleep} icon={Moon} invert={false} />
              <MetricCard label="Energi" value={selected.avgEnergy} icon={Zap} invert={false} />
              <MetricCard label="Sinne" value={selected.avgMood} icon={Heart} invert={false} />
              <MetricCard label="Stress" value={selected.avgStress} icon={Brain} invert={true} />
              <MetricCard label="Stelhet" value={selected.avgSoreness} icon={Dumbbell} invert={true} />
            </div>
          )}

          <div className="flex gap-2 mt-4 flex-wrap">
            {selected.trend !== 'unknown' && (
              <span className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                selected.trend === 'up' ? 'bg-green-50 text-green-700' :
                selected.trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {selected.trend === 'up' && <TrendingUp className="w-3 h-3" strokeWidth={2.5} />}
                {selected.trend === 'down' && <TrendingDown className="w-3 h-3" strokeWidth={2.5} />}
                {selected.trend === 'stable' && '→'}
                {selected.trend === 'up' ? 'Positiv trend' : selected.trend === 'down' ? 'Negativ trend' : 'Stabil'}
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
              selected.riskLevel === 'high' ? 'bg-red-50 text-red-600' :
              selected.riskLevel === 'moderate' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-700'
            }`}>
              {selected.riskLevel === 'high' ? 'Hög risk' : selected.riskLevel === 'moderate' ? 'Måttlig risk' : 'Låg risk'}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
              <ClipboardList className="w-3 h-3" strokeWidth={2.5} />
              {selected.surveyCount} enkäter
            </span>
          </div>
        </div>

        {selected.riskFactors.length > 0 && (
          <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-card mb-4">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" strokeWidth={2.5} />
              Riskfaktorer
            </h4>
            <div className="flex flex-wrap gap-2">
              {selected.riskFactors.map((rf, i) => (
                <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-bold">
                  {rf}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-card">
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gray-700" strokeWidth={2.5} />
            Rekommendationer
          </h4>
          <div className="space-y-2">
            {selected.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
                <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed pt-0.5 font-medium">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {analysis.playerAnalyses.map((a) => (
        <button
          key={a.player.id}
          onClick={() => setSelected(a)}
          className="w-full bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 hover:border-black hover:shadow-card transition-all text-left"
        >
          <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
            {a.player.jersey_number != null ? (
              <span className="text-sm font-extrabold">{a.player.jersey_number}</span>
            ) : (
              <User className="w-5 h-5" strokeWidth={2.5} />
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-black">{a.player.name}</p>
            <p className="text-sm text-gray-500 font-medium">
              {a.player.position ? `${a.player.position} · ` : ''}
              {a.riskFactors.length > 0 ? a.riskFactors.join(' · ') : 'Inga riskfaktorer'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {a.avgWellbeing !== null && (
              <span className="text-sm font-extrabold text-black">{a.avgWellbeing.toFixed(1)}</span>
            )}
            <span className={`w-3 h-3 rounded-full ${
              a.riskLevel === 'high' ? 'bg-red-500' :
              a.riskLevel === 'moderate' ? 'bg-amber-400' : 'bg-green-500'
            }`} />
          </div>
        </button>
      ))}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, invert }: { label: string; value: number | null; icon: typeof Moon; invert: boolean }) {
  if (value === null) {
    return (
      <div className="text-center bg-gray-50 rounded-xl py-2">
        <Icon className="w-4 h-4 mx-auto mb-1 text-gray-300" strokeWidth={2.5} />
        <p className="text-sm font-extrabold text-gray-300">—</p>
        <p className="text-xs text-gray-400 font-bold">{label}</p>
      </div>
    );
  }

  const isLow = invert ? value > 3.5 : value < 3;
  const colorClass = isLow ? 'text-red-600' : 'text-black';

  return (
    <div className={`text-center rounded-xl py-2 ${isLow ? 'bg-red-50' : 'bg-gray-50'}`}>
      <Icon className={`w-4 h-4 mx-auto mb-1 ${isLow ? 'text-red-400' : 'text-gray-400'}`} strokeWidth={2.5} />
      <p className={`text-sm font-extrabold ${colorClass}`}>{value.toFixed(1)}</p>
      <p className="text-xs text-gray-400 font-bold">{label}</p>
    </div>
  );
}
