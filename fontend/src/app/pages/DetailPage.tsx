import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Play, Plus, Check, Star, Calendar, ArrowLeft, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchLatestMovies, fetchLatestTVShows, getTVDetails, getSeasonEpisodes, getMovieDetails, mapTMDBToItem } from '../lib/api';
import type { MovieItem, TVShowItem, EpisodeItem, TMDBEpisode, TMDBSeason } from '../lib/api';
import { addToWatchlist, removeFromWatchlist, isInWatchlist, getWatchProgress } from '../lib/storage';
import { getCachedItem, cacheItems } from '../lib/cache';

interface DetailPageProps {
  type: 'movie' | 'tv';
}

export function DetailPage({ type }: DetailPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<MovieItem | TVShowItem | null>(null);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [tmdbSeasons, setTmdbSeasons] = useState<TMDBSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [inList, setInList] = useState(false);
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function loadDetail() {
      setLoading(true);
      try {
        let currentItem = getCachedItem(id!);
        
        if (!currentItem) {
          // Fetch from TMDB if not in cache
          if (type === 'movie') {
            const detail = await getMovieDetails(id!);
            const mapped = mapTMDBToItem(detail as any); // mapTMDBToItem expects TMDBSearchResult but it handles detail objects too
            if (mapped) currentItem = mapped;
          } else {
            const detail = await getTVDetails(id!);
            const mapped = mapTMDBToItem(detail as any);
            if (mapped) currentItem = mapped;
            
            // Set seasons
            if (detail.seasons) {
              // Filter out season 0 (Specials) usually
              setTmdbSeasons(detail.seasons.filter(s => s.season_number > 0));
              if (detail.seasons.length > 0) {
                const firstRealSeason = detail.seasons.find(s => s.season_number > 0)?.season_number || 1;
                setSelectedSeason(firstRealSeason);
              }
            }
          }
        }
        
        if (currentItem) {
          setItem(currentItem);
          setInList(isInWatchlist(currentItem.tmdb_id || currentItem.imdb_id));
        }

        // If it's a TV show and we used cache, we still need to get seasons
        if (type === 'tv' && currentItem && tmdbSeasons.length === 0) {
           const detail = await getTVDetails(id!);
           if (detail.seasons) {
             setTmdbSeasons(detail.seasons.filter(s => s.season_number > 0));
             if (detail.seasons.length > 0) {
               const firstRealSeason = detail.seasons.find(s => s.season_number > 0)?.season_number || 1;
               setSelectedSeason(firstRealSeason);
             }
           }
        }

      } catch (err) {
        console.error('Failed to load details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [id, type]);

  // Fetch episodes when selected season changes
  useEffect(() => {
    if (type !== 'tv' || !id || !selectedSeason) return;
    
    async function loadEpisodes() {
      setEpisodesLoading(true);
      try {
        const res = await getSeasonEpisodes(id!, selectedSeason);
        setEpisodes(res.episodes || []);
      } catch (err) {
        console.error('Failed to load episodes:', err);
        setEpisodes([]);
      } finally {
        setEpisodesLoading(false);
      }
    }
    loadEpisodes();
  }, [id, type, selectedSeason]);

  const handlePlay = () => {
    if (!id) return;
    if (type === 'movie') {
      navigate(`/watch/movie/${item?.imdb_id || id}`);
    } else if (episodes.length > 0) {
      const ep = episodes[0];
      navigate(`/watch/tv/${id}/${ep.season_number}/${ep.episode_number}`);
    } else {
      // Default to S1E1 even without episode listing
      navigate(`/watch/tv/${id}/1/1`);
    }
  };

  const handleEpisodePlay = (ep: TMDBEpisode) => {
    navigate(`/watch/tv/${id}/${ep.season_number}/${ep.episode_number}`);
  };

  const handleWatchlist = () => {
    if (!item) return;
    const itemId = item.tmdb_id || item.imdb_id;
    if (inList) {
      removeFromWatchlist(itemId);
      setInList(false);
    } else {
      addToWatchlist({
        id: itemId, tmdb_id: item.tmdb_id, imdb_id: item.imdb_id,
        title: item.title, poster: item.poster_url, type: item.type,
        year: item.year, rating: item.rating, genre: item.genre, addedAt: Date.now(),
      });
      setInList(true);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-[60vh] bg-white/5 animate-pulse" />
        <div className="p-8 space-y-4">
          <div className="h-8 w-64 bg-white/5 rounded animate-pulse" />
          <div className="h-4 w-full max-w-lg bg-white/5 rounded animate-pulse" />
          <div className="h-4 w-3/4 max-w-md bg-white/5 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // If item not found in cache/listings, still allow playing directly
  if (!item) {
    return (
      <div className="p-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 mb-8 bg-white/5 rounded-lg border border-white/10 text-white text-sm hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#E50914]/20 to-[#E50914]/5 flex items-center justify-center border border-[#E50914]/20">
            <Play className="w-10 h-10 text-[#E50914]" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white">Ready to Play</h2>
            <p className="text-[#9A9A9A] text-sm max-w-md">
              Details not available in the catalog, but you can still watch this {type === 'movie' ? 'movie' : 'show'} directly.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (type === 'movie') {
                  navigate(`/watch/movie/${id}`);
                } else {
                  navigate(`/watch/tv/${id}/1/1`);
                }
              }}
              className="flex items-center gap-2 px-8 py-3.5 bg-[#E50914] rounded-xl text-white shadow-[0_0_25px_rgba(229,9,20,0.4)] hover:shadow-[0_0_40px_rgba(229,9,20,0.6)] hover:bg-[#ff1a25] transition-all duration-300 font-medium"
            >
              <Play className="w-5 h-5" fill="currentColor" />
              Play Now
            </motion.button>
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white text-sm transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-[65vh] overflow-hidden">
        <img
          src={item.poster_url}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070707]/80 via-transparent to-transparent" />

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 text-white text-sm hover:bg-black/60 transition-all z-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
          <div className="max-w-3xl space-y-5">
            {/* Metadata */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs text-white border border-white/15">
                {item.year}
              </span>
              {parseFloat(item.rating) > 0 && (
                <span className="px-3 py-1 rounded-full bg-yellow-500/15 backdrop-blur text-xs text-yellow-400 border border-yellow-500/25 flex items-center gap-1">
                  <Star className="w-3 h-3" fill="currentColor" />
                  {parseFloat(item.rating).toFixed(1)}
                </span>
              )}
              <span className="px-3 py-1 rounded-full bg-[#E50914]/15 backdrop-blur text-xs text-[#E50914] border border-[#E50914]/25 uppercase font-semibold tracking-wider">
                {type === 'movie' ? 'Movie' : 'TV Series'}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {item.title}
            </h1>

            {/* Genres */}
            {item.genre && (
              <p className="text-sm text-[#aaa]">{item.genre}</p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePlay}
                className="flex items-center gap-2 px-7 py-3.5 bg-[#E50914] rounded-xl text-white
                         shadow-[0_0_25px_rgba(229,9,20,0.4)] hover:shadow-[0_0_40px_rgba(229,9,20,0.6)]
                         hover:bg-[#ff1a25] transition-all duration-300 font-medium text-sm"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                {type === 'movie' ? 'Play Movie' : 'Play S1:E1'}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleWatchlist}
                className={`flex items-center gap-2 px-6 py-3.5 backdrop-blur-xl rounded-xl text-white border transition-all duration-300 text-sm font-medium
                  ${inList ? 'bg-[#E50914]/15 border-[#E50914]/30' : 'bg-white/8 border-white/15 hover:bg-white/12'}`}
              >
                {inList ? <Check className="w-5 h-5 text-[#E50914]" /> : <Plus className="w-5 h-5" />}
                {inList ? 'In Watchlist' : 'Add to Watchlist'}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes Section (TV Only) */}
      {type === 'tv' && (
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Episodes</h2>

            {/* Season Selector */}
            {tmdbSeasons.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white hover:bg-white/10 transition-all"
                >
                  Season {selectedSeason}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showSeasonDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showSeasonDropdown && (
                  <div className="absolute right-0 top-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-20 min-w-[140px] max-h-64 overflow-y-auto">
                    {tmdbSeasons.map(s => (
                      <button
                        key={s.season_number}
                        onClick={() => { setSelectedSeason(s.season_number); setShowSeasonDropdown(false); }}
                        className={`w-full px-4 py-2.5 text-sm text-left transition-colors ${
                          selectedSeason === s.season_number ? 'bg-[#E50914]/15 text-white' : 'text-[#9A9A9A] hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        Season {s.season_number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Episode List */}
          {episodesLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#E50914] border-t-transparent animate-spin" />
            </div>
          ) : episodes.length > 0 ? (
            <div className="space-y-2">
              {episodes.map((ep, idx) => {
                const progress = getWatchProgress(id!, ep.season_number, ep.episode_number);
                const progressPercent = progress && progress.duration > 0 ? (progress.progress / progress.duration) * 100 : 0;

                return (
                  <motion.button
                    key={ep.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleEpisodePlay(ep)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-[#E50914]/20 transition-all group text-left"
                  >
                    {/* Episode Number */}
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-[#E50914]/20 transition-colors">
                      <span className="text-sm text-[#9A9A9A] group-hover:text-[#E50914] font-mono">{ep.episode_number}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm text-white font-medium truncate">
                        {ep.name || `Episode ${ep.episode_number}`}
                      </h3>
                      {ep.air_date && (
                        <p className="text-xs text-[#666] mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {ep.air_date}
                        </p>
                      )}
                      {progressPercent > 0 && (
                        <div className="mt-2 h-1 w-full max-w-[200px] bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#E50914] rounded-full" style={{ width: `${progressPercent}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Play icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 group-hover:bg-[#E50914] flex items-center justify-center transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(229,9,20,0.4)]">
                      <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
              <p className="text-[#666] text-sm">Episode listing not available. You can still play episodes directly.</p>
              <div className="flex gap-3 justify-center flex-wrap">
                {[1, 2, 3, 4, 5].map(epNum => (
                  <button
                    key={epNum}
                    onClick={() => navigate(`/watch/tv/${id}/${selectedSeason}/${epNum}`)}
                    className="px-5 py-2.5 bg-white/5 hover:bg-[#E50914]/20 border border-white/10 hover:border-[#E50914]/30 rounded-lg text-white text-sm transition-all"
                  >
                    S{selectedSeason}:E{epNum}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
