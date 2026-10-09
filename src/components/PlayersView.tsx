import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, User, Users, Loader2, X, Pencil } from 'lucide-react';
import { supabase, type Player } from '@/lib/supabase';

const POSITIONS = ['Målvakt', 'Försvarare', 'Mittfältare', 'Anfallare'];

async function sendPlayerInvite(payload: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('invite-player', {
    body: payload,
  });
  if (!error) return data?.error ?? null;

  if (error.context instanceof Response) {
    const responseBody = await error.context.clone().json().catch(() => null) as { error?: string } | null;
    if (responseBody?.error) return responseBody.error;
  }
  return error.message;
}

export default function PlayersView({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

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
    setPlayers(data as Player[]);
  }, [teamId]);

  useEffect(() => {
    (async () => {
      await fetchPlayers();
      setLoading(false);
    })();
  }, [fetchPlayers]);

  const addPlayer = async (
    name: string,
    email: string,
    position: string | null,
    jersey: number | null
  ): Promise<string | null> => {
    const inviteError = await sendPlayerInvite({ teamId, name, email, position, jerseyNumber: jersey });
    if (inviteError) return inviteError;
    setShowForm(false);
    setSuccessMessage(`Inbjudan skickad till ${email}. Spelaren väljer sitt eget lösenord.`);
    await fetchPlayers();
    return null;
  };

  const updatePlayer = async (
    id: string,
    name: string,
    email: string,
    position: string | null,
    jersey: number | null
  ): Promise<string | null> => {
    const { error } = await supabase
      .from('players')
      .update({ name, position: position || null, jersey_number: jersey })
      .eq('id', id);
    if (error) {
      console.error('Error updating player:', error);
      return error.message;
    }
    if (email.trim()) {
      const inviteError = await sendPlayerInvite({ teamId, playerId: id, name, email, position, jerseyNumber: jersey });
      if (inviteError) return inviteError;
      setSuccessMessage(`Inbjudan skickad till ${email}. Spelaren väljer sitt eget lösenord.`);
    } else {
      setSuccessMessage('Spelaruppgifterna har sparats.');
    }
    setEditingPlayer(null);
    await fetchPlayers();
    return null;
  };

  const deletePlayer = async (id: string) => {
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) {
      console.error('Error deleting player:', error);
      return;
    }
    await fetchPlayers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-black animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {successMessage && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {successMessage}
        </p>
      )}
      {players.length === 0 && !showForm && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Inga spelarprofiler ännu. Skapa en profil!</p>
        </div>
      )}

      <div className="space-y-3 mb-4">
        {players.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm"
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
              {p.position && (
                <p className="text-sm text-gray-500">{p.position}</p>
              )}
            </div>
            <button
              onClick={() => setEditingPlayer(p)}
              className="text-gray-400 hover:text-black transition-colors p-1"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => deletePlayer(p.id)}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {editingPlayer && (
        <PlayerForm
          player={editingPlayer}
          onSave={(name, email, position, jersey) =>
            updatePlayer(editingPlayer.id, name, email, position, jersey)
          }
          onCancel={() => setEditingPlayer(null)}
        />
      )}

      {showForm ? (
        <PlayerForm
          onSave={addPlayer}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        !editingPlayer && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 w-full bg-white border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50 text-gray-500 hover:text-black px-4 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Lägg till spelare
          </button>
        )
      )}
    </div>
  );
}

function PlayerForm({
  player,
  onSave,
  onCancel,
}: {
  player?: Player;
  onSave: (name: string, email: string, position: string | null, jersey: number | null) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(player?.name ?? '');
  const [email, setEmail] = useState('');
  const [position, setPosition] = useState(player?.position ?? '');
  const [jersey, setJersey] = useState(
    player?.jersey_number != null ? String(player.jersey_number) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || (!player && !email.trim())) return;
    setSaving(true);
    setError(null);
    const jerseyNum = jersey.trim() ? parseInt(jersey) : null;
    const saveError = await onSave(name.trim(), email.trim(), position || null, jerseyNum);
    if (saveError) setError(saveError);
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-black">
          {player ? 'Redigera spelare' : 'Ny spelare'}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-black">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="T.ex. Anders Svensson"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="player-email" className="block text-sm font-medium text-gray-700 mb-1.5">
            E-post {player && <span className="text-gray-400">(frivilligt)</span>}
          </label>
          <input
            id="player-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="spelare@example.com"
            required={!player}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
          <p className="mt-1.5 text-xs leading-5 text-gray-500">
            Vi skickar en inbjudan. Spelaren skapar sitt eget lösenord via e-postlänken.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Position</label>
          <div className="grid grid-cols-2 gap-2">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(position === pos ? '' : pos)}
                className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                  position === pos
                    ? 'border-black bg-gray-50 text-black'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tröjnummer <span className="text-gray-400">(frivilligt)</span>
          </label>
          <input
            type="number"
            value={jersey}
            onChange={(e) => setJersey(e.target.value)}
            placeholder="T.ex. 10"
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || (!player && !email.trim()) || saving}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {player ? (email.trim() ? 'Spara och bjud in' : 'Spara ändringar') : 'Skapa spelare och bjud in'}
          </button>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}
