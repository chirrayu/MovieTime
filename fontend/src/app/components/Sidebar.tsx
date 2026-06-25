import { Home, TrendingUp, Film, Tv, Bookmark, Clock, Settings, Menu, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

interface NavItem {
  icon: React.ElementType;
  label: string;
  id: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', id: 'home', path: '/' },
  { icon: Film, label: 'Movies', id: 'movies', path: '/movies' },
  { icon: Tv, label: 'Series', id: 'series', path: '/series' },
  { icon: Sparkles, label: 'Recommendations', id: 'recommendations', path: '/recommendations' },
  { icon: Bookmark, label: 'Watchlist', id: 'watchlist', path: '/watchlist' },
  { icon: Clock, label: 'Continue Watching', id: 'continue', path: '/continue' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveItem = () => {
    const path = location.pathname;
    if (path === '/movies') return 'movies';
    if (path === '/series') return 'series';
    if (path === '/watchlist') return 'watchlist';
    if (path === '/continue') return 'continue';
    if (path === '/recommendations') return 'recommendations';
    return 'home';
  };

  const activeItem = getActiveItem();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex fixed left-0 top-0 h-screen bg-[var(--sidebar)]/95 backdrop-blur-2xl border-r border-[var(--sidebar-border)] flex-col z-50 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo & Toggle */}
      <div className="p-4 border-b border-[var(--sidebar-border)] flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-xl tracking-tight font-semibold">
            <span className="text-[var(--foreground)]">MOVIE</span>
            <span className="text-[var(--sidebar-primary)]">•</span>
            <span className="text-[var(--foreground)]">TIME</span>
          </h1>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-[var(--secondary)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-2xl
                transition-all duration-300 ease-out
                  ${isActive
                      ? 'bg-gradient-to-r from-[rgba(229,9,20,0.18)] to-[rgba(229,9,20,0.05)] text-[var(--foreground)] shadow-[0_0_25px_rgba(229,9,20,0.15)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]'
                }
                ${collapsed ? 'justify-center px-0' : ''}
              `}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-[var(--sidebar-primary)]' : ''}`} strokeWidth={1.5} />
              {!collapsed && <span className="text-sm whitespace-nowrap">{item.label}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--sidebar-primary)] shadow-[0_0_8px_rgba(229,9,20,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-[var(--sidebar-border)]">
        <div className={`flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--secondary)] transition-all duration-300 cursor-pointer ${collapsed ? 'justify-center px-0' : ''}`}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--sidebar-primary)] to-[#b5070f] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-medium">U</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--foreground)] truncate">User</p>
              <p className="text-xs text-[var(--muted-foreground)]">Free Plan</p>
            </div>
          )}
        </div>
      </div>
    </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--sidebar)]/95 backdrop-blur-2xl border-t border-[var(--sidebar-border)] z-50 flex items-center justify-around px-2 pb-2 pt-2">
        {navItems.filter(item => item.id !== 'settings' && item.id !== 'trending').map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-2 min-w-[64px] ${isActive ? 'text-[var(--sidebar-primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{item.label === 'Continue Watching' ? 'Continue' : item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
