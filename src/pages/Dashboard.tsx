import { Link } from 'react-router-dom';
import { Trophy, Upload, Swords, Video, ChevronRight } from 'lucide-react';
import { getPlayers, getMatches } from '../lib/storage';
import { RatingBadge } from '../components/RatingBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { getSkillLevel } from '../types';

export function Dashboard() {
  const players = getPlayers().sort((a, b) => b.current_rating - a.current_rating);
  const matches = getMatches();
  const recentMatches = matches.slice(0, 5);

  const topPlayer = players[0];
  const totalMatches = matches.filter(m => m.status === 'complete').length;

  if (players.length === 0) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-2">Welcome to Pickle Rankings</h1>
        <p className="text-zinc-400 mb-8">AI-powered pickleball video analysis & player rankings</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-10 h-10 rounded-lg bg-pickle/10 flex items-center justify-center mb-3">
              <Upload size={20} className="text-pickle" />
            </div>
            <h3 className="font-semibold text-zinc-200 mb-1">1. Upload a Video</h3>
            <p className="text-sm text-zinc-500">Record your pickleball games and upload them for AI analysis</p>
          </div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-10 h-10 rounded-lg bg-pickle/10 flex items-center justify-center mb-3">
              <Swords size={20} className="text-pickle" />
            </div>
            <h3 className="font-semibold text-zinc-200 mb-1">2. Tag Players</h3>
            <p className="text-sm text-zinc-500">Identify who's playing so ratings track across games</p>
          </div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="w-10 h-10 rounded-lg bg-pickle/10 flex items-center justify-center mb-3">
              <Trophy size={20} className="text-pickle" />
            </div>
            <h3 className="font-semibold text-zinc-200 mb-1">3. Get Rankings</h3>
            <p className="text-sm text-zinc-500">See skill ratings on the USA Pickleball 2.0-5.5+ scale</p>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            to="/players"
            className="px-4 py-2 bg-zinc-800 text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors no-underline"
          >
            Add Players First
          </Link>
          <Link
            to="/upload"
            className="px-4 py-2 bg-pickle text-zinc-950 rounded-lg text-sm font-medium hover:bg-pickle-dark transition-colors no-underline"
          >
            Upload a Game
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Your pickleball analytics at a glance</p>
        </div>
        <Link
          to="/upload"
          className="flex items-center gap-2 px-4 py-2 bg-pickle text-zinc-950 rounded-lg text-sm font-semibold hover:bg-pickle-dark transition-colors no-underline"
        >
          <Upload size={16} />
          Analyze Game
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Players</p>
          <p className="text-2xl font-bold mt-1">{players.length}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Games Analyzed</p>
          <p className="text-2xl font-bold mt-1">{totalMatches}</p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Top Rating</p>
          <p className="text-2xl font-bold mt-1" style={{ color: getSkillLevel(topPlayer.current_rating).color }}>
            {topPlayer.current_rating.toFixed(1)}
          </p>
        </div>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Top Player</p>
          <p className="text-2xl font-bold mt-1 truncate">{topPlayer.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Leaderboard Preview */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Trophy size={18} className="text-pickle" />
              Leaderboard
            </h2>
            <Link to="/leaderboard" className="text-xs text-pickle hover:text-pickle-dark no-underline flex items-center gap-1">
              View All <ChevronRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-zinc-800">
            {players.slice(0, 5).map((player, i) => (
              <Link
                key={player.id}
                to={`/players/${player.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors no-underline"
              >
                <span className="text-sm font-bold text-zinc-500 w-6">{i + 1}</span>
                <PlayerAvatar name={player.name} avatar_url={player.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{player.name}</p>
                  <p className="text-xs text-zinc-500">{player.matches_played} games</p>
                </div>
                <RatingBadge rating={player.current_rating} size="sm" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Matches */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h2 className="font-semibold flex items-center gap-2">
              <Video size={18} className="text-pickle" />
              Recent Games
            </h2>
          </div>
          {recentMatches.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-zinc-500">No games analyzed yet</p>
              <Link
                to="/upload"
                className="text-xs text-pickle hover:text-pickle-dark mt-2 inline-block no-underline"
              >
                Upload your first game
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {recentMatches.map(match => (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/50 transition-colors no-underline"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Video size={14} className="text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{match.video_name}</p>
                    <p className="text-xs text-zinc-500">
                      {new Date(match.date).toLocaleDateString()} &middot; {match.players.length} players
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    match.status === 'complete' ? 'bg-pickle/10 text-pickle' :
                    match.status === 'error' ? 'bg-red-500/10 text-red-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    {match.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
