import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Trash2, X } from 'lucide-react';
import { getPlayers, addPlayer, deletePlayer } from '../lib/storage';
import { RatingBadge } from '../components/RatingBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { EmptyState } from '../components/EmptyState';
import { getSkillLevel } from '../types';

export function PlayersPage() {
  const [players, setPlayers] = useState(getPlayers);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addPlayer(newName.trim());
    setPlayers(getPlayers());
    setNewName('');
    setShowAdd(false);
  };

  const handleDelete = (id: string) => {
    deletePlayer(id);
    setPlayers(getPlayers());
  };

  const sorted = [...players].sort((a, b) => b.current_rating - a.current_rating);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Players</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage your pickleball crew</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-pickle text-zinc-950 rounded-xl text-sm font-semibold hover:bg-pickle-dark transition-colors cursor-pointer border-0"
        >
          <Plus size={18} />
          Add Player
        </button>
      </div>

      {/* Add Player Modal — bottom sheet on mobile */}
      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-t-2xl sm:rounded-2xl border border-zinc-700 p-6 w-full sm:max-w-md sm:mx-4" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add Player</h2>
              <button onClick={() => setShowAdd(false)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-200 bg-transparent border-0 cursor-pointer">
                <X size={22} />
              </button>
            </div>
            <input
              type="text"
              placeholder="Player name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-base text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-pickle"
            />
            <p className="text-xs text-zinc-500 mt-2">New players start at a 2.5 rating (Beginner). Their rating will adjust as you analyze games.</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 min-h-[44px] px-4 py-3 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-xl border-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="flex-1 min-h-[44px] px-4 py-3 bg-pickle text-zinc-950 rounded-xl text-sm font-medium hover:bg-pickle-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0"
              >
                Add Player
              </button>
            </div>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No players yet"
          description="Add your pickleball crew to start tracking rankings"
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-5 py-3 min-h-[44px] bg-pickle text-zinc-950 rounded-xl text-sm font-medium hover:bg-pickle-dark cursor-pointer border-0"
            >
              <Plus size={18} />
              Add First Player
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((player) => {
            const level = getSkillLevel(player.current_rating);
            return (
              <Link
                key={player.id}
                to={`/players/${player.id}`}
                className="bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors p-5 no-underline group relative"
              >
                <button
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(player.id);
                  }}
                  className="absolute top-3 right-3 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-transparent text-zinc-600 hover:text-red-400 hover:bg-red-400/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer border-0"
                >
                  <Trash2 size={16} />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <PlayerAvatar name={player.name} avatar_url={player.avatar_url} size="lg" />
                  <div>
                    <p className="font-semibold text-zinc-200">{player.name}</p>
                    <p className="text-xs text-zinc-500">{level.label}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">Rating</p>
                    <RatingBadge rating={player.current_rating} size="lg" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Games</p>
                    <p className="text-lg font-semibold text-zinc-300">{player.matches_played}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">W/L</p>
                    <p className="text-lg font-semibold text-zinc-300">
                      {player.wins}/{player.losses}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
