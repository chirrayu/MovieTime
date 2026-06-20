/// <reference types="vite/client" />
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Maximize2, Minimize2, SkipForward, List, Globe, Users, MessageSquare, Send, Share2, Sparkles, AlertCircle, X, Shield, Play, Pause, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { getMovieEmbedUrl, getTVEmbedUrl, getMovieDetails, getTVDetails, mapTMDBToItem, EMBED_SOURCES, getPreferredSourceId, setPreferredSourceId } from '../lib/api';
import { getCachedItem } from '../lib/cache';
import {
  saveWatchProgress,
  getWatchProgress,
  setupPlayerListener,
  addToHistory,
  getPreferences,
  savePreferences,
} from '../lib/storage';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

// Define Socket message interfaces
interface PartyUser {
  id: string;
  username: string;
  isHost: boolean;
}

interface PlaybackState {
  isPlaying: boolean;
  timestamp: number;
  lastUpdateTime: number;
  mediaId?: string;
  mediaType?: 'movie' | 'tv';
}

interface SyncPayload {
  roomId: string;
  type: 'play' | 'pause' | 'seek';
  currentTime: number;
  sentAt?: number;
  requesterId?: string;
  mediaId?: string;
  mediaType?: 'movie' | 'tv';
  playbackRate?: number;
}

interface PartyRoomState {
  roomId: string;
  hostId: string;
  users: Record<string, PartyUser>;
  playbackState: PlaybackState;
}

interface PartyChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface PlayerPageProps {
  type: 'movie' | 'tv';
}

// Watch Party Backend URL — runtime-safe fallback (dev defaults to local backend)
const BACKEND_URL = (() => {
  const win = window as any;
  if (win && win.__VITE_WS_URL) return win.__VITE_WS_URL;
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocal ? 'http://127.0.0.1:3002' : 'https://movietime-mkwk.onrender.com';
})();

// ----------------------------------------------------
// Sub-Component: VideoFeed
// ----------------------------------------------------
interface VideoFeedProps {
  stream: MediaStream;
  muted?: boolean;
  username: string;
  isLocal?: boolean;
  micMuted?: boolean;
  camOff?: boolean;
}

function VideoFeed({ stream, muted, username, isLocal, micMuted, camOff }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black/60 aspect-video border border-white/5 shadow-inner flex items-center justify-center group transition-all hover:border-red-500/30">
      {camOff ? (
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#E50914] to-red-400 flex items-center justify-center text-white font-bold text-lg shadow-[0_2px_8px_rgba(229,9,20,0.3)] select-none animate-pulse">
          {username.substring(0, 2).toUpperCase()}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="watch-party-video w-full h-full object-cover rounded-xl"
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
        />
      )}

      {/* Overlay Status Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] text-white font-semibold">
          {username} {isLocal && '(You)'}
        </span>

        <div className="flex gap-1">
          {micMuted && (
            <span className="p-1 rounded-md bg-red-600/90 text-white shadow-sm flex items-center justify-center">
              <AlertCircle className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
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
  const [volume, setVolume] = useState(75);

  // Initialize player volume on mount
  useEffect(() => {
    // Ensure iframe is ready before sending volume command
    const timer = setTimeout(() => {
      sendPlayerCommand('volume', volume / 100);
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const prefs = getPreferences();
  const [currentLang, setCurrentLang] = useState(prefs.subtitleLang || 'en');
  const seasonNum = season ? parseInt(season) : undefined;
  const episodeNum = episode ? parseInt(episode) : undefined;

  const [embedUrl, setEmbedUrl] = useState('');
  const [adBlockEnabled, setAdBlockEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('movietime_adblock_enabled');
      return val === null ? true : val === 'true';
    } catch {
      return true;
    }
  });

  const toggleAdBlock = () => {
    const nextVal = !adBlockEnabled;
    setAdBlockEnabled(nextVal);
    try {
      localStorage.setItem('movietime_adblock_enabled', String(nextVal));
    } catch (err) {
      console.warn(err);
    }
    toast.success(nextVal ? 'Ad-Blocker Enabled' : 'Ad-Blocker Disabled (Reloading player...)');
  };



  // ----------------------------------------------------
  // Watch Party States
  // ----------------------------------------------------
  const [roomId, setRoomId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('room');
  });
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<Record<string, PartyUser>>({});
  const [hostId, setHostId] = useState<string>('');
  const [connStatus, setConnStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'call' | 'users'>('chat');
  const [chatMessages, setChatMessages] = useState<PartyChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('movietime_username') || '';
  });
  const [userId, setUserId] = useState<string>(() => {
    return localStorage.getItem('movietime_user_id') || '';
  });
  const [showNameModal, setShowNameModal] = useState<boolean>(!username && !!roomId);

  const generateNewUserId = () => {
    const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-${Math.random().toString(36).substring(2, 12)}`;
    localStorage.setItem('movietime_user_id', newId);
    setUserId(newId);
    return newId;
  };
  const [latency, setLatency] = useState<number>(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync correction states
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(Date.now());
  const lastSeekTimeRef = useRef<number>(0);
  const isRemoteUpdate = useRef(false);
  const partyReadyRef = useRef(false);
  const [hasJoinedParty, setHasJoinedParty] = useState(false);

  // ----------------------------------------------------
  // WebRTC Audio/Video Call States & Refs
  // ----------------------------------------------------
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [inVideoCall, setInVideoCall] = useState(false);

  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  // Synchronous Refs to bypass persistent hook recreation on fast state updates
  const currentProgressRef = useRef(currentProgress);
  const currentDurationRef = useRef(currentDuration);
  const lastProgressUpdateRef = useRef(lastProgressUpdate);
  const hostIdRef = useRef(hostId);
  const isPlayingRef = useRef(false);

  // Sync/drift correction constants and smoothing timer
  const SYNC_SMALL_DRIFT = 0.3; // seconds
  const SYNC_HARD_DRIFT = 2; // seconds
  const SYNC_SMOOTH_DURATION = 3000; // ms: how long to apply gentle playbackRate
  const smoothAdjustTimeoutRef = useRef<number | null>(null);

  useEffect(() => { currentProgressRef.current = currentProgress; }, [currentProgress]);
  useEffect(() => { currentDurationRef.current = currentDuration; }, [currentDuration]);
  useEffect(() => { lastProgressUpdateRef.current = lastProgressUpdate; }, [lastProgressUpdate]);
  useEffect(() => { hostIdRef.current = hostId; }, [hostId]);

  // Derived watch party states
  const isHost = useMemo(() => {
    if (!socket) return false;
    return socket.id === hostId;
  }, [socket, hostId]);

  const activeUserCount = useMemo(() => {
    return Object.keys(users).length;
  }, [users]);

  // ----------------------------------------------------
  // Host Simulated Progress fallbacks (for cross-origin iframe restriction)
  // ----------------------------------------------------
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // User must click "Join Watch Party" (unlocks sync + guest apply)
  const partyReady =
    hasJoinedParty && !!roomId && !!username.trim() && !showNameModal;

  useEffect(() => {
    partyReadyRef.current = partyReady;
  }, [partyReady]);

  const canHostControl = isHost && partyReady && connStatus === 'connected' && !!socket;

  useEffect(() => {
    // Simulated progress only outside watch party (iframe reports real progress)
    if (!localIsPlaying || roomId) return;

    const interval = setInterval(() => {
      setCurrentProgress(prev => {
        const next = prev + 1;
        if (next >= currentDuration) {
          setLocalIsPlaying(false);
          return currentDuration;
        }
        return next;
      });
      setLastProgressUpdate(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [localIsPlaying, currentDuration, roomId]);

  // ----------------------------------------------------
  // Embed URL setup
  // ----------------------------------------------------

  useEffect(() => {
    if (!id) return;

    if (type === 'movie') {
      setEmbedUrl(getMovieEmbedUrl(id, {
        resumeAt: undefined,
        primaryColor: prefs.playerColor,
        lang: currentLang,
      }));
    } else if (seasonNum && episodeNum) {
      setEmbedUrl(getTVEmbedUrl(id, seasonNum, episodeNum, {
        resumeAt: undefined,
        primaryColor: prefs.playerColor,
        lang: currentLang,
      }));
    }
  }, [id, type, seasonNum, episodeNum, currentLang, prefs.playerColor]);

  // ----------------------------------------------------
  // Sync URL Room parameter
  // ----------------------------------------------------
  useEffect(() => {
    const handleUrlChange = () => {
      const rId = new URLSearchParams(window.location.search).get('room');
      setRoomId(rId);
      if (!rId) {
        setHasJoinedParty(false);
        partyReadyRef.current = false;
      }
      if (rId && !username) {
        setShowNameModal(true);
      }
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [username]);

  // ----------------------------------------------------
  // Fetch metadata
  // ----------------------------------------------------
  useEffect(() => {
    if (!id) return;

    async function loadMeta() {
      try {
        if (type === 'movie') {
          const detail = await getMovieDetails(id!);
          const mapped = mapTMDBToItem(detail as any);
          if (mapped) {
            setPlayerTitle(mapped.title);
            setPlayerPoster(mapped.poster_url);
            if (detail.runtime) {
              setCurrentDuration(detail.runtime * 60);
            } else {
              setCurrentDuration(120 * 60); // 2 hours default fallback
            }
          }
        } else {
          const detail = await getTVDetails(id!);
          const mapped = mapTMDBToItem(detail as any);
          if (mapped) {
            setPlayerTitle(mapped.title);
            setPlayerPoster(mapped.poster_url);
            // Default TV episode duration: 45 minutes
            setCurrentDuration(45 * 60);
          }
        }
      } catch (err) {
        console.error('Failed to load meta:', err);
        setCurrentDuration(120 * 60);
      }
    }
    loadMeta();
  }, [id, type]);

  // Add to history
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

  // ----------------------------------------------------
  // Controller: Post commands to Iframe Player
  // ----------------------------------------------------
  const postToEmbedPlayer = useCallback((payload: object) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(payload, '*');
  }, []);

  const sendPlayerCommand = useCallback((action: 'play' | 'pause' | 'seek' | 'volume' | 'playbackRate' | 'hideControls', value?: number) => {
    if (!iframeRef.current?.contentWindow) {
      console.error('PLAYER_COMMAND failed: embed iframe not ready', { action, value });
      return;
    }
    console.log('PLAYER_COMMAND', { action, value });

    if (action === 'hideControls') {
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'hideControls', value: true } });
      postToEmbedPlayer({ key: 'player_command', action: 'hideControls', value: true });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'setChromeless', value: true } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'toggleControls', value: false } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'hideUI', value: true } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'setUIVisibility', value: false } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'hideBottomControls', value: true } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'hideTopBar', value: true } });
      return;
    }

    if (action === 'playbackRate' && typeof value === 'number') {
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'playbackRate', value } });
      postToEmbedPlayer({ key: 'player_command', action: 'playbackRate', value });
      return;
    }

    if (action === 'seek' && typeof value === 'number') {
      lastSeekTimeRef.current = Date.now();
      const time = value;
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'seek', time } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'seek', value: time } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'seek', timestamp: time } });
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'seek', currentTime: time } });
      postToEmbedPlayer({ key: 'player_command', action: 'seek', value: time });
      postToEmbedPlayer({ key: 'player_command', action: 'seek', time });
      return;
    }

    if (action === 'play') {
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'play' } });
      postToEmbedPlayer({ key: 'player_command', action: 'play' });
      return;
    }

    if (action === 'pause') {
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'pause' } });
      postToEmbedPlayer({ key: 'player_command', action: 'pause' });
      return;
    }

    if (action === 'volume' && typeof value === 'number') {
      postToEmbedPlayer({ type: 'PLAYER_COMMAND', data: { action: 'volume', value } });
      postToEmbedPlayer({ key: 'player_command', action: 'volume', value });
    }
  }, [postToEmbedPlayer]);

  const applyRemoteSync = useCallback((data: SyncPayload, source: string) => {
    const estimatedLatencySeconds = latency ? latency / 2000 : 0;
    const actualLatencySeconds = data.sentAt ? Math.max(0, Date.now() - data.sentAt) / 1000 : estimatedLatencySeconds;
    const time = Math.max(0, data.currentTime);
    const targetTime = data.type === 'play'
      ? Math.min(currentDurationRef.current || time, time + actualLatencySeconds)
      : time;

    console.log('SYNC RECEIVED', {
      source,
      payload: data,
      localTime: currentProgressRef.current,
      predictedTime: targetTime,
      latencySeconds: actualLatencySeconds,
    });

    if (!partyReadyRef.current) {
      console.log('SYNC IGNORED: click Join Watch Party first');
      return;
    }

    isRemoteUpdate.current = true;

    const local = currentProgressRef.current || 0;
    const drift = Math.abs(local - targetTime);

    // Clear any previous smooth adjust timers
    if (smoothAdjustTimeoutRef.current) {
      window.clearTimeout(smoothAdjustTimeoutRef.current);
      smoothAdjustTimeoutRef.current = null;
    }

    // Helper to reset playbackRate back to 1
    const resetPlaybackRate = () => {
      try {
        sendPlayerCommand('playbackRate', 1);
      } catch (err) {
        console.warn('Failed to reset playbackRate', err);
      }
    };

    // Apply behavior depending on drift size
    if (drift < SYNC_SMALL_DRIFT) {
      // Small drift: just nudge internal state and play/pause without seeking
      setCurrentProgress(targetTime);
      setLastProgressUpdate(Date.now());
      if (data.type === 'play') {
        setIsPlaying(true);
        setLocalIsPlaying(true);
        sendPlayerCommand('play');
      } else if (data.type === 'pause') {
        setIsPlaying(false);
        setLocalIsPlaying(false);
        sendPlayerCommand('pause');
      }
      console.log('APPLY small drift adjust', { local, targetTime, drift });
    } else if (drift < SYNC_HARD_DRIFT) {
      // Medium drift: gentle playbackRate correction to converge
      const shouldSpeedUp = targetTime > local;
      const rate = shouldSpeedUp ? 1.02 : 0.98;
      setLastProgressUpdate(Date.now());
      sendPlayerCommand('playbackRate', rate);
      // After a short window, reset rate and snap to expected time to avoid permanent skew
      smoothAdjustTimeoutRef.current = window.setTimeout(() => {
        resetPlaybackRate();
        setCurrentProgress(targetTime);
        setLastProgressUpdate(Date.now());
      }, SYNC_SMOOTH_DURATION) as unknown as number;
      if (data.type === 'play') {
        setIsPlaying(true);
        setLocalIsPlaying(true);
        sendPlayerCommand('play');
      } else if (data.type === 'pause') {
        setIsPlaying(false);
        setLocalIsPlaying(false);
        sendPlayerCommand('pause');
      }
      console.log('APPLY gentle playbackRate', { local, targetTime, drift, rate });
    } else {
      // Large drift: hard seek to authoritative time
      setCurrentProgress(targetTime);
      setLastProgressUpdate(Date.now());
      sendPlayerCommand('seek', targetTime);
      if (data.type === 'play') {
        setIsPlaying(true);
        setLocalIsPlaying(true);
        sendPlayerCommand('play');
      } else if (data.type === 'pause') {
        setIsPlaying(false);
        setLocalIsPlaying(false);
        sendPlayerCommand('pause');
      }
      console.log('APPLY hard seek', { local, targetTime, drift });
    }

    // short debounce before re-enabling local listeners
    setTimeout(() => {
      isRemoteUpdate.current = false;
    }, 250);
  }, [sendPlayerCommand, latency]);

  const emitHostSync = useCallback((type: 'play' | 'pause' | 'seek', currentTime?: number) => {
    if (!isHost) {
      console.log('EMIT blocked: not host');
      return;
    }
    if (!roomId || !socket || connStatus !== 'connected') {
      console.log('EMIT blocked: not connected to party');
      return;
    }

    const time = Math.max(
      0,
      Math.min(currentDurationRef.current || 0, currentTime ?? currentProgressRef.current)
    );
    const payload: SyncPayload = { roomId, type, currentTime: time, sentAt: Date.now() };

    console.log('EMIT', payload);

    isRemoteUpdate.current = true;
    setCurrentProgress(time);
    setLastProgressUpdate(Date.now());

    if (type === 'play') {
      setIsPlaying(true);
      setLocalIsPlaying(true);
      sendPlayerCommand('play');
    } else if (type === 'pause') {
      setIsPlaying(false);
      setLocalIsPlaying(false);
      sendPlayerCommand('pause');
    }
    sendPlayerCommand('seek', time);

    socket.emit('sync', payload);

    setTimeout(() => {
      isRemoteUpdate.current = false;
    }, 200);
  }, [isHost, roomId, socket, connStatus, sendPlayerCommand]);

  const hideEmbedPlayerControls = useCallback(() => {
    sendPlayerCommand('hideControls');
  }, [sendPlayerCommand]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !embedUrl) return;

    const onLoad = () => {
      hideEmbedPlayerControls();
      setTimeout(hideEmbedPlayerControls, 400);
      setTimeout(hideEmbedPlayerControls, 1500);
    };

    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [embedUrl, hideEmbedPlayerControls]);

  const togglePlayPause = useCallback(() => {
    if (!roomId) {
      if (isRemoteUpdate.current) return;
      if (isPlaying) {
        setIsPlaying(false);
        setLocalIsPlaying(false);
        sendPlayerCommand('pause');
      } else {
        setIsPlaying(true);
        setLocalIsPlaying(true);
        sendPlayerCommand('play');
      }
      return;
    }

    if (!canHostControl) {
      if (roomId && !isHost) {
        toast.info('Only the host controls playback');
      } else if (roomId && !partyReady) {
        toast.info('Join the watch party first');
      }
      return;
    }
    if (isRemoteUpdate.current) return;
    if (isPlaying) {
      emitHostSync('pause', currentProgressRef.current);
    } else {
      emitHostSync('play', currentProgressRef.current);
    }
  }, [canHostControl, roomId, isHost, partyReady, isPlaying, emitHostSync, sendPlayerCommand]);

  const broadcastHostCommand = useCallback((
    command: 'play' | 'pause' | 'seek',
    seekTime?: number,
    options?: { toastMessage?: string }
  ) => {
    if (!isHost) {
      toast.error('Only the party host can control playback');
      return;
    }
    if (!partyReady) {
      toast.error('Enter your name and join the watch party first');
      return;
    }
    emitHostSync(command, seekTime);
    if (options?.toastMessage) {
      toast.success(options.toastMessage);
    }
  }, [isHost, emitHostSync]);

  const hostPlay = useCallback(() => {
    broadcastHostCommand('play', currentProgressRef.current, { toastMessage: 'Broadcasted Play to the room' });
  }, [broadcastHostCommand]);

  const hostPause = useCallback(() => {
    broadcastHostCommand('pause', currentProgressRef.current, { toastMessage: 'Broadcasted Pause to the room' });
  }, [broadcastHostCommand]);

  const hostSkip = useCallback((deltaSeconds: number) => {
    const newTime = Math.max(
      0,
      Math.min(currentDurationRef.current, currentProgressRef.current + deltaSeconds)
    );
    broadcastHostCommand('seek', newTime, {
      toastMessage: deltaSeconds < 0 ? 'Rewound 10 seconds for everyone' : 'Skipped forward 10 seconds for everyone',
    });
  }, [broadcastHostCommand]);

  const hostForceSync = useCallback(() => {
    if (!isHost || !partyReady) {
      toast.error('Only the host can force sync after joining the party');
      return;
    }
    const type = isPlayingRef.current ? 'play' : 'pause';
    emitHostSync(type, currentProgressRef.current);
    toast.success('Force-synced all guests to your timeline');
  }, [isHost, partyReady, emitHostSync]);

  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const targetProgress = Math.floor(percentage * currentDuration);

    if (roomId) {
      if (!canHostControl) {
        if (!isHost) {
          toast.info('Only the host can jump the timeline during a watch party');
        } else if (!partyReady) {
          toast.info('Join the watch party first');
        }
        return;
      }

      broadcastHostCommand('seek', targetProgress, {
        toastMessage: `Jumped to ${Math.floor(targetProgress / 60)}m ${targetProgress % 60}s for everyone`,
      });
      return;
    }

    setCurrentProgress(targetProgress);
    setLastProgressUpdate(Date.now());
    sendPlayerCommand('seek', targetProgress);
  }, [roomId, canHostControl, currentDuration, broadcastHostCommand, isHost, partyReady, sendPlayerCommand]);

  // ----------------------------------------------------
  // Clean up WebRTC streams on unmount
  // ----------------------------------------------------
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.keys(peersRef.current).forEach(k => {
        peersRef.current[k].close();
      });
    };
  }, []);

  // ----------------------------------------------------
  // WebRTC Handlers (Join, Leave, Mute, Camera)
  // ----------------------------------------------------
  const handleJoinCall = async () => {
    if (!socket || !roomId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // Apply current mic mute state to the newly acquired stream
      if (isMicMuted) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = false;
      }
      setLocalStream(stream);
      localStreamRef.current = stream;
      setInVideoCall(true);

      // Notify active room participants we joined the call
      socket.emit('join_call', { roomId });
      toast.success("Connected to video call!");
    } catch (err) {
      console.error("Camera/Mic access denied:", err);
      toast.error("Failed to access Camera or Microphone.");
    }
  };

  const handleLeaveCall = () => {
    if (socket && roomId) {
      socket.emit('leave_call', { roomId });
    }

    // Close local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    localStreamRef.current = null;
    setInVideoCall(false);

    // Close peer connections
    Object.keys(peersRef.current).forEach(k => {
      peersRef.current[k].close();
    });
    peersRef.current = {};
    setRemoteStreams({});
    toast.info("Left video call.");
  };

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
        // Propagate the new audio track to all active peer connections
        Object.values(peersRef.current).forEach((pc) => {
          // Find existing audio sender(s) and replace their track
          const audioSenders = pc.getSenders().filter((s) => s.track?.kind === 'audio');
          audioSenders.forEach((sender) => {
            // replaceTrack returns a promise; we ignore result but catch errors
            sender.replaceTrack(audioTrack).catch(console.error);
          });
        });
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOff(!videoTrack.enabled);
      }
    }
  };

  // ----------------------------------------------------
  // Core Synchronization & Socket Integration
  // ----------------------------------------------------
  useEffect(() => {
    if (!roomId || !username || showNameModal) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    setConnStatus('connecting');

    const newSocket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    setSocket(newSocket);

    // Helper: Create peer connections for P2P mesh WebRTC
    const createPeerConnection = (targetUserId: string, activeSocket: Socket) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Add local stream tracks if available
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          activeSocket.emit('webrtc_signal', {
            to: targetUserId,
            signal: { candidate: event.candidate }
          });
        }
      };

      // Handle remote streams
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        setRemoteStreams(prev => ({ ...prev, [targetUserId]: remoteStream }));
      };

      return pc;
    };

    newSocket.on('connect', () => {
      setConnStatus('connected');
      toast.success('Connected to watch party!');

      if (partyReadyRef.current && roomId) {
        newSocket.emit('join_room', {
          roomId,
          username,
          userId: userId || generateNewUserId(),
          mediaId: id,
          mediaType: type
        });
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connect_error:', err);
      setConnStatus('disconnected');
      sendPlayerCommand('pause');
      setIsPlaying(false);
      setLocalIsPlaying(false);
      toast.error(`Watch party connection failed: ${err?.message || 'unknown error'}`);
    });

    newSocket.on('connect_timeout', () => {
      console.error('Socket connect_timeout');
      setConnStatus('disconnected');
      sendPlayerCommand('pause');
      setIsPlaying(false);
      setLocalIsPlaying(false);
      toast.error('Watch party connection timed out.');
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
      setConnStatus('disconnected');
      sendPlayerCommand('pause');
      setIsPlaying(false);
      setLocalIsPlaying(false);
      toast.error('Network error occurred. Playback paused.');
    });

    newSocket.on('disconnect', () => {
      setConnStatus('disconnected');
      // Pause video locally when connection drops
      sendPlayerCommand('pause');
      setIsPlaying(false);
      setLocalIsPlaying(false);
      toast.error('Disconnected from watch party. Playback paused.');
    });

    newSocket.on('reconnect', () => {
      setConnStatus('connected');
      toast.success('Reconnected to watch party');
      newSocket.emit('join_room', {
        roomId,
        username,
        userId: userId || generateNewUserId(),
        mediaId: id,
        mediaType: type,
      });
    });

    // Room state on join — guests apply host state once (no drift math)
    newSocket.on('room_state_update', (roomState: PartyRoomState) => {
      setUsers(roomState.users);
      setHostId(roomState.hostId);
      hostIdRef.current = roomState.hostId;

      // Guests apply initial state only after explicit join (no drift math)
      if (newSocket.id !== roomState.hostId && partyReadyRef.current) {
        const pb = roomState.playbackState;
        const elapsed = pb.isPlaying ? (Date.now() - pb.lastUpdateTime) / 1000 : 0;
        const predictedTime = Math.max(0, pb.timestamp + elapsed);
        applyRemoteSync(
          {
            roomId: roomState.roomId,
            type: pb.isPlaying ? 'play' : 'pause',
            currentTime: predictedTime,
            sentAt: pb.lastUpdateTime,
          },
          'room_state_update'
        );
      }
    });

    // New user joined
    newSocket.on('user_joined', (user: PartyUser) => {
      setUsers(prev => ({ ...prev, [user.id]: user }));
      toast.info(`${user.username} joined the party!`);
    });

    newSocket.on('request_host_timeline', ({ roomId: requestRoomId, requesterId }: { roomId: string; requesterId: string }) => {
      if (hostIdRef.current !== newSocket.id) return;
      if (requestRoomId !== roomId) return;

      const timeline: SyncPayload = {
        roomId,
        requesterId,
        type: isPlayingRef.current ? 'play' : 'pause',
        currentTime: Math.max(0, currentProgressRef.current),
        sentAt: Date.now(),
        mediaId: id,
        mediaType: type,
      };

      console.log('HOST TIMELINE RESPONDING', timeline);
      newSocket.emit('host_timeline', timeline);
    });

    newSocket.on('host_timeline', (payload: SyncPayload) => {
      if (payload.requesterId && payload.requesterId !== newSocket.id) return;
      if (newSocket.id === hostIdRef.current) return;
      console.log('HOST TIMELINE RECEIVED', payload);
      applyRemoteSync(payload, 'host_timeline');
    });

    // User left
    newSocket.on('user_left', (userId: string) => {
      setUsers(prev => {
        const next = { ...prev };
        const user = next[userId];
        if (user) {
          toast.info(`${user.username} left the party.`);
          delete next[userId];
        }
        return next;
      });

      // Cleanup WebRTC connection
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    // Host changed
    newSocket.on('host_changed', (newHostId: string) => {
      setHostId(newHostId);
      hostIdRef.current = newHostId;
      setUsers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          next[k].isHost = next[k].id === newHostId;
        });
        return next;
      });
      if (newSocket.id === newHostId) {
        toast.success("You are now the Watch Party Host! You control the playback.");
      } else {
        toast.info("Watch Party Host changed.");
      }
    });

    // Single sync channel — guests receive and apply only (never emit)
    newSocket.on('sync', (data: SyncPayload) => {
      if (newSocket.id === hostIdRef.current) {
        console.log('SYNC IGNORED on host (already applied locally before EMIT)');
        return;
      }
      applyRemoteSync(data, 'sync');
    });

    newSocket.on('sync_state', (data: SyncPayload) => {
      if (newSocket.id === hostIdRef.current) return;
      applyRemoteSync(data, 'sync_state');
    });

    // Receive embedded chat messages
    newSocket.on('new_message', (msg: PartyChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
    });

    // ----------------------------------------------------
    // WebRTC Signaling Receivers & Handlers
    // ----------------------------------------------------
    newSocket.on('user_joined_call', async (userId: string) => {
      // If we are currently in call, initiate peer connection offer to new caller
      if (localStreamRef.current) {
        toast.info("Establishing video link...");
        const pc = createPeerConnection(userId, newSocket);
        peersRef.current[userId] = pc;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          newSocket.emit('webrtc_signal', { to: userId, signal: { sdp: offer } });
        } catch (err) {
          console.error("Failed to create offer:", err);
        }
      }
    });

    newSocket.on('user_left_call', (userId: string) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].close();
        delete peersRef.current[userId];
      }
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    newSocket.on('webrtc_signal', async ({ from, signal }: { from: string, signal: any }) => {
      let pc = peersRef.current[from];

      if (signal.sdp) {
        if (!pc) {
          pc = createPeerConnection(from, newSocket);
          peersRef.current[from] = pc;
        }
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            newSocket.emit('webrtc_signal', { to: from, signal: { sdp: answer } });
          }
        } catch (err) {
          console.error("Error setting signaling description:", err);
        }
      } else if (signal.candidate) {
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.error("Error adding ICE candidate:", err);
          }
        }
      }
    });

    // Heartbeat mechanism to measure latency
    const pingInterval = setInterval(() => {
      const startTime = Date.now();
      newSocket.emit('ping', () => {
        setLatency(Date.now() - startTime);
      });
    }, 5000);

    return () => {
      newSocket.disconnect();
      clearInterval(pingInterval);
    };
  }, [roomId, username, showNameModal, sendPlayerCommand, applyRemoteSync, id, type]);

  useEffect(() => {
    if (!socket || !roomId || !isHost || !partyReady || connStatus !== 'connected') return;

    const syncInterval = setInterval(() => {
      if (!isPlaying) return;
      socket.emit('sync_state', {
        roomId,
        type: 'play',
        currentTime: currentProgressRef.current,
        sentAt: Date.now(),
      });
    }, 3000);

    return () => clearInterval(syncInterval);
  }, [socket, roomId, isHost, partyReady, connStatus, isPlaying]);

  // Autoscroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, sidebarOpen, activeTab]);

  // Setup player event listener for progress & state tracking
  useEffect(() => {
    if (!id) return;

    const cleanup = setupPlayerListener({
      onProgress: (progress, duration, info) => {
        if (isRemoteUpdate.current) return;
        setIsPlaying(true);
        setLocalIsPlaying(true);
        setCurrentProgress(progress);
        setLastProgressUpdate(Date.now());
        setCurrentDuration(duration);
        if (info?.title) setPlayerTitle(info.title);

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
        });
      },
      onPause: (progress) => {
        if (isRemoteUpdate.current) return;
        setIsPlaying(false);
        setLocalIsPlaying(false);
        setCurrentProgress(progress);
        // Host must use control pad / play button to broadcast — no auto-emit (prevents loops)
      },
      onComplete: () => {
        if (type === 'tv' && prefs.autoNextEpisode && seasonNum && episodeNum) {
          const nextEp = episodeNum + 1;
          navigate(`/watch/tv/${id}/${seasonNum}/${nextEp}${roomId ? `?room=${roomId}` : ''}`, { replace: true });
        }
      },
      onSeeked: (progress) => {
        if (isRemoteUpdate.current) return;
        setCurrentProgress(progress);
        // Host must use control pad / seek bar to broadcast — no auto-emit (prevents loops)
      },
    });

    return cleanup;
  }, [id, type, seasonNum, episodeNum, playerTitle, playerPoster, prefs.autoNextEpisode, navigate, roomId]);

  // Auto-hide player controls
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
      resetControlsTimeout();
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Next episode helper
  const playNextEpisode = () => {
    if (type === 'tv' && seasonNum && episodeNum) {
      navigate(`/watch/tv/${id}/${seasonNum}/${episodeNum + 1}${roomId ? `?room=${roomId}` : ''}`, { replace: true });
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

  // ----------------------------------------------------
  // Watch Party Actions
  // ----------------------------------------------------
  const handleCreateParty = () => {
    const randomRoomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const newUrl = `${window.location.pathname}?room=${randomRoomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    setRoomId(randomRoomId);

    if (!username) {
      setShowNameModal(true);
    } else {
      toast.success("Watch Party created!");
    }
  };

  const handleCopyInvite = () => {
    const inviteUrl = window.location.href;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied to clipboard!");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('send_message', { roomId, text: chatInput });
    setChatInput('');
  };

  const handleJoinWatchParty = useCallback(() => {
    if (!username.trim()) {
      toast.error('Enter a username first');
      return;
    }
    const activeUserId = userId || generateNewUserId();
    setHasJoinedParty(true);
    partyReadyRef.current = true;
    // Re-join so server sends room_state_update after sync is unlocked
    if (socket?.connected && roomId) {
      socket.emit('join_room', {
        roomId,
        username,
        userId: activeUserId,
        mediaId: id,
        mediaType: type,
      });
    }
    toast.success('Joined watch party — playback sync is active');
  }, [username, userId, socket, roomId, id, type]);

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    const activeUserId = userId || generateNewUserId();
    try {
      localStorage.setItem('movietime_username', username);
    } catch (err) {
      console.warn('Failed to save username to localStorage', err);
    }
    setShowNameModal(false);
    setHasJoinedParty(true);
    partyReadyRef.current = true;
    if (socket?.connected && roomId) {
      socket.emit('join_room', {
        roomId,
        username,
        userId: activeUserId,
        mediaId: id,
        mediaType: type,
      });
    }
    toast.success(`Welcome, ${username}! Join Watch Party to sync playback.`);
  };

  const generateRandomUsername = () => {
    const list = ['MovieBuff', 'PopcornKing', 'CouchPotato', 'CinemaFan', 'FilmGuru', 'IndieLover', 'SciFiGeek', 'RomComLover'];
    const randomName = `${list[Math.floor(Math.random() * list.length)]}${Math.floor(10 + Math.random() * 90)}`;
    setUsername(randomName);
  };

  return (
    <div className="flex h-[calc(100vh-65px)] w-full bg-black overflow-hidden relative font-sans">

      {/* 1. Main Streaming Side */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-black h-full flex flex-col justify-between"
        onMouseMove={resetControlsTimeout}
        onClick={resetControlsTimeout}
      >
        {/* Video Player Iframe — native embed UI cropped/hidden; custom controls below */}
        <div className="watch-player-embed absolute inset-0 z-0" onMouseMove={resetControlsTimeout} onClick={resetControlsTimeout}>
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="border-0 w-full h-full absolute inset-0"
            sandbox={adBlockEnabled ? "allow-scripts allow-forms allow-presentation allow-pointer-lock" : undefined}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            title={type === 'movie' ? 'Movie Player' : `S${seasonNum}E${episodeNum}`}
            onMouseMove={resetControlsTimeout}
            onClick={resetControlsTimeout}
          />


        </div>

        {/* Top Controls Bar */}
        <div
          className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 to-transparent
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
                <h2 className="text-white text-sm font-semibold flex items-center gap-2">
                  {playerTitle || 'Now Playing'}
                  {roomId && (
                    <span className="px-2 py-0.5 text-[10px] bg-[#E50914] text-white rounded-full font-medium tracking-wide shadow-[0_0_8px_rgba(229,9,20,0.4)] flex items-center gap-1 animate-pulse">
                      <Sparkles className="w-2.5 h-2.5" /> Watch Party
                    </span>
                  )}
                </h2>
                {type === 'tv' && seasonNum && episodeNum && (
                  <p className="text-[#9A9A9A] text-xs">
                    Season {seasonNum} · Episode {episodeNum}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Watch Party Control Button */}
              {!roomId ? (
                <button
                  onClick={handleCreateParty}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#E50914] text-white text-xs font-semibold rounded-lg hover:bg-[#b8070f] transition-all shadow-[0_0_12px_rgba(229,9,20,0.3)] hover:scale-105"
                  title="Start a Watch Party"
                >
                  <Users className="w-4 h-4" />
                  <span>Start Party</span>
                </button>
              ) : (
                <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 p-1">
                  <button
                    onClick={handleCopyInvite}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/15 text-white text-xs rounded-md transition-all border border-white/5"
                    title="Copy Invite Link"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Invite</span>
                  </button>
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-all text-xs font-medium ${sidebarOpen ? 'bg-[#E50914] text-white shadow-[0_0_8px_rgba(229,9,20,0.3)]' : 'bg-white/5 text-white hover:bg-white/15'
                      }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Party Sidebar</span>
                    {activeUserCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-black/30 rounded-full text-[9px] font-bold">
                        {activeUserCount}
                      </span>
                    )}
                  </button>
                </div>
              )}

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
                        className={`w-full px-4 py-2.5 text-xs text-left transition-colors ${currentLang === lang.code ? 'bg-[#E50914]/15 text-white' : 'text-[#9A9A9A] hover:bg-white/5 hover:text-white'
                          }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>



              {/* Ad Blocker Switch */}
              <button
                onClick={toggleAdBlock}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all ${
                  adBlockEnabled 
                    ? 'bg-[#E50914]/20 border-[#E50914]/40 text-[#E50914] hover:bg-[#E50914]/30' 
                    : 'bg-white/10 border-white/10 text-[#9A9A9A] hover:bg-white/20 hover:text-white'
                }`}
                title={adBlockEnabled ? "Disable Ad-Blocker (use if video fails to load)" : "Enable Ad-Blocker"}
              >
                <Shield className={`w-4 h-4 ${adBlockEnabled ? 'fill-[#E50914]/20' : ''}`} />
                <span className="hidden sm:inline">{adBlockEnabled ? "AdBlock: On" : "AdBlock: Off"}</span>
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-white/10 backdrop-blur-md rounded-lg border border-white/10 text-white hover:bg-white/20 transition-all"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Volume Controls */}
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => {
                    const newVol = volume === 0 ? 100 : 0;
                    setVolume(newVol);
                    sendPlayerCommand('volume', newVol / 100);
                  }}
                  className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                  title={volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {volume === 0 ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    sendPlayerCommand('volume', v / 100);
                  }}
                  className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Progress Bar */}
        {currentDuration > 0 && (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent
                       transition-all duration-500 z-10 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
          >
            <div className="px-4 pb-4 pt-8">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={togglePlayPause}
                  disabled={!!roomId && !canHostControl}
                  className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-full text-white transition-colors shrink-0"
                  title={
                    roomId && !isHost
                      ? 'Only the host controls playback'
                      : roomId && !partyReady
                        ? 'Join Watch Party first'
                        : isPlaying
                          ? 'Pause'
                          : 'Play'
                  }
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
                </button>
                {/* Progress bar */}
                <div
                  onClick={handleProgressBarClick}
                  className={`flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden group relative ${canHostControl || !roomId ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                >
                  <div
                    className="h-full bg-[#E50914] rounded-full relative group-hover:h-1.5 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center justify-between text-xs text-[#9A9A9A] pl-11">
                <span>{formatTime(currentProgress)}</span>
                <span>{formatTime(currentDuration)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Realtime Watch Party Sidebar */}
      {roomId && sidebarOpen && !showNameModal && (
        <div className="w-80 border-l border-white/5 bg-[#0a0a0a] flex flex-col h-full z-20 shrink-0 relative">

          {/* Header */}
          <div className="p-4 border-b border-white/5 flex flex-col gap-2 bg-[#0d0d0d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${connStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                    connStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`} />
                <span className="text-white text-sm font-semibold tracking-wide">WATCH PARTY</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-[#9A9A9A] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-white/5 rounded-lg p-2 border border-white/5 text-[11px]">
              <span className="text-[#9A9A9A] font-mono">Room: {roomId}</span>
              <button
                onClick={handleCopyInvite}
                className="text-[#E50914] hover:underline font-medium flex items-center gap-1 ml-2 transition-all hover:brightness-110"
              >
                <Share2 className="w-3.5 h-3.5" /> Copy Link
              </button>
            </div>

            {/* Latency and Status */}
            <div className="flex items-center justify-between text-[10px] text-[#7A7A7A] px-1">
              <span>{isHost ? '👑 Party Host (You)' : '👥 Guest'}</span>
              {connStatus === 'connected' && <span>Ping: {latency}ms</span>}
            </div>

            {connStatus === 'connected' && !partyReady && (
              <button
                type="button"
                onClick={handleJoinWatchParty}
                className="w-full py-2.5 bg-[#E50914] hover:bg-[#b8070f] text-white text-xs font-bold rounded-lg transition-all shadow-[0_4px_12px_rgba(229,9,20,0.3)]"
              >
                Join Watch Party
              </button>
            )}
            {partyReady && (
              <p className="text-[10px] text-emerald-500/90 px-1">Sync active — host controls play / pause / seek</p>
            )}
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-white/5 text-xs bg-[#0b0b0b]">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-center border-b-2 font-medium transition-all ${activeTab === 'chat' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
                }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('call')}
              className={`flex-1 py-3 text-center border-b-2 font-medium transition-all relative ${activeTab === 'call' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
                }`}
            >
              Video Call
              {inVideoCall && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-3 text-center border-b-2 font-medium transition-all ${activeTab === 'users' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
                }`}
            >
              People ({activeUserCount})
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-[#080808]">
            {activeTab === 'chat' ? (
              <div className="flex flex-col gap-3 min-h-full justify-end">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 text-[#5A5A5A] gap-2 my-auto">
                    <MessageSquare className="w-8 h-8 opacity-40" />
                    <p className="text-xs">No messages yet.<br />Say hello to the crew!</p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 text-xs max-w-[85%] ${msg.userId === socket?.id ? 'self-end items-end' : 'self-start items-start'
                        }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-[#7A7A7A]">
                        <span className="font-semibold text-white/80">{msg.username}</span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`p-2.5 rounded-2xl ${msg.userId === socket?.id
                          ? 'bg-[#E50914] text-white rounded-tr-none shadow-[0_2px_8px_rgba(229,9,20,0.25)]'
                          : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5'
                        }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            ) : activeTab === 'call' ? (
              <div className="flex flex-col gap-3 h-full justify-between">
                <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-4">
                  {/* Local Video Feed */}
                  {inVideoCall && localStream && (
                    <VideoFeed
                      stream={localStream}
                      username={username}
                      isLocal={true}
                      muted={true} // Mutled local feed to prevent loops
                      micMuted={isMicMuted}
                      camOff={isCamOff}
                    />
                  )}

                  {/* Remote Video Feeds */}
                  {inVideoCall && Object.entries(remoteStreams).map(([peerId, rStream]) => {
                    const peerUser = users[peerId];
                    return (
                      <VideoFeed
                        key={peerId}
                        stream={rStream}
                        username={peerUser ? peerUser.username : 'Participant'}
                        isLocal={false}
                        muted={false}
                      />
                    );
                  })}

                  {/* Call Waiting screen */}
                  {inVideoCall && Object.keys(remoteStreams).length === 0 && (
                    <div className="p-4 text-center border border-dashed border-white/5 rounded-xl bg-white/[0.01]">
                      <p className="text-[10px] text-[#5A5A5A] animate-pulse">Waiting for friends to join the call...</p>
                    </div>
                  )}

                  {/* Join Call landing page */}
                  {!inVideoCall && (
                    <div className="flex flex-col items-center justify-center text-center py-16 gap-5 h-full my-auto">
                      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white/35 shadow-inner">
                        <Users className="w-7 h-7" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-white text-xs font-semibold">Face-to-Face Video Call</h4>
                        <p className="text-[10px] text-[#7A7A7A] max-w-[200px] leading-relaxed">
                          Talk in real-time, see expressions, and share movie comments live with microphones and webcams!
                        </p>
                      </div>
                      <button
                        onClick={handleJoinCall}
                        className="mt-2 w-full py-2.5 bg-[#E50914] hover:bg-[#b8070f] text-white text-xs font-bold rounded-xl shadow-[0_4px_12px_rgba(229,9,20,0.3)] transition-all hover:scale-103 active:scale-97 flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" fill="currentColor" /> Join Video Call
                      </button>
                    </div>
                  )}
                </div>

                {/* Video Controls Bar */}
                {inVideoCall && (
                  <div className="flex justify-around items-center bg-[#0d0d0d] border border-white/10 rounded-xl p-2 shadow-xl mt-auto z-10 shrink-0">
                    <button
                      onClick={toggleMic}
                      className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${isMicMuted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white/90'
                        }`}
                      title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMicMuted ? <AlertCircle className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={toggleCamera}
                      className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${isCamOff ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white/90'
                        }`}
                      title={isCamOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                      {isCamOff ? <X className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={handleLeaveCall}
                      className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center justify-center hover:scale-105 active:scale-95 shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
                      title="Leave call"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* 👑 Host Control Pad (Only for Host) */}
                {isHost && (
                  <div className="p-3.5 bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl flex flex-col gap-3 shadow-[0_4px_20px_rgba(245,158,11,0.05)]">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs uppercase tracking-wide">
                      <Shield className="w-3.5 h-3.5 animate-pulse" />
                      <span>Host Control Pad</span>
                    </div>

                    <p className="text-[10px] text-[#7A7A7A] leading-relaxed">
                      Use these overrides to directly broadcast playback commands to all guests in the room.
                    </p>

                    {/* Controls Row */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={hostPlay}
                        disabled={!canHostControl}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all hover:scale-102 flex items-center justify-center gap-1"
                        title="Broadcast Play"
                      >
                        <Play className="w-3 h-3" fill="currentColor" /> Play
                      </button>
                      <button
                        type="button"
                        onClick={hostPause}
                        disabled={!canHostControl}
                        className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all hover:scale-102 flex items-center justify-center gap-1"
                        title="Broadcast Pause"
                      >
                        <Pause className="w-3 h-3" fill="currentColor" /> Pause
                      </button>
                    </div>

                    {/* Skip Row */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => hostSkip(-10)}
                        disabled={!canHostControl}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/5 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                        title="Rewind 10s for everyone"
                      >
                        <ArrowLeft className="w-3 h-3" /> -10s
                      </button>
                      <button
                        type="button"
                        onClick={() => hostSkip(10)}
                        disabled={!canHostControl}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/5 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1"
                        title="Fast forward 10s for everyone"
                      >
                        +10s <SkipForward className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Sync Button */}
                    <button
                      type="button"
                      onClick={hostForceSync}
                      disabled={!canHostControl}
                      className="w-full py-1.5 bg-[#E50914] hover:bg-[#b8070f] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all hover:scale-102 shadow-md flex items-center justify-center gap-1"
                      title="Force all guests to your current time and play state"
                    >
                      <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} /> Force Sync Room
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <h4 className="text-[11px] font-semibold text-[#5A5A5A] uppercase tracking-wider mb-2">People Watching</h4>
                  {Object.values(users).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl transition-all hover:bg-white/10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#E50914] to-red-400 flex items-center justify-center text-white font-bold text-sm shadow-[0_2px_8px_rgba(229,9,20,0.3)]">
                          {user.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-white/95 font-medium">{user.username}</span>
                          <span className="text-[9px] text-[#7A7A7A] font-mono">{user.id === socket?.id ? 'You' : 'Participant'}</span>
                        </div>
                      </div>

                      {user.isHost && (
                        <span className="px-2 py-0.5 text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-md font-semibold flex items-center gap-1 shadow-sm">
                          <Shield className="w-2.5 h-2.5" /> Host
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Input for Chat */}
          {activeTab === 'chat' && (
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-[#0a0a0a] flex gap-2">
              <input
                type="text"
                placeholder="Send message..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-[#5A5A5A] focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 bg-[#E50914] hover:bg-[#b8070f] disabled:bg-[#5A5A5A]/30 disabled:text-[#7A7A7A] text-white rounded-lg transition-all shadow-[0_2px_8px_rgba(229,9,20,0.2)] disabled:shadow-none hover:scale-105 active:scale-95 flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      )}

      {/* 3. Username Modal (For joining Watch Parties) */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
          <div className="w-[360px] bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center text-[#E50914] shadow-[0_0_15px_rgba(229,9,20,0.15)]">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-white text-lg font-bold">Join the Watch Party!</h3>
              <p className="text-xs text-[#9A9A9A]">Enter a username to join your friends in this digital movie night.</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Create a nickname..."
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleUsernameSubmit(e as any);
                  }}
                  maxLength={15}
                  required
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#5A5A5A] focus:outline-none focus:border-[#E50914] transition-all"
                />
                <button
                  type="button"
                  onClick={generateRandomUsername}
                  className="px-3 bg-white/10 hover:bg-white/15 border border-white/5 text-xs text-white rounded-lg transition-all flex items-center justify-center gap-1 font-medium"
                  title="Generate Random Name"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Random
                </button>
              </div>

              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNameModal(false);
                    setHasJoinedParty(false);
                    partyReadyRef.current = false;
                    const newUrl = window.location.pathname;
                    window.history.pushState({ path: newUrl }, '', newUrl);
                    setRoomId(null);
                  }}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleUsernameSubmit}
                  disabled={!username.trim()}
                  className="flex-1 py-2.5 bg-[#E50914] hover:bg-[#b8070f] disabled:bg-[#5A5A5A]/30 text-white rounded-lg text-xs font-bold transition-all shadow-[0_4px_12px_rgba(229,9,20,0.3)] hover:scale-102 active:scale-98"
                >
                  Join Watch Party
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}