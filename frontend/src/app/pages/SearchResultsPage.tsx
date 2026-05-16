import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { MovieCard } from '../components/MovieCard';
import { searchMulti, mapTMDBToItem } from '../lib/api';
import type { MovieItem, TVShowItem } from '../lib/api';
import { cacheItems } from '../lib/cache';
import { Search } from 'lucide-react';

export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<(MovieItem | TVShowItem)[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    async function search() {
      setLoading(true);
      try {
        // Search through TMDB
        const res = await searchMulti(query.trim(), 1);
        const mappedResults = res.results
          .map(mapTMDBToItem)
          .filter((item): item is MovieItem | TVShowItem => item !== null);
          
        cacheItems(mappedResults);
        setResults(mappedResults);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }

    search();
  }, [query]);

  const filtered = filter === 'all' ? results : results.filter(r => r.type === filter);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Search Results</h1>
          <p className="text-[#9A9A9A] text-sm">
            {loading ? 'Searching...' : `${filtered.length} results for "${query}"`}
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'movie', 'tv'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                filter === f
                  ? 'bg-[#E50914] text-white shadow-[0_0_15px_rgba(229,9,20,0.3)]'
                  : 'bg-white/5 text-[#9A9A9A] hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              {f === 'all' ? 'All' : f === 'movie' ? 'Movies' : 'TV Shows'}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
              <div className="mt-2 h-4 bg-white/5 rounded animate-pulse w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Search className="w-10 h-10 text-[#333]" />
          </div>
          <h2 className="text-xl text-white">No results found</h2>
          <p className="text-[#9A9A9A] text-sm text-center max-w-md">
            Try a different search term or browse our catalog.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filtered.map((item, idx) => (
            <MovieCard
              key={`${item.type}-${item.tmdb_id}-${idx}`}
              tmdb_id={item.tmdb_id}
              imdb_id={item.imdb_id}
              title={item.title}
              year={item.year}
              rating={item.rating}
              poster_url={item.poster_url}
              genre={item.genre}
              type={item.type}
            />
          ))}
        </div>
      )}
    </div>
  );
}
