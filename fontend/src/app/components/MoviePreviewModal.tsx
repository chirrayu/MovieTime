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

export interface Movie {
  id: string;
  title: string;
  year: string;
  rating: string | number;
  imageUrl?: string;
  poster_url?: string;
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
  const [inWatchlist, setInWatchlist] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!movie) return;
    const handleKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [movie, onClose]);

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
        const heroImage = movie.imageUrl || movie.poster_url || details.backdrop;
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
                  {details.maturityRating}
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
                      {details.duration}
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
                    onClick={() => { onPlay?.(movie); onClose(); }}
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
                    onClick={() => setInWatchlist((v) => !v)}
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
                    onClick={() => setLiked((v) => !v)}
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
                  <p className="text-[#d4d4d4] text-sm leading-relaxed">{details.synopsis}</p>
                </div>

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
