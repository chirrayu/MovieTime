// ============================
// VidAPI & TMDB API Integration
// ============================

// VidAPI — listing data (JSON catalogs)
const VIDAPI_BASE = 'https://vidapi.ru';
// VidAPI — embed player
const VAPLAYER_BASE = 'https://vaplayer.ru';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// ---- Multi-Source Embed Providers ----

export interface EmbedSource {
  id: string;
  label: string;
  getMovieUrl: (id: string, options?: EmbedOptions) => string;
  getTVUrl: (id: string, season: number, episode: number, options?: EmbedOptions) => string;
}

export interface EmbedOptions {
  resumeAt?: number;
  primaryColor?: string;
  lang?: string;
  autoplay?: boolean;
  title?: string;
  poster?: string;
}

function buildVaPlayerMovieUrl(id: string, opts?: EmbedOptions): string {
  const url = new URL(`${VAPLAYER_BASE}/embed/movie/${id}`);
  url.searchParams.set('primaryColor', (opts?.primaryColor || '#E50914').replace('#', ''));
  if (opts?.lang) url.searchParams.set('lang', opts.lang);
  if (typeof opts?.autoplay === 'boolean') url.searchParams.set('autoplay', opts.autoplay ? '1' : '0');
  if (opts?.resumeAt != null && opts.resumeAt > 0) url.searchParams.set('resumeAt', String(Math.floor(opts.resumeAt)));
  if (opts?.title) url.searchParams.set('title', opts.title);
  if (opts?.poster) url.searchParams.set('poster', opts.poster);
  return url.toString();
}

function buildVaPlayerTVUrl(id: string, season: number, episode: number, opts?: EmbedOptions): string {
  const url = new URL(`${VAPLAYER_BASE}/embed/tv/${id}/${season}/${episode}`);
  url.searchParams.set('primaryColor', (opts?.primaryColor || '#E50914').replace('#', ''));
  if (opts?.lang) url.searchParams.set('lang', opts.lang);
  if (typeof opts?.autoplay === 'boolean') url.searchParams.set('autoplay', opts.autoplay ? '1' : '0');
  if (opts?.resumeAt != null && opts.resumeAt > 0) url.searchParams.set('resumeAt', String(Math.floor(opts.resumeAt)));
  if (opts?.title) url.searchParams.set('title', opts.title);
  if (opts?.poster) url.searchParams.set('poster', opts.poster);
  return url.toString();
}

export const EMBED_SOURCES: EmbedSource[] = [
  {
    id: 'vidsrc',
    label: 'VidSrc (Reliable)',
    getMovieUrl: (id) => `https://vidsrc.in/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidsrc.in/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidapi',
    label: 'VidAPI',
    getMovieUrl: (id, opts) => buildVaPlayerMovieUrl(id, opts),
    getTVUrl: (id, s, e, opts) => buildVaPlayerTVUrl(id, s, e, opts),
  },
];

// Persist user's preferred source across sessions
const SOURCE_PREF_KEY = 'movietime_embed_source';

export function getPreferredSourceId(): string {
  try {
    return localStorage.getItem(SOURCE_PREF_KEY) || EMBED_SOURCES[0].id;
  } catch {
    return EMBED_SOURCES[0].id;
  }
}

export function setPreferredSourceId(id: string): void {
  try {
    localStorage.setItem(SOURCE_PREF_KEY, id);
  } catch {
    // ignore
  }
}

export function getSourceById(id: string): EmbedSource {
  return EMBED_SOURCES.find(s => s.id === id) ?? EMBED_SOURCES[0];
}

const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb'; // Public TMDB API key for full search functionality

// ---- Types ----

export interface MovieItem {
  tmdb_id: string;
  imdb_id: string;
  title: string;
  year: string;
  poster_url: string;
  rating: string;
  genre: string;
  popularity: string;
  type: 'movie';
  embed_url: string;
}

export interface TVShowItem {
  tmdb_id: string;
  imdb_id: string;
  title: string;
  year: string;
  poster_url: string;
  rating: string;
  genre: string;
  popularity: string;
  type: 'tv';
  embed_url: string;
}

export interface EpisodeItem {
  show_tmdb_id: string;
  season_number: string;
  episode_number: string;
  episode_title: string;
  air_date: string;
  show_title: string;
  show_imdb_id: string;
  type: 'episode';
  embed_url: string;
}

export interface PaginatedResponse<T> {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  items: T[];
}

export interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv';
  genre_ids: number[];
}

export interface TMDBMovieDetail {
  id: number;
  imdb_id: string;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date: string;
  runtime: number;
  genres: { id: number; name: string }[];
  tagline: string;
  status: string;
  production_companies: { id: number; name: string; logo_path: string | null }[];
}

export interface TMDBTVDetail {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  tagline: string;
  status: string;
  seasons: TMDBSeason[];
  external_ids?: { imdb_id: string };
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date: string;
  overview: string;
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string;
  runtime: number;
  vote_average: number;
  season_number: number;
}

// ---- TMDB Image Helpers ----

export function tmdbImage(path: string | null, size: string = 'w500'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function tmdbBackdrop(path: string | null): string {
  return tmdbImage(path, 'w1280');
}

export function tmdbPoster(path: string | null, size: 'w200' | 'w342' | 'w500' | 'original' = 'w500'): string {
  return tmdbImage(path, size);
}

// ---- Embed URL Builders ----
// These delegate to the active embed source. Pass sourceId to override per-request.

export function getMovieEmbedUrl(
  id: string,
  options?: EmbedOptions,
  sourceId?: string,
): string {
  const source = getSourceById(sourceId ?? getPreferredSourceId());
  return source.getMovieUrl(id, { primaryColor: '#E50914', ...options });
}

export function getTVEmbedUrl(
  id: string,
  season: number,
  episode: number,
  options?: EmbedOptions,
  sourceId?: string,
): string {
  const source = getSourceById(sourceId ?? getPreferredSourceId());
  return source.getTVUrl(id, season, episode, { primaryColor: '#E50914', ...options });
}

// ---- VidAPI Listing Endpoints ----
// VidAPI listings are the PRIMARY data source — they return ready-made vaplayer.ru embed URLs.
// TMDB is used as an enrichment fallback for search/details only.

export async function fetchLatestMovies(page: number = 1): Promise<PaginatedResponse<MovieItem>> {
  try {
    // VidAPI listing is primary — embed_url already points to vaplayer.ru
    const data = await fetchVidLatestMovies(page);
    // Re-stamp embed URLs through our builder so options (color, etc.) are applied
    data.items = data.items.map(m => ({
      ...m,
      embed_url: getMovieEmbedUrl(m.imdb_id || m.tmdb_id),
    }));
    return data;
  } catch (err) {
    console.warn('VidAPI movie listing failed, trying TMDB popular:', err);
    if (!TMDB_API_KEY) throw err;
    try {
      const data = await getPopular('movie', page);
      const items = data.results.map(r => mapTMDBToItem({ ...r, media_type: 'movie' })).filter(Boolean) as MovieItem[];
      return { page, per_page: 20, total: data.total_results || 10000, total_pages: data.total_pages, items };
    } catch (err2) {
      console.error('Both VidAPI and TMDB failed for movies:', err2);
      return { page, per_page: 20, total: 0, total_pages: 0, items: [] };
    }
  }
}

export async function fetchLatestTVShows(page: number = 1): Promise<PaginatedResponse<TVShowItem>> {
  try {
    const data = await fetchVidLatestTVShows(page);
    // Re-stamp with our TV embed URL builder (season 1, ep 1 default)
    data.items = data.items.map(s => ({
      ...s,
      embed_url: getTVEmbedUrl(s.tmdb_id || s.imdb_id, 1, 1),
    }));
    return data;
  } catch (err) {
    console.warn('VidAPI TV listing failed, trying TMDB popular:', err);
    if (!TMDB_API_KEY) throw err;
    try {
      const data = await getPopular('tv', page);
      const items = data.results.map(r => mapTMDBToItem({ ...r, media_type: 'tv' })).filter(Boolean) as TVShowItem[];
      return { page, per_page: 20, total: data.total_results || 10000, total_pages: data.total_pages, items };
    } catch (err2) {
      console.error('Both VidAPI and TMDB failed for TV shows:', err2);
      return { page, per_page: 20, total: 0, total_pages: 0, items: [] };
    }
  }
}

export async function fetchLatestEpisodes(page: number = 1): Promise<PaginatedResponse<EpisodeItem>> {
  const res = await fetch(`${VIDAPI_BASE}/episodes/latest/page-${page}.json`);
  if (!res.ok) throw new Error(`Failed to fetch episodes: ${res.status}`);
  return res.json();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function fetchVidLatestMovies(page: number = 1): Promise<PaginatedResponse<MovieItem>> {
  return fetchJson(`${VIDAPI_BASE}/movies/latest/page-${page}.json`);
}

async function fetchVidLatestTVShows(page: number = 1): Promise<PaginatedResponse<TVShowItem>> {
  return fetchJson(`${VIDAPI_BASE}/tvshows/latest/page-${page}.json`);
}

// ---- TMDB Search & Details ----

const MIRROR_PREF_KEY = 'movietime_tmdb_mirror';

function getOrderedMirrors(): string[] {
  const defaultBases = [
    'https://api.themoviedb.org/3',
    'https://api.tmdb.org/3',
  ];
  try {
    const preferred = localStorage.getItem(MIRROR_PREF_KEY);
    if (preferred && defaultBases.includes(preferred)) {
      return [preferred, ...defaultBases.filter(b => b !== preferred)];
    }
  } catch {
    // Ignore
  }
  return defaultBases;
}

async function tmdbFetch(path: string, params?: Record<string, string>) {
  let lastError: any = null;
  const bases = getOrderedMirrors();
  for (const base of bases) {
    try {
      const url = new URL(`${base}${path}`);
      url.searchParams.set('api_key', TMDB_API_KEY);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        try {
          localStorage.setItem(MIRROR_PREF_KEY, base);
        } catch {
          // ignore
        }
        return await res.json();
      }
      lastError = new Error(`TMDB Error: ${res.status} on ${base}`);
    } catch (err) {
      lastError = err;
      console.warn(`Failed to fetch TMDB data from ${base}, trying next mirror...`, err);
    }
  }
  throw lastError || new Error('All TMDB API mirrors failed to load.');
}

export async function searchMulti(query: string, page: number = 1): Promise<{
  results: TMDBSearchResult[];
  total_pages: number;
  total_results: number;
}> {
  if (!TMDB_API_KEY) {
    // Fallback: search through VidAPI listings
    return { results: [], total_pages: 0, total_results: 0 };
  }

  try {
    return await tmdbFetch('/search/multi', { query, page: String(page) });
  } catch (err) {
    console.warn('TMDB search failed, returning empty results:', err);
    return { results: [], total_pages: 0, total_results: 0 };
  }
}

export async function getMovieDetails(tmdbId: string): Promise<TMDBMovieDetail> {
  return tmdbFetch(`/movie/${tmdbId}`);
}

export async function getTVDetails(tmdbId: string): Promise<TMDBTVDetail> {
  return tmdbFetch(`/tv/${tmdbId}`, { append_to_response: 'external_ids' });
}

export async function getVideos(
  mediaType: 'movie' | 'tv',
  tmdbId: string,
): Promise<{
  results: { key: string; site: string; type: string; official: boolean }[];
}> {
  if (!TMDB_API_KEY || !tmdbId) {
    return { results: [] };
  }
  return tmdbFetch(`/${mediaType}/${tmdbId}/videos`);
}

export async function getSeasonEpisodes(tmdbId: string, seasonNumber: number): Promise<{
  episodes: TMDBEpisode[];
}> {
  return tmdbFetch(`/tv/${tmdbId}/season/${seasonNumber}`);
}

export async function getTrending(mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week'): Promise<{
  results: TMDBSearchResult[];
}> {
  if (!TMDB_API_KEY) {
    return { results: [] };
  }
  return tmdbFetch(`/trending/${mediaType}/${timeWindow}`);
}

export async function getPopular(mediaType: 'movie' | 'tv', page: number = 1): Promise<{
  results: TMDBSearchResult[];
  total_pages: number;
  total_results?: number;
}> {
  if (!TMDB_API_KEY) {
    return { results: [], total_pages: 0 };
  }
  return tmdbFetch(`/${mediaType}/popular`, { page: String(page) });
}

export async function getTopRated(mediaType: 'movie' | 'tv', page: number = 1): Promise<{
  results: TMDBSearchResult[];
  total_pages: number;
}> {
  if (!TMDB_API_KEY) {
    return { results: [], total_pages: 0 };
  }
  return tmdbFetch(`/${mediaType}/top_rated`, { page: String(page) });
}

// ---- Genre Mapping ----

export const MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

export const TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids',
  9648: 'Mystery', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

export function getGenreNames(genreIds: number[], mediaType: 'movie' | 'tv'): string {
  const map = mediaType === 'movie' ? MOVIE_GENRES : TV_GENRES;
  return genreIds.map(id => map[id]).filter(Boolean).join(', ');
}

// ---- Mapping Helper ----

export function mapTMDBToItem(tmdb: TMDBSearchResult): MovieItem | TVShowItem | null {
  if (tmdb.media_type !== 'movie' && tmdb.media_type !== 'tv') return null;

  const isMovie = tmdb.media_type === 'movie';
  const idStr = String(tmdb.id);
  const title = tmdb.title || tmdb.name || 'Unknown';
  const yearStr = isMovie ? tmdb.release_date : tmdb.first_air_date;
  const year = yearStr ? yearStr.split('-')[0] : '';
  const rating = tmdb.vote_average ? tmdb.vote_average.toFixed(1) : '0';
  const poster_url = tmdbPoster(tmdb.poster_path);
  const genre = tmdb.genre_ids ? getGenreNames(tmdb.genre_ids, tmdb.media_type) : '';

  const extractedImdbId = (tmdb as any).imdb_id || (tmdb as any).external_ids?.imdb_id || '';

  if (isMovie) {
    // Prefer IMDB ID for vaplayer.ru (tt prefix), fall back to TMDB numeric ID
    const embedId = extractedImdbId || idStr;
    return {
      tmdb_id: idStr,
      imdb_id: extractedImdbId,
      title,
      year,
      poster_url,
      rating,
      genre,
      popularity: String(tmdb.vote_average),
      type: 'movie',
      embed_url: getMovieEmbedUrl(embedId),
    } as MovieItem;
  } else {
    // TV shows: use TMDB ID for episode routing
    return {
      tmdb_id: idStr,
      imdb_id: extractedImdbId,
      title,
      year,
      poster_url,
      rating,
      genre,
      popularity: String(tmdb.vote_average),
      type: 'tv',
      embed_url: getTVEmbedUrl(idStr, 1, 1),
    } as TVShowItem;
  }
}