import { BrowserRouter, Routes, Route } from 'react-router';
import { useAppStore } from '../store/useAppStore';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { lazy, Suspense } from 'react';
const HomePage = lazy(() => import('./pages/HomePage'));
const MoviesPage = lazy(() => import('./pages/MoviesPage'));
const SeriesPage = lazy(() => import('./pages/SeriesPage'));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage'));
const ContinueWatchingPage = lazy(() => import('./pages/ContinueWatchingPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const DetailPage = lazy(() => import('./pages/DetailPage'));

export default function App() {
  // State moved to Zustand store
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  // Collapse sidebar on medium screens handled in store via effect (will be added later)

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#070707] text-white">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

        {/* Main Content */}
        <main className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} pb-20 md:pb-0`}>
          {/* Header */}
          <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#070707]/80 border-b border-white/5">
            <div className="flex items-center justify-between p-4 px-6">
              <SearchBar />
              <div className="flex items-center gap-4">
                <button className="text-[#9A9A9A] hover:text-white transition-colors duration-200 relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#E50914] rounded-full" />
                </button>
              </div>
            </div>
          </header>

          {/* Routes */}
          <div className="pb-20">
            <Suspense fallback={<div className="flex items-center justify-center h-full"><span>Loading...</span></div>}>
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
            </Suspense>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}