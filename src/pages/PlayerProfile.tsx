import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Target, Zap, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getPlayer, getMatches } from '../lib/storage';
import { RatingBadge } from '../components/RatingBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { SkillBar } from '../components/SkillBar';
import { getSkillLevel } from '../types';
import type { PlayerAnalysis } from '../types';

export function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const player = id ? getPlayer(id) : undefined;
  const matches = getMatches().filter(m => m.status === 'complete' && m.players.some(p => p.player_id === id));

  if (!player) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">Player not found</p>
        <Link to="/players" className="text-pickle text-sm mt-2 inline-block no-underline">Back to Players</Link>
      </div>
    );
  }

  const level = getSkillLevel(player.current_rating);

  const playerAnalyses: PlayerAnalysis[] = matches
    .filter(m => m.analysis?.player_analyses)
    .flatMap(m => m.analysis!.player_analyses.filter(pa => pa.player_id === id));

  const latestAnalysis = playerAnalyses[playerAnalyses.length - 1];

  const chartData = player.rating_history.map((entry, i) => ({
    game: i + 1,
    rating: entry.rating,
    date: new Date(entry.date).toLocaleDateString(),
  }));

  return (
    <div>
      <Link to="/players" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-6 no-underline min-h-[44px] px-1">
        <ArrowLeft size={18} /> Back to Players
      </Link>

      {/* Header */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <PlayerAvatar name={player.name} avatar_url={player.avatar_url} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{player.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: level.color }}>{level.label}</p>
            <p className="text-xs text-zinc-500 mt-1 hidden sm:block">{level.description}</p>
          </div>
          <div className="text-right shrink-0">
            <RatingBadge rating={player.current_rating} size="lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-800">
          <div className="text-center p-2">
            <p className="text-xs text-zinc-500">Games</p>
            <p className="text-xl font-bold">{player.matches_played}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-zinc-500">Wins</p>
            <p className="text-xl font-bold text-green-400">{player.wins}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-zinc-500">Losses</p>
            <p className="text-xl font-bold text-red-400">{player.losses}</p>
          </div>
          <div className="text-center p-2">
            <p className="text-xs text-zinc-500">Win Rate</p>
            <p className="text-xl font-bold">
              {player.matches_played > 0 ? Math.round((player.wins / player.matches_played) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating History Chart */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-pickle" /> Rating History
          </h2>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="game" tick={{ fill: '#71717a', fontSize: 12 }} axisLine={{ stroke: '#27272a' }} />
                <YAxis domain={[2, 5.5]} tick={{ fill: '#71717a', fontSize: 12 }} axisLine={{ stroke: '#27272a' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                  labelStyle={{ color: '#a1a1aa' }}
                  itemStyle={{ color: '#4ade80' }}
                />
                <Line type="monotone" dataKey="rating" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-zinc-500">
              Play more games to see rating trends
            </div>
          )}
        </div>

        {/* Skill Breakdown */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <h2 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Target size={18} className="text-pickle" /> Skill Breakdown
          </h2>
          {latestAnalysis ? (
            <div className="space-y-3">
              <SkillBar label="Serve" value={latestAnalysis.skill_assessment.serve} />
              <SkillBar label="Return" value={latestAnalysis.skill_assessment.return_of_serve} />
              <SkillBar label="Third Shot" value={latestAnalysis.skill_assessment.third_shot} />
              <SkillBar label="Dinks" value={latestAnalysis.skill_assessment.dinks} />
              <SkillBar label="Volleys" value={latestAnalysis.skill_assessment.volleys} />
              <SkillBar label="Positioning" value={latestAnalysis.skill_assessment.court_positioning} />
              <SkillBar label="Strategy" value={latestAnalysis.skill_assessment.strategy} />
              <SkillBar label="Consistency" value={latestAnalysis.skill_assessment.consistency} />
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-zinc-500">
              Analyze a game to see skill breakdown
            </div>
          )}
        </div>

        {/* Strengths */}
        {latestAnalysis && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h2 className="font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Zap size={18} className="text-green-400" /> Strengths
            </h2>
            <ul className="space-y-2">
              {latestAnalysis.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-green-400 mt-0.5">+</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas to Improve */}
        {latestAnalysis && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h2 className="font-semibold text-zinc-200 mb-3 flex items-center gap-2">
              <Shield size={18} className="text-yellow-400" /> Areas to Improve
            </h2>
            <ul className="space-y-2">
              {latestAnalysis.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="text-yellow-400 mt-0.5">!</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Match History */}
      {matches.length > 0 && (
        <div className="mt-6 bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="font-semibold text-zinc-200">Match History</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {matches.map(match => {
              const pa = match.analysis?.player_analyses.find(a => a.player_id === id);
              return (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/50 transition-colors no-underline min-h-[52px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{match.video_name}</p>
                    <p className="text-xs text-zinc-500">{new Date(match.date).toLocaleDateString()}</p>
                  </div>
                  {pa && (
                    <span className={`text-xs font-medium ${pa.rating_change > 0 ? 'text-green-400' : pa.rating_change < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                      {pa.rating_change > 0 ? '+' : ''}{pa.rating_change.toFixed(1)}
                    </span>
                  )}
                  {match.team1_score !== null && match.team2_score !== null && (
                    <span className="text-sm text-zinc-400">{match.team1_score}-{match.team2_score}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
