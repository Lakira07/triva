import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, User, Users, Loader2, X, Pencil } from 'lucide-react';
import { supabase, type Player } from '@/lib/supabase';

const POSITIONS = ['Målvakt', 'Försvarare', 'Mittfältare', 'Anfallare'];

export default function PlayersView({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

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

  const addPlayer = async (name: string, position: string | null, jersey: number | null) => {
    const { error } = await supabase
      .from('players')
      .insert({ name, position: position || null, jersey_number: jersey, team_id: teamId });
    if (error) {
      console.error('Error adding player:', error);
      return;
    }
    setShowForm(false);
    await fetchPlayers();
  };

  const updatePlayer = async (
    id: string,
    name: string,
    position: string | null,
    jersey: number | null
  ) => {
    const { error } = await supabase
      .from('players')
      .update({ name, position: position || null, jersey_number: jersey })
      .eq('id', id);
    if (error) {
      console.error('Error updating player:', error);
      return;
    }
    setEditingPlayer(null);
    await fetchPlayers();
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
          onSave={(name, position, jersey) =>
            updatePlayer(editingPlayer.id, name, position, jersey)
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
  onSave: (name: string, position: string | null, jersey: number | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(player?.name ?? '');
  const [position, setPosition] = useState(player?.position ?? '');
  const [jersey, setJersey] = useState(
    player?.jersey_number != null ? String(player.jersey_number) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const jerseyNum = jersey.trim() ? parseInt(jersey) : null;
    await onSave(name.trim(), position || null, jerseyNum);
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
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="flex items-center gap-2 bg-black hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {player ? 'Spara ändringar' : 'Spara spelare'}
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
