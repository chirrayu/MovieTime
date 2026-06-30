import React from 'react';

interface RecommendationFiltersProps {
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
}

export const FILTERS = ['For You', 'New Discoveries', 'Trending', 'Highly Rated'] as const;

export function RecommendationFilters({ activeFilter, setActiveFilter }: RecommendationFiltersProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-6" style={{ scrollbarWidth: 'none' }}>
      {FILTERS.map(f => (
        <button
          key={f}
          onClick={() => setActiveFilter(f)}
          aria-label={`Filter by ${f}`}
          className={`flex-none px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer
            ${activeFilter === f
              ? 'bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.35)]'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
