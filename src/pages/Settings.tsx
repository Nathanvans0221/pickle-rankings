import { useState } from 'react';
import { Download, Trash2, Info } from 'lucide-react';
import { useTheme, type ThemePreference } from '../hooks/useTheme';
import { getPlayers, getMatches, getClaimedPlayerId, setClaimedPlayerId, getCorrections } from '../lib/storage';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RatingBadge } from '../components/RatingBadge';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const players = getPlayers().sort((a, b) => a.name.localeCompare(b.name));
  const [claimedId, setClaimedId] = useState(getClaimedPlayerId);
  const [confirmClear, setConfirmClear] = useState(false);

  const claimedPlayer = claimedId ? players.find(p => p.id === claimedId) : null;

  const handleClaimChange = (id: string) => {
    const val = id || null;
    setClaimedPlayerId(val);
    setClaimedId(val);
  };

  const handleExport = () => {
    const data = {
      players: getPlayers(),
      matches: getMatches(),
      corrections: getCorrections(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pickle-rankings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    localStorage.removeItem('pickle_rankings_players');
    localStorage.removeItem('pickle_rankings_matches');
    localStorage.removeItem('pickle_rankings_claimed_player');
    localStorage.removeItem('pickle_rankings_corrections');
    setConfirmClear(false);
    window.location.reload();
  };

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Appearance */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Appearance</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-300 mb-3">Theme</p>
          <div className="flex rounded-xl bg-zinc-800 p-1">
            {themeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer border-0 ${
                  theme === opt.value
                    ? 'bg-pickle text-zinc-950'
                    : 'bg-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Your Player */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Your Player</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-zinc-400 mb-3">Link yourself to a player to see your stats on the Dashboard.</p>
          <select
            value={claimedId || ''}
            onChange={e => handleClaimChange(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-base text-zinc-200 focus:outline-none focus:border-pickle"
          >
            <option value="">None</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {claimedPlayer && (
            <div className="flex items-center gap-3 mt-4 p-3 bg-zinc-800 rounded-xl">
              <PlayerAvatar name={claimedPlayer.name} avatar_url={claimedPlayer.avatar_url} size="md" />
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-200">{claimedPlayer.name}</p>
                <p className="text-xs text-zinc-500">{claimedPlayer.matches_played} games played</p>
              </div>
              <RatingBadge rating={claimedPlayer.current_rating} size="md" />
            </div>
          )}
        </div>
      </section>

      {/* Data */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Data</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-3 px-5 py-4 text-left bg-transparent border-0 cursor-pointer hover:bg-zinc-800/50 transition-colors"
          >
            <Download size={20} className="text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Export Data</p>
              <p className="text-xs text-zinc-500">Download all players and matches as JSON</p>
            </div>
          </button>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left bg-transparent border-0 cursor-pointer hover:bg-red-500/5 transition-colors"
            >
              <Trash2 size={20} className="text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-400">Clear All Data</p>
                <p className="text-xs text-zinc-500">Delete all players, matches, and settings</p>
              </div>
            </button>
          ) : (
            <div className="px-5 py-4">
              <p className="text-sm text-red-400 font-medium mb-3">Are you sure? This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleClearAll}
                  className="flex-1 min-h-[44px] bg-red-500/20 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors cursor-pointer border-0"
                >
                  Delete Everything
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 min-h-[44px] bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium hover:bg-zinc-700 transition-colors cursor-pointer border-0"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">About</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Info size={20} className="text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Pickle Rankings</p>
              <p className="text-xs text-zinc-500">v2.1.0</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            AI-powered pickleball video analysis and player rankings.
            Powered by Gemini 2.5 Pro + Claude Sonnet 4.5.
          </p>
        </div>
      </section>
    </div>
  );
}
