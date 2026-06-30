import React from 'react';
import { MovieCard } from '../MovieCard';
import type { ScoredRecommendation } from '../../lib/recommender';

const MAX_GRID_ITEMS = 40;

interface RecommendationGridProps {
  activeFilter: string;
  gridRecs: ScoredRecommendation[];
  loading: boolean;
  onCardClick: (movie: any) => void;
}

export function RecommendationGrid({
  activeFilter,
  gridRecs,
  loading,
  onCardClick,
}: RecommendationGridProps) {
  const visibleRecs = gridRecs.slice(0, MAX_GRID_ITEMS);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-6">
        <h2 className="text-xl text-white font-medium">
          🍿 {activeFilter === 'For You' ? 'Your Full Feed' : activeFilter}
        </h2>
        <span className="text-xs text-[#666] uppercase tracking-wider">
          {loading ? '—' : `${visibleRecs.length} titles`}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
              <div className="mt-2 h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="mt-1 h-3 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 px-6">
          {visibleRecs.map((rec, idx) => (
            <MovieCard
              key={`${rec.item.tmdb_id || rec.item.imdb_id}-${idx}`}
              tmdb_id={rec.item.tmdb_id}
              imdb_id={rec.item.imdb_id}
              title={rec.item.title}
              year={rec.item.year}
              rating={rec.item.rating}
              poster_url={rec.item.poster_url}
              genre={rec.item.genre}
              type={rec.item.type}
              personalizedPoster={rec.personalizedPoster}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
