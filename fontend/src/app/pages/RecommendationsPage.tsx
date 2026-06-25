import { useState, useEffect, lazy, Suspense } from 'react';
import { MovieCard } from '../components/MovieCard';
import { MoviePreviewModal } from '../components/MoviePreviewModal';
import {
  getFavoriteGenres,
  saveFavoriteGenres,
  getWatchlist,
  getHistory,
  getLikedItems,
  getAllWatchProgress
} from '../lib/storage';
import {
  getPopular,
  getTrending,
  getTopRated,
  mapTMDBToItem,
  MOVIE_GENRES,
  TV_GENRES
} from '../lib/api';
import type { MovieItem, TVShowItem } from '../lib/api';
import { Sparkles, Check, RefreshCw } from 'lucide-react';

const LazyPlayer = lazy(() => import('../components/Player'));

// Unique set of all genres across movies and TV shows
const ALL_GENRES = Array.from(
  new Set([...Object.values(MOVIE_GENRES), ...Object.values(TV_GENRES)])
).sort();

interface ScoredItem {
  item: MovieItem | TVShowItem;
  score: number;
  reasons: string[];
}

export function RecommendationsPage() {
  const [selectedGenres, setSelectedGenres] = useState<string[]>(getFavoriteGenres());
  const [recommendations, setRecommendations] = useState<ScoredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
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

  const toggleGenre = (genre: string) => {
    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter(g => g !== genre)
      : [...selectedGenres, genre];
    setSelectedGenres(next);
    saveFavoriteGenres(next);
  };

  const fetchCandidatesAndScore = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch Candidate items from multiple TMDB endpoints
      const [popMovies, popTV, trending, topMovie, topTV] = await Promise.all([
        getPopular('movie', 1).catch(() => ({ results: [] })),
        getPopular('tv', 1).catch(() => ({ results: [] })),
        getTrending('all', 'week').catch(() => ({ results: [] })),
        getTopRated('movie', 1).catch(() => ({ results: [] })),
        getTopRated('tv', 1).catch(() => ({ results: [] }))
      ]);

      // Map everything to common item format
      const rawCandidates = [
        ...popMovies.results.map(r => mapTMDBToItem({ ...r, media_type: 'movie' })),
        ...popTV.results.map(r => mapTMDBToItem({ ...r, media_type: 'tv' })),
        ...trending.results.map(r => mapTMDBToItem(r)),
        ...topMovie.results.map(r => mapTMDBToItem({ ...r, media_type: 'movie' })),
        ...topTV.results.map(r => mapTMDBToItem({ ...r, media_type: 'tv' }))
      ].filter(Boolean) as (MovieItem | TVShowItem)[];

      // Remove duplicates
      const seen = new Set<string>();
      const candidatePool: (MovieItem | TVShowItem)[] = [];
      for (const item of rawCandidates) {
        const id = item.tmdb_id || item.imdb_id;
        if (id && !seen.has(id)) {
          seen.add(id);
          candidatePool.push(item);
        }
      }

      // 2. Fetch User Profile metrics from LocalStorage/Cookies
      const watchlist = getWatchlist();
      const history = getHistory();
      const liked = getLikedItems();
      const watchProgress = getAllWatchProgress();

      // Extract genre frequencies from history & likes for contextual weightings
      const watchlistGenres = watchlist.flatMap(w => w.genre ? w.genre.split(',').map(s => s.trim()) : []);
      const historyGenres = history.flatMap(h => {
        const match = watchlist.find(w => w.id === h.id) || candidatePool.find(c => (c.tmdb_id === h.id || c.imdb_id === h.id));
        return match?.genre ? match.genre.split(',').map(s => s.trim()) : [];
      });

      // 3. Compute Recommendation Score
      const scored: ScoredItem[] = candidatePool.map(item => {
        let score = 0;
        const reasons: string[] = [];
        const itemGenres = item.genre ? item.genre.split(',').map(s => s.trim()) : [];
        const itemId = item.tmdb_id || item.imdb_id;

        // Skip if user has watched more than 90%
        const progressEntry = watchProgress[itemId];
        if (progressEntry && progressEntry.duration > 0) {
          const percent = (progressEntry.progress / progressEntry.duration) * 100;
          if (percent > 90) return null as any;
        }

        // Skip if in watch history
        if (history.some(h => h.id === itemId)) {
          return null as any;
        }

        // Match with User Selected Favorite Genres (+5 points per match)
        const favMatches = itemGenres.filter(g => selectedGenres.includes(g));
        if (favMatches.length > 0) {
          score += favMatches.length * 5;
          reasons.push(`Matches your favorite genre${favMatches.length > 1 ? 's' : ''}: ${favMatches.slice(0, 2).join(', ')}`);
        }

        // Match with Watchlist Genres (+3 points per match)
        const watchlistMatches = itemGenres.filter(g => watchlistGenres.includes(g));
        if (watchlistMatches.length > 0) {
          score += watchlistMatches.length * 3;
          reasons.push(`Similar to items in your watchlist`);
        }

        // Match with History Genres (+2 points per match)
        const historyMatches = itemGenres.filter(g => historyGenres.includes(g));
        if (historyMatches.length > 0) {
          score += historyMatches.length * 2;
          reasons.push(`Fits your watch style`);
        }

        // Favor highly rated titles (+1 point per rating score above 6)
        const ratingVal = parseFloat(item.rating);
        if (!isNaN(ratingVal) && ratingVal > 6) {
          score += (ratingVal - 6) * 1.5;
        }

        return { item, score, reasons: Array.from(new Set(reasons)) };
      }).filter(Boolean);

      // Sort descending by score
      const sorted = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

      setRecommendations(sorted.slice(0, 30));
    } catch (err) {
      console.error('Failed to calculate recommendations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCandidatesAndScore();
  }, [selectedGenres]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-[#E50914] animate-pulse" />
            Recommended For You
          </h1>
          <p className="text-[#9A9A9A] text-sm">
            Suggestions based on your local activity and preferences.
          </p>
        </div>
        <button
          onClick={fetchCandidatesAndScore}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm transition-all duration-300 disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Recalculate
        </button>
      </div>

      {/* Profile/Preference Customization */}
      <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">Select Your Favorite Genres</h2>
          <p className="text-xs text-[#666]">Choose the genres you want to see more of in recommendations.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map(genre => {
            const isSelected = selectedGenres.includes(genre);
            return (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                  ${isSelected
                    ? 'bg-[#E50914] border-[#E50914] text-white shadow-[0_0_12px_rgba(229,9,20,0.4)]'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5" />}
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recommendation Results */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[2/3] rounded-xl bg-white/5" />
              <div className="h-4 bg-white/5 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white/5 rounded-2xl border border-white/5">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-[#555]" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-lg font-medium text-white">No Recommendations Found</h3>
            <p className="text-sm text-[#9A9A9A] max-w-sm px-4">
              Select some genres above, add titles to your Watchlist, or watch movies to help us build recommendations for you!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-medium text-white">Top Recommendations</h3>
            <span className="text-xs text-[#666] tracking-wider uppercase">{recommendations.length} Suggestions</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {recommendations.map(({ item, reasons }, idx) => (
              <div key={`${item.tmdb_id}-${idx}`} className="relative group">
                <MovieCard
                  tmdb_id={item.tmdb_id}
                  imdb_id={item.imdb_id}
                  title={item.title}
                  year={item.year}
                  rating={item.rating}
                  poster_url={item.poster_url}
                  genre={item.genre}
                  type={item.type}
                  onCardClick={handleCardClick}
                />
                {reasons.length > 0 && (
                  <div className="absolute top-8 left-2 right-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30 bg-black/90 backdrop-blur-md rounded-lg p-2 border border-white/10 text-[10px] text-white shadow-xl">
                    <p className="font-semibold text-[#E50914] mb-0.5">Recommendation Match</p>
                    <p className="text-white/80 line-clamp-2">{reasons[0]}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
                embedUrl={selectedMovie.embed_url || `https://vaplayer.ru/embed/${selectedMovie.type}/${selectedMovie.imdb_id || selectedMovie.tmdb_id}`}
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
