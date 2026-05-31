import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState } from 'react';
import { MovieCard } from './MovieCard';
import type { MovieItem, TVShowItem } from '../lib/api';

interface MovieRowProps {
  title: string;
  items: (MovieItem | TVShowItem)[];
  loading?: boolean;
}

export function MovieRow({ title, items, loading }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const updateArrows = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -600 : 600;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(updateArrows, 400);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl text-white px-6 font-medium">{title}</h2>
        <div className="flex gap-4 px-6 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-none w-44">
              <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
              <div className="mt-2 h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="mt-1 h-3 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-4 group/row">
      {/* Row Title */}
      <div className="flex items-center justify-between px-6">
        <h2 className="text-xl text-white font-medium">{title}</h2>
        <span className="text-xs text-[#666] uppercase tracking-wider">{items.length} titles</span>
      </div>

      {/* Scrollable Container */}
      <div className="relative">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="absolute left-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-r from-[#070707] to-transparent
                     flex items-center justify-center opacity-0 group-hover/row:opacity-100
                     transition-opacity duration-300"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </div>
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="absolute right-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-l from-[#070707] to-transparent
                     flex items-center justify-center opacity-0 group-hover/row:opacity-100
                     transition-opacity duration-300"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </button>
        )}

        {/* Movies Grid */}
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-4 overflow-x-auto px-6 pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, idx) => (
            <div key={`${item.tmdb_id}-${idx}`} className="flex-none w-44">
              <MovieCard
                tmdb_id={item.tmdb_id}
                imdb_id={item.imdb_id}
                title={item.title}
                year={item.year}
                rating={item.rating}
                poster_url={item.poster_url}
                genre={item.genre}
                type={item.type}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
