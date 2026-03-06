import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Film, Play, Loader2, AlertCircle, CheckCircle, Eye, UserPlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getPlayers, addMatch, updateMatch, addPlayer } from '../lib/storage';
import { analyzeVideo, analyzeVideoMultiPass, applyRatingUpdates, uploadAndIdentifyPlayers, type IdentifiedPlayer } from '../lib/analysis';
import { PlayerAvatar } from '../components/PlayerAvatar';
import type { Match, MatchPlayer } from '../types';

type Step = 'upload' | 'identifying' | 'assign' | 'players' | 'analyzing' | 'done' | 'error';

export function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [geminiFileUri, setGeminiFileUri] = useState<string>('');
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
  const [identifiedPlayers, setIdentifiedPlayers] = useState<IdentifiedPlayer[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<number, string>>({});
  const [team1Score, setTeam1Score] = useState<string>('');
  const [team2Score, setTeam2Score] = useState<string>('');
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState('');
  const [matchId, setMatchId] = useState('');

  const existingPlayers = getPlayers();

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      const reason = rejected[0]?.errors?.[0];
      if (reason?.code === 'file-too-large') {
        setError(`File too large (max 2GB). Your file is ${(rejected[0].file.size / (1024 * 1024 * 1024)).toFixed(1)}GB.`);
      } else if (reason?.code === 'file-invalid-type') {
        setError(`Unsupported file type. Please upload a video file (MP4, MOV, AVI, WebM, MKV, etc.)`);
      } else {
        setError(reason?.message || 'File rejected');
      }
      return;
    }
    const file = accepted[0];
    if (file) {
      setError('');
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      startIdentification(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v', '.ts', '.mts'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 * 1024,
  });

  const startIdentification = async (file: File) => {
    setStep('identifying');
    setError('');
    setProgress('Uploading video...');
    setProgressPct(5);

    try {
      const result = await uploadAndIdentifyPlayers(file, (msg, pct) => {
        setProgress(msg);
        if (pct !== undefined) setProgressPct(pct);
      });
      setIdentifiedPlayers(result.players);
      setBlobUrl(result.blobUrl);
      setGeminiFileUri(result.geminiFileUri);
      // Pre-fill name inputs as empty
      const names: Record<number, string> = {};
      result.players.forEach((_, i) => { names[i] = ''; });
      setPlayerNames(names);
      setStep('assign');
    } catch (err: any) {
      setError(err.message || 'Player identification failed');
      setStep('error');
    }
  };

  const confirmAssignments = () => {
    const players: MatchPlayer[] = [];
    identifiedPlayers.forEach((ip, i) => {
      const name = playerNames[i]?.trim();
      if (!name) return;
      // Find or create the player
      let existing = existingPlayers.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        existing = addPlayer(name);
      }
      const team = players.filter(p => p.team === 1).length < 2 ? 1 : 2;
      players.push({
        player_id: existing.id,
        player_name: existing.name,
        team: team as 1 | 2,
        appearance: ip.description,
      });
    });
    setMatchPlayers(players);
    setStep('players');
  };

  const skipIdentification = () => {
    setStep('players');
  };

  const removePlayer = (id: string) => {
    setMatchPlayers(prev => prev.filter(p => p.player_id !== id));
  };

  const toggleTeam = (id: string) => {
    setMatchPlayers(prev =>
      prev.map(p => (p.player_id === id ? { ...p, team: p.team === 1 ? 2 : 1 } : p))
    );
  };

  const updateAppearance = (id: string, appearance: string) => {
    setMatchPlayers(prev =>
      prev.map(p => (p.player_id === id ? { ...p, appearance } : p))
    );
  };

  const [newPlayerName, setNewPlayerName] = useState('');

  const addExistingPlayer = (id: string, name: string) => {
    if (matchPlayers.find(p => p.player_id === id)) return;
    const team = matchPlayers.filter(p => p.team === 1).length < 2 ? 1 : 2;
    setMatchPlayers(prev => [...prev, { player_id: id, player_name: name, team: team as 1 | 2, appearance: '' }]);
  };

  const addNewPlayer = () => {
    if (!newPlayerName.trim()) return;
    const player = addPlayer(newPlayerName.trim());
    addExistingPlayer(player.id, player.name);
    setNewPlayerName('');
  };

  const startAnalysis = async () => {
    if (!videoFile || matchPlayers.length < 2) return;

    const id = uuidv4();
    setMatchId(id);
    setStep('analyzing');
    setError('');

    const match: Match = {
      id,
      date: new Date().toISOString(),
      players: matchPlayers,
      team1_score: team1Score ? parseInt(team1Score) : null,
      team2_score: team2Score ? parseInt(team2Score) : null,
      analysis: null,
      video_name: videoFile.name,
      status: 'analyzing',
      created_at: new Date().toISOString(),
    };
    addMatch(match);

    try {
      setProgress('Sending video to AI for analysis...');
      setProgressPct(5);

      let analysis;
      if (geminiFileUri) {
        // Use multi-pass pipeline (video already uploaded to Gemini)
        analysis = await analyzeVideoMultiPass(
          matchPlayers,
          geminiFileUri,
          videoFile.type || 'video/mp4',
          (msg, pct) => {
            setProgress(msg);
            if (pct !== undefined) setProgressPct(pct);
          },
        );
      } else {
        // Fallback to single-pass (no Gemini URI available)
        analysis = await analyzeVideo(
          videoFile,
          matchPlayers,
          (msg, pct) => {
            setProgress(msg);
            if (pct !== undefined) setProgressPct(pct);
          },
          blobUrl || undefined,
        );
      }

      setProgressPct(95);
      setProgress('Updating player ratings...');

      applyRatingUpdates(analysis, id);
      updateMatch(id, { status: 'complete', analysis });

      setProgressPct(100);
      setProgress('Analysis complete!');
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
      updateMatch(id, { status: 'error' });
      setStep('error');
    }
  };

  const assignedCount = Object.values(playerNames).filter(n => n.trim()).length;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Analyze Game</h1>
      <p className="text-zinc-400 text-sm mb-8">Upload a pickleball game video — Gemini AI watches the full game</p>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-pickle bg-pickle/5' : 'border-zinc-700 hover:border-zinc-500'
          }`}
        >
          <input {...getInputProps()} />
          <Film size={48} className="text-zinc-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-zinc-300">Drop your game video here</p>
          <p className="text-sm text-zinc-500 mt-1">or click to browse &middot; MP4, MOV, AVI, WebM up to 5GB</p>
          <p className="text-xs text-zinc-600 mt-3">Powered by Gemini 2.5 Pro — watches your entire game, not just screenshots</p>
          {error && (
            <div className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Identifying Players */}
      {step === 'identifying' && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
          <Loader2 size={40} className="text-pickle mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">Scanning for Players</h2>
          <p className="text-sm text-zinc-400 mb-2">{progress}</p>
          <p className="text-xs text-zinc-600 mb-6">AI is watching the video to identify each player by appearance</p>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden max-w-md mx-auto">
            <div
              className="h-full bg-pickle rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">{progressPct}%</p>
        </div>
      )}

      {/* Step 3: Assign Names to Identified Players */}
      {step === 'assign' && (
        <div>
          {videoPreviewUrl && (
            <div className="mb-6 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
              <video src={videoPreviewUrl} controls className="w-full max-h-48 object-contain bg-black" />
            </div>
          )}

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye size={20} className="text-pickle" />
              <h3 className="font-semibold text-zinc-200">AI Detected {identifiedPlayers.length} Players</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-5">Assign a name to each player the AI found. Leave blank to skip a player.</p>

            <div className="space-y-4">
              {identifiedPlayers.map((ip, i) => (
                <div key={i} className="bg-zinc-800 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pickle/20 text-pickle flex items-center justify-center font-bold text-sm">
                      {String.fromCharCode(65 + i)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 mb-1">{ip.description}</p>
                      <p className="text-xs text-zinc-500 mb-3">{ip.court_position}</p>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Enter player name..."
                          value={playerNames[i] || ''}
                          onChange={e => setPlayerNames(prev => ({ ...prev, [i]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              // Focus next input
                              const next = document.querySelector<HTMLInputElement>(`[data-player-idx="${i + 1}"]`);
                              next?.focus();
                            }
                          }}
                          data-player-idx={i}
                          list={`existing-players-${i}`}
                          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-pickle text-sm"
                        />
                        <datalist id={`existing-players-${i}`}>
                          {existingPlayers.map(p => (
                            <option key={p.id} value={p.name} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={confirmAssignments}
              disabled={assignedCount < 2}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-pickle text-zinc-950 rounded-xl text-base font-semibold hover:bg-pickle-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors border-0"
            >
              <UserPlus size={20} />
              Confirm {assignedCount} Players
            </button>
            <button
              onClick={skipIdentification}
              className="px-4 py-3 bg-zinc-800 text-zinc-400 rounded-xl text-sm font-medium hover:bg-zinc-700 hover:text-zinc-300 cursor-pointer transition-colors border-0"
            >
              Skip — Add Manually
            </button>
          </div>
          {assignedCount < 2 && (
            <p className="text-xs text-zinc-500 text-center mt-2">Name at least 2 players to continue</p>
          )}
        </div>
      )}

      {/* Step 4: Player Selection / Review */}
      {step === 'players' && (
        <div>
          {videoPreviewUrl && (
            <div className="mb-6 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
              <video src={videoPreviewUrl} controls className="w-full max-h-64 object-contain bg-black" />
              <div className="px-4 py-2 border-t border-zinc-800">
                <p className="text-sm text-zinc-400">{videoFile?.name} &middot; {videoFile ? (videoFile.size / (1024 * 1024)).toFixed(0) : 0}MB</p>
              </div>
            </div>
          )}

          {/* Score Input */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
            <h3 className="font-semibold text-zinc-200 mb-3">Score (optional)</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 block mb-1">Team 1</label>
                <input
                  type="number"
                  value={team1Score}
                  onChange={e => setTeam1Score(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center text-lg font-semibold placeholder-zinc-600 focus:outline-none focus:border-pickle"
                />
              </div>
              <span className="text-zinc-500 font-bold mt-5">vs</span>
              <div className="flex-1">
                <label className="text-xs text-zinc-500 block mb-1">Team 2</label>
                <input
                  type="number"
                  value={team2Score}
                  onChange={e => setTeam2Score(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 text-center text-lg font-semibold placeholder-zinc-600 focus:outline-none focus:border-pickle"
                />
              </div>
            </div>
          </div>

          {/* Player Selection */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
            <h3 className="font-semibold text-zinc-200 mb-3">Players</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Team 1</p>
                <div className="space-y-2">
                  {matchPlayers.filter(p => p.team === 1).map(p => (
                    <div key={p.player_id} className="px-3 py-2 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar name={p.player_name} size="sm" />
                        <span className="text-sm text-zinc-200 flex-1">{p.player_name}</span>
                        <button onClick={() => toggleTeam(p.player_id)} className="text-xs text-zinc-500 hover:text-pickle bg-transparent border-0 cursor-pointer">swap</button>
                        <button onClick={() => removePlayer(p.player_id)} className="text-xs text-zinc-500 hover:text-red-400 bg-transparent border-0 cursor-pointer">&times;</button>
                      </div>
                      <input
                        type="text"
                        placeholder="Appearance: e.g. blue hat, white shirt"
                        value={p.appearance || ''}
                        onChange={e => updateAppearance(p.player_id, e.target.value)}
                        className="w-full mt-1.5 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pickle"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Team 2</p>
                <div className="space-y-2">
                  {matchPlayers.filter(p => p.team === 2).map(p => (
                    <div key={p.player_id} className="px-3 py-2 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar name={p.player_name} size="sm" />
                        <span className="text-sm text-zinc-200 flex-1">{p.player_name}</span>
                        <button onClick={() => toggleTeam(p.player_id)} className="text-xs text-zinc-500 hover:text-pickle bg-transparent border-0 cursor-pointer">swap</button>
                        <button onClick={() => removePlayer(p.player_id)} className="text-xs text-zinc-500 hover:text-red-400 bg-transparent border-0 cursor-pointer">&times;</button>
                      </div>
                      <input
                        type="text"
                        placeholder="Appearance: e.g. red shorts, tall"
                        value={p.appearance || ''}
                        onChange={e => updateAppearance(p.player_id, e.target.value)}
                        className="w-full mt-1.5 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-pickle"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Add from existing */}
            {existingPlayers.filter(p => !matchPlayers.find(mp => mp.player_id === p.id)).length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-zinc-500 mb-2">Add existing player:</p>
                <div className="flex flex-wrap gap-2">
                  {existingPlayers
                    .filter(p => !matchPlayers.find(mp => mp.player_id === p.id))
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => addExistingPlayer(p.id, p.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors cursor-pointer border-0"
                      >
                        <PlayerAvatar name={p.name} size="sm" />
                        {p.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Add new player inline */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New player name"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNewPlayer()}
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-pickle text-sm"
              />
              <button
                onClick={addNewPlayer}
                disabled={!newPlayerName.trim()}
                className="px-3 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-40 cursor-pointer border-0"
              >
                Add
              </button>
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={startAnalysis}
            disabled={matchPlayers.length < 2}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-pickle text-zinc-950 rounded-xl text-base font-semibold hover:bg-pickle-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors border-0"
          >
            <Play size={20} />
            Analyze Full Game ({matchPlayers.length} players)
          </button>
          {matchPlayers.length < 2 && (
            <p className="text-xs text-zinc-500 text-center mt-2">Add at least 2 players to continue</p>
          )}
        </div>
      )}

      {/* Analyzing */}
      {step === 'analyzing' && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
          <Loader2 size={40} className="text-pickle mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">Analyzing Full Game</h2>
          <p className="text-sm text-zinc-400 mb-2">{progress}</p>
          <p className="text-xs text-zinc-600 mb-6">
            {geminiFileUri
              ? 'Multi-pass pipeline: structure scan → segment analysis → player focus → rating → calibration'
              : progressPct < 50
                ? 'Uploading your video to Google servers...'
                : 'Gemini + Claude are analyzing every rally — this can take 2-5 minutes for long videos'}
          </p>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden max-w-md mx-auto">
            <div
              className="h-full bg-pickle rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">{progressPct}%</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
          <CheckCircle size={48} className="text-pickle mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">Analysis Complete!</h2>
          <p className="text-sm text-zinc-400 mb-6">Player ratings have been updated</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => navigate(`/matches/${matchId}`)}
              className="px-4 py-2 bg-pickle text-zinc-950 rounded-lg text-sm font-medium hover:bg-pickle-dark cursor-pointer border-0"
            >
              View Results
            </button>
            <button
              onClick={() => {
                setStep('upload');
                setVideoFile(null);
                setVideoPreviewUrl('');
                setBlobUrl('');
                setGeminiFileUri('');
                setMatchPlayers([]);
                setIdentifiedPlayers([]);
                setPlayerNames({});
                setTeam1Score('');
                setTeam2Score('');
              }}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 cursor-pointer border-0"
            >
              Analyze Another
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="bg-zinc-900 rounded-xl border border-red-500/30 p-8 text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">
            {identifiedPlayers.length === 0 ? 'Player Detection Failed' : 'Analysis Failed'}
          </h2>
          <p className="text-sm text-red-400 mb-6">{error}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => videoFile ? startIdentification(videoFile) : setStep('upload')}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 cursor-pointer border-0"
            >
              Retry
            </button>
            <button
              onClick={() => {
                setStep('players');
                setError('');
              }}
              className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 cursor-pointer border-0"
            >
              Skip — Add Players Manually
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
