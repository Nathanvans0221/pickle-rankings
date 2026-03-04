import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { getPlayers } from '../lib/storage';
import { RatingBadge } from '../components/RatingBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { EmptyState } from '../components/EmptyState';
import { getSkillLevel } from '../types';

type SortKey = 'rating' | 'name' | 'games' | 'wins';

export function LeaderboardPage() {
  const [sortBy, setSortBy] = useState<SortKey>('rating');
  const players = getPlayers();

  const sorted = [...players].sort((a, b) => {
    switch (sortBy) {
      case 'rating': return b.current_rating - a.current_rating;
      case 'name': return a.name.localeCompare(b.name);
      case 'games': return b.matches_played - a.matches_played;
      case 'wins': return b.wins - a.wins;
    }
  });

  if (players.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-8">Leaderboard</h1>
        <EmptyState
          icon={Trophy}
          title="No rankings yet"
          description="Add players and analyze some games to see the leaderboard"
        />
      </div>
    );
  }

  const getRatingTrend = (player: typeof players[0]) => {
    if (player.rating_history.length < 2) return 0;
    const prev = player.rating_history[player.rating_history.length - 2].rating;
    return player.current_rating - prev;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-zinc-400 text-sm mt-1">{players.length} players ranked</p>
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-pickle"
        >
          <option value="rating">Sort by Rating</option>
          <option value="name">Sort by Name</option>
          <option value="games">Sort by Games</option>
          <option value="wins">Sort by Wins</option>
        </select>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wide px-5 py-3 w-12">#</th>
              <th className="text-left text-xs text-zinc-500 uppercase tracking-wide px-5 py-3">Player</th>
              <th className="text-center text-xs text-zinc-500 uppercase tracking-wide px-5 py-3">Rating</th>
              <th className="text-center text-xs text-zinc-500 uppercase tracking-wide px-5 py-3 hidden sm:table-cell">Level</th>
              <th className="text-center text-xs text-zinc-500 uppercase tracking-wide px-5 py-3 hidden md:table-cell">Trend</th>
              <th className="text-center text-xs text-zinc-500 uppercase tracking-wide px-5 py-3">Games</th>
              <th className="text-center text-xs text-zinc-500 uppercase tracking-wide px-5 py-3 hidden sm:table-cell">W/L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sorted.map((player, i) => {
              const trend = getRatingTrend(player);
              const level = getSkillLevel(player.current_rating);
              return (
                <tr key={player.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <span className={`text-sm font-bold ${i < 3 ? 'text-pickle' : 'text-zinc-500'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link to={`/players/${player.id}`} className="flex items-center gap-3 no-underline">
                      <PlayerAvatar name={player.name} avatar_url={player.avatar_url} size="sm" />
                      <span className="text-sm font-medium text-zinc-200">{player.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <RatingBadge rating={player.current_rating} />
                  </td>
                  <td className="px-5 py-4 text-center hidden sm:table-cell">
                    <span className="text-xs text-zinc-400">{level.label.split(' - ')[1]}</span>
                  </td>
                  <td className="px-5 py-4 text-center hidden md:table-cell">
                    {trend > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-xs text-green-400">
                        <ArrowUpRight size={14} /> +{trend.toFixed(1)}
                      </span>
                    ) : trend < 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-xs text-red-400">
                        <ArrowDownRight size={14} /> {trend.toFixed(1)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-zinc-500">
                        <Minus size={14} />
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className="text-sm text-zinc-300">{player.matches_played}</span>
                  </td>
                  <td className="px-5 py-4 text-center hidden sm:table-cell">
                    <span className="text-sm text-zinc-300">{player.wins}-{player.losses}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Skill Level Legend */}
      <div className="mt-8 bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">USA Pickleball Skill Levels</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { range: '2.0-2.5', label: 'Beginner', color: '#ef4444', desc: 'Learning basics' },
            { range: '3.0-3.5', label: 'Intermediate', color: '#eab308', desc: 'Developing shots' },
            { range: '4.0-4.5', label: 'Advanced', color: '#22c55e', desc: 'Strategic play' },
            { range: '5.0-5.5+', label: 'Expert/Pro', color: '#8b5cf6', desc: 'Tournament level' },
          ].map(l => (
            <div key={l.range} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
              <div>
                <span className="text-xs font-medium text-zinc-300">{l.range} {l.label}</span>
                <span className="text-xs text-zinc-500 ml-1">{l.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
