import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/Upload';
import { LeaderboardPage } from './pages/Leaderboard';
import { PlayersPage } from './pages/Players';
import { PlayerProfilePage } from './pages/PlayerProfile';
import { MatchDetailPage } from './pages/MatchDetail';
import { SettingsPage } from './pages/Settings';
import { syncFromCloud, pushAllToCloud } from './lib/storage';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  const [synced, setSynced] = useState(!isSupabaseConfigured());

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    syncFromCloud().then(pulledData => {
      if (!pulledData) {
        // No cloud data yet — seed from local
        pushAllToCloud();
      }
      setSynced(true);
    });
  }, []);

  if (!synced) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-400 text-sm">
        Syncing data...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:id" element={<PlayerProfilePage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
