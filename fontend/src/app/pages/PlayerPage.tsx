import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Maximize2, Minimize2, SkipForward, List, Globe } from 'lucide-react';
import { getMovieEmbedUrl, getTVEmbedUrl, getMovieDetails, getTVDetails, mapTMDBToItem } from '../lib/api';
import { getCachedItem } from '../lib/cache';
import {
  saveWatchProgress,
  getWatchProgress,
  setupPlayerListener,
  addToHistory,
  getPreferences,
  savePreferences,
} from '../lib/storage';

interface PlayerPageProps {
  type: 'movie' | 'tv';
}

export function PlayerPage({ type }: PlayerPageProps) {
  const { id, season, episode } = useParams();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [playerTitle, setPlayerTitle] = useState('');
  const [playerPoster, setPlayerPoster] = useState('');
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const prefs = getPreferences();
  const [currentLang, setCurrentLang] = useState(prefs.subtitleLang || 'en');
  const seasonNum = season ? parseInt(season) : undefined;
  const episodeNum = episode ? parseInt(episode) : undefined;

  const [embedUrl, setEmbedUrl] = useState('');

  // Calculate embed URL ONCE on mount so changing progress state doesn't reload the iframe
  useEffect(() => {
    if (!id) return;

    if (type === 'movie') {
      const saved = getWatchProgress(id);
      setEmbedUrl(getMovieEmbedUrl(id, {
        resumeAt: saved?.progress,
        primaryColor: prefs.playerColor,
        lang: currentLang,
      }));
    } else if (seasonNum && episodeNum) {
      const saved = getWatchProgress(id, seasonNum, episodeNum);
      setEmbedUrl(getTVEmbedUrl(id, seasonNum, episodeNum, {
        resumeAt: saved?.progress,
        primaryColor: prefs.playerColor,
        lang: currentLang,
      }));
    }
  }, [id, type, seasonNum, episodeNum, currentLang, prefs.playerColor]);

  // Fetch metadata to save in history
  useEffect(() => {
    if (!id) return;

    async function loadMeta() {
      const cached = getCachedItem(id!);
      if (cached) {
        setPlayerTitle(cached.title);
        setPlayerPoster(cached.poster_url);
        return;
      }
      try {
        if (type === 'movie') {
          const detail = await getMovieDetails(id!);
          const mapped = mapTMDBToItem(detail as any);
          if (mapped) {
            setPlayerTitle(mapped.title);
            setPlayerPoster(mapped.poster_url);
          }
        } else {
          const detail = await getTVDetails(id!);
          const mapped = mapTMDBToItem(detail as any);
          if (mapped) {
            setPlayerTitle(mapped.title);
            setPlayerPoster(mapped.poster_url);
          }
        }
      } catch (err) {
        console.error('Failed to load meta:', err);
      }
    }
    loadMeta();
  }, [id, type]);

  // Add to history on mount or when meta loads
  useEffect(() => {
    if (id && playerTitle) {
      addToHistory({
        id,
        tmdb_id: id,
        imdb_id: id,
        title: playerTitle,
        poster: playerPoster,
        type,
        watchedAt: Date.now(),
        season: seasonNum,
        episode: episodeNum,
      });
    }
  }, [id, type, seasonNum, episodeNum, playerTitle, playerPoster]);

  // Setup player event listener for progress saving
  useEffect(() => {
    if (!id) return;

    const cleanup = setupPlayerListener({
      onProgress: (progress, duration, info) => {
        setCurrentProgress(progress);
        setCurrentDuration(duration);
        if (info?.title) setPlayerTitle(info.title);

        // Save progress to localStorage every ~5 seconds (player fires this)
        saveWatchProgress({
          id,
          type,
          title: info?.title || playerTitle || 'Unknown',
          poster: info?.poster || playerPoster || '',
          progress,
          duration,
          timestamp: Date.now(),
          season: seasonNum,
          episode: episodeNum,
          episodeTitle: undefined,
        });
      },
      onPause: (progress, info) => {
        setCurrentProgress(progress);
        // Save on pause too
        saveWatchProgress({
          id,
          type,
          title: info?.title || playerTitle || 'Unknown',
          poster: info?.poster || playerPoster || '',
          progress,
          duration: currentDuration,
          timestamp: Date.now(),
          season: seasonNum,
          episode: episodeNum,
        });
      },
      onComplete: (info) => {
        // Auto-play next episode
        if (type === 'tv' && prefs.autoNextEpisode && seasonNum && episodeNum) {
          const nextEp = episodeNum + 1;
          navigate(`/watch/tv/${id}/${seasonNum}/${nextEp}`, { replace: true });
        }
      },
      onSeeked: (progress) => {
        setCurrentProgress(progress);
      },
    });

    return cleanup;
  }, [id, type, seasonNum, episodeNum, playerTitle, currentDuration, prefs.autoNextEpisode, navigate]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimeout]);

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Next episode
  const playNextEpisode = () => {
    if (type === 'tv' && seasonNum && episodeNum) {
      navigate(`/watch/tv/${id}/${seasonNum}/${episodeNum + 1}`, { replace: true });
    }
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleLangChange = (lang: string) => {
    setCurrentLang(lang);
    setShowLangDropdown(false);
    savePreferences({ subtitleLang: lang });
  };

  const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Russian' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'hi', label: 'Hindi' },
    { code: 'ja', label: 'Japanese' }
  ];

  const progressPercent = currentDuration > 0 ? (currentProgress / currentDuration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black"
      style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 65px)' }}
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* Video Player Iframe */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        className="w-full h-full border-0"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        title={type === 'movie' ? 'Movie Player' : `S${seasonNum}E${episodeNum}`}
      />

      {/* Top Controls Bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent
                   transition-all duration-500 z-10 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-white text-sm hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div>
              <h2 className="text-white text-sm font-medium">
                {playerTitle || 'Now Playing'}
              </h2>
              {type === 'tv' && seasonNum && episodeNum && (
                <p className="text-[#9A9A9A] text-xs">
                  Season {seasonNum} · Episode {episodeNum}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Next Episode */}
            {type === 'tv' && (
              <button
                onClick={playNextEpisode}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-white text-xs hover:bg-white/20 transition-all"
                title="Next Episode"
              >
                <SkipForward className="w-4 h-4" />
                <span className="hidden sm:inline">Next</span>
              </button>
            )}

            {/* Episode List */}
            {type === 'tv' && (
              <button
                onClick={() => navigate(`/tv/${id}`)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-white text-xs hover:bg-white/20 transition-all"
                title="Episode List"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Episodes</span>
              </button>
            )}

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-white text-xs hover:bg-white/20 transition-all"
                title="Dubbing / Language"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{LANGUAGES.find(l => l.code === currentLang)?.label || 'Language'}</span>
              </button>

              {showLangDropdown && (
                <div className="absolute right-0 top-full mt-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-20">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleLangChange(lang.code)}
                      className={`w-full px-4 py-2.5 text-xs text-left transition-colors ${
                        currentLang === lang.code ? 'bg-[#E50914]/15 text-white' : 'text-[#9A9A9A] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-white hover:bg-white/20 transition-all"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      {currentDuration > 0 && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent
                     transition-all duration-500 z-10 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        >
          <div className="px-4 pb-4 pt-8">
            {/* Progress bar */}
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mb-2 cursor-pointer group">
              <div
                className="h-full bg-[#E50914] rounded-full relative group-hover:h-1.5 transition-all"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#E50914] rounded-full shadow-[0_0_8px_rgba(229,9,20,0.8)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Time */}
            <div className="flex items-center justify-between text-xs text-[#9A9A9A]">
              <span>{formatTime(currentProgress)}</span>
              <span>{formatTime(currentDuration)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
