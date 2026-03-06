import { useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Target, TrendingUp, TrendingDown, RefreshCw, Loader2, Trash2, SlidersHorizontal, X, Minus, Plus, Check } from 'lucide-react';
import { getMatch, updateMatch, deleteMatch, getMatchCorrections } from '../lib/storage';
import { analyzeVideo, applyRatingUpdates, reverseRatingUpdates, applyRatingCorrection } from '../lib/analysis';
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
          <th className="text-left text-xs text-zinc-500 py-2 hidden sm:table-cell">Notes</th>
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
            <td className="py-2 text-zinc-500 text-xs hidden sm:table-cell">{row.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [matchData, setMatchData] = useState(() => id ? getMatch(id) : undefined);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeProgress, setReanalyzeProgress] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionValues, setCorrectionValues] = useState<Record<string, { rating: number; note: string }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingCorrections = id ? getMatchCorrections(id) : [];

  const openCorrectionModal = useCallback(() => {
    if (!matchData?.analysis) return;
    const initial: Record<string, { rating: number; note: string }> = {};
    for (const pa of matchData.analysis.player_analyses) {
      const existing = existingCorrections.find(c => c.player_id === pa.player_id);
      initial[pa.player_id] = {
        rating: existing?.corrected_rating ?? pa.rating_after,
        note: existing?.note ?? '',
      };
    }
    setCorrectionValues(initial);
    setShowCorrectionModal(true);
  }, [matchData, existingCorrections]);

  const handleSaveCorrections = useCallback(() => {
    if (!matchData?.analysis || !id) return;
    let changed = 0;
    for (const pa of matchData.analysis.player_analyses) {
      const val = correctionValues[pa.player_id];
      if (!val) continue;
      const aiRating = pa.rating_after;
      if (Math.abs(val.rating - aiRating) < 0.05) continue;
      applyRatingCorrection(id, pa.player_id, pa.player_name, aiRating, val.rating, val.note || undefined);
      changed++;
    }
    if (changed > 0) {
      setMatchData(getMatch(id));
    }
    setShowCorrectionModal(false);
  }, [matchData, id, correctionValues]);

  const handleDelete = useCallback(() => {
    if (!matchData || !id) return;
    if (matchData.analysis) {
      reverseRatingUpdates(matchData.analysis, id);
    }
    deleteMatch(id);
    navigate('/');
  }, [matchData, id, navigate]);

  const handleReanalyze = useCallback(async (file: File) => {
    if (!matchData || !id) return;

    setReanalyzing(true);
    setReanalyzeProgress('Uploading video...');

    try {
      if (matchData.analysis) {
        reverseRatingUpdates(matchData.analysis, id);
      }

      const newAnalysis = await analyzeVideo(
        file,
        matchData.players,
        msg => setReanalyzeProgress(msg),
      );

      applyRatingUpdates(newAnalysis, id);
      updateMatch(id, { status: 'complete', analysis: newAnalysis });
      setMatchData(getMatch(id));
      setReanalyzing(false);
      setReanalyzeProgress('');
    } catch (err: any) {
      setReanalyzeProgress(`Error: ${err.message}`);
      setReanalyzing(false);
      if (matchData.analysis) {
        applyRatingUpdates(matchData.analysis, id);
      }
    }
  }, [matchData, id]);

  const onFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleReanalyze(file);
  }, [handleReanalyze]);

  const match = matchData;

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
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onFileSelected}
      />

      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-6 no-underline min-h-[44px] px-1">
        <ArrowLeft size={18} /> Back to Dashboard
      </Link>

      {/* Re-analyze Banner */}
      {reanalyzing && (
        <div className="bg-zinc-900 rounded-xl border border-pickle/30 p-5 mb-6 text-center">
          <Loader2 size={24} className="text-pickle mx-auto mb-2 animate-spin" />
          <p className="text-sm text-zinc-300">{reanalyzeProgress}</p>
        </div>
      )}

      {/* Corrections Banner */}
      {existingCorrections.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <Check size={18} className="text-green-400 shrink-0" />
          <p className="text-sm text-green-300">
            Ratings manually corrected for {existingCorrections.length} player{existingCorrections.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Match Header */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">{match.video_name}</h1>
            <p className="text-sm text-zinc-400 mt-1">
              {new Date(match.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {analysis?.analysis_mode && (
                <span className="ml-2 text-xs text-zinc-500">({analysis.analysis_mode})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!reanalyzing && !confirmDelete && (
              <>
                {match.status === 'complete' && (
                  <>
                    <button
                      onClick={openCorrectionModal}
                      className="relative flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors cursor-pointer border-0"
                    >
                      <SlidersHorizontal size={16} />
                      Adjust Ratings
                      {existingCorrections.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                      )}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors cursor-pointer border-0"
                    >
                      <RefreshCw size={16} />
                      Re-analyze
                    </button>
                  </>
                )}
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer border-0"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Delete this match?</span>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2.5 min-h-[44px] bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors cursor-pointer border-0"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors cursor-pointer border-0"
                >
                  Cancel
                </button>
              </div>
            )}
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              match.status === 'complete' ? 'bg-pickle/10 text-pickle' :
              match.status === 'error' ? 'bg-red-500/10 text-red-400' :
              'bg-yellow-500/10 text-yellow-400'
            }`}>
              {match.status}
            </span>
          </div>
        </div>

        {/* Score & Teams — vertical stack on mobile */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 py-4">
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Team 1</p>
            <div className="flex items-center gap-2">
              {team1.map(p => (
                <Link key={p.player_id} to={`/players/${p.player_id}`} className="flex items-center gap-1.5 no-underline min-h-[44px]">
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
                <Link key={p.player_id} to={`/players/${p.player_id}`} className="flex items-center gap-1.5 no-underline min-h-[44px]">
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

          {/* Rating Correction Modal */}
          {showCorrectionModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowCorrectionModal(false)} />
              <div className="relative bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-4 flex items-center justify-between z-10">
                  <h3 className="font-semibold text-zinc-200">Adjust Ratings</h3>
                  <button onClick={() => setShowCorrectionModal(false)} className="p-2 text-zinc-400 hover:text-zinc-200 bg-transparent border-0 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-5 space-y-5">
                  {analysis.player_analyses.map(pa => {
                    const val = correctionValues[pa.player_id];
                    if (!val) return null;
                    const delta = val.rating - pa.rating_after;
                    const hasChanged = Math.abs(delta) >= 0.05;
                    return (
                      <div key={pa.player_id} className={`p-4 rounded-xl border ${hasChanged ? 'border-green-500/30 bg-green-500/5' : 'border-zinc-800 bg-zinc-800/50'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <PlayerAvatar name={pa.player_name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-200 truncate">{pa.player_name}</p>
                            <p className="text-xs text-zinc-500">AI rated: {pa.rating_after.toFixed(1)}</p>
                          </div>
                          {hasChanged && (
                            <span className={`text-xs font-medium ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setCorrectionValues(prev => ({
                              ...prev,
                              [pa.player_id]: { ...prev[pa.player_id], rating: Math.max(2.0, Math.round((val.rating - 0.1) * 10) / 10) },
                            }))}
                            className="w-10 h-10 flex items-center justify-center bg-zinc-700 text-zinc-300 rounded-lg border-0 cursor-pointer hover:bg-zinc-600"
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            type="range"
                            min="2.0"
                            max="5.5"
                            step="0.1"
                            value={val.rating}
                            onChange={e => setCorrectionValues(prev => ({
                              ...prev,
                              [pa.player_id]: { ...prev[pa.player_id], rating: parseFloat(e.target.value) },
                            }))}
                            className="flex-1 accent-pickle"
                          />
                          <button
                            onClick={() => setCorrectionValues(prev => ({
                              ...prev,
                              [pa.player_id]: { ...prev[pa.player_id], rating: Math.min(5.5, Math.round((val.rating + 0.1) * 10) / 10) },
                            }))}
                            className="w-10 h-10 flex items-center justify-center bg-zinc-700 text-zinc-300 rounded-lg border-0 cursor-pointer hover:bg-zinc-600"
                          >
                            <Plus size={16} />
                          </button>
                          <span className="text-lg font-bold text-zinc-200 w-12 text-center">{val.rating.toFixed(1)}</span>
                        </div>
                        <input
                          type="text"
                          placeholder="Note (optional)"
                          value={val.note}
                          onChange={e => setCorrectionValues(prev => ({
                            ...prev,
                            [pa.player_id]: { ...prev[pa.player_id], note: e.target.value },
                          }))}
                          className="w-full mt-3 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pickle"
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 px-5 py-4">
                  <button
                    onClick={handleSaveCorrections}
                    className="w-full min-h-[44px] bg-pickle text-zinc-950 rounded-xl text-sm font-semibold hover:bg-pickle/90 transition-colors cursor-pointer border-0"
                  >
                    Save Corrections
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Per-Player Analysis */}
          <div className="space-y-6">
            {analysis.player_analyses.map(pa => (
              <div key={pa.player_id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                  <Link to={`/players/${pa.player_id}`} className="flex items-center gap-3 no-underline min-h-[44px]">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800 border-t border-zinc-800">
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
