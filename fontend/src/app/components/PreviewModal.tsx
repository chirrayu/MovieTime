import { X, Play, Plus, Check, Share2, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '../lib/storage';
import { getMovieDetails, getTVDetails, TMDBMovieDetail, TMDBTVDetail } from '../lib/api';
import { useNavigate } from 'react-router';
import styles from './PreviewModal.module.css';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

const contentVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, ease: 'anticipate' } },
};

interface PreviewModalProps {
  movie: any; // MovieItem or TVShowItem
  onClose: () => void;
}

export function PreviewModal({ movie, onClose }: PreviewModalProps) {
  const navigate = useNavigate();
  const [details, setDetails] = useState<TMDBMovieDetail | TMDBTVDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [inList, setInList] = useState(isInWatchlist(movie.tmdb_id || movie.imdb_id));

  useEffect(() => {
    async function fetchDetails() {
      try {
        if (movie.type === 'movie') {
          const d = await getMovieDetails(movie.tmdb_id);
          setDetails(d);
        } else {
          const d = await getTVDetails(movie.tmdb_id);
          setDetails(d);
        }
      } catch (err) {
        console.error('Failed to fetch details', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
  }, [movie]);

  const handlePlay = () => {
    if (movie.type === 'movie') {
      navigate(`/watch/movie/${movie.imdb_id || movie.tmdb_id}`);
    } else {
      navigate(`/tv/${movie.tmdb_id}`);
    }
    onClose();
  };

  const toggleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = movie.tmdb_id || movie.imdb_id;
    if (inList) {
      removeFromWatchlist(id);
      setInList(false);
    } else {
      addToWatchlist({
        id,
        tmdb_id: movie.tmdb_id,
        imdb_id: movie.imdb_id,
        title: movie.title,
        poster: movie.poster_url,
        type: movie.type,
        year: movie.year,
        rating: movie.rating,
        genre: movie.genre || '',
        addedAt: Date.now(),
      });
      setInList(true);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={overlayVariants}
        className={styles.overlay}
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          transition={{ duration: 0.3 }}
          className={styles.modal}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white hover:text-red-500 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>

          <div className={styles.banner} style={{ backgroundImage: `url(${movie.poster_url || ''})` }} />

          <motion.div className={styles.content} variants={contentVariants} initial="hidden" animate="visible">
            <h2 className="text-2xl font-bold text-white mb-2">{movie.title}</h2>
            <div className="flex flex-wrap gap-2 text-sm text-gray-300">
              <span>{movie.year}</span>
              <span className="mx-1">•</span>
              <span>{movie.rating} ★</span>
              {movie.genre && (
                <>                
                  <span className="mx-1">•</span>
                  <span>{movie.genre}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3 mt-2">
              <button onClick={handlePlay} className={`${styles.actionBtn} ${styles.playBtn} ${styles.shine}`}>
                <Play size={20} /> Play Now
              </button>
              <button onClick={toggleWatchlist} className={`${styles.actionBtn} ${styles.watchlistBtn} ${inList ? styles.inList : ''}`}>
                {inList ? <Check size={18} /> : <Plus size={18} />}
                {inList ? 'Added' : 'Add to List'}
              </button>
              <button className={`${styles.actionBtn} ${styles.likeBtn}`}>
                <Heart size={18} /> Like
              </button>
              <button className={`${styles.actionBtn} ${styles.shareBtn}`}>
                <Share2 size={18} /> Share
              </button>
            </div>

            {loading ? (
              <p className="text-gray-400">Loading description…</p>
            ) : (
              <p className="text-gray-300 mt-2">{(details as any)?.overview || 'No description available.'}</p>
            )}

            <div className="mt-4 text-sm text-gray-400">
              <p><strong>Director:</strong> {(details as any)?.director || 'Unknown'}</p>
              <p><strong>Cast:</strong> {(details as any)?.cast?.join(', ') || 'N/A'}</p>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
