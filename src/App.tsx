import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { UploadPage } from './pages/Upload';
import { LeaderboardPage } from './pages/Leaderboard';
import { PlayersPage } from './pages/Players';
import { PlayerProfilePage } from './pages/PlayerProfile';
import { MatchDetailPage } from './pages/MatchDetail';

function App() {
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
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
