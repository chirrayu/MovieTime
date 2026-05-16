// ============================
// Session Storage-Based Data Cache
// ============================
// Caches items fetched from VidAPI in sessionStorage so detail pages can find them
// instantly without re-fetching. Survives client-side navigation unlike in-memory Map.

import type { MovieItem, TVShowItem } from './api';

type CacheItem = MovieItem | TVShowItem;

const CACHE_KEY = 'movietime_item_cache';

function getCache(): Record<string, CacheItem> {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, CacheItem>): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // sessionStorage full or unavailable, silently fail
  }
}

export function cacheItems(items: CacheItem[]): void {
  const cache = getCache();
  for (const item of items) {
    if (item.tmdb_id) cache[item.tmdb_id] = item;
    if (item.imdb_id) cache[item.imdb_id] = item;
  }
  setCache(cache);
}

export function getCachedItem(id: string): CacheItem | undefined {
  const cache = getCache();
  return cache[id];
}

export function getAllCachedItems(): CacheItem[] {
  const cache = getCache();
  // De-duplicate by tmdb_id
  const seen = new Set<string>();
  const result: CacheItem[] = [];
  for (const item of Object.values(cache)) {
    const key = item.tmdb_id || item.imdb_id;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
