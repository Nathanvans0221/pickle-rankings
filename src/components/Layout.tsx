import { Link, useLocation } from 'react-router-dom';
import { Trophy, Upload, Users, Home, Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/upload', label: 'Analyze', icon: Upload },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/players', label: 'Players', icon: Users },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top Nav */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 no-underline">
              <span className="text-2xl">🏓</span>
              <span className="text-xl font-bold text-zinc-50">
                Pickle<span className="text-pickle">Rankings</span>
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <nav className="flex items-center gap-1">
                {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                  const active = location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                        active
                          ? 'bg-pickle/10 text-pickle'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="hidden sm:inline">{label}</span>
                    </Link>
                  );
                })}
              </nav>
              <button
                onClick={toggle}
                className="ml-2 p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer bg-transparent border-0"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Version */}
      <footer className="text-center text-xs text-zinc-700 py-4">v2.0.0</footer>
    </div>
  );
}
