import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Maximize2, Minimize2, SkipForward, List, Globe, Users, MessageSquare, Send, Share2, Sparkles, AlertCircle, X, Shield, Play, Pause, RefreshCw } from 'lucide-react';
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

// Watch Party Backend URL
const BACKEND_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

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
          className="w-full h-full object-cover rounded-xl"
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
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const prefs = getPreferences();
  const [currentLang, setCurrentLang] = useState(prefs.subtitleLang || 'en');
  const seasonNum = season ? parseInt(season) : undefined;
  const episodeNum = episode ? parseInt(episode) : undefined;

  const [embedUrl, setEmbedUrl] = useState('');

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
  const [showNameModal, setShowNameModal] = useState<boolean>(!username && !!roomId);
  const [latency, setLatency] = useState<number>(0);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync correction states
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(Date.now());
  const lastSeekTimeRef = useRef<number>(0);

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
  // Embed URL setup
  // ----------------------------------------------------
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

  // ----------------------------------------------------
  // Sync URL Room parameter
  // ----------------------------------------------------
  useEffect(() => {
    const handleUrlChange = () => {
      const rId = new URLSearchParams(window.location.search).get('room');
      setRoomId(rId);
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
  const sendPlayerCommand = useCallback((action: 'play' | 'pause' | 'seek', value?: number) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    
    if (action === 'seek') {
      lastSeekTimeRef.current = Date.now();
    }
    
    // Structure 1: PLAYER_COMMAND structure
    iframeRef.current.contentWindow.postMessage({
      type: 'PLAYER_COMMAND',
      data: { action, time: value, value }
    }, '*');

    // Structure 2: Fallback direct commands
    iframeRef.current.contentWindow.postMessage({
      key: 'player_command',
      action,
      value
    }, '*');
  }, []);

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
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
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
      
      // Join Room
      newSocket.emit('join_room', {
        roomId,
        username,
        mediaId: id,
        mediaType: type
      });
    });

    newSocket.on('connect_error', () => {
      setConnStatus('disconnected');
      toast.error('Watch party server connection failed.');
    });

    newSocket.on('disconnect', () => {
      setConnStatus('disconnected');
      toast.error('Disconnected from watch party.');
    });

    // Room state full sync (on join)
    newSocket.on('room_state_update', (roomState: PartyRoomState) => {
      setUsers(roomState.users);
      setHostId(roomState.hostId);
      
      // Synchronize video state for newly joined users
      const pb = roomState.playbackState;
      if (newSocket.id !== roomState.hostId) {
        // Calculate dynamic drift using update time
        const elapsed = (Date.now() - pb.lastUpdateTime) / 1000;
        const targetTime = pb.timestamp + (pb.isPlaying ? elapsed : 0);
        
        // Command play/pause and seek
        if (pb.isPlaying) {
          sendPlayerCommand('play');
        } else {
          sendPlayerCommand('pause');
        }
        sendPlayerCommand('seek', targetTime);
      }
    });

    // New user joined
    newSocket.on('user_joined', (user: PartyUser) => {
      setUsers(prev => ({ ...prev, [user.id]: user }));
      toast.info(`${user.username} joined the party!`);
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

    // Playback state updates (Host authoritative trigger)
    newSocket.on('playback_update', (pb: PlaybackState) => {
      if (newSocket.id === hostIdRef.current) return; // Ignore host's own echo

      if (pb.isPlaying) {
        sendPlayerCommand('play');
      } else {
        sendPlayerCommand('pause');
      }
      sendPlayerCommand('seek', pb.timestamp);
      toast.info(`Playback synced by Host`);
    });

    // Periodic state reconciliation (drift check)
    newSocket.on('sync_update', (pb: PlaybackState) => {
      if (newSocket.id === hostIdRef.current) return;

      // Ignore sync updates if we recently performed a seek to allow player buffering
      if (Date.now() - lastSeekTimeRef.current < 6000) {
        return;
      }

      // Calculate elapsed time since our last local progress event
      const elapsedLocal = (Date.now() - lastProgressUpdateRef.current) / 1000;
      // Account for virtual progress locally since the last player progress update event
      const virtualLocalProgress = currentProgressRef.current + (currentDurationRef.current > 0 && elapsedLocal < 5 ? elapsedLocal : 0);

      // Soft self-correction of drift instead of hard jumping
      const elapsedHost = (Date.now() - pb.lastUpdateTime) / 1000;
      const targetTime = pb.timestamp + (pb.isPlaying ? elapsedHost : 0);
      const drift = Math.abs(virtualLocalProgress - targetTime);

      if (drift > 5) {
        console.log(`Self-correcting drift: ${drift.toFixed(2)}s`);
        sendPlayerCommand('seek', targetTime);
        if (pb.isPlaying) {
          sendPlayerCommand('play');
        } else {
          sendPlayerCommand('pause');
        }
      }
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
  }, [roomId, username, showNameModal, sendPlayerCommand, id, type]);

  // Autoscroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, sidebarOpen, activeTab]);

  // ----------------------------------------------------
  // Host Periodic Sync Emits
  // ----------------------------------------------------
  useEffect(() => {
    if (!socket || !isHost || connStatus !== 'connected') return;

    const syncInterval = setInterval(() => {
      socket.emit('sync_state', {
        roomId,
        timestamp: currentProgress,
        isPlaying: currentDuration > 0 && currentProgress < currentDuration
      });
    }, 3000);

    return () => clearInterval(syncInterval);
  }, [socket, isHost, currentProgress, currentDuration, roomId, connStatus]);

  // ----------------------------------------------------
  // Setup player event listener for progress & state tracking
  // ----------------------------------------------------
  useEffect(() => {
    if (!id) return;

    const cleanup = setupPlayerListener({
      onProgress: (progress, duration, info) => {
        setCurrentProgress(progress);
        setLastProgressUpdate(Date.now());
        setCurrentDuration(duration);
        if (info?.title) setPlayerTitle(info.title);

        // Save progress to local storage
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
      onPause: (progress, info) => {
        setCurrentProgress(progress);
        
        // If Host pauses, propagate
        if (socket && isHost) {
          socket.emit('playback_action', {
            roomId,
            action: 'pause',
            timestamp: progress
          });
        }
      },
      onComplete: (info) => {
        if (type === 'tv' && prefs.autoNextEpisode && seasonNum && episodeNum) {
          const nextEp = episodeNum + 1;
          navigate(`/watch/tv/${id}/${seasonNum}/${nextEp}${roomId ? `?room=${roomId}` : ''}`, { replace: true });
        }
      },
      onSeeked: (progress) => {
        setCurrentProgress(progress);
        
        // If Host seeks, propagate
        if (socket && isHost) {
          socket.emit('playback_action', {
            roomId,
            action: 'seek',
            timestamp: progress
          });
        }
      },
    });

    return cleanup;
  }, [id, type, seasonNum, episodeNum, playerTitle, currentDuration, prefs.autoNextEpisode, navigate, socket, isHost, roomId]);

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

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    localStorage.setItem('movietime_username', username);
    setShowNameModal(false);
    toast.success(`Welcome, ${username}! Joining Watch Party...`);
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
        {/* Video Player Iframe */}
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="w-full h-full border-0 absolute inset-0 z-0"
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-forms"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          title={type === 'movie' ? 'Movie Player' : `S${seasonNum}E${episodeNum}`}
        />

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
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-all text-xs font-medium ${
                      sidebarOpen ? 'bg-[#E50914] text-white shadow-[0_0_8px_rgba(229,9,20,0.3)]' : 'bg-white/5 text-white hover:bg-white/15'
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
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent
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

      {/* 2. Realtime Watch Party Sidebar */}
      {roomId && sidebarOpen && !showNameModal && (
        <div className="w-80 border-l border-white/5 bg-[#0a0a0a] flex flex-col h-full z-20 shrink-0 relative">
          
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex flex-col gap-2 bg-[#0d0d0d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  connStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
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
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-white/5 text-xs bg-[#0b0b0b]">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 text-center border-b-2 font-medium transition-all ${
                activeTab === 'chat' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('call')}
              className={`flex-1 py-3 text-center border-b-2 font-medium transition-all relative ${
                activeTab === 'call' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
              }`}
            >
              Video Call
              {inVideoCall && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-3 text-center border-b-2 font-medium transition-all ${
                activeTab === 'users' ? 'border-[#E50914] text-white bg-white/5' : 'border-transparent text-[#9A9A9A] hover:text-white'
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
                      className={`flex flex-col gap-1 text-xs max-w-[85%] ${
                        msg.userId === socket?.id ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-[#7A7A7A]">
                        <span className="font-semibold text-white/80">{msg.username}</span>
                        <span>•</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`p-2.5 rounded-2xl ${
                        msg.userId === socket?.id 
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
                      className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
                        isMicMuted ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white/90'
                      }`}
                      title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMicMuted ? <AlertCircle className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </button>
                    
                    <button
                      onClick={toggleCamera}
                      className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
                        isCamOff ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-white/5 hover:bg-white/10 text-white/90'
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

            <form onSubmit={handleUsernameSubmit} className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Create a nickname..."
                  value={username}
                  onChange={e => setUsername(e.target.value)}
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
                    // Remove room query parameter to return to normal mode safely
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
                  disabled={!username.trim()}
                  className="flex-1 py-2.5 bg-[#E50914] hover:bg-[#b8070f] disabled:bg-[#5A5A5A]/30 text-white rounded-lg text-xs font-bold transition-all shadow-[0_4px_12px_rgba(229,9,20,0.3)] hover:scale-102 active:scale-98"
                >
                  Join Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
