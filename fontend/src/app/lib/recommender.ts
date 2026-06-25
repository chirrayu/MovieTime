// ==========================================
// 10-Layer Recommendation & Tracking Engine
// ==========================================

import type { MovieItem, TVShowItem } from './api';

// ------------------------------------------
// Types & Interfaces
// ------------------------------------------

export interface EnrichmentMetadata {
  themes: string[];
  moods: string[];
  pacing: 'slow burn' | 'steady' | 'fast-paced' | 'frantic';
  audience: 'cerebral viewers' | 'thrill-seekers' | 'mainstream' | 'hopeless romantics' | 'family-friendly';
  visual: {
    colorPalette: string;
    brightness: number; // 0 to 1
    cameraMovement: string;
    sceneIntensity: number; // 0 to 1
  };
  audio: {
    musicStyle: string;
    dialogueDensity: number; // 0 to 1
    soundEnergy: number; // 0 to 1
  };
  posters: {
    romance: string;
    action: string;
    mystery: string;
    comedy: string;
    scifi: string;
    horror: string;
    default: string;
  };
}

export interface TasteVector {
  genres: Record<string, number>;
  pacing: Record<string, number>;
  color: Record<string, number>;
  music: Record<string, number>;
  soundEnergy: number;
  brightness: number;
  dialogueDensity: number;
}

export interface UserProfile {
  explicit: {
    favoriteGenres: string[];
    likes: string[];
    dislikes: string[];
    watchlist: string[];
  };
  implicit: {
    watchPercent: Record<string, number>; // itemId -> percentage
    rewatches: Record<string, number>; // itemId -> count
    pauses: Record<string, number>; // itemId -> count
    skips: Record<string, number>; // itemId -> count
    searches: string[];
  };
  tasteVector: TasteVector;
  contextTaste: {
    night: TasteVector;
    lunch: TasteVector;
    weekend: TasteVector;
    mobile: TasteVector;
    tv: TasteVector;
  };
}

export interface RecommenderContext {
  deviceType: 'mobile' | 'desktop' | 'tv';
  timeOfDay: 'morning' | 'lunch' | 'afternoon' | 'night';
  dayOfWeek: number; // 0-6
  weather: 'sunny' | 'rainy' | 'stormy' | 'snowy';
  searchQuery?: string;
}

export interface ScoredRecommendation {
  item: MovieItem | TVShowItem;
  score: number; // Final composite score 0-100
  probabilities: {
    watch: number;
    completion: number;
    like: number;
    rewatch: number;
    retention: number;
    novelty: number;
    diversity: number;
  };
  enrichment: EnrichmentMetadata;
  personalizedPoster: string;
  category: 'Safe Pick' | 'Adjacent Pick' | 'Discovery Pick';
  reasons: string[];
}

export interface RLLogEntry {
  timestamp: number;
  itemId?: string;
  itemTitle?: string;
  action: string;
  description: string;
}

// ------------------------------------------
// Constants & Seed Data
// ------------------------------------------

const DEFAULT_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery',
  'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
];

const PRESET_POSTERS = {
  romance: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=500&auto=format&fit=crop',
  action: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=500&auto=format&fit=crop',
  mystery: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=500&auto=format&fit=crop',
  comedy: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?q=80&w=500&auto=format&fit=crop',
  scifi: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=500&auto=format&fit=crop',
  horror: 'https://images.unsplash.com/photo-1505635552518-3448ff116af3?q=80&w=500&auto=format&fit=crop'
};

const INITIAL_TASTE_VECTOR: TasteVector = {
  genres: {},
  pacing: { 'slow burn': 0.5, 'steady': 0.5, 'fast-paced': 0.5, 'frantic': 0.5 },
  color: { 'Dark Blue': 0.5, 'Warm Amber': 0.5, 'Neon Cyberpunk': 0.5, 'High-Contrast Monochrome': 0.5, 'Saturated Vintage': 0.5, 'Pastel Whimsical': 0.5 },
  music: { 'atmospheric synth': 0.5, 'heavy orchestral': 0.5, 'lo-fi acoustic': 0.5, 'ambient drone': 0.5, 'industrial beats': 0.5, 'jazz / brass': 0.5 },
  soundEnergy: 0.5,
  brightness: 0.5,
  dialogueDensity: 0.5
};

// ------------------------------------------
// Virtual Users for Collaborative Filtering (Layer 4)
// ------------------------------------------

export interface VirtualUser {
  name: string;
  description: string;
  taste: TasteVector;
  preferredGenres: string[];
}

export const VIRTUAL_USERS: VirtualUser[] = [
  {
    name: 'Cerebral Cinephile',
    description: 'Enjoys deep slow-burn narratives, atmospheric scoring, and thought-provoking themes.',
    preferredGenres: ['Drama', 'Sci-Fi', 'Mystery'],
    taste: {
      genres: { 'Drama': 0.9, 'Sci-Fi': 0.8, 'Mystery': 0.8, 'Thriller': 0.5 },
      pacing: { 'slow burn': 0.9, 'steady': 0.6, 'fast-paced': 0.2, 'frantic': 0.1 },
      color: { 'Dark Blue': 0.8, 'High-Contrast Monochrome': 0.9, 'Warm Amber': 0.4 },
      music: { 'atmospheric synth': 0.8, 'ambient drone': 0.9, 'heavy orchestral': 0.5 },
      soundEnergy: 0.3,
      brightness: 0.3,
      dialogueDensity: 0.7
    }
  },
  {
    name: 'Popcorn Action Fan',
    description: 'Loves high-energy, fast-paced action thrillers with kinetic visuals.',
    preferredGenres: ['Action', 'Adventure', 'Thriller', 'Sci-Fi'],
    taste: {
      genres: { 'Action': 0.9, 'Adventure': 0.8, 'Thriller': 0.8, 'Sci-Fi': 0.5 },
      pacing: { 'slow burn': 0.1, 'steady': 0.4, 'fast-paced': 0.9, 'frantic': 0.8 },
      color: { 'Neon Cyberpunk': 0.9, 'Saturated Vintage': 0.5, 'Dark Blue': 0.4 },
      music: { 'industrial beats': 0.9, 'heavy orchestral': 0.8, 'atmospheric synth': 0.4 },
      soundEnergy: 0.9,
      brightness: 0.6,
      dialogueDensity: 0.3
    }
  },
  {
    name: 'Hopeless Romantic',
    description: 'Prefers warm lighting, emotional connections, dialogue-driven dramas and romance.',
    preferredGenres: ['Romance', 'Drama', 'Comedy'],
    taste: {
      genres: { 'Romance': 0.9, 'Drama': 0.7, 'Comedy': 0.6 },
      pacing: { 'slow burn': 0.6, 'steady': 0.8, 'fast-paced': 0.4, 'frantic': 0.2 },
      color: { 'Warm Amber': 0.9, 'Pastel Whimsical': 0.7, 'Saturated Vintage': 0.6 },
      music: { 'lo-fi acoustic': 0.9, 'jazz / brass': 0.7, 'heavy orchestral': 0.4 },
      soundEnergy: 0.4,
      brightness: 0.7,
      dialogueDensity: 0.8
    }
  },
  {
    name: 'Family & Whimsical Watcher',
    description: 'Enjoys bright, uplifting animation, comedy, and family friendly adventure.',
    preferredGenres: ['Family', 'Animation', 'Comedy', 'Fantasy'],
    taste: {
      genres: { 'Family': 0.9, 'Animation': 0.9, 'Comedy': 0.8, 'Fantasy': 0.7 },
      pacing: { 'slow burn': 0.2, 'steady': 0.7, 'fast-paced': 0.7, 'frantic': 0.4 },
      color: { 'Pastel Whimsical': 0.9, 'Warm Amber': 0.6, 'Saturated Vintage': 0.5 },
      music: { 'heavy orchestral': 0.7, 'lo-fi acoustic': 0.6, 'jazz / brass': 0.8 },
      soundEnergy: 0.6,
      brightness: 0.8,
      dialogueDensity: 0.5
    }
  },
  {
    name: 'Obscure Indie Explorer',
    description: 'Searches for low-popularity gems, experimental soundscapes, and highly artistic themes.',
    preferredGenres: ['Documentary', 'Drama', 'Mystery', 'History'],
    taste: {
      genres: { 'Documentary': 0.8, 'Drama': 0.7, 'Mystery': 0.6, 'History': 0.5 },
      pacing: { 'slow burn': 0.8, 'steady': 0.6, 'fast-paced': 0.3, 'frantic': 0.1 },
      color: { 'High-Contrast Monochrome': 0.8, 'Dark Blue': 0.6, 'Saturated Vintage': 0.7 },
      music: { 'ambient drone': 0.9, 'atmospheric synth': 0.7, 'lo-fi acoustic': 0.8 },
      soundEnergy: 0.3,
      brightness: 0.4,
      dialogueDensity: 0.6
    }
  }
];

// ------------------------------------------
// Helpers
// ------------------------------------------

function getDeterministicSeed(title: string, id: string): number {
  const combined = `${title}_${id}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function selectBySeed<T>(list: T[], seedValue: number): T {
  const index = seedValue % list.length;
  return list[index];
}

function getMultipleBySeed<T>(list: T[], seedValue: number, count: number): T[] {
  const results: T[] = [];
  const temp = [...list];
  let currentSeed = seedValue;
  for (let i = 0; i < count && temp.length > 0; i++) {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
    const index = currentSeed % temp.length;
    results.push(temp.splice(index, 1)[0]);
  }
  return results;
}

// ------------------------------------------
// Content Intelligence (Layer 2 & 3)
// ------------------------------------------

export function enrichMovieContent(title: string, id: string, genresString: string): EnrichmentMetadata {
  const seed = getDeterministicSeed(title, id);
  const genres = genresString ? genresString.split(',').map(g => g.trim()) : [];
  
  // Theme definitions mapped to genres
  const themePool: Record<string, string[]> = {
    'Action': ["hero's journey", "rebellion against power", "survival against odds", "vengeance", "justice"],
    'Adventure': ["uncharted horizons", "lost relics", "camaraderie", "self-discovery", "nature vs human"],
    'Animation': ["innocence and growth", "magic in everyday", "friendship bond", "overcoming differences", "limitless imagination"],
    'Comedy': ["absurdity of life", "satire on society", "mistaken identity", "reconciliation", "clashing personalities"],
    'Crime': ["moral ambiguity", "betrayal among thieves", "broken systems", "greed and decay", "obsession with truth"],
    'Documentary': ["untold history", "ecological crisis", "human resilience", "corruption unveiled", "cultural crossroads"],
    'Drama': ["emotional reconciliation", "grief and healing", "identity crisis", "generational trauma", "class divisions"],
    'Family': ["family legacy", "parental devotion", "coming of age", "community triumph", "comforting nostalgia"],
    'Fantasy': ["ancient prophecies", "magic systems", "good vs evil", "parallel realms", "mythological origins"],
    'Horror': ["supernatural curse", "psychological breakdown", "isolation terror", "haunted lineage", "survival instincts"],
    'Mystery': ["conspiracies", "unravelling puzzles", "unreliable narrator", "dark secrets", "double life"],
    'Romance': ["second chances", "star-crossed love", "forbidden attraction", "emotional intimacy", "healing through connection"],
    'Sci-Fi': ["AI ethics", "loneliness in space", "cybernetic dystopia", "evolution of humanity", "parallel realities"],
    'Thriller': ["paranoia", "race against time", "hostage dilemma", "cat and mouse chase", "psychological warfare"]
  };

  let applicableThemes: string[] = [];
  genres.forEach(g => {
    if (themePool[g]) {
      applicableThemes.push(...themePool[g]);
    }
  });

  const universalThemes = ["redemption", "sacrifice", "human connection", "the passage of time", "isolation"];
  if (applicableThemes.length === 0) {
    applicableThemes = universalThemes;
  }

  const selectedThemes = getMultipleBySeed(applicableThemes, seed, 3);
  
  // Moods pool
  const moodPool = ['dark', 'suspenseful', 'cerebral', 'melancholy', 'uplifting', 'intense', 'cozy', 'whimsical', 'atmospheric', 'claustrophobic'];
  const selectedMoods = getMultipleBySeed(moodPool, seed + 1, 2);

  // Pacing
  const pacings: EnrichmentMetadata['pacing'][] = ['slow burn', 'steady', 'fast-paced', 'frantic'];
  let pacing = selectBySeed(pacings, seed + 2);
  // Pacing adjustments based on genre
  if (genres.includes('Action') || genres.includes('Thriller')) {
    pacing = selectBySeed(['fast-paced', 'frantic', 'steady'], seed + 3);
  } else if (genres.includes('Drama') || genres.includes('Documentary')) {
    pacing = selectBySeed(['slow burn', 'steady'], seed + 3);
  }

  // Audience
  const audiences: EnrichmentMetadata['audience'][] = ['cerebral viewers', 'thrill-seekers', 'mainstream', 'hopeless romantics', 'family-friendly'];
  let audience = selectBySeed(audiences, seed + 4);
  if (genres.includes('Romance')) audience = 'hopeless romantics';
  else if (genres.includes('Family') || genres.includes('Animation')) audience = 'family-friendly';
  else if (genres.includes('Sci-Fi') && pacing === 'slow burn') audience = 'cerebral viewers';
  else if (genres.includes('Action') || genres.includes('Thriller')) audience = 'thrill-seekers';

  // Visual Palette
  const colorPalettes = ['Dark Blue', 'Warm Amber', 'Neon Cyberpunk', 'High-Contrast Monochrome', 'Saturated Vintage', 'Pastel Whimsical'];
  let colorPalette = selectBySeed(colorPalettes, seed + 5);
  if (genres.includes('Sci-Fi')) colorPalette = selectBySeed(['Neon Cyberpunk', 'Dark Blue'], seed + 6);
  else if (genres.includes('Romance') || genres.includes('Drama')) colorPalette = 'Warm Amber';
  else if (genres.includes('Horror')) colorPalette = 'Dark Blue';
  else if (genres.includes('Animation')) colorPalette = 'Pastel Whimsical';

  // Brightness
  let brightness = (seed % 100) / 100 * 0.6 + 0.2; // 0.2 to 0.8
  if (colorPalette === 'Dark Blue' || colorPalette === 'High-Contrast Monochrome') {
    brightness = brightness * 0.6; // darker
  } else if (colorPalette === 'Pastel Whimsical') {
    brightness = Math.min(1.0, brightness + 0.2); // brighter
  }

  // Camera Movement
  const cameraMovements = ['deliberate / static', 'kinetic / handheld', 'sweeping / cinematic', 'steady / tracking'];
  let cameraMovement = selectBySeed(cameraMovements, seed + 7);
  if (genres.includes('Action')) cameraMovement = 'kinetic / handheld';

  // Scene Intensity
  let sceneIntensity = (seed % 90 + 10) / 100; // 0.1 to 1.0
  if (genres.includes('Action') || genres.includes('Horror') || genres.includes('Thriller')) {
    sceneIntensity = Math.min(1.0, sceneIntensity + 0.3);
  } else if (genres.includes('Documentary') || genres.includes('Family')) {
    sceneIntensity = Math.max(0.1, sceneIntensity - 0.2);
  }

  // Music Style
  const musicStyles = ['atmospheric synth', 'heavy orchestral', 'lo-fi acoustic', 'ambient drone', 'industrial beats', 'jazz / brass'];
  let musicStyle = selectBySeed(musicStyles, seed + 8);
  if (genres.includes('Sci-Fi')) musicStyle = 'atmospheric synth';
  else if (genres.includes('Horror') || genres.includes('Mystery')) musicStyle = 'ambient drone';
  else if (genres.includes('Action') || genres.includes('Thriller')) musicStyle = 'industrial beats';
  else if (genres.includes('Romance')) musicStyle = 'lo-fi acoustic';

  // Dialogue density
  let dialogueDensity = (seed % 80 + 15) / 100; // 0.15 to 0.95
  if (genres.includes('Action') || genres.includes('Animation')) {
    dialogueDensity = dialogueDensity * 0.7; // lower
  } else if (genres.includes('Drama') || genres.includes('Comedy')) {
    dialogueDensity = Math.min(0.95, dialogueDensity + 0.15); // higher
  }

  // Sound Energy
  let soundEnergy = (seed % 90 + 10) / 100; // 0.1 to 1.0
  if (genres.includes('Action') || genres.includes('Thriller')) {
    soundEnergy = Math.min(1.0, soundEnergy + 0.4);
  } else if (genres.includes('Drama')) {
    soundEnergy = Math.max(0.1, soundEnergy - 0.3);
  }

  return {
    themes: selectedThemes,
    moods: selectedMoods,
    pacing,
    audience,
    visual: {
      colorPalette,
      brightness: parseFloat(brightness.toFixed(2)),
      cameraMovement,
      sceneIntensity: parseFloat(sceneIntensity.toFixed(2))
    },
    audio: {
      musicStyle,
      dialogueDensity: parseFloat(dialogueDensity.toFixed(2)),
      soundEnergy: parseFloat(soundEnergy.toFixed(2))
    },
    posters: PRESET_POSTERS
  };
}

// ------------------------------------------
// User Profiling Engine (Layer 1)
// ------------------------------------------

export function getInitialUserProfile(favoriteGenres: string[] = []): UserProfile {
  const profile: UserProfile = {
    explicit: {
      favoriteGenres,
      likes: [],
      dislikes: [],
      watchlist: []
    },
    implicit: {
      watchPercent: {},
      rewatches: {},
      pauses: {},
      skips: {},
      searches: []
    },
    tasteVector: { ...INITIAL_TASTE_VECTOR, genres: {} },
    contextTaste: {
      night: { ...INITIAL_TASTE_VECTOR, genres: {} },
      lunch: { ...INITIAL_TASTE_VECTOR, genres: {} },
      weekend: { ...INITIAL_TASTE_VECTOR, genres: {} },
      mobile: { ...INITIAL_TASTE_VECTOR, genres: {} },
      tv: { ...INITIAL_TASTE_VECTOR, genres: {} }
    }
  };

  // Seed default genres from favorites
  DEFAULT_GENRES.forEach(genre => {
    profile.tasteVector.genres[genre] = favoriteGenres.includes(genre) ? 0.8 : 0.2;
    // Set for contexts as well
    profile.contextTaste.night.genres[genre] = favoriteGenres.includes(genre) ? 0.8 : 0.2;
    profile.contextTaste.lunch.genres[genre] = favoriteGenres.includes(genre) ? 0.8 : 0.2;
    profile.contextTaste.weekend.genres[genre] = favoriteGenres.includes(genre) ? 0.8 : 0.2;
    profile.contextTaste.mobile.genres[genre] = favoriteGenres.includes(genre) ? 0.8 : 0.2;
    profile.contextTaste.tv.genres[genre] = favoriteGenres.includes(genre) ? 0.8 : 0.2;
  });

  return profile;
}

// Loads profile from localStorage
export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem('movietime_user_profile_10l');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load user profile from storage', err);
  }
  
  // Fallback: build from existing storage keys
  const favsRaw = localStorage.getItem('movietime_fav_genres');
  const favoriteGenres = favsRaw ? JSON.parse(favsRaw) : [];
  return getInitialUserProfile(favoriteGenres);
}

// Saves profile to localStorage
export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem('movietime_user_profile_10l', JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save user profile', err);
  }
}

// ------------------------------------------
// Collaborative Filtering (Layer 4)
// ------------------------------------------

function cosineSimilarity(v1: TasteVector, v2: TasteVector): number {
  let dotProduct = 0;
  let denom1 = 0;
  let denom2 = 0;

  // Compare genres
  const allGenres = Array.from(new Set([...Object.keys(v1.genres), ...Object.keys(v2.genres)]));
  allGenres.forEach(g => {
    const val1 = v1.genres[g] || 0;
    const val2 = v2.genres[g] || 0;
    dotProduct += val1 * val2;
    denom1 += val1 * val1;
    denom2 += val2 * val2;
  });

  // Compare pacing
  const allPacings = ['slow burn', 'steady', 'fast-paced', 'frantic'];
  allPacings.forEach(p => {
    const val1 = v1.pacing[p] || 0;
    const val2 = v2.pacing[p] || 0;
    dotProduct += val1 * val2;
    denom1 += val1 * val1;
    denom2 += val2 * val2;
  });

  // Compare audio-visual scalars
  dotProduct += v1.soundEnergy * v2.soundEnergy;
  dotProduct += v1.brightness * v2.brightness;
  dotProduct += v1.dialogueDensity * v2.dialogueDensity;

  denom1 += (v1.soundEnergy * v1.soundEnergy) + (v1.brightness * v1.brightness) + (v1.dialogueDensity * v1.dialogueDensity);
  denom2 += (v2.soundEnergy * v2.soundEnergy) + (v2.brightness * v2.brightness) + (v2.dialogueDensity * v2.dialogueDensity);

  if (denom1 === 0 || denom2 === 0) return 0;
  return dotProduct / (Math.sqrt(denom1) * Math.sqrt(denom2));
}

export function computeCollaborativeSimilarities(userTaste: TasteVector): { name: string; similarity: number; twin: VirtualUser }[] {
  return VIRTUAL_USERS.map(vUser => {
    const sim = cosineSimilarity(userTaste, vUser.taste);
    return {
      name: vUser.name,
      similarity: parseFloat(sim.toFixed(3)),
      twin: vUser
    };
  }).sort((a, b) => b.similarity - a.similarity);
}

// ------------------------------------------
// Real-Time Interaction Feedback Loop (Layer 10)
// ------------------------------------------

export function logRecommendationAction(
  profile: UserProfile,
  itemId: string,
  itemTitle: string,
  action: 'click' | 'play' | 'pause' | 'skip' | 'complete' | 'like' | 'watchlist_add' | 'search',
  genresString: string,
  duration?: number,
  progress?: number
): { profile: UserProfile; logEntry: RLLogEntry } {
  
  const enrichment = enrichMovieContent(itemTitle, itemId, genresString);
  const genres = genresString ? genresString.split(',').map(g => g.trim()) : [];
  
  // Create transaction entry
  const logEntry: RLLogEntry = {
    timestamp: Date.now(),
    itemId,
    itemTitle,
    action,
    description: ''
  };

  const lr = 0.15; // Learning rate for RL feedback updates

  switch (action) {
    case 'click':
      logEntry.description = `User clicked item detail card. Boosting genre interest.`;
      genres.forEach(g => {
        profile.tasteVector.genres[g] = Math.min(1.0, (profile.tasteVector.genres[g] || 0) + lr * 0.3);
      });
      break;

    case 'play':
      logEntry.description = `Started watching. Adapting active tastes to match pacing: "${enrichment.pacing}" and color: "${enrichment.visual.colorPalette}".`;
      genres.forEach(g => {
        profile.tasteVector.genres[g] = Math.min(1.0, (profile.tasteVector.genres[g] || 0) + lr * 0.5);
      });
      // Pacing reinforcement
      profile.tasteVector.pacing[enrichment.pacing] = Math.min(1.0, (profile.tasteVector.pacing[enrichment.pacing] || 0) + lr * 0.5);
      // AV reinforcements
      profile.tasteVector.soundEnergy = profile.tasteVector.soundEnergy * (1 - lr) + enrichment.audio.soundEnergy * lr;
      profile.tasteVector.brightness = profile.tasteVector.brightness * (1 - lr) + enrichment.visual.brightness * lr;
      profile.tasteVector.dialogueDensity = profile.tasteVector.dialogueDensity * (1 - lr) + enrichment.audio.dialogueDensity * lr;
      break;

    case 'pause':
      profile.implicit.pauses[itemId] = (profile.implicit.pauses[itemId] || 0) + 1;
      logEntry.description = `Playback paused. Pauses count for this title is now ${profile.implicit.pauses[itemId]}.`;
      break;

    case 'skip':
      profile.implicit.skips[itemId] = (profile.implicit.skips[itemId] || 0) + 1;
      logEntry.description = `Playback skipped/forward seeked. Reducing affinity for pacing: "${enrichment.pacing}" and dialogue density: ${enrichment.audio.dialogueDensity}.`;
      // Reduce pacing score
      profile.tasteVector.pacing[enrichment.pacing] = Math.max(0.0, (profile.tasteVector.pacing[enrichment.pacing] || 0) - lr * 0.4);
      profile.tasteVector.dialogueDensity = Math.max(0.0, profile.tasteVector.dialogueDensity * (1 - lr * 0.3));
      break;

    case 'complete':
      profile.implicit.watchPercent[itemId] = 100;
      logEntry.description = `Completed 100% playback. Solidifying preference for themes: [${enrichment.themes.slice(0, 2).join(', ')}] and music: "${enrichment.audio.musicStyle}".`;
      genres.forEach(g => {
        profile.tasteVector.genres[g] = Math.min(1.0, (profile.tasteVector.genres[g] || 0) + lr * 0.8);
      });
      // Solidify pacing
      profile.tasteVector.pacing[enrichment.pacing] = Math.min(1.0, (profile.tasteVector.pacing[enrichment.pacing] || 0) + lr * 0.8);
      break;

    case 'like':
      if (!profile.explicit.likes.includes(itemId)) {
        profile.explicit.likes.push(itemId);
      }
      logEntry.description = `Liked movie explicitly. Strong taste reinforcement across matching genres.`;
      genres.forEach(g => {
        profile.tasteVector.genres[g] = Math.min(1.0, (profile.tasteVector.genres[g] || 0) + lr * 1.2);
      });
      break;

    case 'watchlist_add':
      if (!profile.explicit.watchlist.includes(itemId)) {
        profile.explicit.watchlist.push(itemId);
      }
      logEntry.description = `Added to watchlist. Incremented genre interest coefficients by +0.3.`;
      genres.forEach(g => {
        profile.tasteVector.genres[g] = Math.min(1.0, (profile.tasteVector.genres[g] || 0) + lr * 0.6);
      });
      break;

    case 'search':
      if (!profile.implicit.searches.includes(itemTitle)) {
        profile.implicit.searches.unshift(itemTitle);
        profile.implicit.searches = profile.implicit.searches.slice(0, 10);
      }
      logEntry.description = `Searched for "${itemTitle}". Injecting keyword into active session-based weights.`;
      break;
  }

  // Update Context Taste Vectors as well (so context tastes specialize)
  const hour = new Date().getHours();
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  
  let targetContexts: TasteVector[] = [];
  if (hour >= 18 || hour <= 4) targetContexts.push(profile.contextTaste.night);
  if (hour >= 11 && hour <= 14) targetContexts.push(profile.contextTaste.lunch);
  if (isWeekend) targetContexts.push(profile.contextTaste.weekend);

  targetContexts.forEach(cVec => {
    genres.forEach(g => {
      cVec.genres[g] = Math.min(1.0, (cVec.genres[g] || 0) + lr * 0.5);
    });
    cVec.pacing[enrichment.pacing] = Math.min(1.0, (cVec.pacing[enrichment.pacing] || 0) + lr * 0.5);
  });

  // Save changes
  saveUserProfile(profile);

  // Store RL transaction log
  try {
    const rawLogs = localStorage.getItem('movietime_rl_loop_logs') || '[]';
    const logs: RLLogEntry[] = JSON.parse(rawLogs);
    logs.unshift(logEntry);
    localStorage.setItem('movietime_rl_loop_logs', JSON.stringify(logs.slice(0, 50)));
  } catch (err) {
    console.warn('Failed to save RL logs', err);
  }

  return { profile, logEntry };
}

// ------------------------------------------
// Real-Time Multi-Layer Ranking Algorithm (Layers 5, 8, 9)
// ------------------------------------------

export function scoreRecommendationCandidate(
  item: MovieItem | TVShowItem,
  profile: UserProfile,
  context: RecommenderContext,
  collaborativeTwins: { similarity: number; twin: VirtualUser }[],
  candidatePool: (MovieItem | TVShowItem)[]
): ScoredRecommendation {
  
  const enrichment = enrichMovieContent(item.title, item.tmdb_id || item.imdb_id, item.genre);
  const genres = item.genre ? item.genre.split(',').map(g => g.trim()) : [];
  const itemId = item.tmdb_id || item.imdb_id;
  const reasons: string[] = [];

  // 1. WATCH PROBABILITY (WatchProb) - Layer 8
  // Combines: Explicit favorite genres + Popularity + Active Context multipliers + Session relevance
  let watchProb = 0.2; // Base likelihood

  // Explicit Favorite genre match
  const favMatches = genres.filter(g => profile.explicit.favoriteGenres.includes(g));
  if (favMatches.length > 0) {
    watchProb += 0.25 * (favMatches.length / Math.max(1, profile.explicit.favoriteGenres.length));
  }

  // Taste Vector match
  let tasteMatch = 0;
  genres.forEach(g => {
    tasteMatch += profile.tasteVector.genres[g] || 0.2;
  });
  const avgTasteMatch = genres.length > 0 ? tasteMatch / genres.length : 0.2;
  watchProb += 0.25 * avgTasteMatch;

  // Context awareness scaling (Layer 9)
  let contextBoost = 1.0;
  // Time of Day Context
  if (context.timeOfDay === 'night') {
    // night: Sci-Fi, Horror, Thriller
    if (genres.includes('Sci-Fi') || genres.includes('Horror') || genres.includes('Thriller')) {
      contextBoost += 0.25;
      if (genres.includes('Sci-Fi')) reasons.push("Late-night atmosphere matches Sci-Fi style");
    }
  } else if (context.timeOfDay === 'lunch') {
    // lunch: Comedy, Animation, family (fast/easy watching)
    if (genres.includes('Comedy') || genres.includes('Animation')) {
      contextBoost += 0.25;
      reasons.push("Perfect mid-day short comedy / animation pick");
    }
  }
  // Day of Week Context
  const isWeekend = context.dayOfWeek === 0 || context.dayOfWeek === 6;
  if (isWeekend) {
    if (genres.includes('Action') || genres.includes('Adventure') || genres.includes('Family')) {
      contextBoost += 0.15;
    }
  }
  // Weather Context
  if (context.weather === 'rainy' || context.weather === 'stormy') {
    if (enrichment.moods.includes('dark') || enrichment.moods.includes('suspenseful') || genres.includes('Horror')) {
      contextBoost += 0.2;
      reasons.push("Cozy rainy weather matches moody thriller vibes");
    }
  } else if (context.weather === 'sunny') {
    if (enrichment.moods.includes('uplifting') || genres.includes('Comedy')) {
      contextBoost += 0.15;
    }
  }
  // Device Context
  if (context.deviceType === 'mobile') {
    // Mobile: fast pacing, lower duration
    if (enrichment.pacing === 'fast-paced' || enrichment.pacing === 'frantic') {
      contextBoost += 0.2;
    }
  } else if (context.deviceType === 'tv') {
    // TV: long, slow burn, sweeping cinematic visuals
    if (enrichment.visual.cameraMovement === 'sweeping / cinematic' || enrichment.pacing === 'slow burn') {
      contextBoost += 0.25;
      reasons.push("Sweeping cinematic scope best experienced on TV");
    }
  }

  watchProb = Math.min(1.0, watchProb * contextBoost);

  // Session-Based temporary adjustments (Layer 5)
  // If user searched a matching keyword in this session, boost WatchProb
  if (context.searchQuery) {
    const q = context.searchQuery.toLowerCase();
    const hasSearchMatch = 
      item.title.toLowerCase().includes(q) || 
      item.genre.toLowerCase().includes(q) ||
      enrichment.themes.some(t => t.toLowerCase().includes(q)) ||
      enrichment.moods.some(m => m.toLowerCase().includes(q));
      
    if (hasSearchMatch) {
      watchProb = Math.min(1.0, watchProb + 0.35);
      reasons.push(`Matches active session search "${context.searchQuery}"`);
    }
  } else if (profile.implicit.searches.length > 0) {
    const lastSearch = profile.implicit.searches[0].toLowerCase();
    const matchesLastSearch = 
      item.title.toLowerCase().includes(lastSearch) || 
      item.genre.toLowerCase().includes(lastSearch) ||
      enrichment.themes.some(t => t.toLowerCase().includes(lastSearch));
    if (matchesLastSearch) {
      watchProb = Math.min(1.0, watchProb + 0.15);
      reasons.push(`Aligned with recent search`);
    }
  }


  // 2. COMPLETION PROBABILITY (CompletionProb) - Layer 8
  // Predict finish rate by comparing movie's pacing/length to user's pacing vector and completion history
  let completionProb = 0.5;
  const userPacingAffin = profile.tasteVector.pacing[enrichment.pacing] || 0.5;
  completionProb = 0.6 * userPacingAffin + 0.4 * (1 - enrichment.visual.sceneIntensity * 0.3);

  // Adjust for device constraints
  if (context.deviceType === 'mobile' && enrichment.pacing === 'slow burn') {
    completionProb = Math.max(0.1, completionProb - 0.35); // Hard to finish slow burn on phone
  } else if (context.deviceType === 'tv' && enrichment.pacing === 'slow burn') {
    completionProb = Math.min(1.0, completionProb + 0.2); // Easier on TV
  }


  // 3. LIKE PROBABILITY (LikeProb) - Layer 8
  // Model how likely user is to press like button
  let likeProb = 0.3;
  // If genre contains multiple favorite genres
  if (favMatches.length >= 2) likeProb += 0.3;
  else if (favMatches.length === 1) likeProb += 0.15;
  
  // Match colors/themes
  const colorPref = profile.tasteVector.color[enrichment.visual.colorPalette] || 0.5;
  likeProb += 0.2 * colorPref;
  
  // Explicit like matching
  if (profile.explicit.likes.includes(itemId)) {
    likeProb = 0.95;
  }
  likeProb = Math.min(1.0, likeProb);


  // 4. REWATCH PROBABILITY (RewatchProb) - Layer 8
  let rewatchProb = 0.05; // Base is low for movies
  if (profile.explicit.likes.includes(itemId)) rewatchProb += 0.15;
  if (genres.includes('Comedy') || genres.includes('Family')) {
    rewatchProb += 0.15; // Comedies are rewatched more
  }
  const prevRewatches = profile.implicit.rewatches[itemId] || 0;
  if (prevRewatches > 0) {
    rewatchProb += 0.3 + (prevRewatches * 0.1);
  }
  rewatchProb = Math.min(0.9, rewatchProb);


  // 5. RETENTION IMPACT (RetentionImpact) - Layer 8
  // Boosting premium high-rated movies that make subscribers happy
  let retentionImpact = 0.4;
  const rating = parseFloat(item.rating) || 0.0;
  if (rating > 8.0) retentionImpact = 0.9;
  else if (rating > 7.0) retentionImpact = 0.7;
  else if (rating < 5.0) retentionImpact = 0.2;


  // 6. NOVELTY SCORE (Novelty) - Layer 8
  // High for quality items outside user's standard genre / pacing bubble
  let noveltyScore = 0.5;
  const topGenrePref = Object.entries(profile.tasteVector.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
    
  const hasTopGenres = genres.some(g => topGenrePref.includes(g));
  if (!hasTopGenres) {
    noveltyScore = 0.85; // highly novel
  } else {
    noveltyScore = 0.3; // safe, not novel
  }


  // 7. DIVERSITY SCORE (Diversity) - Layer 8
  // Calculated against candidate pool - boosts items with unique themes / color palettes
  let diversityScore = 0.5;
  // Deterministic calculation based on title to keep it quick
  const uniqChar = new Set(item.title.toLowerCase().split('')).size;
  diversityScore = 0.3 + (uniqChar % 7) * 0.1; // 0.3 to 0.9


  // 8. FINAL SCORE CALCULATOR (Layer 8 Weights)
  // FinalScore = 0.30 * WatchProb + 0.20 * CompletionProb + 0.15 * LikeProb + 0.15 * RetentionImpact + 0.10 * Novelty + 0.10 * Diversity
  const rawScore = (
    0.30 * watchProb +
    0.20 * completionProb +
    0.15 * likeProb +
    0.15 * retentionImpact +
    0.10 * noveltyScore +
    0.10 * diversityScore
  );
  
  // Scale score to 0-100 range
  let finalScore = Math.round(rawScore * 100);

  // Collaborative twin pick bonus (Layer 4)
  if (collaborativeTwins.length > 0) {
    const bestTwin = collaborativeTwins[0];
    const isTwinFavorite = genres.some(g => bestTwin.twin.preferredGenres.includes(g));
    const isTwinPacingMatch = bestTwin.twin.taste.pacing[enrichment.pacing] > 0.7;
    
    if (isTwinFavorite && isTwinPacingMatch && bestTwin.similarity > 0.6) {
      finalScore = Math.min(100, finalScore + Math.round(5 * bestTwin.similarity));
      reasons.push(`Popular among users like you (${bestTwin.name})`);
    }
  }

  // 9. EXPLORATION VS EXPLOITATION ENGINE (Layer 6 Classifier)
  // 70% Safe Picks (likely to be enjoyed), 20% Adjacent Picks (nearby interests), 10% Discovery Picks (unexpected)
  let category: ScoredRecommendation['category'] = 'Safe Pick';
  if (noveltyScore > 0.8) {
    category = 'Discovery Pick';
  } else if (!genres.some(g => profile.explicit.favoriteGenres.includes(g))) {
    category = 'Adjacent Pick';
  }

  // 10. PERSONALIZED ARTWORK SELECTOR (Layer 7)
  // Select different poster based on user's dominant preferences
  let personalizedPoster = item.poster_url;
  
  const romanceAff = profile.tasteVector.genres['Romance'] || 0.2;
  const actionAff = Math.max(profile.tasteVector.genres['Action'] || 0.2, profile.tasteVector.genres['Thriller'] || 0.2);
  const scifiAff = profile.tasteVector.genres['Sci-Fi'] || 0.2;
  const mysteryAff = profile.tasteVector.genres['Mystery'] || 0.2;
  const horrorAff = profile.tasteVector.genres['Horror'] || 0.2;
  const comedyAff = profile.tasteVector.genres['Comedy'] || 0.2;

  const maxAff = Math.max(romanceAff, actionAff, scifiAff, mysteryAff, horrorAff, comedyAff);

  if (maxAff > 0.6) {
    if (maxAff === romanceAff && genres.includes('Romance')) {
      personalizedPoster = PRESET_POSTERS.romance;
      reasons.push("Showing artwork emphasizing romantic scenes");
    } else if (maxAff === actionAff && (genres.includes('Action') || genres.includes('Thriller'))) {
      personalizedPoster = PRESET_POSTERS.action;
      reasons.push("Showing artwork emphasizing high-intensity action");
    } else if (maxAff === mysteryAff && genres.includes('Mystery')) {
      personalizedPoster = PRESET_POSTERS.mystery;
      reasons.push("Showing artwork emphasizing investigative secrets");
    } else if (maxAff === comedyAff && genres.includes('Comedy')) {
      personalizedPoster = PRESET_POSTERS.comedy;
      reasons.push("Showing artwork emphasizing comedic dialogue");
    } else if (maxAff === scifiAff && genres.includes('Sci-Fi')) {
      personalizedPoster = PRESET_POSTERS.scifi;
      reasons.push("Showing artwork emphasizing deep space systems");
    } else if (maxAff === horrorAff && genres.includes('Horror')) {
      personalizedPoster = PRESET_POSTERS.horror;
      reasons.push("Showing artwork emphasizing terrifying moments");
    }
  }

  return {
    item,
    score: finalScore,
    probabilities: {
      watch: parseFloat(watchProb.toFixed(2)),
      completion: parseFloat(completionProb.toFixed(2)),
      like: parseFloat(likeProb.toFixed(2)),
      rewatch: parseFloat(rewatchProb.toFixed(2)),
      retention: parseFloat(retentionImpact.toFixed(2)),
      novelty: parseFloat(noveltyScore.toFixed(2)),
      diversity: parseFloat(diversityScore.toFixed(2))
    },
    enrichment,
    personalizedPoster,
    category,
    reasons: Array.from(new Set(reasons))
  };
}
