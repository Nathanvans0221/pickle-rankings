import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { getMatch } from '../lib/storage';
import { RatingBadge } from '../components/RatingBadge';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { SkillBar } from '../components/SkillBar';
import type { PlayerAnalysis } from '../types';

function ShotTable({ analysis }: { analysis: PlayerAnalysis }) {
  const shots = analysis.shot_breakdown;
  const rows = [
    { label: 'Serves', ...shots.serves },
    { label: 'Returns', ...shots.returns },
    { label: '3rd Shot Drops', ...shots.third_shot_drops },
    { label: '3rd Shot Drives', ...shots.third_shot_drives },
    { label: 'Dinks', ...shots.dinks },
    { label: 'Volleys', ...shots.volleys },
    { label: 'Speed-ups', ...shots.speed_ups },
    { label: 'Resets', ...shots.resets },
    { label: 'Lobs', ...shots.lobs },
    { label: 'Put-aways', ...shots.put_aways },
  ].filter(r => r.count > 0);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-800">
          <th className="text-left text-xs text-zinc-500 py-2">Shot</th>
          <th className="text-center text-xs text-zinc-500 py-2">Count</th>
          <th className="text-center text-xs text-zinc-500 py-2">Quality</th>
          <th className="text-left text-xs text-zinc-500 py-2">Notes</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/50">
        {rows.map(row => (
          <tr key={row.label}>
            <td className="py-2 text-zinc-300">{row.label}</td>
            <td className="py-2 text-center text-zinc-400">{row.count}</td>
            <td className="py-2 text-center">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                row.quality >= 7 ? 'bg-green-500/10 text-green-400' :
                row.quality >= 4 ? 'bg-yellow-500/10 text-yellow-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {row.quality}/10
              </span>
            </td>
            <td className="py-2 text-zinc-500 text-xs">{row.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const match = id ? getMatch(id) : undefined;

  if (!match) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400">Match not found</p>
        <Link to="/" className="text-pickle text-sm mt-2 inline-block no-underline">Back to Dashboard</Link>
      </div>
    );
  }

  const analysis = match.analysis;
  const team1 = match.players.filter(p => p.team === 1);
  const team2 = match.players.filter(p => p.team === 2);

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-6 no-underline">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      {/* Match Header */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{match.video_name}</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {new Date(match.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
            match.status === 'complete' ? 'bg-pickle/10 text-pickle' :
            match.status === 'error' ? 'bg-red-500/10 text-red-400' :
            'bg-yellow-500/10 text-yellow-400'
          }`}>
            {match.status}
          </span>
        </div>

        {/* Score & Teams */}
        <div className="flex items-center justify-center gap-8 py-4">
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Team 1</p>
            <div className="flex items-center gap-2">
              {team1.map(p => (
                <Link key={p.player_id} to={`/players/${p.player_id}`} className="flex items-center gap-1.5 no-underline">
                  <PlayerAvatar name={p.player_name} size="sm" />
                  <span className="text-sm text-zinc-300">{p.player_name}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-zinc-200">
              {match.team1_score ?? '—'} <span className="text-zinc-600">:</span> {match.team2_score ?? '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Team 2</p>
            <div className="flex items-center gap-2">
              {team2.map(p => (
                <Link key={p.player_id} to={`/players/${p.player_id}`} className="flex items-center gap-1.5 no-underline">
                  <PlayerAvatar name={p.player_name} size="sm" />
                  <span className="text-sm text-zinc-300">{p.player_name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Summary */}
      {analysis && (
        <>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
            <h2 className="font-semibold text-zinc-200 mb-2">Match Summary</h2>
            <p className="text-sm text-zinc-400">{analysis.summary}</p>
            <div className="flex gap-6 mt-4 pt-3 border-t border-zinc-800">
              <div>
                <p className="text-xs text-zinc-500">Duration</p>
                <p className="text-sm text-zinc-300">{analysis.duration_estimate}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Rallies</p>
                <p className="text-sm text-zinc-300">{analysis.rally_count}</p>
              </div>
            </div>
            {analysis.highlights.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zinc-500 mb-1">Highlights</p>
                <ul className="space-y-1">
                  {analysis.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                      <span className="text-pickle">*</span> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Per-Player Analysis */}
          <div className="space-y-6">
            {analysis.player_analyses.map(pa => (
              <div key={pa.player_id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                  <Link to={`/players/${pa.player_id}`} className="flex items-center gap-3 no-underline">
                    <PlayerAvatar name={pa.player_name} size="md" />
                    <div>
                      <p className="font-semibold text-zinc-200">{pa.player_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <RatingBadge rating={pa.rating_before} size="sm" />
                        <span className="text-zinc-500">&rarr;</span>
                        <RatingBadge rating={pa.rating_after} size="sm" />
                        <span className={`text-xs font-medium flex items-center gap-0.5 ${
                          pa.rating_change > 0 ? 'text-green-400' : pa.rating_change < 0 ? 'text-red-400' : 'text-zinc-500'
                        }`}>
                          {pa.rating_change > 0 ? <TrendingUp size={12} /> : pa.rating_change < 0 ? <TrendingDown size={12} /> : null}
                          {pa.rating_change > 0 ? '+' : ''}{pa.rating_change.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
                  {/* Skills */}
                  <div className="p-5">
                    <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                      <Target size={14} className="text-pickle" /> Skills Assessment
                    </h3>
                    <div className="space-y-2.5">
                      <SkillBar label="Serve" value={pa.skill_assessment.serve} />
                      <SkillBar label="Return" value={pa.skill_assessment.return_of_serve} />
                      <SkillBar label="Third Shot" value={pa.skill_assessment.third_shot} />
                      <SkillBar label="Dinks" value={pa.skill_assessment.dinks} />
                      <SkillBar label="Volleys" value={pa.skill_assessment.volleys} />
                      <SkillBar label="Positioning" value={pa.skill_assessment.court_positioning} />
                      <SkillBar label="Strategy" value={pa.skill_assessment.strategy} />
                      <SkillBar label="Consistency" value={pa.skill_assessment.consistency} />
                    </div>
                  </div>

                  {/* Shot Breakdown */}
                  <div className="p-5">
                    <h3 className="text-sm font-medium text-zinc-300 mb-3">Shot Breakdown</h3>
                    <ShotTable analysis={pa} />
                  </div>
                </div>

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-2 divide-x divide-zinc-800 border-t border-zinc-800">
                  <div className="p-4">
                    <p className="text-xs font-medium text-green-400 mb-2">Strengths</p>
                    <ul className="space-y-1">
                      {pa.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-zinc-400">+ {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-yellow-400 mb-2">To Improve</p>
                    <ul className="space-y-1">
                      {pa.improvements.map((s, i) => (
                        <li key={i} className="text-xs text-zinc-400">! {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
