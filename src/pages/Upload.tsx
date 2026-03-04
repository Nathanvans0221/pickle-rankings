import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Film, Play, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getPlayers, addMatch, updateMatch, addPlayer } from '../lib/storage';
import { extractFrames } from '../lib/frames';
import { analyzeFrames, applyRatingUpdates } from '../lib/analysis';
import { PlayerAvatar } from '../components/PlayerAvatar';
import type { Match, MatchPlayer } from '../types';

type Step = 'upload' | 'players' | 'analyzing' | 'done' | 'error';

const API_KEY_STORAGE = 'pickle_rankings_api_key';

export function UploadPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
  const [team1Score, setTeam1Score] = useState<string>('');
  const [team2Score, setTeam2Score] = useState<string>('');
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState('');
  const [apiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [matchId, setMatchId] = useState('');

  const existingPlayers = getPlayers();

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (file) {
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setStep('players');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.webm'] },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const addExistingPlayer = (id: string, name: string) => {
    if (matchPlayers.find(p => p.player_id === id)) return;
    const team = matchPlayers.filter(p => p.team === 1).length < 2 ? 1 : 2;
    setMatchPlayers(prev => [...prev, { player_id: id, player_name: name, team: team as 1 | 2 }]);
  };

  const addNewPlayer = () => {
    if (!newPlayerName.trim()) return;
    const player = addPlayer(newPlayerName.trim());
    addExistingPlayer(player.id, player.name);
    setNewPlayerName('');
  };

  const removePlayer = (id: string) => {
    setMatchPlayers(prev => prev.filter(p => p.player_id !== id));
  };

  const toggleTeam = (id: string) => {
    setMatchPlayers(prev =>
      prev.map(p => (p.player_id === id ? { ...p, team: p.team === 1 ? 2 : 1 } : p))
    );
  };

  const startAnalysis = async () => {
    if (!videoFile || matchPlayers.length < 2) return;

    if (apiKey) {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    }

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
      status: 'extracting',
      created_at: new Date().toISOString(),
    };
    addMatch(match);

    try {
      // Extract frames
      setProgress('Extracting key frames from video...');
      setProgressPct(10);
      const frames = await extractFrames(videoFile, 12, (pct, msg) => {
        setProgressPct(10 + pct * 0.4);
        setProgress(msg);
      });

      // Analyze
      setProgress('AI is analyzing gameplay...');
      setProgressPct(55);
      updateMatch(id, { status: 'analyzing' });

      const analysis = await analyzeFrames(
        frames,
        matchPlayers,
        apiKey,
        msg => setProgress(msg),
      );

      setProgressPct(90);
      setProgress('Updating player ratings...');

      // Apply ratings
      applyRatingUpdates(analysis);
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

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Analyze Game</h1>
      <p className="text-zinc-400 text-sm mb-8">Upload a pickleball game video for AI analysis</p>

      {/* API key is configured server-side */}
      {false && (
        <div className="hidden" />
      )}

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
          <p className="text-sm text-zinc-500 mt-1">or click to browse &middot; MP4, MOV, AVI, WebM up to 500MB</p>
        </div>
      )}

      {/* Step 2: Player Selection */}
      {step === 'players' && (
        <div>
          {/* Video Preview */}
          {videoPreviewUrl && (
            <div className="mb-6 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
              <video src={videoPreviewUrl} controls className="w-full max-h-64 object-contain bg-black" />
              <div className="px-4 py-2 border-t border-zinc-800">
                <p className="text-sm text-zinc-400">{videoFile?.name}</p>
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
            <h3 className="font-semibold text-zinc-200 mb-3">Who's Playing?</h3>

            {/* Selected Players */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Team 1</p>
                <div className="space-y-2">
                  {matchPlayers.filter(p => p.team === 1).map(p => (
                    <div key={p.player_id} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                      <PlayerAvatar name={p.player_name} size="sm" />
                      <span className="text-sm text-zinc-200 flex-1">{p.player_name}</span>
                      <button onClick={() => toggleTeam(p.player_id)} className="text-xs text-zinc-500 hover:text-pickle bg-transparent border-0 cursor-pointer">swap</button>
                      <button onClick={() => removePlayer(p.player_id)} className="text-xs text-zinc-500 hover:text-red-400 bg-transparent border-0 cursor-pointer">&times;</button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Team 2</p>
                <div className="space-y-2">
                  {matchPlayers.filter(p => p.team === 2).map(p => (
                    <div key={p.player_id} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg">
                      <PlayerAvatar name={p.player_name} size="sm" />
                      <span className="text-sm text-zinc-200 flex-1">{p.player_name}</span>
                      <button onClick={() => toggleTeam(p.player_id)} className="text-xs text-zinc-500 hover:text-pickle bg-transparent border-0 cursor-pointer">swap</button>
                      <button onClick={() => removePlayer(p.player_id)} className="text-xs text-zinc-500 hover:text-red-400 bg-transparent border-0 cursor-pointer">&times;</button>
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
            Analyze Game ({matchPlayers.length} players)
          </button>
          {matchPlayers.length < 2 && (
            <p className="text-xs text-zinc-500 text-center mt-2">Add at least 2 players to continue</p>
          )}
        </div>
      )}

      {/* Step 3: Analyzing */}
      {step === 'analyzing' && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
          <Loader2 size={40} className="text-pickle mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">Analyzing Gameplay</h2>
          <p className="text-sm text-zinc-400 mb-6">{progress}</p>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden max-w-md mx-auto">
            <div
              className="h-full bg-pickle rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">{progressPct}%</p>
        </div>
      )}

      {/* Step 4: Done */}
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
                setMatchPlayers([]);
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

      {/* Step 5: Error */}
      {step === 'error' && (
        <div className="bg-zinc-900 rounded-xl border border-red-500/30 p-8 text-center">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-zinc-200 mb-2">Analysis Failed</h2>
          <p className="text-sm text-red-400 mb-6">{error}</p>
          <button
            onClick={() => setStep('players')}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-700 cursor-pointer border-0"
          >
            Try Again
          </button>
        </div>
      )}

    </div>
  );
}
