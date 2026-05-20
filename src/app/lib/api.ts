// ============================
// VidAPI & TMDB API Integration
// ============================

const VIDAPI_BASE = 'https://vidapi.ru';
const VAPLAYER_BASE = 'https://vaplayer.ru';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

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

export function getMovieEmbedUrl(id: string, options?: {
  resumeAt?: number;
  primaryColor?: string;
  lang?: string;
}): string {
  let url = `${VAPLAYER_BASE}/embed/movie/${id}`;
  const params = new URLSearchParams();
  if (options?.resumeAt) params.set('resumeAt', String(options.resumeAt));
  if (options?.primaryColor) params.set('primaryColor', options.primaryColor);
  if (options?.lang) params.set('lang', options.lang);
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export function getTVEmbedUrl(id: string, season: number, episode: number, options?: {
  resumeAt?: number;
  primaryColor?: string;
  lang?: string;
}): string {
  let url = `${VAPLAYER_BASE}/embed/tv/${id}/${season}/${episode}`;
  const params = new URLSearchParams();
  if (options?.resumeAt) params.set('resumeAt', String(options.resumeAt));
  if (options?.primaryColor) params.set('primaryColor', options.primaryColor);
  if (options?.lang) params.set('lang', options.lang);
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

// ---- VidAPI Listing Endpoints ----

export async function fetchLatestMovies(page: number = 1): Promise<PaginatedResponse<MovieItem>> {
  if (!TMDB_API_KEY) {
    const res = await fetch(`${VIDAPI_BASE}/movies/latest/page-${page}.json`);
    if (!res.ok) throw new Error(`Failed to fetch movies: ${res.status}`);
    return res.json();
  }
  
  // Use TMDB Popular Movies for a better global catalog
  const data = await getPopular('movie', page);
  // mapTMDBToItem requires a TMDBSearchResult with media_type, so we force it for popular results
  const items = data.results.map(r => mapTMDBToItem({ ...r, media_type: 'movie' })).filter(Boolean) as MovieItem[];
  
  return {
    page,
    per_page: 20,
    total: data.total_results || 10000,
    total_pages: data.total_pages,
    items,
  };
}

export async function fetchLatestTVShows(page: number = 1): Promise<PaginatedResponse<TVShowItem>> {
  if (!TMDB_API_KEY) {
    const res = await fetch(`${VIDAPI_BASE}/tvshows/latest/page-${page}.json`);
    if (!res.ok) throw new Error(`Failed to fetch TV shows: ${res.status}`);
    return res.json();
  }

  // Use TMDB Popular TV Shows
  const data = await getPopular('tv', page);
  const items = data.results.map(r => mapTMDBToItem({ ...r, media_type: 'tv' })).filter(Boolean) as TVShowItem[];
  
  return {
    page,
    per_page: 20,
    total: data.total_results || 10000,
    total_pages: data.total_pages,
    items,
  };
}

export async function fetchLatestEpisodes(page: number = 1): Promise<PaginatedResponse<EpisodeItem>> {
  const res = await fetch(`${VIDAPI_BASE}/episodes/latest/page-${page}.json`);
  if (!res.ok) throw new Error(`Failed to fetch episodes: ${res.status}`);
  return res.json();
}

// ---- TMDB Search & Details ----

async function tmdbFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB Error: ${res.status}`);
  return res.json();
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
  return tmdbFetch('/search/multi', { query, page: String(page) });
}

export async function getMovieDetails(tmdbId: string): Promise<TMDBMovieDetail> {
  return tmdbFetch(`/movie/${tmdbId}`);
}

export async function getTVDetails(tmdbId: string): Promise<TMDBTVDetail> {
  return tmdbFetch(`/tv/${tmdbId}`, { append_to_response: 'external_ids' });
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
  
  if (isMovie) {
    return {
      tmdb_id: idStr,
      imdb_id: '', // We don't have IMDB ID from search
      title,
      year,
      poster_url,
      rating,
      genre,
      popularity: String(tmdb.vote_average),
      type: 'movie',
      embed_url: getMovieEmbedUrl(idStr)
    } as MovieItem;
  } else {
    return {
      tmdb_id: idStr,
      imdb_id: '', 
      title,
      year,
      poster_url,
      rating,
      genre,
      popularity: String(tmdb.vote_average),
      type: 'tv',
      embed_url: getTVEmbedUrl(idStr, 1, 1)
    } as TVShowItem;
  }
}

