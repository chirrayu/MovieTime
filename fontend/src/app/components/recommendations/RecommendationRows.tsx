import React, { useRef, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MovieCard } from '../MovieCard';
import { RecommendationCard } from './RecommendationCard';
import type { ScoredRecommendation } from '../../lib/recommender';
import { getContinueWatching } from '../../lib/storage';
import { useNavigate } from 'react-router';

const SCROLL_DISTANCE = 600;
const SCROLL_TIMEOUT_MS = 400;

interface RecommendationRowProps {
  title: string;
  subtitle?: string;
  recs: ScoredRecommendation[];
  onCardClick: (item: any) => void;
}

function RecommendationRow({ title, subtitle, recs, onCardClick }: RecommendationRowProps) {
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
    scrollRef.current?.scrollBy({
      left: dir === 'left' ? -SCROLL_DISTANCE : SCROLL_DISTANCE,
      behavior: 'smooth',
    });
    setTimeout(updateArrows, SCROLL_TIMEOUT_MS);
  };

  if (recs.length === 0) return null;

  // Repeat items for infinite horizontal scrolling experience
  const loopedRecs = useMemo(() => {
    if (recs.length < 5) return recs;
    return [...recs, ...recs, ...recs];
  }, [recs]);

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
            aria-label={`Scroll ${title} recommendations left`}
            className="absolute left-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-r from-[#070707] to-transparent
                       flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </div>
          </button>
        )}

        {showRight && (
          <button
            onClick={() => scroll('right')}
            aria-label={`Scroll ${title} recommendations right`}
            className="absolute right-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-l from-[#070707] to-transparent
                       flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 cursor-pointer"
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
          {loopedRecs.map((rec, idx) => (
            <div key={`${rec.item.tmdb_id || rec.item.imdb_id}-${idx}`} className="flex-none w-44">
              <RecommendationCard rec={rec} onCardClick={onCardClick} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContinueWatchingRow({ onCardClick }: { onCardClick: (item: any) => void }) {
  const navigate = useNavigate();
  const items = getContinueWatching();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(items.length > 6);

  const updateArrows = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeft(scrollLeft > 0);
    setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({
      left: dir === 'left' ? -SCROLL_DISTANCE : SCROLL_DISTANCE,
      behavior: 'smooth',
    });
    setTimeout(updateArrows, SCROLL_TIMEOUT_MS);
  };

  if (items.length === 0) return null;

  return (
    <div className="space-y-4 group/row">
      <div className="flex items-center justify-between px-6">
        <div className="space-y-0.5">
          <h2 className="text-xl text-white font-medium">Continue Watching</h2>
          <p className="text-xs text-[#666]">Pick up where you left off</p>
        </div>
        <span className="text-xs text-[#666] uppercase tracking-wider">{items.length} titles</span>
      </div>

      <div className="relative">
        {showLeft && (
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll continue watching row left"
            className="absolute left-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-r from-[#070707] to-transparent
                       flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </div>
          </button>
        )}

        {showRight && (
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll continue watching row right"
            className="absolute right-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-l from-[#070707] to-transparent
                       flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 cursor-pointer"
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
          {items.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="flex-none w-44">
              <MovieCard
                tmdb_id={item.type === 'tv' ? item.id : ''}
                imdb_id={item.type === 'movie' ? item.id : ''}
                title={item.title}
                year=""
                rating=""
                poster_url={item.poster || ''}
                type={item.type}
                progress={item.progress}
                duration={item.duration}
                onCardClick={() => {
                  if (item.type === 'movie') {
                    navigate(`/watch/movie/${item.id}`);
                  } else {
                    navigate(`/watch/tv/${item.id}/${item.season || 1}/${item.episode || 1}`);
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

interface RecommendationRowsProps {
  loading: boolean;
  discoverRecs: ScoredRecommendation[];
  becauseTitle: string;
  becauseWatched: ScoredRecommendation[];
  topRated: ScoredRecommendation[];
  onCardClick: (item: any) => void;
}

export function RecommendationRows({
  loading,
  discoverRecs,
  becauseTitle,
  becauseWatched,
  topRated,
  onCardClick,
}: RecommendationRowsProps) {
  return (
    <div className="space-y-10 py-6">
      {/* Continue Watching Pinned to Top */}
      {!loading && <ContinueWatchingRow onCardClick={onCardClick} />}

      {/* Discover Weekly */}
      {loading ? (
        <SkeletonRow title="✨ Discover Weekly" />
      ) : (
        <RecommendationRow
          title="✨ Discover Weekly"
          subtitle="Fresh picks outside your usual genres"
          recs={discoverRecs}
          onCardClick={onCardClick}
        />
      )}

      {/* Because you watched... */}
      {loading ? (
        <SkeletonRow title="🎯 Picked for You" />
      ) : (
        <RecommendationRow
          title={`🎯 ${becauseTitle}`}
          subtitle="Viewers with similar tastes also enjoyed these"
          recs={becauseWatched}
          onCardClick={onCardClick}
        />
      )}

      {/* Top Rated */}
      {loading ? (
        <SkeletonRow title="⭐ Top Rated Picks" />
      ) : (
        <RecommendationRow
          title="⭐ Top Rated Picks"
          subtitle="Highest-scoring titles matched to your profile"
          recs={topRated}
          onCardClick={onCardClick}
        />
      )}
    </div>
  );
}
