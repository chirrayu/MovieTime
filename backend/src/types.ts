export interface User {
  id: string;
  username: string;
  isHost: boolean;
  avatarUrl?: string;
  isReady?: boolean;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  users: Record<string, User>;
  playbackState: {
    isPlaying: boolean;
    timestamp: number;
    lastUpdateTime: number; // For calculating drift
    playbackRate: number; // Playback speed factor
    mediaId?: string; // e.g. TMDB id
    mediaType?: 'movie' | 'tv';
  };
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}
