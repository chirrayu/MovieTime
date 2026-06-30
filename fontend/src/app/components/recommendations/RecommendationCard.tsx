import React, { useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Play, Plus, Star, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../../lib/storage';
import type { ScoredRecommendation } from '../../lib/recommender';

interface RecommendationCardProps {
  rec: ScoredRecommendation;
  onCardClick: (item: any) => void;
}

export function RecommendationCard({ rec, onCardClick }: RecommendationCardProps) {
  const { item, score, personalizedPoster } = rec;
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileTapped, setIsMobileTapped] = useState(false);
  const [inList, setInList] = useState(isInWatchlist(item.tmdb_id || item.imdb_id));
  const navigate = useNavigate();

  const showOverlay = isHovered || isMobileTapped;
  const matchPercent = Math.round(score);
  const ratingNum = parseFloat(item.rating);
  const genres = item.genre ? item.genre.split(',').map(g => g.trim()).filter(Boolean) : [];
  const posterSrc = personalizedPoster || item.poster_url;

  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'movie') {
      navigate(`/watch/movie/${item.imdb_id || item.tmdb_id}`);
    } else {
      navigate(`/tv/${item.tmdb_id}`);
    }
  }, [item, navigate]);

  const handleClick = useCallback(() => {
    onCardClick({
      tmdb_id: item.tmdb_id,
      imdb_id: item.imdb_id,
      title: item.title,
      year: item.year,
      rating: item.rating,
      poster_url: posterSrc,
      genre: item.genre,
      type: item.type,
      embed_url: undefined,
      personalizedPoster,
    });
  }, [item, posterSrc, personalizedPoster, onCardClick]);

  const handleWatchlist = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const id = item.tmdb_id || item.imdb_id;
    if (inList) {
      removeFromWatchlist(id);
      setInList(false);
    } else {
      addToWatchlist({
        id,
        tmdb_id: item.tmdb_id,
        imdb_id: item.imdb_id,
        title: item.title,
        poster: posterSrc,
        type: item.type,
        year: item.year,
        rating: item.rating,
        genre: item.genre || '',
        addedAt: Date.now(),
      });
      setInList(true);
    }
  }, [item, posterSrc, inList]);

  // Mobile: toggle overlay on touch
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Only toggle if it wasn't a scroll gesture
    if (e.cancelable) {
      setIsMobileTapped(prev => !prev);
    }
  }, []);

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onTouchEnd={handleTouchEnd}
      whileHover={{ y: -8, scale: 1.05 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative group cursor-pointer will-change-transform"
      onClick={handleClick}
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a1a]">
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '';
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]">
            <span className="text-[#333] text-4xl">🎬</span>
          </div>
        )}

        {/* Type Badge — always visible */}
        <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-[#E50914]/90 text-[10px] text-white uppercase font-semibold tracking-wider z-20">
          {item.type === 'movie' ? 'Movie' : 'Series'}
        </div>

        {/* Rating Badge — always visible */}
        {ratingNum > 0 && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 z-20">
            <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
            <span className="text-xs text-white font-medium">{ratingNum.toFixed(1)}</span>
          </div>
        )}

        {/* ── Premium hover overlay ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showOverlay ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-10 flex flex-col justify-end pointer-events-none"
        >
          {/* Dark gradient backdrop */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />

          {/* Center play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: showOverlay ? 1 : 0.6, opacity: showOverlay ? 1 : 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              onClick={handlePlay}
              aria-label={`Play ${item.title}`}
              className="pointer-events-auto w-14 h-14 rounded-full bg-[#E50914] flex items-center justify-center
                       shadow-[0_0_30px_rgba(229,9,20,0.6)] hover:shadow-[0_0_40px_rgba(229,9,20,0.8)]
                       hover:bg-[#ff1a25] transition-all duration-200 cursor-pointer"
            >
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </motion.button>
          </div>

          {/* Info overlay at bottom */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: showOverlay ? 0 : 16, opacity: showOverlay ? 1 : 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="relative px-3.5 pb-3.5 pt-8 space-y-2 pointer-events-auto"
          >
            {/* Match percentage — Netflix green */}
            <div className="flex items-center justify-between">
              <span className="text-[#46d369] text-sm font-bold tracking-tight">
                {matchPercent}% Match
              </span>
              <button
                onClick={handleWatchlist}
                aria-label={inList ? 'Remove from watchlist' : 'Add to watchlist'}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 border cursor-pointer
                  ${inList
                    ? 'bg-[#E50914]/20 border-[#E50914]/50 text-[#E50914]'
                    : 'bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20'
                  }`}
              >
                {inList ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Rating · Year row */}
            <div className="flex items-center gap-2 text-xs text-white/80">
              {ratingNum > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                  {ratingNum.toFixed(1)}
                </span>
              )}
              {ratingNum > 0 && item.year && <span className="text-white/30">•</span>}
              {item.year && <span>{item.year}</span>}
            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="text-[11px] text-white/60 truncate">
                {genres.slice(0, 3).join(' • ')}
              </div>
            )}

            {/* Type badge */}
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
              {item.type === 'movie' ? '📺 Movie' : '📺 TV Series'}
            </div>
          </motion.div>
        </motion.div>

        {/* Red glow on hover */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showOverlay ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute -inset-0.5 rounded-xl shadow-[0_0_20px_rgba(229,9,20,0.3)] -z-10"
        />
      </div>

      {/* Title below card */}
      <div className="mt-2 px-1">
        <h3 className="text-sm text-white/90 truncate">{item.title}</h3>
        <p className="text-xs text-[#666] mt-0.5">{item.year}</p>
      </div>
    </motion.div>
  );
}
