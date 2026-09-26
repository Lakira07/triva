import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Dumbbell,
  HeartPulse,
  Loader2,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { supabase, type Player, type WellbeingEntry } from '@/lib/supabase';
import LineChart from '@/components/LineChart';

type Range = '7d' | '4w' | '3m' | 'custom';

interface CoachOverviewProps {
  teamId: string;
  onOpenPlayer: (playerId: string) => void;
}

const METRIC_SERIES = [
  { key: 'sleep', label: 'Sömn', color: '#38664b' },
  { key: 'energy', label: 'Energi', color: '#cc8a26' },
  { key: 'stress', label: 'Stress', color: '#c4574c' },
  { key: 'soreness', label: 'Ömhet', color: '#65819a' },
];

function localDateKey(value: string | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function offsetDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function entryNeedsFollowUp(entry: WellbeingEntry): boolean {
  return entry.energy <= 2 || entry.sleep <= 2 || entry.stress >= 4 || entry.soreness >= 4;
}

export default function CoachOverview({ teamId, onOpenPlayer }: CoachOverviewProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<WellbeingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('7d');
  const [customStart, setCustomStart] = useState(offsetDate(-6));
  const [customEnd, setCustomEnd] = useState(localDateKey(new Date()));

  const fetchOverview = useCallback(async () => {
    const [{ data: playerData, error: playerError }, { data: entryData, error: entryError }] = await Promise.all([
      supabase.from('players').select('*').eq('team_id', teamId).order('name', { ascending: true }),
      supabase.from('wellbeing_entries').select('*').eq('team_id', teamId).order('created_at', { ascending: true }),
    ]);
    if (playerError) console.error('Error fetching team players:', playerError);
    if (entryError) console.error('Error fetching team wellbeing:', entryError);
    setPlayers((playerData || []) as Player[]);
    setEntries((entryData || []) as WellbeingEntry[]);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const latestByPlayer = useMemo(() => {
    const latest = new Map<string, WellbeingEntry>();
    for (const entry of entries) {
      const previous = latest.get(entry.player_id);
      if (!previous || new Date(entry.created_at) > new Date(previous.created_at)) {
        latest.set(entry.player_id, entry);
      }
    }
    return latest;
  }, [entries]);

  const todayKey = localDateKey(new Date());
  const registeredToday = players.filter((player) => {
    const entry = latestByPlayer.get(player.id);
    return entry && localDateKey(entry.created_at) === todayKey;
  });
  const missingToday = players.filter((player) => !registeredToday.some((registered) => registered.id === player.id));
  const lowEnergy = players.filter((player) => {
    const entry = latestByPlayer.get(player.id);
    return entry && localDateKey(entry.created_at) === todayKey && entry.energy <= 2;
  });
  const needsFollowUp = players.filter((player) => {
    const entry = latestByPlayer.get(player.id);
    return entry && localDateKey(entry.created_at) === todayKey && entryNeedsFollowUp(entry);
  });

  const trendEntries = useMemo(() => {
    const start = range === '7d' ? offsetDate(-6) : range === '4w' ? offsetDate(-27) : range === '3m' ? offsetDate(-89) : customStart;
    const end = range === 'custom' ? customEnd : todayKey;
    return entries.filter((entry) => {
      const key = localDateKey(entry.created_at);
      return key >= start && key <= end;
    });
  }, [customEnd, customStart, entries, range, todayKey]);

  const trendData = useMemo(() => {
    const byDate = new Map<string, WellbeingEntry[]>();
    for (const entry of trendEntries) {
      const key = localDateKey(entry.created_at);
      const dayEntries = byDate.get(key) || [];
      dayEntries.push(entry);
      byDate.set(key, dayEntries);
    }
    return [...byDate.entries()].slice(-20).map(([key, dayEntries]) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
      values: Object.fromEntries(METRIC_SERIES.map(({ key: metric }) => [
        metric,
        dayEntries.reduce((sum, entry) => sum + entry[metric as 'sleep' | 'energy' | 'stress' | 'soreness'], 0) / dayEntries.length,
      ])),
    }));
  }, [trendEntries]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-[#315c43]" /></div>;
  }

  const attentionNames = needsFollowUp.map((player) => player.name);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#557461]">{new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2 className="mt-1 text-2xl font-extrabold text-gray-950">Lagets dagsbild</h2>
          <p className="mt-1 text-sm text-gray-500">En överblick att följa upp tillsammans med spelarna.</p>
        </div>
        <div className="text-sm text-gray-500">Planera <span className="px-1 text-gray-300">/</span> Träna <span className="px-1 text-gray-300">/</span> Mäta <span className="px-1 text-gray-300">/</span> Följa upp</div>
      </div>

      <section aria-label="Dagens status" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryTile icon={<Users className="h-4 w-4" />} label="Spelare" value={players.length} detail="i gruppen" tone="neutral" />
        <SummaryTile icon={<ClipboardCheck className="h-4 w-4" />} label="Status idag" value={`${registeredToday.length}/${players.length}`} detail={`${missingToday.length} saknar registrering`} tone={missingToday.length ? 'amber' : 'green'} />
        <SummaryTile icon={<Zap className="h-4 w-4" />} label="Låg energi" value={lowEnergy.length} detail="värde 1–2 av 5" tone={lowEnergy.length ? 'amber' : 'neutral'} />
        <SummaryTile icon={<HeartPulse className="h-4 w-4" />} label="Följ upp" value={needsFollowUp.length} detail="avvikande statusvärde" tone={needsFollowUp.length ? 'red' : 'green'} />
        <SummaryTile icon={<Dumbbell className="h-4 w-4" />} label="Belastning" value="—" detail="inte registrerad" tone="neutral" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Gruppens återhämtning</p>
              <h3 className="mt-1 font-bold text-gray-900">Status över tid</h3>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Trendperiod">
              {([{ id: '7d', label: '7 dagar' }, { id: '4w', label: '4 veckor' }, { id: '3m', label: '3 månader' }, { id: 'custom', label: 'Egen period' }] as const).map(({ id, label }) => (
                <button key={id} onClick={() => setRange(id)} aria-pressed={range === id} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${range === id ? 'bg-[#234633] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {range === 'custom' && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500"><label>Från <input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} className="ml-1 rounded border border-gray-200 px-2 py-1 text-gray-700" /></label><label>Till <input type="date" value={customEnd} min={customStart} max={todayKey} onChange={(event) => setCustomEnd(event.target.value)} className="ml-1 rounded border border-gray-200 px-2 py-1 text-gray-700" /></label></div>}
          <div className="mt-4"><LineChart data={trendData} series={METRIC_SERIES} /></div>
          <p className="mt-2 text-xs text-gray-400">Gruppens dagsgenomsnitt av inskickade statusrapporter, skala 1–5.</p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><h3 className="font-bold text-gray-900">Värt att följa upp</h3></div>
          <p className="mt-1 text-xs leading-5 text-gray-500">Signaler är underlag för samtal, inte bedömningar eller diagnoser.</p>
          <div className="mt-4 space-y-2">
            {missingToday.length > 0 && <SignalRow title="Status saknas idag" names={missingToday.map((player) => player.name)} tone="amber" onOpen={() => onOpenPlayer(missingToday[0].id)} />}
            {attentionNames.length > 0 && <SignalRow title="Avvikande statusvärde" names={attentionNames} tone="red" onOpen={() => onOpenPlayer(needsFollowUp[0].id)} />}
            {missingToday.length === 0 && needsFollowUp.length === 0 && <p className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">Inga statusbaserade signaler idag.</p>}
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Träningsplan</p>
            <div className="mt-2 flex items-start gap-2 text-sm text-gray-600"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><span>Kommande pass och planerad belastning är inte registrerade i systemet ännu.</span></div>
            <div className="mt-3 flex items-start gap-2 text-sm text-gray-600"><Target className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /><span>IUP-mål och spelarreflektion saknar datastöd ännu.</span></div>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-5">
          <div><p className="text-xs font-bold uppercase tracking-wider text-gray-400">Grupp till individ</p><h3 className="mt-1 font-bold text-gray-900">Spelarstatus</h3></div>
          <p className="hidden text-xs text-gray-400 sm:block">Välj spelare för historik och detaljer</p>
        </div>
        {players.length === 0 ? <div className="px-5 py-10 text-center"><p className="font-semibold text-gray-700">Inga spelare i gruppen ännu</p><p className="mt-1 text-sm text-gray-500">Lägg till spelarprofiler för att börja följa gruppens status.</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500"><tr><th className="px-4 py-3 sm:px-5">Spelare</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Sömn</th><th className="px-3 py-3">Energi</th><th className="px-3 py-3">Ömhet</th><th className="px-3 py-3">Stress</th><th className="px-4 py-3">Uppföljning</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {players.map((player) => {
                  const entry = latestByPlayer.get(player.id);
                  const isToday = entry && localDateKey(entry.created_at) === todayKey;
                  return <tr key={player.id}>
                    <td className="px-4 py-3 sm:px-5"><button onClick={() => onOpenPlayer(player.id)} className="flex items-center gap-2 font-semibold text-gray-900 hover:text-[#315c43]"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf2ed] text-xs font-bold text-[#315c43]">{player.jersey_number ?? player.name.slice(0, 1).toUpperCase()}</span><span>{player.name}<span className="block text-xs font-normal text-gray-400">{player.position || 'Spelare'}</span></span><ChevronRight className="h-3.5 w-3.5 text-gray-300" /></button></td>
                    <td className="px-3 py-3">{entry ? <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isToday ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{isToday ? 'Idag' : new Date(entry.created_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}</span> : <span className="text-xs text-gray-400">Saknas</span>}</td>
                    {(['sleep', 'energy', 'soreness', 'stress'] as const).map((metric) => <td key={metric} className="px-3 py-3"><StatusValue value={entry?.[metric]} low={metric === 'sleep' || metric === 'energy'} high={metric === 'soreness' || metric === 'stress'} /></td>)}
                    <td className="px-4 py-3">{entry && isToday && entryNeedsFollowUp(entry) ? <button onClick={() => onOpenPlayer(player.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"><CircleHelp className="h-3.5 w-3.5" />Kolla läget</button> : <span className="text-xs text-gray-400">{isToday ? '—' : 'Status saknas idag'}</span>}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string | number; detail: string; tone: 'neutral' | 'green' | 'amber' | 'red' }) {
  const colors = { neutral: 'text-gray-500 bg-gray-100', green: 'text-green-700 bg-green-50', amber: 'text-amber-700 bg-amber-50', red: 'text-red-700 bg-red-50' };
  return <div className="rounded-xl border border-gray-200 bg-white p-3.5 sm:p-4"><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-md ${colors[tone]}`}>{icon}</span><span className="text-xs font-semibold text-gray-500">{label}</span></div><p className="mt-3 text-2xl font-extrabold text-gray-950">{value}</p><p className="mt-0.5 text-xs text-gray-400">{detail}</p></div>;
}

function SignalRow({ title, names, tone, onOpen }: { title: string; names: string[]; tone: 'amber' | 'red'; onOpen: () => void }) {
  const style = tone === 'red' ? 'border-red-100 bg-red-50 text-red-800' : 'border-amber-100 bg-amber-50 text-amber-800';
  const label = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  return <button onClick={onOpen} className={`w-full rounded-lg border px-3 py-2.5 text-left ${style}`}><span className="block text-xs font-bold">{title} · {names.length}</span><span className="mt-0.5 block truncate text-xs opacity-80">{label}</span></button>;
}

function StatusValue({ value, low, high }: { value?: number; low: boolean; high: boolean }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const flagged = (low && value <= 2) || (high && value >= 4);
  return <span className={`font-semibold ${flagged ? 'text-amber-700' : 'text-gray-700'}`}>{value}/5</span>;
}