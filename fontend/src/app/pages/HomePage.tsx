import { useState, useEffect, lazy, Suspense } from 'react';
import { HeroBanner } from '../components/HeroBanner';
import { MovieRow } from '../components/MovieRow';
import { MovieCard } from '../components/MovieCard';
import { MoviePreviewModal } from '../components/MoviePreviewModal';
import { fetchLatestMovies, fetchLatestTVShows } from '../lib/api';
import { getContinueWatching, type WatchProgress } from '../lib/storage';
import type { MovieItem, TVShowItem } from '../lib/api';

const LazyPlayer = lazy(() => import('../components/Player'));

export function HomePage() {
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [tvShows, setTvShows] = useState<TVShowItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  const handleCardClick = (movie: any) => {
    setSelectedMovie(movie);
    setIsModalOpen(true);
    setShowPlayer(false);
  };

  const closeModal = (keepSelected = false) => {
    setIsModalOpen(false);
    if (!keepSelected) {
      setSelectedMovie(null);
    }
    document.body.style.overflow = '';
  };

  const handlePlay = (movie: any) => {
    setSelectedMovie(movie);
    setShowPlayer(true);
    closeModal(true);
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [moviesResp, tvResp] = await Promise.all([
          fetchLatestMovies(),
          fetchLatestTVShows()
        ]);
        const moviesList = (moviesResp && 'items' in moviesResp) ? moviesResp.items : moviesResp;
        const tvList = (tvResp && 'items' in tvResp) ? tvResp.items : tvResp;
        setMovies(Array.isArray(moviesList) ? moviesList : []);
        setTvShows(Array.isArray(tvList) ? tvList : []);
        const cwProgress = getContinueWatching();
        setContinueWatching(cwProgress);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        console.error('Failed to load home page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const heroItem = movies[0] || null;

  return (
    <div className="pb-10">
      {/* Hero Banner */}
      <div className="p-6 pt-6">
        {error && (
          <div className="mb-4 rounded-2xl border border-[#E50914]/50 bg-[#1a1a1a]/90 p-4 text-sm text-[#f1f1f1] shadow-sm">
            <strong className="block text-white mb-1">Connection issue</strong>
            <span>Unable to fetch TMDB data right now. Showing fallback content where available.</span>
          </div>
        )}
        <HeroBanner item={heroItem} loading={loading} />
      </div>

      {/* Content Rows */}
      <div className="space-y-10 py-6">
        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-6">
              <h2 className="text-xl text-white font-medium">Continue Watching</h2>
              <span className="text-xs text-[#666] uppercase tracking-wider">{continueWatching.length} titles</span>
            </div>
            <div className="flex gap-4 overflow-x-auto px-6 pb-4" style={{ scrollbarWidth: 'none' }}>
              {continueWatching.map((item, idx) => (
                <div key={`cw-${item.id}-${idx}`} className="flex-none w-44">
                  <MovieCard
                    tmdb_id={item.id}
                    imdb_id={item.id}
                    title={item.title || item.episodeTitle || `Title ${item.id}`}
                    year={item.type === 'movie' ? '' : item.season && item.episode ? `S${item.season} · E${item.episode}` : ''}
                    rating=""
                    poster_url={item.poster}
                    type={item.type}
                    progress={item.progress}
                    duration={item.duration}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Movies */}
        <MovieRow
          title="🔥 Latest Movies"
          items={movies}
          loading={loading}
          renderCard={(movie) => (
            <MovieCard {...movie} onCardClick={handleCardClick} />
          )}
        />

        {/* Latest TV Shows */}
        <MovieRow
          title="📺 Trending Series"
          items={tvShows}
          loading={loading}
          renderCard={(show) => (
            <MovieCard {...show} onCardClick={handleCardClick} />
          )}
        />

        {/* High Rated Movies */}
        <MovieRow
          title="⭐ Top Rated"
          items={Array.isArray(movies) ? movies.filter(m => parseFloat(m.rating) >= 7).slice(0, 12) : []}
          loading={loading}
          renderCard={(movie) => (
            <MovieCard {...movie} onCardClick={handleCardClick} />
          )}
        />

        {/* Action Movies */}
        <MovieRow
          title="💥 Action & Thrillers"
          items={Array.isArray(movies) ? movies.filter(m => m.genre?.toLowerCase().includes('action') || m.genre?.toLowerCase().includes('thriller')) : []}
          loading={loading}
          renderCard={(movie) => (
            <MovieCard {...movie} onCardClick={handleCardClick} />
          )}
        />
      </div>

      {/* Preview Modal */}
      {isModalOpen && selectedMovie && (
        <MoviePreviewModal
          key={selectedMovie.tmdb_id || selectedMovie.imdb_id}
          movie={selectedMovie}
          onClose={closeModal}
          onPlay={handlePlay}
        />
      )}

      {/* Lazy‑loaded Player */}
      {showPlayer && selectedMovie && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black text-white">Loading player…</div>}>
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur-md">
              <span className="text-white text-sm font-semibold">{selectedMovie.title}</span>
              <button
                onClick={() => { setShowPlayer(false); setSelectedMovie(null); }}
                className="text-white/70 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                ✕ Close
              </button>
            </div>
            <div className="relative flex-1">
              <LazyPlayer
                embedUrl={selectedMovie.embed_url}
                type={selectedMovie.type}
                title={selectedMovie.title}
              />
            </div>
          </div>
        </Suspense>
      )}
    </div>
  );
}
