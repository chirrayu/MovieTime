// ============================
// Cookie and Local Storage Manager
// ============================

// Helper functions for Cookies
function setCookie(name: string, value: string, days = 365): void {
  try {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Lax";
  } catch (e) {
    console.error('Failed to set cookie', e);
  }
}

function getCookie(name: string): string | null {
  try {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length));
      }
    }
  } catch (e) {
    console.error('Failed to get cookie', e);
  }
  return null;
}

const STORAGE_KEYS = {
  WATCH_PROGRESS: 'movietime_watch_progress',
  WATCHLIST: 'movietime_watchlist',
  WATCH_HISTORY: 'movietime_watch_history',
  WATCH_LIKES: 'movietime_watch_likes',
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
  const serialized = JSON.stringify(all);
  
  // Save to localStorage
  localStorage.setItem(STORAGE_KEYS.WATCH_PROGRESS, serialized);
  // Save to Cookie
  setCookie(STORAGE_KEYS.WATCH_PROGRESS, serialized);
}

export function getWatchProgress(id: string, season?: number, episode?: number): WatchProgress | null {
  const all = getAllWatchProgress();
  const key = season != null && episode != null ? `${id}_s${season}e${episode}` : id;
  return all[key] || null;
}

export function getAllWatchProgress(): Record<string, WatchProgress> {
  try {
    // Attempt to load from Cookie first, fallback to localStorage
    const cookieRaw = getCookie(STORAGE_KEYS.WATCH_PROGRESS);
    if (cookieRaw) {
      return JSON.parse(cookieRaw);
    }
    const raw = localStorage.getItem(STORAGE_KEYS.WATCH_PROGRESS);
    const parsed = raw ? JSON.parse(raw) : {};
    // Keep them synced if local storage has data but cookie didn't
    if (raw) {
      setCookie(STORAGE_KEYS.WATCH_PROGRESS, raw);
    }
    return parsed;
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
  const serialized = JSON.stringify(all);
  localStorage.setItem(STORAGE_KEYS.WATCH_PROGRESS, serialized);
  setCookie(STORAGE_KEYS.WATCH_PROGRESS, serialized);
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

export interface LikedItem {
  id: string;
  addedAt: number;
}

export function addToWatchlist(item: WatchlistItem): void {
  const list = getWatchlist();
  if (!list.find(i => i.id === item.id)) {
    list.unshift({ ...item, addedAt: Date.now() });
    const serialized = JSON.stringify(list);
    localStorage.setItem(STORAGE_KEYS.WATCHLIST, serialized);
    setCookie(STORAGE_KEYS.WATCHLIST, serialized);
  }
}

export function removeFromWatchlist(id: string): void {
  const list = getWatchlist().filter(i => i.id !== id);
  const serialized = JSON.stringify(list);
  localStorage.setItem(STORAGE_KEYS.WATCHLIST, serialized);
  setCookie(STORAGE_KEYS.WATCHLIST, serialized);
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().some(i => i.id === id);
}

export function getWatchlist(): WatchlistItem[] {
  try {
    // Attempt to load from Cookie first, fallback to localStorage
    const cookieRaw = getCookie(STORAGE_KEYS.WATCHLIST);
    if (cookieRaw) {
      return JSON.parse(cookieRaw);
    }
    const raw = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
    const parsed = raw ? JSON.parse(raw) : [];
    if (raw) {
      setCookie(STORAGE_KEYS.WATCHLIST, raw);
    }
    return parsed;
  } catch {
    return [];
  }
}

export function getLikedItems(): LikedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WATCH_LIKES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isLiked(id: string): boolean {
  return getLikedItems().some(item => item.id === id);
}

export function addLiked(id: string): void {
  const list = getLikedItems();
  if (!list.some(item => item.id === id)) {
    list.unshift({ id, addedAt: Date.now() });
    localStorage.setItem(STORAGE_KEYS.WATCH_LIKES, JSON.stringify(list));
  }
}

export function removeLiked(id: string): void {
  const list = getLikedItems().filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.WATCH_LIKES, JSON.stringify(list));
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
  const serialized = JSON.stringify(history);
  localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, serialized);
  setCookie(STORAGE_KEYS.WATCH_HISTORY, serialized);
}

export function getHistory(): HistoryItem[] {
  try {
    const cookieRaw = getCookie(STORAGE_KEYS.WATCH_HISTORY);
    if (cookieRaw) {
      return JSON.parse(cookieRaw);
    }
    const raw = localStorage.getItem(STORAGE_KEYS.WATCH_HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (raw) {
      setCookie(STORAGE_KEYS.WATCH_HISTORY, raw);
    }
    return parsed;
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  const serialized = JSON.stringify([]);
  localStorage.setItem(STORAGE_KEYS.WATCH_HISTORY, serialized);
  setCookie(STORAGE_KEYS.WATCH_HISTORY, serialized);
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
    const cookieRaw = getCookie(STORAGE_KEYS.PREFERENCES);
    if (cookieRaw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(cookieRaw) };
    }
    const raw = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    const parsed = raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
    if (raw) {
      setCookie(STORAGE_KEYS.PREFERENCES, raw);
    }
    return parsed;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): void {
  const current = getPreferences();
  const updated = { ...current, ...prefs };
  const serialized = JSON.stringify(updated);
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, serialized);
  setCookie(STORAGE_KEYS.PREFERENCES, serialized);
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
