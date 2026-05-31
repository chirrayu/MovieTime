import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Play,
  Plus,
  Star,
  Clock,
  Calendar,
  Tag,
  ChevronRight,
  Volume2,
  Share2,
  Heart,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from 'react-router';
import {
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
  addLiked,
  removeLiked,
  isLiked,
} from '../lib/storage';
import { getTVDetails, getSeasonEpisodes, TMDBEpisode, TMDBTVDetail } from '../lib/api';

export interface Movie {
  id: string;
  tmdb_id?: string;
  imdb_id?: string;
  title: string;
  year: string;
  rating: string | number;
  type: 'movie' | 'tv';
  imageUrl?: string;
  poster_url?: string;
  embed_url?: string;
  genre?: string;
}

interface MovieDetailModalProps {
  movie: Movie | null;
  onClose: () => void;
  onPlay?: (movie: Movie) => void;
}

const MOCK_DETAILS: Record<
  string,
  {
    director: string;
    duration: string;
    synopsis: string;
    cast: string[];
    tags: string[];
    backdrop: string;
    matchPercent: number;
    maturityRating: string;
  }
> = {
  default: {
    director: "Alexei Voronov",
    duration: "2h 14m",
    synopsis:
      "In a near-future megalopolis where augmented reality bleeds into every waking moment, a disillusioned intelligence operative uncovers a conspiracy that fractures the boundary between memory and simulation. Each revelation pulls them deeper into a labyrinth of corporate betrayal and existential dread — until the line between hunter and hunted dissolves entirely.",
    cast: ["Isla Mercer", "Damien Voss", "Reina Castillo", "Marcus Thane", "Soo-Jin Park"],
    tags: ["Intense", "Mind-Bending", "Atmospheric", "Award-Winning"],
    backdrop:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&h=700&fit=crop",
    matchPercent: 97,
    maturityRating: "R",
  },
};

function getDetails(id: string) {
  return MOCK_DETAILS[id] ?? MOCK_DETAILS["default"];
}

export function MoviePreviewModal({ movie, onClose, onPlay }: MovieDetailModalProps) {
  const navigate = useNavigate();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [liked, setLiked] = useState(false);
  const [tvDetails, setTvDetails] = useState<TMDBTVDetail | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<TMDBEpisode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  useEffect(() => {
    if (!movie) return;
    setInWatchlist(isInWatchlist(movie.id));
    setLiked(isLiked(movie.id));
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [movie, onClose]);

  useEffect(() => {
    async function loadTvDetails() {
      if (!movie || movie.type !== 'tv') {
        setTvDetails(null);
        setSeasonEpisodes([]);
        setSelectedSeason(null);
        return;
      }

      try {
        const detail = await getTVDetails(movie.tmdb_id || movie.id);
        setTvDetails(detail);
        const firstSeason = detail.seasons?.find(s => s.season_number > 0)?.season_number || 1;
        setSelectedSeason(firstSeason);
      } catch (err) {
        console.error('Failed to load TV details:', err);
        setTvDetails(null);
      }
    }
    loadTvDetails();
  }, [movie]);

  useEffect(() => {
    async function loadSeason() {
      if (!movie || movie.type !== 'tv' || selectedSeason == null) {
        setSeasonEpisodes([]);
        return;
      }

      setEpisodesLoading(true);
      try {
        const result = await getSeasonEpisodes(movie.tmdb_id || movie.id, selectedSeason);
        setSeasonEpisodes(result.episodes || []);
      } catch (err) {
        console.error('Failed to load season episodes:', err);
        setSeasonEpisodes([]);
      } finally {
        setEpisodesLoading(false);
      }
    }
    loadSeason();
  }, [movie, selectedSeason]);

  const handlePlayNow = () => {
    if (!movie) return;

    if (movie.type === 'tv') {
      const season = (selectedSeason ?? tvDetails?.seasons?.find((s) => s.season_number > 0)?.season_number) || 1;
      const episode = seasonEpisodes[0]?.episode_number || 1;
      navigate(`/watch/tv/${movie.tmdb_id || movie.id}/${season}/${episode}`);
    } else {
      navigate(`/watch/movie/${movie.tmdb_id || movie.id}`);
    }

    onClose();
  };

  // Lock body scroll while open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (movie) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [movie]);

  return (
    <AnimatePresence>
      {movie && (() => {
        const details = getDetails(movie.id);
        const ratingValue = typeof movie.rating === 'number' ? movie.rating : parseFloat(movie.rating as string);
        const ratingLabel = Number.isFinite(ratingValue) ? ratingValue.toFixed(1) : 'N/A';
        const heroImage = movie.imageUrl || movie.poster_url || tvDetails?.backdrop_path || details.backdrop;
        const seriesDetails = movie.type === 'tv' && tvDetails ? tvDetails : null;
        const seasons = seriesDetails?.seasons?.filter(s => s.season_number > 0) || [];
        const seasonText = selectedSeason || seasons[0]?.season_number || 1;
        const overviewText = movie.type === 'tv' ? seriesDetails?.overview || details.synopsis : details.synopsis;
        const durationText = movie.type === 'tv' ? `${seriesDetails?.number_of_seasons || seasons.length} Seasons` : details.duration;
        const maturityLabel = movie.type === 'tv' ? 'TV-14' : details.maturityRating;
        return (
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)" }}
          >
            {/* Modal panel */}
            <motion.div
              key="modal-panel"
              initial={{ opacity: 0, scale: 0.94, y: 28 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-hide rounded-2xl"
              style={{
                background: "linear-gradient(180deg, #1a0a0a 0%, #0e0e0e 40%, #0a0a0a 100%)",
                border: "1px solid rgba(229,9,20,0.18)",
                boxShadow: "0 0 80px rgba(229,9,20,0.15), 0 40px 80px rgba(0,0,0,0.8)",
              }}
            >
              {/* ── Hero image ── */}
              <div className="relative w-full aspect-video overflow-hidden rounded-t-2xl">
                <img
                  src={heroImage}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                />
                {/* Cinematic vignette layers */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(0deg, #0a0a0a 0%, rgba(10,10,10,0.55) 40%, transparent 70%)",
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
                  }}
                />
                {/* Red ambient pulse at bottom */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(229,9,20,0.6), transparent)",
                  }}
                />

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center
                             transition-all duration-200 hover:scale-110"
                  style={{
                    background: "rgba(10,10,10,0.75)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                {/* Mute / sound hint */}
                <button
                  className="absolute bottom-4 right-4 w-8 h-8 rounded-full flex items-center justify-center
                             transition-all duration-200 opacity-60 hover:opacity-100"
                  style={{
                    background: "rgba(10,10,10,0.6)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                </button>

                {/* Maturity badge */}
                <span
                  className="absolute bottom-4 left-4 text-xs font-semibold px-2 py-0.5 rounded"
                  style={{
                    border: "1px solid rgba(255,255,255,0.35)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {maturityLabel}
                </span>
              </div>

              {/* ── Content body ── */}
              <div className="px-7 pb-8 pt-5 space-y-6">

                {/* Title + match */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h2
                      className="text-3xl font-bold tracking-tight text-white leading-tight"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      {movie.title}
                    </h2>
                    <span
                      className="shrink-0 text-sm font-bold mt-1"
                      style={{ color: "#46d369" }}
                    >
                      {details.matchPercent}% Match
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <span className="flex items-center gap-1.5 text-[#E50914] font-semibold">
                      <Star className="w-3.5 h-3.5" fill="currentColor" />
                      {ratingLabel}
                    </span>
                    <Dot />
                    <span className="flex items-center gap-1.5 text-[#9A9A9A]">
                      <Calendar className="w-3.5 h-3.5" />
                      {movie.year}
                    </span>
                    <Dot />
                    <span className="flex items-center gap-1.5 text-[#9A9A9A]">
                      <Clock className="w-3.5 h-3.5" />
                      {durationText}
                    </span>
                    {movie.genre && (
                      <>
                        <Dot />
                        <span className="flex items-center gap-1.5 text-[#9A9A9A]">
                          <Tag className="w-3.5 h-3.5" />
                          {movie.genre}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Play */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    onClick={handlePlayNow}
                    className="flex items-center gap-2.5 px-7 py-3 rounded-lg text-sm font-semibold
                               text-white transition-all duration-280"
                    style={{
                      background: "#E50914",
                      boxShadow: "0 0 24px rgba(229,9,20,0.45)",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "0 0 40px rgba(229,9,20,0.7)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "0 0 24px rgba(229,9,20,0.45)")
                    }
                  >
                    <Play className="w-4 h-4" fill="currentColor" />
                    Play Now
                  </motion.button>

                  {/* Watchlist toggle */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!movie) return;
                      const id = movie.id;
                      if (inWatchlist) {
                        removeFromWatchlist(id);
                        setInWatchlist(false);
                      } else {
                        addToWatchlist({
                          id,
                          tmdb_id: movie.id,
                          imdb_id: movie.id,
                          title: movie.title,
                          poster: movie.poster_url || movie.imageUrl || '',
                          type: movie.type || 'movie',
                          year: movie.year || '',
                          rating: String(movie.rating || ''),
                          genre: movie.genre || '',
                          addedAt: Date.now(),
                        });
                        setInWatchlist(true);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium
                               text-white transition-all duration-200"
                    style={{
                      background: inWatchlist
                        ? "rgba(229,9,20,0.18)"
                        : "rgba(255,255,255,0.08)",
                      border: inWatchlist
                        ? "1px solid rgba(229,9,20,0.4)"
                        : "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <Plus
                      className="w-4 h-4 transition-transform duration-200"
                      style={{
                        transform: inWatchlist ? "rotate(45deg)" : "rotate(0deg)",
                        color: inWatchlist ? "#E50914" : "white",
                      }}
                    />
                    {inWatchlist ? "In Watchlist" : "Add to List"}
                  </motion.button>

                  {/* Like */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!movie) return;
                      const id = movie.id;
                      if (liked) {
                        removeLiked(id);
                        setLiked(false);
                      } else {
                        addLiked(id);
                        setLiked(true);
                      }
                    }}
                    className="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{
                      background: liked
                        ? "rgba(229,9,20,0.18)"
                        : "rgba(255,255,255,0.06)",
                      border: liked
                        ? "1px solid rgba(229,9,20,0.4)"
                        : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <Heart
                      className="w-4 h-4"
                      fill={liked ? "#E50914" : "none"}
                      stroke={liked ? "#E50914" : "white"}
                    />
                  </motion.button>

                  {/* Share */}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!movie) return;
                      const url = `${window.location.origin}/${movie.type === 'tv' ? 'tv' : 'movie'}/${movie.id}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        alert('Share link copied to clipboard');
                      } catch {
                        window.open(`mailto:?subject=Check out this title&body=${encodeURIComponent(url)}`);
                      }
                    }}
                    className="w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <Share2 className="w-4 h-4 text-white" />
                  </motion.button>
                </div>

                {/* Synopsis */}
                <div className="space-y-2">
                  <p className="text-[#d4d4d4] text-sm leading-relaxed">{overviewText}</p>
                </div>

                {movie.type === 'tv' && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-[#9A9A9A] uppercase tracking-wider">Choose season</p>
                        <p className="text-white text-sm">Season {seasonText}</p>
                      </div>
                      <button
                        onClick={() => setSeasonDropdownOpen((open) => !open)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 transition"
                      >
                        Season {seasonText}
                        <ChevronRight className={`w-4 h-4 transition-transform ${seasonDropdownOpen ? 'rotate-90' : ''}`} />
                      </button>
                    </div>

                    {seasonDropdownOpen && seasons.length > 0 && (
                      <div className="space-y-2 rounded-2xl border border-white/10 bg-[#121212]/95 p-3">
                        {seasons.map((season) => (
                          <button
                            key={season.season_number}
                            onClick={() => {
                              setSelectedSeason(season.season_number);
                              setSeasonDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${selectedSeason === season.season_number ? 'bg-[#E50914]/15 text-white' : 'bg-white/5 text-[#ccc] hover:bg-white/10'}`}
                          >
                            Season {season.season_number}: {season.name || `${season.episode_count} Episodes`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Episodes</h3>
                        {episodesLoading && <span className="text-sm text-[#999]">Loading...</span>}
                      </div>

                      {episodesLoading ? (
                        <div className="py-6 flex justify-center">
                          <div className="w-8 h-8 rounded-full border-2 border-[#E50914] border-t-transparent animate-spin" />
                        </div>
                      ) : seasonEpisodes.length > 0 ? (
                        <div className="space-y-2">
                          {seasonEpisodes.map((ep) => (
                            <button
                              key={ep.episode_number}
                              onClick={() => {
                                const season = selectedSeason || seasonText;
                                navigate(`/watch/tv/${movie.tmdb_id || movie.id}/${season}/${ep.episode_number}`);
                                onClose();
                              }}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-sm font-semibold text-white">Episode {ep.episode_number}</span>
                                <span className="text-xs text-[#999]">{ep.air_date || ''}</span>
                              </div>
                              <p className="text-sm text-[#ccc] mt-2 truncate">
                                {ep.name || `Episode ${ep.episode_number}`}
                              </p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[#999]">No episode listing available for this season.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div
                  className="h-px w-full"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-[#6b6b6b] uppercase tracking-wider text-xs">Director</span>
                    <p className="text-white font-medium">{details.director}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[#6b6b6b] uppercase tracking-wider text-xs">Cast</span>
                    <p className="text-white font-medium leading-relaxed">
                      {details.cast.join(", ")}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div
                  className="h-px w-full"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />

                {/* Tags */}
                <div className="space-y-2">
                  <span className="text-[#6b6b6b] uppercase tracking-wider text-xs">Mood & Tone</span>
                  <div className="flex flex-wrap gap-2">
                    {details.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: "rgba(229,9,20,0.1)",
                          border: "1px solid rgba(229,9,20,0.25)",
                          color: "#e8a0a4",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* More like this teaser */}
                <button
                  onClick={() => {
                    if (!movie) return;
                    navigate(movie.type === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between py-3 px-4 rounded-xl
                             text-sm font-medium text-[#9A9A9A] hover:text-white
                             transition-all duration-200 group"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <span>More like this</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}

function Dot() {
  return <span className="text-[#3a3a3a]">·</span>;
}
