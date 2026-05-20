import { useState } from 'react';
import { MovieCard } from '../components/MovieCard';
import { getWatchlist, removeFromWatchlist } from '../lib/storage';
import { Bookmark, Trash2 } from 'lucide-react';

export function WatchlistPage() {
  const [items, setItems] = useState(getWatchlist());

  const handleRemove = (id: string) => {
    removeFromWatchlist(id);
    setItems(getWatchlist());
  };

  const handleClearAll = () => {
    items.forEach(item => removeFromWatchlist(item.id));
    setItems([]);
  };

  return (
    <div className="p-6 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-[#E50914]" />
            My Watchlist
          </h1>
          <p className="text-[#9A9A9A] text-sm">
            {items.length} {items.length === 1 ? 'title' : 'titles'} saved
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 rounded-lg text-sm text-[#9A9A9A] hover:text-red-400 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Bookmark className="w-10 h-10 text-[#333]" />
          </div>
          <h2 className="text-xl text-white">Your watchlist is empty</h2>
          <p className="text-[#9A9A9A] text-sm text-center max-w-md">
            Add movies and TV shows to your watchlist by clicking the + button on any title.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {items.map((item, idx) => (
            <MovieCard
              key={`${item.id}-${idx}`}
              tmdb_id={item.tmdb_id}
              imdb_id={item.imdb_id}
              title={item.title}
              year={item.year}
              rating={item.rating}
              poster_url={item.poster}
              genre={item.genre}
              type={item.type}
            />
          ))}
        </div>
      )}
    </div>
  );
}
