import { Link, useLocation } from 'react-router-dom';
import { Trophy, Upload, Users, Home, Settings } from 'lucide-react';

const TAB_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/upload', label: 'Analyze', icon: Upload },
  { path: '/leaderboard', label: 'Rankings', icon: Trophy },
  { path: '/players', label: 'Players', icon: Users },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const isTabActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Top Bar — slim logo only */}
      <header
        className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-12">
            <Link to="/" className="flex items-center gap-2 no-underline">
              <span className="text-xl">🏓</span>
              <span className="text-lg font-bold text-zinc-50">
                Pickle<span className="text-pickle">Rankings</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {children}
      </main>

      {/* Bottom Tab Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-lg mx-auto flex items-stretch justify-around">
          {TAB_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = isTabActive(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[50px] min-w-[44px] flex-1 py-1.5 no-underline transition-colors ${
                  active ? 'text-pickle' : 'text-zinc-500'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
