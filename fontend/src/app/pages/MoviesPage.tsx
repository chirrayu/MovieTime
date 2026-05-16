import { useState, useEffect } from 'react';
import { MovieCard } from '../components/MovieCard';
import { fetchLatestMovies } from '../lib/api';
import type { MovieItem } from '../lib/api';
import { cacheItems } from '../lib/cache';
import { Loader2 } from 'lucide-react';

export function MoviesPage() {
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMovies = async (pageNum: number, append: boolean = false) => {
    const setLoadState = append ? setLoadingMore : setLoading;
    setLoadState(true);
    try {
      const res = await fetchLatestMovies(pageNum);
      cacheItems(res.items);
      if (append) {
        setMovies(prev => [...prev, ...res.items]);
      } else {
        setMovies(res.items);
      }
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error('Failed to load movies:', err);
    } finally {
      setLoadState(false);
    }
  };

  useEffect(() => { loadMovies(1); }, []);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadMovies(nextPage, true);
  };

  return (
    <div className="p-6 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Movies</h1>
        <p className="text-[#9A9A9A] text-sm">Browse the latest movies available</p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
              <div className="mt-2 h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="mt-1 h-3 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {movies.map((movie, idx) => (
              <MovieCard
                key={`${movie.tmdb_id}-${idx}`}
                tmdb_id={movie.tmdb_id}
                imdb_id={movie.imdb_id}
                title={movie.title}
                year={movie.year}
                rating={movie.rating}
                poster_url={movie.poster_url}
                genre={movie.genre}
                type="movie"
              />
            ))}
          </div>

          {/* Load More */}
          {page < totalPages && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white text-sm transition-all duration-300 disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Movies'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
