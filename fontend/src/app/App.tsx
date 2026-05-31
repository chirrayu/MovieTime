import { BrowserRouter, Routes, Route } from 'react-router';
import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { HomePage } from './pages/HomePage';
import { MoviesPage } from './pages/MoviesPage';
import { SeriesPage } from './pages/SeriesPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { ContinueWatchingPage } from './pages/ContinueWatchingPage';
import { PlayerPage } from './pages/PlayerPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { DetailPage } from './pages/DetailPage';

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Collapse sidebar on medium screens
  useEffect(() => {
    const checkWidth = () => {
      setSidebarCollapsed(window.innerWidth < 1024);
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

        {/* Main Content */}
        <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} pb-20 md:pb-0`}>
          {/* Header */}
          <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--surface)]/85 border-b border-[var(--border)]">
            <div className="flex items-center justify-between p-4 px-6">
              <SearchBar />
              <div className="flex items-center gap-4">
                <button className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors duration-200 relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--primary)] rounded-full" />
                </button>
              </div>
            </div>
          </header>

          {/* Routes */}
          <div className="pb-20">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/movies" element={<MoviesPage />} />
              <Route path="/series" element={<SeriesPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/continue" element={<ContinueWatchingPage />} />
              <Route path="/search" element={<SearchResultsPage />} />
              <Route path="/movie/:id" element={<DetailPage type="movie" />} />
              <Route path="/tv/:id" element={<DetailPage type="tv" />} />
              <Route path="/watch/movie/:id" element={<PlayerPage type="movie" />} />
              <Route path="/watch/tv/:id/:season/:episode" element={<PlayerPage type="tv" />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}