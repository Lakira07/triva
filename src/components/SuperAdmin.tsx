import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  LogOut,
  Search,
  KeyRound,
  TrendingUp,
  Inbox,
  ChevronDown,
  ChevronUp,
  Mail,
  UserCog,
} from 'lucide-react';
import { supabase, type Team } from '@/lib/supabase';

interface TeamWithStats extends Team {
  player_count: number;
  question_count: number;
  response_count: number;
  wellbeing_count: number;
  owner_email: string | null;
}

interface AdminSession {
  email: string;
  isAdmin: boolean;
}

interface SuperAdminProps {
  session: AdminSession;
  onLogout: () => void;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function SuperAdmin({ session, onLogout }: SuperAdminProps) {
  const [teams, setTeams] = useState<TeamWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    const { data: teamData, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching teams:', error);
      setLoading(false);
      return;
    }

    const teamsWithStats: TeamWithStats[] = await Promise.all(
      (teamData || []).map(async (t: any) => {
        const [p, q, r, w] = await Promise.all([
          supabase.from('players').select('*', { count: 'exact', head: true }).eq('team_id', t.id),
          supabase.from('questions').select('*', { count: 'exact', head: true }).eq('team_id', t.id),
          supabase.from('responses').select('*', { count: 'exact', head: true }).eq('team_id', t.id),
          supabase.from('wellbeing_entries').select('*', { count: 'exact', head: true }).eq('team_id', t.id),
        ]);
        let ownerEmail: string | null = null;
        if (t.owner_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', t.owner_id)
            .maybeSingle();
          ownerEmail = profile?.email ?? null;
        }
        return {
          ...t,
          player_count: p.count ?? 0,
          question_count: q.count ?? 0,
          response_count: r.count ?? 0,
          wellbeing_count: w.count ?? 0,
          owner_email: ownerEmail,
        };
      })
    );
    setTeams(teamsWithStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const regenerateCode = async (teamId: string, field: 'join_code' | 'trainer_code') => {
    let newCode = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('teams')
        .select('id')
        .or(`join_code.eq.${newCode},trainer_code.eq.${newCode}`)
        .maybeSingle();
      if (!existing) break;
      newCode = generateCode();
      attempts++;
    }
    const { error } = await supabase
      .from('teams')
      .update({ [field]: newCode })
      .eq('id', teamId);
    if (error) {
      console.error('Error regenerating code:', error);
      return;
    }
    await fetchTeams();
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm('Är du säker på att du vill radera detta lag? All data för laget kommer att raderas.')) return;
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) {
      console.error('Error deleting team:', error);
      return;
    }
    await fetchTeams();
  };

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.join_code.toLowerCase().includes(search.toLowerCase()) ||
    t.trainer_code.toLowerCase().includes(search.toLowerCase()) ||
    (t.owner_email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPlayers = teams.reduce((sum, t) => sum + t.player_count, 0);
  const totalResponses = teams.reduce((sum, t) => sum + t.response_count, 0);
  const totalWellbeing = teams.reduce((sum, t) => sum + t.wellbeing_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center ring-2 ring-black/10">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-black tracking-tight">Admin Panel</h1>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {session.email}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-black transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logga ut
          </button>
        </div>
        <p className="text-gray-500 ml-14">Hantera alla lag, tränare och koder</p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard icon={<Users className="w-5 h-5" />} label="Lag" value={teams.length} />
        <StatCard icon={<Users className="w-5 h-5" />} label="Spelare" value={totalPlayers} />
        <StatCard icon={<Inbox className="w-5 h-5" />} label="Enkäter" value={totalResponses} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Välmående" value={totalWellbeing} />
      </div>

      {/* Search + Create */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök lag, kod eller tränare..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center justify-center gap-2 bg-black hover:bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Skapa lag
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateTeamForm
          onCreate={async (name, ownerEmail) => {
            let ownerId: string | null = null;
            if (ownerEmail.trim()) {
              const { data: existingUser } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('email', ownerEmail.trim().toLowerCase())
                .maybeSingle();
              if (existingUser) {
                ownerId = existingUser.id;
              }
            }
            let joinCode = generateCode();
            let trainerCode = generateCode();
            let attempts = 0;
            while (attempts < 10) {
              const { data: existing } = await supabase
                .from('teams')
                .select('id')
                .or(`join_code.eq.${joinCode},trainer_code.eq.${joinCode}`)
                .maybeSingle();
              if (!existing) break;
              joinCode = generateCode();
              attempts++;
            }
            attempts = 0;
            while (attempts < 10) {
              const { data: existing } = await supabase
                .from('teams')
                .select('id')
                .or(`join_code.eq.${trainerCode},trainer_code.eq.${trainerCode}`)
                .maybeSingle();
              if (!existing && trainerCode !== joinCode) break;
              trainerCode = generateCode();
              attempts++;
            }
            const { error } = await supabase
              .from('teams')
              .insert({ name: name.trim(), join_code: joinCode, trainer_code: trainerCode, owner_id: ownerId });
            if (error) {
              console.error('Error creating team:', error);
              return;
            }
            const { data: newTeam } = await supabase
              .from('teams')
              .select('id')
              .eq('join_code', joinCode)
              .maybeSingle();
            if (newTeam) {
              await supabase.from('team_settings').insert({
                team_id: newTeam.id,
                weekly_survey_required: 1,
                weekly_wellbeing_required: 1,
              });
            }
            setShowCreateForm(false);
            await fetchTeams();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Teams list */}
      <div className="space-y-3">
        {filteredTeams.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Inga lag hittades.</p>
          </div>
        )}
        {filteredTeams.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Team header row */}
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-black truncate">{t.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{t.player_count} spelare</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{t.question_count} frågor</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{t.response_count} svar</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{t.wellbeing_count} välmående</span>
                </div>
              </div>
              {/* Expand toggle */}
              <button
                onClick={() => setExpandedTeam(expandedTeam === t.id ? null : t.id)}
                className="text-gray-400 hover:text-black transition-colors p-1"
              >
                {expandedTeam === t.id ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Expanded details */}
            {expandedTeam === t.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                {/* Codes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Tränarkod:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyCode(t.trainer_code)}
                        className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-black text-gray-700 px-3 py-1.5 rounded-lg text-sm font-mono font-bold transition-colors"
                        title="Kopiera tränarkod"
                      >
                        {copiedCode === t.trainer_code ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        {t.trainer_code}
                      </button>
                      <button
                        onClick={() => regenerateCode(t.id, 'trainer_code')}
                        className="flex items-center gap-1 bg-white border border-gray-200 hover:border-black text-gray-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        <KeyRound className="w-3 h-3" /> Ny
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-500">Spelarkod:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyCode(t.join_code)}
                        className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-black text-gray-700 px-3 py-1.5 rounded-lg text-sm font-mono font-bold transition-colors"
                        title="Kopiera spelarkod"
                      >
                        {copiedCode === t.join_code ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        {t.join_code}
                      </button>
                      <button
                        onClick={() => regenerateCode(t.id, 'join_code')}
                        className="flex items-center gap-1 bg-white border border-gray-200 hover:border-black text-gray-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        <KeyRound className="w-3 h-3" /> Ny
                      </button>
                    </div>
                  </div>
                </div>

                {/* Owner */}
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500">Tränare:</span>
                  <span className="font-medium text-black">
                    {t.owner_email ?? 'Ej tilldelad'}
                  </span>
                </div>

                {/* Danger zone */}
                <div className="pt-1">
                  <button
                    onClick={() => deleteTeam(t.id)}
                    className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Radera lag
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-black">{value}</p>
    </div>
  );
}

function CreateTeamForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string, ownerEmail: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onCreate(name, ownerEmail);
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-black">Skapa nytt lag</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-black text-sm">
          Avbryt
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Lagnamn</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Österåker United U17:3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tränarens e-post <span className="text-gray-400">(frivilligt — måste vara registrerad)</span>
          </label>
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="tränare@example.se"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Om e-posten matchar en registrerad tränare kopplas laget till dem automatiskt.
            Både en spelarkod och en tränarkod genereras automatiskt.
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Skapa lag
        </button>
      </div>
    </div>
  );
}
