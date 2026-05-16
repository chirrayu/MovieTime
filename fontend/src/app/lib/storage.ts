// ============================
// Local Storage Manager
// ============================
// All persistent state is stored in localStorage so it works on Vercel (no backend needed)

const STORAGE_KEYS = {
  WATCH_PROGRESS: 'movietime_watch_progress',
  WATCHLIST: 'movietime_watchlist',
  WATCH_HISTORY: 'movietime_watch_history',
  PREFERENCES: 'movietime_preferences',
} as const;

// ---- Watch Progress (Resume Playback) ----

export interface WatchProgress {
  id: string; // imdb_id or tmdb_id
  type: 'movie' | 'tv';
  title: string;
  poster: string;
  progress: number; // seconds
  duration: number; // total seconds
  timestamp: number; // Date.now() when saved
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

export function saveWatchProgress(entry: WatchProgress): void {
  const key = getProgressKey(entry);
  const all = getAllWatchProgress();
  all[key] = { ...entry, timestamp: Date.now() };
  localStorage.setItem(STORAGE_KEYS.WATCH_PROGRESS, JSON.stringify(all));
}

export function getWatchProgress(id: string, season?: number, episode?: number): WatchProgress | null {
  const all = getAllWatchProgress();
  const key = season != null && episode != null ? `${id}_s${season}e${episode}` : id;
  return all[key] || null;
}

export function getAllWatchProgress(): Record<string, WatchProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCH_PROGRESS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getContinueWatching(): WatchProgress[] {
  const all = getAllWatchProgress();
  return Object.values(all)
    .filter(p => {
      // Only show items not finished (less than 95% watched)
      const percent = p.duration > 0 ? (p.progress / p.duration) * 100 : 0;
      return percent < 95 && percent > 2;
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
}

export function removeWatchProgress(id: string, season?: number, episode?: number): void {
  const all = getAllWatchProgress();
  const key = season != null && episode != null ? `${id}_s${season}e${episode}` : id;
  delete all[key];
  localStorage.setItem(STORAGE_KEYS.WATCH_PROGRESS, JSON.stringify(all));
}

function getProgressKey(entry: WatchProgress): string {
  if (entry.type === 'tv' && entry.season != null && entry.episode != null) {
    return `${entry.id}_s${entry.season}e${entry.episode}`;
  }
  return entry.id;
}

// ---- Watchlist (Bookmarks) ----

export interface WatchlistItem {
  id: string;
  tmdb_id: string;
  imdb_id: string;
  title: string;
  poster: string;
  type: 'movie' | 'tv';
  year: string;
  rating: string;
  genre: string;
  addedAt: number;
}

export function addToWatchlist(item: WatchlistItem): void {
  const list = getWatchlist();
  if (!list.find(i => i.id === item.id)) {
    list.unshift({ ...item, addedAt: Date.now() });
    localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(list));
  }
}

export function removeFromWatchlist(id: string): void {
  const list = getWatchlist().filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(list));
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().some(i => i.id === id);
}

export function getWatchlist(): WatchlistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---- Watch History ----

export interface HistoryItem {
  id: string;
  tmdb_id: string;
  imdb_id: string;
  title: string;
  poster: string;
  type: 'movie' | 'tv';
  watchedAt: number;
  season?: number;
  episode?: number;
}

export function addToHistory(item: HistoryItem): void {
  let history = getHistory();
  // Remove duplicate if exists
  history = history.filter(h => {
    if (h.id !== item.id) return true;
    if (item.type === 'tv') {
      return h.season !== item.season || h.episode !== item.episode;
    }
    return false;
  });
  history.unshift({ ...item, watchedAt: Date.now() });
  // Keep only last 100
  history = history.slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, JSON.stringify(history));
}

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCH_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, JSON.stringify([]));
}

// ---- User Preferences ----

export interface UserPreferences {
  subtitleLang: string;
  playerColor: string;
  autoPlay: boolean;
  autoNextEpisode: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  subtitleLang: 'en',
  playerColor: '#E50914',
  autoPlay: true,
  autoNextEpisode: true,
};

export function getPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): void {
  const current = getPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
}

// ---- Player Event Listener ----
// Sets up the postMessage listener for the VidAPI player iframe

export function setupPlayerListener(callbacks: {
  onProgress?: (progress: number, duration: number, info: any) => void;
  onPause?: (progress: number, info: any) => void;
  onComplete?: (info: any) => void;
  onSeeked?: (progress: number, info: any) => void;
}): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type !== 'PLAYER_EVENT') return;
    
    const { player_info, player_status, player_progress, player_duration } = event.data.data;

    switch (player_status) {
      case 'playing':
        callbacks.onProgress?.(player_progress, player_duration, player_info);
        break;
      case 'paused':
        callbacks.onPause?.(player_progress, player_info);
        break;
      case 'completed':
        callbacks.onComplete?.(player_info);
        break;
      case 'seeked':
        callbacks.onSeeked?.(player_progress, player_info);
        break;
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
