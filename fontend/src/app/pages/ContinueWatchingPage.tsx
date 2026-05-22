import { useState } from 'react';
import { getContinueWatching, removeWatchProgress } from '../lib/storage';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Play, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';

export function ContinueWatchingPage() {
  const [items, setItems] = useState(getContinueWatching());
  const navigate = useNavigate();

  const handlePlay = (item: typeof items[0]) => {
    if (item.type === 'movie') {
      navigate(`/watch/movie/${item.id}`);
    } else {
      navigate(`/watch/tv/${item.id}/${item.season}/${item.episode}`);
    }
  };

  const handleRemove = (item: typeof items[0]) => {
    removeWatchProgress(item.id, item.season, item.episode);
    setItems(getContinueWatching());
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="p-6 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Clock className="w-8 h-8 text-[#E50914]" />
          Continue Watching
        </h1>
        <p className="text-[#9A9A9A] text-sm">Pick up where you left off</p>
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
            <Clock className="w-10 h-10 text-[#333]" />
          </div>
          <h2 className="text-xl text-white">Nothing to continue</h2>
          <p className="text-[#9A9A9A] text-sm text-center max-w-md">
            Start watching something and your progress will be saved automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const percent = item.duration > 0 ? (item.progress / item.duration) * 100 : 0;
            return (
              <motion.div
                key={`${item.id}-${idx}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 transition-all group"
              >
                {/* Poster */}
                <div className="relative w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => handlePlay(item)}>
                  {item.poster ? (
                    <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <Play className="w-5 h-5 text-[#444]" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-6 h-6 text-white" fill="currentColor" />
                  </div>
                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                    <div className="h-full bg-[#E50914]" style={{ width: `${percent}%` }} />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium truncate">{item.title}</h3>
                  {item.type === 'tv' && item.season && item.episode && (
                    <p className="text-xs text-[#9A9A9A] mt-0.5">
                      Season {item.season} · Episode {item.episode}
                      {item.episodeTitle && ` · ${item.episodeTitle}`}
                    </p>
                  )}
                  <p className="text-xs text-[#666] mt-1">
                    {formatTime(item.progress)} / {formatTime(item.duration)} · {Math.round(percent)}% watched
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlay(item)}
                    className="px-4 py-2 bg-[#E50914] hover:bg-[#ff1a25] rounded-lg text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(229,9,20,0.3)]"
                  >
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    Resume
                  </button>
                  <button
                    onClick={() => handleRemove(item)}
                    className="p-2 rounded-lg hover:bg-white/5 text-[#666] hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
