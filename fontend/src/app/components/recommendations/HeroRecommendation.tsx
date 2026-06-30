import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Play, Info, Swords, Compass, Laugh, ShieldAlert, Film, Clapperboard, Users, Wand2, Hourglass, Ghost, Music, Search, Heart, Rocket, Flame, Tv, Bomb, Mountain } from 'lucide-react';
import type { ScoredRecommendation } from '../../lib/recommender';
import { getVideos } from '../../lib/api';

const HERO_HEIGHT = '75vh';
const HERO_ITEMS_COUNT = 5;
const SLIDE_INTERVAL_MS = 25000;

interface HeroRecommendationProps {
  recommendations: ScoredRecommendation[];
  loading: boolean;
  onPlay: (movie: any) => void;
  onInfoClick: (movie: any) => void;
}

function getGenreIcon(genreName: string) {
  const lower = genreName.toLowerCase();
  if (lower.includes('action') || lower.includes('adventure')) return <Swords className="w-3.5 h-3.5" />;
  if (lower.includes('animation')) return <Sparkles className="w-3.5 h-3.5" />;
  if (lower.includes('comedy')) return <Laugh className="w-3.5 h-3.5" />;
  if (lower.includes('crime')) return <ShieldAlert className="w-3.5 h-3.5" />;
  if (lower.includes('documentary')) return <Film className="w-3.5 h-3.5" />;
  if (lower.includes('drama')) return <Clapperboard className="w-3.5 h-3.5" />;
  if (lower.includes('family')) return <Users className="w-3.5 h-3.5" />;
  if (lower.includes('fantasy')) return <Wand2 className="w-3.5 h-3.5" />;
  if (lower.includes('history')) return <Hourglass className="w-3.5 h-3.5" />;
  if (lower.includes('horror')) return <Ghost className="w-3.5 h-3.5" />;
  if (lower.includes('music')) return <Music className="w-3.5 h-3.5" />;
  if (lower.includes('mystery')) return <Search className="w-3.5 h-3.5" />;
  if (lower.includes('romance')) return <Heart className="w-3.5 h-3.5" />;
  if (lower.includes('sci-fi') || lower.includes('fantasy')) return <Rocket className="w-3.5 h-3.5" />;
  if (lower.includes('thriller')) return <Flame className="w-3.5 h-3.5" />;
  if (lower.includes('war')) return <Bomb className="w-3.5 h-3.5" />;
  if (lower.includes('western')) return <Mountain className="w-3.5 h-3.5" />;
  return <Tv className="w-3.5 h-3.5" />;
}

function AnimatedMatchScore({ score }: { score: number }) {
  const rounded = Math.round(score);
  return (
    <motion.span
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      className="px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md text-xs text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 font-semibold"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {rounded}% match
    </motion.span>
  );
}

export function HeroRecommendation({
  recommendations,
  loading,
  onPlay,
  onInfoClick,
}: HeroRecommendationProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);

  const candidates = recommendations.slice(0, HERO_ITEMS_COUNT);
  const activeHero = candidates[activeIndex];

  // Auto-slide effect
  useEffect(() => {
    if (loading || candidates.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % candidates.length);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loading, candidates.length]);

  // Reset indices if recommendations load
  useEffect(() => {
    setActiveIndex(0);
  }, [recommendations.length]);

  // Background trailer loader
  useEffect(() => {
    let active = true;
    setVideoKey(null);
    setShowTrailer(false);

    const id = activeHero?.item?.tmdb_id || activeHero?.item?.imdb_id;
    if (!id) return;

    const fetchTrailer = async () => {
      try {
        const data = await getVideos(activeHero.item.type, id);
        const trailer = data.results.find(
          v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser' || v.type === 'Clip')
        );
        if (trailer && active) {
          setVideoKey(trailer.key);
          setTimeout(() => {
            if (active) setShowTrailer(true);
          }, 1500); // smooth cinematic fade-in
        }
      } catch (err) {
        console.warn('Failed to load background trailer for hero:', err);
      }
    };

    fetchTrailer();

    return () => {
      active = false;
    };
  }, [activeHero]);

  // Loading skeleton
  if (loading || !activeHero) {
    return (
      <div className="p-6 pt-6">
        <div
          className="relative w-full overflow-hidden rounded-2xl bg-[#121212] animate-pulse"
          style={{ height: HERO_HEIGHT }}
        >
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
      </div>
    );
  }

  return (
    <div className="p-6 pt-6 relative group">
      {/* Ambient background blur */}
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-1000 ease-in-out -z-10"
        style={{
          backgroundImage: `url(${activeHero.personalizedPoster || activeHero.item.poster_url})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          filter: 'blur(110px) saturate(1.5) opacity(0.18)',
        }}
      />

      <div
        className="relative w-full overflow-hidden rounded-2xl bg-[#070707]"
        style={{ height: HERO_HEIGHT }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeHero.item.tmdb_id || activeHero.item.imdb_id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Ken Burns Artwork */}
            <div className="absolute inset-0">
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: 1.08 }}
                transition={{ duration: 25, repeat: Infinity, repeatType: 'reverse' }}
                className="w-full h-full"
              >
                <img
                  src={activeHero.personalizedPoster || activeHero.item.poster_url}
                  alt={activeHero.item.title}
                  className="w-full h-full object-cover"
                />
              </motion.div>

              {/* YouTube Auto-playing Background Trailer */}
              <AnimatePresence>
                {showTrailer && videoKey && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 z-0 bg-[#070707] pointer-events-none"
                  >
                    <iframe
                      src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoKey}&playsinline=1&enablejsapi=1&showinfo=0&rel=0&modestbranding=1`}
                      className="w-full h-full scale-[1.35] border-0 pointer-events-none object-cover"
                      allow="autoplay; encrypted-media"
                      title="Hero Video Background"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/30 to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070707]/90 via-[#070707]/40 to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070707] z-10" />
              <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(229,9,20,0.15)] z-10" />
            </div>

            {/* Banner Text Content */}
            <div className="relative h-full flex flex-col justify-end p-5 sm:p-8 pb-10 sm:pb-12 lg:p-12 lg:pb-16 z-20">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="max-w-2xl space-y-5"
              >
                {/* Metadata pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E50914]/15 backdrop-blur-md text-xs text-[#E50914] border border-[#E50914]/25 font-medium">
                    <Sparkles className="w-3.5 h-3.5" />
                    Top pick for you
                  </span>
                  
                  <AnimatedMatchScore score={activeHero.score} />

                  {activeHero.item.year && (
                    <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs text-white border border-white/15">
                      {activeHero.item.year}
                    </span>
                  )}

                  {activeHero.item.genre && activeHero.item.genre.split(',').slice(0, 2).map((g, idx) => {
                    const trimmed = g.trim();
                    return (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs text-white border border-white/15 uppercase tracking-wider font-medium flex items-center gap-1.5"
                      >
                        {getGenreIcon(trimmed)}
                        {trimmed}
                      </span>
                    );
                  })}
                </div>

                {/* Title */}
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white tracking-tight leading-tight drop-shadow-2xl">
                  {activeHero.item.title}
                </h1>

                {/* Reason */}
                {activeHero.reasons[0] && (
                  <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-lg line-clamp-2 drop-shadow">
                    {activeHero.reasons[0]}
                  </p>
                )}

                {/* Buttons */}
                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onPlay(activeHero.item)}
                    aria-label={`Play ${activeHero.item.title} now`}
                    className="flex items-center gap-2.5 px-5 sm:px-7 py-3 sm:py-3.5 bg-[#E50914] rounded-xl text-white font-semibold cursor-pointer
                               shadow-[0_0_30px_rgba(229,9,20,0.4)] hover:shadow-[0_0_45px_rgba(229,9,20,0.6)]
                               hover:bg-[#ff1a25] transition-all duration-300 w-full sm:w-auto justify-center"
                  >
                    <Play className="w-5 h-5" fill="currentColor" />
                    <span>Play Now</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onInfoClick(activeHero.item)}
                    aria-label={`Show details and information for ${activeHero.item.title}`}
                    className="flex items-center gap-2.5 px-7 py-3.5 bg-white/8 backdrop-blur-xl rounded-xl cursor-pointer
                               text-white border border-white/15 hover:bg-white/12 hover:border-white/25
                               transition-all duration-300"
                  >
                    <Info className="w-5 h-5" />
                    <span>More Info</span>
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Carousel indicators/pills */}
        {candidates.length > 1 && (
          <div className="absolute bottom-6 right-8 flex items-center gap-2.5 z-30">
            {candidates.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  activeIndex === idx ? 'w-8 bg-[#E50914]' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
