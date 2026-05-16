import { Play, Plus, Info, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import type { MovieItem, TVShowItem } from '../lib/api';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../lib/storage';

interface HeroBannerProps {
  item?: MovieItem | TVShowItem | null;
  loading?: boolean;
}

export function HeroBanner({ item, loading }: HeroBannerProps) {
  const navigate = useNavigate();
  const id = item ? (item.tmdb_id || item.imdb_id) : '';
  const [inList, setInList] = useState(id ? isInWatchlist(id) : false);

  if (loading || !item) {
    return (
      <div className="relative w-full h-[75vh] overflow-hidden rounded-2xl bg-[#121212] animate-pulse">
        <div className="absolute bottom-16 left-12 space-y-4">
          <div className="h-6 w-48 bg-white/5 rounded" />
          <div className="h-12 w-96 bg-white/5 rounded" />
          <div className="h-4 w-80 bg-white/5 rounded" />
          <div className="flex gap-4 mt-6">
            <div className="h-12 w-36 bg-white/5 rounded-lg" />
            <div className="h-12 w-36 bg-white/5 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const handlePlay = () => {
    if (item.type === 'movie') {
      navigate(`/watch/movie/${item.imdb_id || item.tmdb_id}`);
    } else {
      navigate(`/tv/${item.tmdb_id}`);
    }
  };

  const handleInfo = () => {
    const path = item.type === 'movie' ? `/movie/${item.tmdb_id}` : `/tv/${item.tmdb_id}`;
    navigate(path);
  };

  const handleWatchlist = () => {
    if (inList) {
      removeFromWatchlist(id);
      setInList(false);
    } else {
      addToWatchlist({
        id, tmdb_id: item.tmdb_id, imdb_id: item.imdb_id,
        title: item.title, poster: item.poster_url, type: item.type,
        year: item.year, rating: item.rating, genre: item.genre, addedAt: Date.now(),
      });
      setInList(true);
    }
  };

  return (
    <div className="relative w-full h-[75vh] overflow-hidden rounded-2xl">
      {/* Background Image with Ken Burns Effect */}
      <div className="absolute inset-0">
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 1.08 }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse" }}
          className="w-full h-full"
        >
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Multi-layer vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070707]/90 via-[#070707]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070707]" />

        {/* Red ambient glow */}
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(229,9,20,0.1)]" />

        {/* Film grain overlay */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end p-5 sm:p-8 pb-10 sm:pb-12 lg:p-12 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-2xl space-y-5"
        >
          {/* Metadata Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs text-white border border-white/15">
              {item.year}
            </span>
            {item.rating && parseFloat(item.rating) > 0 && (
              <span className="px-3 py-1 rounded-full bg-[#E50914]/15 backdrop-blur-md text-xs text-[#E50914] border border-[#E50914]/25 font-medium">
                ⭐ {parseFloat(item.rating).toFixed(1)}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs text-white border border-white/15 uppercase tracking-wider font-medium">
              {item.type === 'movie' ? 'Movie' : 'Series'}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white tracking-tight leading-tight drop-shadow-2xl">
            {item.title}
          </h1>

          {/* Genres */}
          {item.genre && (
            <div className="flex items-center gap-2 text-sm text-[#aaa]">
              {item.genre.split(',').slice(0, 3).map((g, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-[#444] mr-2">•</span>}
                  {g.trim()}
                </span>
              ))}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePlay}
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
              onClick={handleWatchlist}
              className={`flex items-center gap-2 px-4 sm:px-7 py-2.5 sm:py-3.5 backdrop-blur-xl rounded-xl
                       text-white border transition-all duration-300 flex-1 sm:flex-none justify-center
                       ${inList
                         ? 'bg-[#E50914]/15 border-[#E50914]/30 hover:bg-[#E50914]/25'
                         : 'bg-white/8 border-white/15 hover:bg-white/12 hover:border-white/25'
                       }`}
            >
              {inList ? <Check className="w-5 h-5 text-[#E50914]" /> : <Plus className="w-5 h-5" />}
              <span className="text-sm font-semibold">{inList ? 'In List' : 'My List'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleInfo}
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
  );
}
