import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion } from 'motion/react';
import { MovieCard } from '../components/MovieCard';
import { MoviePreviewModal } from '../components/MoviePreviewModal';
import { ChevronLeft, ChevronRight, Sparkles, Play, Info } from 'lucide-react';
import { getHistory, getAllWatchProgress } from '../lib/storage';
import { fetchLatestMovies, fetchLatestTVShows, getTrending, mapTMDBToItem } from '../lib/api';
import type { MovieItem, TVShowItem } from '../lib/api';
import {
  loadUserProfile,
  computeCollaborativeSimilarities,
  scoreRecommendationCandidate,
  type UserProfile,
  type RecommenderContext,
  type ScoredRecommendation,
} from '../lib/recommender';

const LazyPlayer = lazy(() => import('../components/Player'));

// ── Scrollable row ────────────────────────────────────────────────────────────

function RecommendationRow({
  title,
  subtitle,
  recs,
  onCardClick,
}: {
  title: string;
  subtitle?: string;
  recs: ScoredRecommendation[];
  onCardClick: (item: any) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' });
    setTimeout(updateArrows, 400);
  };

  if (recs.length === 0) return null;

  return (
    <div className="space-y-4 group/row">
      <div className="flex items-center justify-between px-6">
        <div className="space-y-0.5">
          <h2 className="text-xl text-white font-medium">{title}</h2>
          {subtitle && <p className="text-xs text-[#666]">{subtitle}</p>}
        </div>
        <span className="text-xs text-[#666] uppercase tracking-wider">{recs.length} titles</span>
      </div>

      <div className="relative">
        {showLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-r from-[#070707] to-transparent
                       flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </div>
          </button>
        )}

        {showRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-l from-[#070707] to-transparent
                       flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-4 overflow-x-auto px-6 pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {recs.map((rec, idx) => (
            <div key={`${rec.item.tmdb_id}-${idx}`} className="flex-none w-44">
              <MovieCard
                tmdb_id={rec.item.tmdb_id}
                imdb_id={rec.item.imdb_id}
                title={rec.item.title}
                year={rec.item.year}
                rating={rec.item.rating}
                poster_url={rec.item.poster_url}
                genre={rec.item.genre}
                type={rec.item.type}
                personalizedPoster={rec.personalizedPoster}
                onCardClick={onCardClick}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white px-6 font-medium">{title}</h2>
      <div className="flex gap-4 px-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-none w-44">
            <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
            <div className="mt-2 h-4 bg-white/5 rounded animate-pulse w-3/4" />
            <div className="mt-1 h-3 bg-white/5 rounded animate-pulse w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────

const FILTERS = ['For You', 'New Discoveries', 'Trending', 'Highly Rated'] as const;

// ── Main page ─────────────────────────────────────────────────────────────────

export function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<ScoredRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('For You');
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const hour = new Date().getHours();
        let timeOfDay: RecommenderContext['timeOfDay'] = 'night';
        if (hour > 5 && hour < 11) timeOfDay = 'morning';
        else if (hour >= 11 && hour < 14) timeOfDay = 'lunch';
        else if (hour >= 14 && hour < 18) timeOfDay = 'afternoon';

        const context: RecommenderContext = {
          deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
          timeOfDay,
          dayOfWeek: new Date().getDay(),
          weather: 'sunny',
        };

        const profile: UserProfile = loadUserProfile();

        // VidAPI is the primary source — same as HomePage, has real poster URLs.
        // Fetch two pages each for breadth, supplement with TMDB trending.
        const [vid1Movies, vid2Movies, vid1TV, vid2TV, trending] = await Promise.all([
          fetchLatestMovies(1).catch(() => ({ items: [] })),
          fetchLatestMovies(2).catch(() => ({ items: [] })),
          fetchLatestTVShows(1).catch(() => ({ items: [] })),
          fetchLatestTVShows(2).catch(() => ({ items: [] })),
          getTrending('all', 'week').catch(() => ({ results: [] })),
        ]);

        const raw: (MovieItem | TVShowItem)[] = [
          // VidAPI first — guaranteed working poster URLs (same as HomePage)
          ...vid1Movies.items,
          ...vid2Movies.items,
          ...vid1TV.items,
          ...vid2TV.items,
          // TMDB trending as lightweight supplement (includes media_type in response)
          ...trending.results
            .map(r => mapTMDBToItem(r))
            .filter(Boolean) as (MovieItem | TVShowItem)[],
        ].filter(item => !!item.poster_url); // drop anything with no poster

        const seen = new Set<string>();
        const pool: (MovieItem | TVShowItem)[] = [];
        for (const item of raw) {
          const id = item.tmdb_id || item.imdb_id;
          if (id && !seen.has(id)) { seen.add(id); pool.push(item); }
        }

        const history = getHistory();
        const progress = getAllWatchProgress();
        const twins = computeCollaborativeSimilarities(profile.tasteVector)
          .map(s => ({ similarity: s.similarity, twin: s.twin }));

        const scored = pool
          .map(item => {
            const id = item.tmdb_id || item.imdb_id;
            const p = progress[id];
            if (p && p.duration > 0 && (p.progress / p.duration) > 0.9) return null;
            if (history.some(h => h.id === id)) return null;
            return scoreRecommendationCandidate(item, profile, context, twins, pool);
          })
          .filter((r): r is ScoredRecommendation => r !== null)
          .sort((a, b) => b.score - a.score);

        setRecommendations(scored);
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleCardClick = (item: any) => {
    setSelectedMovie(item);
    setIsModalOpen(true);
    setShowPlayer(false);
  };

  const closeModal = (keepSelected = false) => {
    setIsModalOpen(false);
    if (!keepSelected) setSelectedMovie(null);
    document.body.style.overflow = '';
  };

  const handlePlay = (item: any) => {
    setSelectedMovie(item);
    setShowPlayer(true);
    closeModal(true);
  };

  // ── Derived sections ──────────────────────────────────────────────────────

  const hero = recommendations[0] ?? null;

  const discoverRecs = recommendations
    .filter(r => r.category === 'Discovery Pick' || r.probabilities.novelty > 0.7)
    .slice(0, 15);

  const history = getHistory();
  const becauseTitle = history.length > 0
    ? `Because you watched ${history[0].title}`
    : 'Picked for your taste';
  const becauseWatched = recommendations.filter(r => r !== hero).slice(2, 17);

  const topRated = [...recommendations]
    .sort((a, b) => parseFloat(b.item.rating) - parseFloat(a.item.rating))
    .slice(0, 15);

  let gridRecs = [...recommendations];
  if (activeFilter === 'New Discoveries') gridRecs = gridRecs.filter(r => r.probabilities.novelty > 0.6);
  if (activeFilter === 'Trending') gridRecs = gridRecs.sort((a, b) => b.probabilities.watch - a.probabilities.watch);
  if (activeFilter === 'Highly Rated') gridRecs = gridRecs.sort((a, b) => parseFloat(b.item.rating) - parseFloat(a.item.rating));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pb-10">

      {/* ── Hero ── */}
      <div className="p-6 pt-6">
        {loading || !hero ? (
          <div className="relative w-full h-[75vh] overflow-hidden rounded-2xl bg-[#121212] animate-pulse">
            <div className="absolute bottom-16 left-12 space-y-4">
              <div className="h-5 w-40 bg-white/5 rounded" />
              <div className="h-12 w-96 bg-white/5 rounded" />
              <div className="h-4 w-72 bg-white/5 rounded" />
              <div className="flex gap-4 mt-6">
                <div className="h-12 w-36 bg-white/5 rounded-lg" />
                <div className="h-12 w-36 bg-white/5 rounded-lg" />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-[75vh] overflow-hidden rounded-2xl">
            {/* Background with Ken Burns */}
            <div className="absolute inset-0">
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: 1.08 }}
                transition={{ duration: 25, repeat: Infinity, repeatType: 'reverse' }}
                className="w-full h-full"
              >
                <img
                  src={hero.personalizedPoster || hero.item.poster_url}
                  alt={hero.item.title}
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070707]/90 via-[#070707]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070707]" />
              <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(229,9,20,0.1)]" />
            </div>

            {/* Content */}
            <div className="relative h-full flex flex-col justify-end p-5 sm:p-8 pb-10 sm:pb-12 lg:p-12 lg:pb-16">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="max-w-2xl space-y-5"
              >
                {/* Metadata pills — matches HeroBanner exactly */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E50914]/15 backdrop-blur-md text-xs text-[#E50914] border border-[#E50914]/25 font-medium">
                    <Sparkles className="w-3 h-3" />
                    Top pick for you
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs text-white border border-white/15">
                    {Math.round(hero.score)}% match
                  </span>
                  {hero.item.year && (
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs text-white border border-white/15">
                      {hero.item.year}
                    </span>
                  )}
                  {hero.item.genre && (
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs text-white border border-white/15 uppercase tracking-wider font-medium">
                      {hero.item.genre.split(',')[0]}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white tracking-tight leading-tight drop-shadow-2xl">
                  {hero.item.title}
                </h1>

                {/* Reason */}
                {hero.reasons[0] && (
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-lg line-clamp-2">
                    {hero.reasons[0]}
                  </p>
                )}

                {/* Buttons — matches HeroBanner exactly */}
                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePlay(hero.item)}
                    className="flex items-center gap-2.5 px-5 sm:px-7 py-3 sm:py-3.5 bg-[#E50914] rounded-xl text-white
                               shadow-[0_0_30px_rgba(229,9,20,0.4)] hover:shadow-[0_0_45px_rgba(229,9,20,0.6)]
                               hover:bg-[#ff1a25] transition-all duration-300 w-full sm:w-auto justify-center"
                  >
                    <Play className="w-5 h-5" fill="currentColor" />
                    <span className="text-sm font-semibold">Play Now</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCardClick(hero.item)}
                    className="flex items-center gap-2.5 px-7 py-3.5 bg-white/8 backdrop-blur-xl rounded-xl
                               text-white border border-white/15 hover:bg-white/12 hover:border-white/25
                               transition-all duration-300"
                  >
                    <Info className="w-5 h-5" />
                    <span className="text-sm font-semibold">More Info</span>
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* ── Content rows ── */}
      <div className="space-y-10 py-6">

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto px-6" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`flex-none px-5 py-2 rounded-full text-sm font-semibold transition-all
                ${activeFilter === f
                  ? 'bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.35)]'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Discover Weekly */}
        {loading
          ? <SkeletonRow title="✨ Discover Weekly" />
          : <RecommendationRow
            title="✨ Discover Weekly"
            subtitle="Fresh picks outside your usual genres"
            recs={discoverRecs.length ? discoverRecs : recommendations.slice(1, 16)}
            onCardClick={handleCardClick}
          />
        }

        {/* Because you watched */}
        {loading
          ? <SkeletonRow title="🎯 Picked for You" />
          : <RecommendationRow
            title={`🎯 ${becauseTitle}`}
            subtitle="Viewers with similar tastes also enjoyed these"
            recs={becauseWatched}
            onCardClick={handleCardClick}
          />
        }

        {/* Top Rated */}
        {loading
          ? <SkeletonRow title="⭐ Top Rated Picks" />
          : <RecommendationRow
            title="⭐ Top Rated Picks"
            subtitle="Highest-scoring titles matched to your profile"
            recs={topRated}
            onCardClick={handleCardClick}
          />
        }

        {/* Full grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-6">
            <h2 className="text-xl text-white font-medium">
              🍿 {activeFilter === 'For You' ? 'Your Full Feed' : activeFilter}
            </h2>
            <span className="text-xs text-[#666] uppercase tracking-wider">
              {loading ? '—' : `${Math.min(gridRecs.length, 40)} titles`}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
                  <div className="mt-2 h-4 bg-white/5 rounded animate-pulse w-3/4" />
                  <div className="mt-1 h-3 bg-white/5 rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-6">
              {gridRecs.slice(0, 40).map((rec, idx) => (
                <MovieCard
                  key={`${rec.item.tmdb_id}-${idx}`}
                  tmdb_id={rec.item.tmdb_id}
                  imdb_id={rec.item.imdb_id}
                  title={rec.item.title}
                  year={rec.item.year}
                  rating={rec.item.rating}
                  poster_url={rec.item.poster_url}
                  genre={rec.item.genre}
                  type={rec.item.type}
                  personalizedPoster={rec.personalizedPoster}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Modal ── */}
      {isModalOpen && selectedMovie && (
        <MoviePreviewModal
          key={selectedMovie.tmdb_id || selectedMovie.imdb_id}
          movie={{
            id: selectedMovie.tmdb_id || selectedMovie.imdb_id,
            tmdb_id: selectedMovie.tmdb_id,
            imdb_id: selectedMovie.imdb_id,
            title: selectedMovie.title,
            year: selectedMovie.year,
            rating: selectedMovie.rating,
            type: selectedMovie.type,
            genre: selectedMovie.genre,
            poster_url: selectedMovie.poster_url || selectedMovie.imageUrl,
          }}
          onClose={closeModal}
          onPlay={handlePlay}
        />
      )}

      {/* ── Player ── */}
      {showPlayer && selectedMovie && (
        <Suspense fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
            Loading player…
          </div>
        }>
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