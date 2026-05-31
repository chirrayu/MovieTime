import { Search, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import type { MovieItem, TVShowItem } from '../lib/api';
import { searchMulti, mapTMDBToItem } from '../lib/api';
import { cacheItems } from '../lib/cache';

export function SearchBar() {
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(MovieItem | TVShowItem)[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Search through TMDB
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchMulti(query.trim(), 1);
        const mappedResults = res.results
          .map(mapTMDBToItem)
          .filter((item): item is MovieItem | TVShowItem => item !== null);
          
        cacheItems(mappedResults);
        setResults(mappedResults.slice(0, 8));
        setShowDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (item: MovieItem | TVShowItem) => {
    const path = item.type === 'movie' ? `/movie/${item.tmdb_id}` : `/tv/${item.tmdb_id}`;
    navigate(path);
    setShowDropdown(false);
    setQuery('');
  };

  return (
    <div className="relative w-full max-w-xl" ref={dropdownRef}>
      <form onSubmit={handleSubmit}>
        <div className={`
          relative flex items-center gap-3 px-4 py-2.5 rounded-2xl
          bg-[var(--secondary)] backdrop-blur-xl border border-[var(--border)]
          transition-all duration-300 ease-out
          ${isFocused ? 'shadow-[0_0_0_2px_rgba(229,9,20,0.3)] bg-[rgba(255,255,255,0.1)] border-[rgba(229,9,20,0.3)]' : 'hover:bg-[rgba(255,255,255,0.08)]'}
        `}>
          <Search className={`w-5 h-5 transition-colors ${isFocused ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'}`} strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, series..."
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="flex-1 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-sm"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); }}>
              <X className="w-4 h-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]" />
            </button>
          )}
          {isSearching && (
            <div className="w-4 h-4 border-2 border-[var(--primary)]/30 border-t-[var(--primary)] rounded-full animate-spin" />
          )}
        </div>
      </form>

      {/* Search Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--card)]/95 backdrop-blur-2xl border border-[var(--border)] rounded-3xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.35)] z-50">
          {results.map((item, idx) => (
            <button
              key={`${item.type}-${item.tmdb_id}-${idx}`}
              onClick={() => handleResultClick(item)}
              className="w-full flex items-center gap-3 p-3 hover:bg-[rgba(255,255,255,0.06)] transition-colors text-left"
            >
              {item.poster_url ? (
                <img
                  src={item.poster_url}
                  alt={item.title}
                  className="w-10 h-14 object-cover rounded-xl flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-10 h-14 bg-[var(--secondary)] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--foreground)] truncate">{item.title}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {item.year} • {item.type === 'movie' ? 'Movie' : 'TV Show'}
                  {item.rating && ` • ⭐ ${item.rating}`}
                </p>
              </div>
            </button>
          ))}
          <button
            onClick={handleSubmit as any}
            className="w-full p-3 text-center text-sm text-[var(--primary)] hover:bg-[rgba(255,255,255,0.06)] border-t border-[var(--border)]"
          >
            See all results for "{query}"
          </button>
        </div>
      )}
    </div>
  );
}
