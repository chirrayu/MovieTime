import { Play, Plus, Star, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../lib/storage';
import { getVideos } from '../lib/api';

interface MovieCardProps {
  tmdb_id: string;
  imdb_id: string;
  title: string;
  year: string;
  rating: string;
  poster_url: string;
  genre?: string;
  type: 'movie' | 'tv';
  embed_url?: string;
  // For continue watching
  progress?: number;
  duration?: number;
  // Optional callback when the card is clicked (used for preview modal)
  onCardClick?: (movie: MovieCardProps) => void;
  personalizedPoster?: string;
}

export function MovieCard({ tmdb_id, imdb_id, title, year, rating, poster_url, genre, type, progress, duration, onCardClick, personalizedPoster }: MovieCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [inList, setInList] = useState(isInWatchlist(tmdb_id || imdb_id));
  const [previewVideoKey, setPreviewVideoKey] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    let timeoutId: any = null;

    if (isHovered) {
      timeoutId = setTimeout(async () => {
        const id = tmdb_id || imdb_id;
        if (!id) return;
        setIsLoadingVideo(true);
        try {
          const data = await getVideos(type, id);
          const trailer = data.results.find(
            v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip')
          );
          if (trailer && active) {
            setPreviewVideoKey(trailer.key);
          }
        } catch (err) {
          console.warn('Failed to fetch preview trailer:', err);
        } finally {
          if (active) setIsLoadingVideo(false);
        }
      }, 800);
    } else {
      setPreviewVideoKey(null);
    }

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isHovered, tmdb_id, imdb_id, type]);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (type === 'movie') {
      navigate(`/watch/movie/${imdb_id || tmdb_id}`);
    } else {
      // For TV, go to detail page to pick episode
      navigate(`/tv/${tmdb_id}`);
    }
  };

  const handleClick = () => {
    if (onCardClick) {
      // Pass full movie data to modal handler
      onCardClick({
        tmdb_id,
        imdb_id,
        title,
        year,
        rating,
        poster_url: personalizedPoster || poster_url,
        genre,
        type,
        embed_url: undefined,
        progress,
        duration,
        onCardClick,
        personalizedPoster,
      });
    } else {
      const path = type === 'movie' ? `/movie/${tmdb_id}` : `/tv/${tmdb_id}`;
      navigate(path);
    }
  };

  const handleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = tmdb_id || imdb_id;
    if (inList) {
      removeFromWatchlist(id);
      setInList(false);
    } else {
      addToWatchlist({
        id, tmdb_id, imdb_id, title, poster: poster_url,
        type, year, rating, genre: genre || '', addedAt: Date.now(),
      });
      setInList(true);
    }
  };

  const progressPercent = progress && duration ? Math.min((progress / duration) * 100, 100) : 0;

  return (
    <motion.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -8, scale: 1.04 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative group cursor-pointer"
      onClick={handleClick}
    >
      {/* Movie Poster */}
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#1a1a1a]">
        {poster_url || personalizedPoster ? (
          <img
            src={personalizedPoster || poster_url}
            alt={title}
            className="w-full h-full object-cover transition-all duration-500"
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

        {/* Hover preview video */}
        {isHovered && previewVideoKey && (
          <div className="absolute inset-0 bg-black pointer-events-none">
            <iframe
              src={`https://www.youtube.com/embed/${previewVideoKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${previewVideoKey}&playsinline=1&enablejsapi=1&showinfo=0&rel=0&modestbranding=1`}
              className="w-full h-full border-0 scale-[1.3] pointer-events-none object-cover"
              title="Trailer Preview"
              allow="autoplay; encrypted-media"
            />
          </div>
        )}

        {/* Rating Badge */}
        {rating && parseFloat(rating) > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
            <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
            <span className="text-xs text-white font-medium">{parseFloat(rating).toFixed(1)}</span>
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#E50914]/90 text-[10px] text-white uppercase font-semibold tracking-wider">
          {type === 'movie' ? 'Movie' : 'Series'}
        </div>

        {/* Hover Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"
        >
          {/* Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: isHovered ? 1 : 0.6, opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              onClick={handlePlay}
              className="w-14 h-14 rounded-full bg-[#E50914] flex items-center justify-center
                       shadow-[0_0_30px_rgba(229,9,20,0.6)] hover:shadow-[0_0_40px_rgba(229,9,20,0.8)]
                       hover:bg-[#ff1a25] transition-all duration-200"
            >
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </motion.button>
          </div>

          {/* Bottom Info */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="absolute bottom-0 left-0 right-0 p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#ccc]">
                <span>{year}</span>
                {genre && (
                  <>
                    <span className="text-[#555]">•</span>
                    <span className="truncate max-w-[120px]">{genre.split(',')[0]}</span>
                  </>
                )}
              </div>
              <button
                onClick={handleWatchlist}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border
                  ${inList
                    ? 'bg-[#E50914]/20 border-[#E50914]/50 text-[#E50914]'
                    : 'bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20'
                  }`}
              >
                {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            <h3 className="text-white text-sm font-medium line-clamp-1">{title || 'Unknown Title'}</h3>
          </motion.div>
        </motion.div>

        {/* Red glow on hover */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute -inset-0.5 rounded-xl shadow-[0_0_20px_rgba(229,9,20,0.3)] -z-10"
        />

        {/* Progress bar for continue watching */}
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full bg-[#E50914] rounded-r-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Title below card */}
      <div className="mt-2 px-1">
        <h3 className="text-sm text-white/90 truncate">{title}</h3>
        <p className="text-xs text-[#666] mt-0.5">{year}</p>
      </div>
    </motion.div>
  );
}
