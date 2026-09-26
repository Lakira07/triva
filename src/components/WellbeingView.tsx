import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  Loader2,
  User,
  Calendar,
  Trash2,
  Activity,
  Moon,
  Zap,
  Heart,
  Brain,
  Dumbbell,
} from 'lucide-react';
import { supabase, type Player, type WellbeingEntry, WELLBEING_METRICS } from '@/lib/supabase';
import LineChart from '@/components/LineChart';

const SERIES_COLORS = ['#000000', '#6b7280', '#9ca3af', '#4b5563', '#d1d5db'];

const METRIC_ICONS: Record<string, typeof Moon> = {
  sleep: Moon,
  energy: Zap,
  mood: Heart,
  stress: Brain,
  soreness: Dumbbell,
};

export default function WellbeingView({ teamId, initialPlayerId, onBackToList }: { teamId: string; initialPlayerId?: string | null; onBackToList?: () => void }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<WellbeingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: playerData }, { data: entryData }] = await Promise.all([
      supabase.from('players').select('*').eq('team_id', teamId).order('name', { ascending: true }),
      supabase.from('wellbeing_entries').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    ]);
    setPlayers((playerData || []) as Player[]);
    setEntries((entryData || []) as WellbeingEntry[]);
    return (playerData || []) as Player[];
  }, [teamId]);

  useEffect(() => {
    (async () => {
      const loadedPlayers = await fetchAll();
      if (initialPlayerId) {
        setSelectedPlayer(loadedPlayers.find((player) => player.id === initialPlayerId) || null);
      }
      setLoading(false);
    })();
  }, [fetchAll, initialPlayerId]);

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from('wellbeing_entries').delete().eq('id', id);
    if (error) {
      console.error('Error deleting entry:', error);
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

  if (players.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
        <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Skapa spelarprofiler först för att följa välmående över tid.</p>
      </div>
    );
  }

  // Detail view for a single player
  if (selectedPlayer) {
    const playerEntries = entries
      .filter((e) => e.player_id === selectedPlayer.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const chartData = playerEntries.map((e) => ({
      label: new Date(e.created_at).toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
      }),
      values: {
        sleep: e.sleep,
        energy: e.energy,
        mood: e.mood,
        stress: e.stress,
        soreness: e.soreness,
      },
    }));

    const series = WELLBEING_METRICS.map((m, i) => ({
      key: m.key,
      label: m.label,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }));

    const avg = (key: string) => {
      if (playerEntries.length === 0) return 0;
      const sum = playerEntries.reduce((acc, e) => acc + (e as any)[key], 0);
      return (sum / playerEntries.length).toFixed(1);
    };

    return (
      <div>
        <button
          onClick={() => { setSelectedPlayer(null); onBackToList?.(); }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-black font-medium mb-4"
        >
          ← Tillbaka
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
              {selectedPlayer.jersey_number != null ? (
                <span className="text-sm font-bold">{selectedPlayer.jersey_number}</span>
              ) : (
                <User className="w-5 h-5" />
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
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
              {playerEntries.length} inlämningar
            </span>
            {playerEntries.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                Senast: {new Date(playerEntries[playerEntries.length - 1].created_at).toLocaleDateString('sv-SE')}
              </span>
            )}
          </div>
        </div>

        {playerEntries.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Inga välmående-inlämningar för denna spelare ännu.</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Utveckling över tid
              </h4>
              <LineChart data={chartData} series={series} />
            </div>

            {/* Average scores */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Snitt över alla inlämningar</h4>
              <div className="grid grid-cols-5 gap-2">
                {WELLBEING_METRICS.map((m) => {
                  const Icon = METRIC_ICONS[m.key];
                  return (
                    <div key={m.key} className="text-center">
                      <Icon className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                      <p className="text-lg font-bold text-black">{avg(m.key)}</p>
                      <p className="text-xs text-gray-400">{m.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Entry history */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Historik</h4>
              <div className="space-y-4">
                {[...playerEntries].reverse().map((e) => (
                  <div key={e.id} className="border-t border-gray-100 pt-4 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(e.created_at).toLocaleString('sv-SE')}
                      </span>
                      <button
                        onClick={() => deleteEntry(e.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-2 mb-2">
                      {WELLBEING_METRICS.map((m) => (
                        <div key={m.key} className="text-center bg-gray-50 rounded-lg py-1.5">
                          <p className="text-xs text-gray-400">{m.label}</p>
                          <p className="text-sm font-bold text-black">{(e as any)[m.key]}/5</p>
                        </div>
                      ))}
                    </div>
                    {e.note && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-2">
                        {e.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Overview: list all players with latest entry summary
  return (
    <div className="space-y-3">
      {players.map((p) => {
        const playerEntries = entries.filter((e) => e.player_id === p.id);
        const latest = playerEntries
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const overallAvg = playerEntries.length > 0
          ? (
              playerEntries.reduce(
                (acc, e) => acc + e.sleep + e.energy + e.mood + (6 - e.stress) + (6 - e.soreness),
                0
              ) / (playerEntries.length * 5)
            ).toFixed(1)
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
                {playerEntries.length} inlämningar
                {p.position ? ` · ${p.position}` : ''}
              </p>
            </div>
            {overallAvg && (
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="text-lg font-bold text-black">{overallAvg}</span>
                </div>
                <p className="text-xs text-gray-400">snitt välmående</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
