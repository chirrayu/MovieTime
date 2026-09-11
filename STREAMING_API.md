# MovieTime — Streaming Details API Reference

> **Source:** `https://vidapi.ru` · `https://vaplayer.ru`
> **Code file:** [`fontend/src/app/lib/api.ts`](./fontend/src/app/lib/api.ts)

---

## Overview

MovieTime integrates two VidAPI services alongside TMDB for metadata:

| Service | Base URL | Role |
|---|---|---|
| **VaPlayer** (embed) | `https://vaplayer.ru` | Iframe embed player for movies & TV |
| **VidAPI** (listings) | `https://vidapi.ru` | Paginated JSON content lists |
| **TMDB** | `https://api.themoviedb.org/3` | Metadata, search, details, trailers |

---

## 1. Embed Player — VaPlayer (`vaplayer.ru`)

### Movie Embed

```
GET https://vaplayer.ru/embed/movie/{id}
```

| Parameter | Required | Description |
|---|---|---|
| `id` | Yes | IMDB ID (with `tt` prefix) **or** TMDB ID (numeric only) |

**Examples:**
```
# By IMDB ID
https://vaplayer.ru/embed/movie/tt23779058

# By TMDB ID
https://vaplayer.ru/embed/movie/1147301
```

---

### TV Show Episode Embed

```
GET https://vaplayer.ru/embed/tv/{id}/{season}/{episode}
```

| Parameter | Required | Description |
|---|---|---|
| `id` | Yes | IMDB ID (with `tt` prefix) **or** TMDB ID (numeric only) |
| `season` | Yes | Season number |
| `episode` | Yes | Episode number |

**Examples:**
```
# TMDB numeric
https://vaplayer.ru/embed/tv/205715/1/1

# IMDB SxxExx format
https://vaplayer.ru/embed/tv/tt13159924/S01E01
```

---

### Query Parameters (All Endpoints)

#### UI & Colors

| Parameter | Type | Description |
|---|---|---|
| `primaryColor` | Hex | Primary UI accent color (e.g. `#E50914`) |

#### Title & Display

| Parameter | Type | Description |
|---|---|---|
| `title` | String | Custom title displayed in the player (URL-encoded) |
| `poster` | URL | Custom poster/thumbnail image URL |

#### Playback

| Parameter | Type | Description |
|---|---|---|
| `autoplay` | `1` | Enable autoplay |
| `resumeAt` | Float | Resume from a saved timestamp in seconds |

#### Subtitles

| Parameter | Type | Description |
|---|---|---|
| `sub_url` | URL | URL-encoded remote subtitle file (`.srt` or `.vtt`) |
| `sub_label` | String | Subtitle track label |
| `sub_lang` | String | Subtitle language code (default: `en`) |
| `sub_default` | Boolean | Set subtitle as default track |
| `lang` | String | Default subtitle language for OpenSubtitles auto-search (ISO 639-1 or 3-letter code) |

#### Other

| Parameter | Type | Description |
|---|---|---|
| `controls` | Boolean | Show/hide player control bar |
| `overlay` | Boolean | Show/hide the hover gradient overlay and title area |

**Example with params:**
```
https://vaplayer.ru/embed/movie/tt23779058?primaryColor=%23e50914&title=My%20Movie&lang=en&autoplay=1&resumeAt=300
```

---

### `EmbedOptions` Interface
```ts
interface EmbedOptions {
  resumeAt?:     number;   // seconds — applied as ?resumeAt=
  primaryColor?: string;   // hex string with # (e.g. '#E50914')
  lang?:         string;   // OpenSubtitles language code
  autoplay?:     boolean;
  title?:        string;
  poster?:       string;
  subUrl?:       string;   // URL-encoded remote .srt/.vtt subtitle
  subLabel?:     string;   // subtitle track label
  subLang?:      string;   // subtitle language code
  subDefault?:   boolean;  // set as default subtitle track
  controls?:     boolean;  // show/hide control bar
  overlay?:      boolean;  // show/hide hover overlay
}
```

### Helper Functions
```ts
getMovieEmbedUrl(id: string, options?: EmbedOptions): string
getTVEmbedUrl(id: string, season: number, episode: number, options?: EmbedOptions): string
```

> **ID format:** Movies prefer **IMDB ID** (`tt` prefix); TV shows use **TMDB numeric ID**.  
> Default `primaryColor` is `#E50914` (Netflix red).

---

## 2. Player Events (`postMessage`)

The player sends a single `PLAYER_EVENT` message to the parent window.

### Event Payload
```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "player_info": {
      "imdb": "tt23779058",
      "tmdb": null,
      "mediaType": "movie",
      "season": null,
      "episode": null,
      "title": "My Movie",
      "poster": "https://..."
    },
    "player_status": "playing",
    "player_progress": 125.4,
    "player_duration": 7200,
    "quality": { "label": "1080p", "width": 1920, "height": 1080 },
    "availableQualities": ["1080p", "720p", "480p", "360p"]
  }
}
```

### Player Statuses

| Status | Fired When |
|---|---|
| `playing` | Playback starts/resumes, and every ~5s during playback |
| `paused` | User pauses |
| `completed` | Video reaches end |
| `seeked` | User seeks |

---

## 3. VidAPI — Content Listings (`vidapi.ru`)

All listing endpoints return paginated JSON, **24 results per page**.

### Latest Movies
```
GET https://vidapi.ru/movies/latest/page-{n}.json
```

### Latest TV Shows
```
GET https://vidapi.ru/tvshows/latest/page-{n}.json
```

### Latest Episodes
```
GET https://vidapi.ru/episodes/latest/page-{n}.json
```

### Paginated Response Shape
```ts
interface PaginatedResponse<T> {
  page:        number;
  per_page:    number;   // 24
  total:       number;
  total_pages: number;
  items:       T[];
}
```

**Example item (movie):**
```json
{
  "tmdb_id": "385687",
  "imdb_id": "tt1517268",
  "title": "Fast X",
  "year": "2023",
  "poster_url": "https://image.tmdb.org/t/p/original/...",
  "rating": "7.1",
  "genre": "Action, Crime, Thriller",
  "popularity": "2847.12",
  "type": "movie",
  "embed_url": "https://vaplayer.ru/embed/movie/tt1517268"
}
```

---

## 4. TMDB — Metadata & Search

### API Key (public, embedded in client)
```
15d2ea6d0dc1d476efbca3eba2b9bbfb
```

### Mirror Bases (tried in order, fastest cached in `localStorage`)

| Priority | Base URL |
|---|---|
| 1 | `https://api.themoviedb.org/3` |
| 2 | `https://api.tmdb.org/3` |

> Preference stored under `localStorage` key `movietime_tmdb_mirror`. 6-second timeout per request.

### Endpoints Used

| Method | Endpoint | Description |
|---|---|---|
| GET | `/search/multi?query={q}&page={n}` | Multi-search (movies + TV) |
| GET | `/movie/{tmdb_id}` | Movie details |
| GET | `/tv/{tmdb_id}?append_to_response=external_ids` | TV details + IMDB ID |
| GET | `/{movie\|tv}/{tmdb_id}/videos` | Trailers |
| GET | `/tv/{tmdb_id}/season/{n}` | Season episodes |
| GET | `/trending/{all\|movie\|tv}/{day\|week}` | Trending |
| GET | `/{movie\|tv}/popular?page={n}` | Popular |
| GET | `/{movie\|tv}/top_rated?page={n}` | Top Rated |

### Image CDN

```
https://image.tmdb.org/t/p/{size}{path}
```

| Helper | Default Size | Sizes available |
|---|---|---|
| `tmdbImage(path, size)` | `w500` | any |
| `tmdbBackdrop(path)` | `w1280` | — |
| `tmdbPoster(path, size)` | `w500` | `w200`, `w342`, `w500`, `original` |

---

## 5. Data Types

### `MovieItem`
```ts
interface MovieItem {
  tmdb_id:    string;
  imdb_id:    string;
  title:      string;
  year:       string;
  poster_url: string;
  rating:     string;
  genre:      string;
  popularity: string;
  type:       'movie';
  embed_url:  string;
}
```

### `TVShowItem`
```ts
interface TVShowItem {
  tmdb_id:    string;
  imdb_id:    string;
  title:      string;
  year:       string;
  poster_url: string;
  rating:     string;
  genre:      string;
  popularity: string;
  type:       'tv';
  embed_url:  string;
}
```

### `EpisodeItem`
```ts
interface EpisodeItem {
  show_tmdb_id:   string;
  season_number:  string;
  episode_number: string;
  episode_title:  string;
  air_date:       string;
  show_title:     string;
  show_imdb_id:   string;
  type:           'episode';
  embed_url:      string;
}
```

---

## 6. Player Iframe — Sandbox & Permissions

The embed iframe in [`PlayerPage.tsx`](./fontend/src/app/pages/PlayerPage.tsx) has **no `sandbox` attribute** — VaPlayer explicitly blocks loading inside any sandboxed frame.

```
allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
```

---

## 7. Watch Party Backend

| Environment | URL |
|---|---|
| Local dev | `http://127.0.0.1:3002` |
| Production | `https://movietime-mkwk.onrender.com` |

Can be overridden via `window.__VITE_WS_URL`.

---

## 8. Genre ID Maps

### Movie Genres
| ID | Name | ID | Name | ID | Name | ID | Name |
|---|---|---|---|---|---|---|---|
| 28 | Action | 12 | Adventure | 16 | Animation | 35 | Comedy |
| 80 | Crime | 99 | Documentary | 18 | Drama | 10751 | Family |
| 14 | Fantasy | 36 | History | 27 | Horror | 10402 | Music |
| 9648 | Mystery | 10749 | Romance | 878 | Sci-Fi | 10770 | TV Movie |
| 53 | Thriller | 10752 | War | 37 | Western | | |

### TV Genres
| ID | Name | ID | Name | ID | Name | ID | Name |
|---|---|---|---|---|---|---|---|
| 10759 | Action & Adventure | 16 | Animation | 35 | Comedy | 80 | Crime |
| 99 | Documentary | 18 | Drama | 10751 | Family | 10762 | Kids |
| 9648 | Mystery | 10763 | News | 10764 | Reality | 10765 | Sci-Fi & Fantasy |
| 10766 | Soap | 10767 | Talk | 10768 | War & Politics | 37 | Western |
