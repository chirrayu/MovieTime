import { useState, useEffect, useCallback } from 'react';
import { getHistory, getAllWatchProgress } from '../lib/storage';
import { fetchLatestMovies, fetchLatestTVShows, getTrending, mapTMDBToItem } from '../lib/api';
import type { MovieItem, TVShowItem } from '../lib/api';
import {
  loadUserProfile,
  computeCollaborativeSimilarities,
  scoreRecommendationCandidate,
  type UserProfile,
  type RecommenderContext,
  type ScoredRecommendation,
} from '../lib/recommender';

export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<ScoredRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hour = new Date().getHours();
      let timeOfDay: RecommenderContext['timeOfDay'] = 'night';
      if (hour > 5 && hour < 11) timeOfDay = 'morning';
      else if (hour >= 11 && hour < 14) timeOfDay = 'lunch';
      else if (hour >= 14 && hour < 18) timeOfDay = 'afternoon';

      const context: RecommenderContext = {
        deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
        timeOfDay,
        dayOfWeek: new Date().getDay(),
        weather: 'sunny',
      };

      const profile: UserProfile = loadUserProfile();

      const [vid1Movies, vid2Movies, vid1TV, vid2TV, trending] = await Promise.all([
        fetchLatestMovies(1).catch(() => ({ items: [] })),
        fetchLatestMovies(2).catch(() => ({ items: [] })),
        fetchLatestTVShows(1).catch(() => ({ items: [] })),
        fetchLatestTVShows(2).catch(() => ({ items: [] })),
        getTrending('all', 'week').catch(() => ({ results: [] })),
      ]);

      const raw: (MovieItem | TVShowItem)[] = [
        ...vid1Movies.items,
        ...vid2Movies.items,
        ...vid1TV.items,
        ...vid2TV.items,
        ...trending.results
          .map(r => mapTMDBToItem(r))
          .filter(Boolean) as (MovieItem | TVShowItem)[],
      ].filter(item => !!item.poster_url);

      const seen = new Set<string>();
      const pool: (MovieItem | TVShowItem)[] = [];
      for (const item of raw) {
        const id = item.tmdb_id || item.imdb_id;
        if (id && !seen.has(id)) {
          seen.add(id);
          pool.push(item);
        }
      }

      if (pool.length === 0) {
        throw new Error('No recommendations could be generated. Please check your connection.');
      }

      const history = getHistory();
      const progress = getAllWatchProgress();
      const twins = computeCollaborativeSimilarities(profile.tasteVector)
        .map(s => ({ similarity: s.similarity, twin: s.twin }));

      const scored = pool
        .map(item => {
          const id = item.tmdb_id || item.imdb_id;
          const p = progress[id];
          if (p && p.duration > 0 && (p.progress / p.duration) > 0.9) return null;
          if (history.some(h => h.id === id)) return null;
          return scoreRecommendationCandidate(item, profile, context, twins, pool);
        })
        .filter((r): r is ScoredRecommendation => r !== null)
        .sort((a, b) => b.score - a.score);

      setRecommendations(scored);
    } catch (err: any) {
      console.error('Failed to load recommendations:', err);
      setError(err || new Error('Failed to load recommendations'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return { recommendations, loading, error, retry: fetchRecommendations };
}
