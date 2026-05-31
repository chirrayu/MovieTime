import { useState, useEffect } from 'react';
import { HeroBanner } from '../components/HeroBanner';
import { MovieRow } from '../components/MovieRow';
import { MovieCard } from '../components/MovieCard';
import { fetchLatestMovies, fetchLatestTVShows } from '../lib/api';
import { getContinueWatching } from '../lib/storage';
import { cacheItems } from '../lib/cache';
import type { MovieItem, TVShowItem } from '../lib/api';

export function HomePage() {
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [tvShows, setTVShows] = useState<TVShowItem[]>([]);
  const [heroItem, setHeroItem] = useState<MovieItem | TVShowItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const continueWatching = getContinueWatching();

  useEffect(() => {
    async function loadData() {
      try {
        const [moviesRes, tvRes] = await Promise.all([
          fetchLatestMovies(1),
          fetchLatestTVShows(1),
        ]);

        setMovies(moviesRes.items);
        setTVShows(tvRes.items);

        // Cache all items for instant detail page access
        cacheItems([...moviesRes.items, ...tvRes.items]);

        // Pick a random high-rated item for the hero
        const allItems = [...moviesRes.items, ...tvRes.items];
        const highRated = allItems.filter(i => parseFloat(i.rating) >= 7);
        if (highRated.length > 0) {
          setHeroItem(highRated[Math.floor(Math.random() * Math.min(highRated.length, 5))]);
        } else if (allItems.length > 0) {
          setHeroItem(allItems[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to load homepage data:', err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div>
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
                    title={item.title}
                    year=""
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
        <MovieRow title="🔥 Latest Movies" items={movies} loading={loading} />

        {/* Latest TV Shows */}
        <MovieRow title="📺 Trending Series" items={tvShows} loading={loading} />

        {/* High Rated Movies */}
        <MovieRow
          title="⭐ Top Rated"
          items={movies.filter(m => parseFloat(m.rating) >= 7).slice(0, 12)}
          loading={loading}
        />

        {/* Action Movies */}
        <MovieRow
          title="💥 Action & Thrillers"
          items={movies.filter(m => m.genre?.toLowerCase().includes('action') || m.genre?.toLowerCase().includes('thriller'))}
          loading={loading}
        />
      </div>
    </div>
  );
}
