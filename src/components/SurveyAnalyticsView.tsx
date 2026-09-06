import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  User,
  TrendingUp,
  Star,
  ArrowLeft,
  MessageSquare,
  ListChecks,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { supabase, type Player, type Question, type Answer, type Response } from '@/lib/supabase';
import LineChart from '@/components/LineChart';

const SERIES_COLORS = ['#000000', '#6b7280', '#9ca3af', '#4b5563', '#d1d5db', '#374151'];

interface ResponseWithAnswers extends Response {
  answers: Answer[];
}

export default function SurveyAnalyticsView({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<ResponseWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: playerData }, { data: questionData }, { data: respData }, { data: ansData }] =
      await Promise.all([
        supabase.from('players').select('*').eq('team_id', teamId).order('name', { ascending: true }),
        supabase.from('questions').select('*').eq('team_id', teamId).order('order_index', { ascending: true }),
        supabase.from('responses').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
        supabase.from('answers').select('*'),
      ]);

    setPlayers((playerData || []) as Player[]);
    setQuestions((questionData || []) as Question[]);

    const withAnswers: ResponseWithAnswers[] = (respData || []).map((r: any) => ({
      ...r,
      answers: (ansData || []).filter((a: any) => a.response_id === r.id),
    }));
    setResponses(withAnswers);
  }, [teamId]);

  useEffect(() => {
    (async () => {
      await fetchAll();
      setLoading(false);
    })();
  }, [fetchAll]);

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
        <p className="text-gray-500">Skapa spelarprofiler först för att se enkätsstatistik.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <ListChecks className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Skapa enkätfrågor först för att se statistik.</p>
      </div>
    );
  }

  // Detail view
  if (selectedPlayer) {
    const playerResponses = responses
      .filter((r) => r.player_id === selectedPlayer.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const ratingQuestions = questions.filter((q) => q.type === 'rating');
    const choiceQuestions = questions.filter((q) => q.type === 'choice');
    const textQuestions = questions.filter((q) => q.type === 'text');

    const getAnswerValue = (response: ResponseWithAnswers, questionId: string): string | null => {
      const ans = response.answers.find((a) => a.question_id === questionId);
      return ans ? ans.answer_text : null;
    };

    // Chart data for rating questions
    const chartData = playerResponses.map((r) => ({
      label: new Date(r.created_at).toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
      }),
      values: Object.fromEntries(
        ratingQuestions.map((q) => [q.id, parseInt(getAnswerValue(r, q.id) || '0') || 0])
      ),
    }));

    const ratingSeries = ratingQuestions.map((q, i) => ({
      key: q.id,
      label: q.text.length > 20 ? q.text.slice(0, 20) + '…' : q.text,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }));

    // Averages for rating questions
    const avgRating = (questionId: string): string => {
      const vals = playerResponses
        .map((r) => parseInt(getAnswerValue(r, questionId) || '0'))
        .filter((v) => v > 0);
      if (vals.length === 0) return '—';
      return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    };

    // Choice distribution
    const choiceDist = (questionId: string, options: string[]) => {
      const counts: Record<string, number> = Object.fromEntries(options.map((o) => [o, 0]));
      playerResponses.forEach((r) => {
        const val = getAnswerValue(r, questionId);
        if (val && counts[val] != null) counts[val]++;
      });
      return counts;
    };

    return (
      <div>
        <button
          onClick={() => setSelectedPlayer(null)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black font-medium mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Tillbaka
        </button>

        {/* Player header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0 font-bold">
              {selectedPlayer.jersey_number != null ? (
                <span>{selectedPlayer.jersey_number}</span>
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg text-black">{selectedPlayer.name}</h3>
              {selectedPlayer.position && (
                <p className="text-sm text-gray-500">{selectedPlayer.position}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md font-medium">
              {playerResponses.length} enkäter
            </span>
            {playerResponses.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md font-medium">
                Senast:{' '}
                {new Date(
                  playerResponses[playerResponses.length - 1].created_at
                ).toLocaleDateString('sv-SE')}
              </span>
            )}
          </div>
        </div>

        {playerResponses.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Inga enkätinlämningar för denna spelare ännu.</p>
          </div>
        ) : (
          <>
            {/* Rating chart */}
            {ratingQuestions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Betygsutveckling över tid
                </h4>
                <LineChart data={chartData} series={ratingSeries} />
              </div>
            )}

            {/* Rating averages */}
            {ratingQuestions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Snittbetyg
                </h4>
                <div className="space-y-3">
                  {ratingQuestions.map((q) => {
                    const avg = parseFloat(avgRating(q.id));
                    return (
                      <div key={q.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">{q.text}</span>
                          <span className="text-sm font-bold text-black">{avgRating(q.id)}</span>
                        </div>
                        {avg > 0 && (
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-black rounded-full transition-all duration-500"
                              style={{ width: `${(avg / 5) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Choice distributions */}
            {choiceQuestions.length > 0 &&
              choiceQuestions.map((q) => {
                const dist = choiceDist(q.id, q.options || []);
                const total = Object.values(dist).reduce((a, b) => a + b, 0);
                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6"
                  >
                    <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <ListChecks className="w-4 h-4" /> {q.text}
                    </h4>
                    <div className="space-y-2.5">
                      {(q.options || []).map((opt) => {
                        const count = dist[opt];
                        const pct = total > 0 ? (count / total) * 100 : 0;
                        return (
                          <div key={opt}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-gray-600">{opt}</span>
                              <span className="text-xs text-gray-400 font-medium">
                                {count} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gray-700 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {/* Text answers */}
            {textQuestions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Textsvar
                </h4>
                <div className="space-y-4">
                  {textQuestions.map((q) => (
                    <div key={q.id}>
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                        {q.text}
                      </p>
                      <div className="space-y-2">
                        {playerResponses.map((r) => {
                          const ans = r.answers.find((a) => a.question_id === q.id);
                          if (!ans) return null;
                          return (
                            <div
                              key={r.id}
                              className="border-l-2 border-gray-200 pl-3 py-1"
                            >
                              <p className="text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(r.created_at).toLocaleDateString('sv-SE')}
                              </p>
                              <p className="text-sm text-gray-700">{ans.answer_text}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Overview: list all players with survey counts and average rating
  const ratingQuestions = questions.filter((q) => q.type === 'rating');

  return (
    <div className="space-y-3">
      {players.map((p) => {
        const playerResponses = responses.filter((r) => r.player_id === p.id);
        const overallAvg =
          playerResponses.length > 0 && ratingQuestions.length > 0
            ? (() => {
                const allRatings: number[] = [];
                playerResponses.forEach((r) => {
                  ratingQuestions.forEach((q) => {
                    const ans = r.answers.find((a) => a.question_id === q.id);
                    if (ans) {
                      const val = parseInt(ans.answer_text);
                      if (val > 0) allRatings.push(val);
                    }
                  });
                });
                return allRatings.length > 0
                  ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
                  : null;
              })()
            : null;

        return (
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
              <p className="font-medium text-black">{p.name}</p>
              <p className="text-sm text-gray-500">
                {playerResponses.length} enkäter
                {p.position ? ` · ${p.position}` : ''}
              </p>
            </div>
            {overallAvg && (
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-gray-400" />
                  <span className="text-lg font-bold text-black">{overallAvg}</span>
                </div>
                <p className="text-xs text-gray-400">snitt betyg</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
