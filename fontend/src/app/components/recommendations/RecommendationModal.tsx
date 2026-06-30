import React, { lazy, Suspense } from 'react';
import { MoviePreviewModal } from '../MoviePreviewModal';

const LazyPlayer = lazy(() => import('../Player'));

interface RecommendationModalProps {
  ui: {
    selectedMovie: any | null;
    isModalOpen: boolean;
    showPlayer: boolean;
  };
  closeModal: () => void;
  handlePlay: (movie: any) => void;
  closePlayer: () => void;
}

export function RecommendationModal({
  ui,
  closeModal,
  handlePlay,
  closePlayer,
}: RecommendationModalProps) {
  const { selectedMovie, isModalOpen, showPlayer } = ui;

  return (
    <>
      {/* ── Modal ── */}
      {isModalOpen && selectedMovie && (
        <MoviePreviewModal
          key={selectedMovie.tmdb_id || selectedMovie.imdb_id}
          movie={{
            id: selectedMovie.tmdb_id || selectedMovie.imdb_id,
            tmdb_id: selectedMovie.tmdb_id,
            imdb_id: selectedMovie.imdb_id,
            title: selectedMovie.title,
            year: selectedMovie.year,
            rating: selectedMovie.rating,
            type: selectedMovie.type,
            genre: selectedMovie.genre,
            poster_url: selectedMovie.poster_url || selectedMovie.imageUrl,
          }}
          onClose={closeModal}
          onPlay={handlePlay}
        />
      )}

      {/* ── Player ── */}
      {showPlayer && selectedMovie && (
        <Suspense fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-black text-white" aria-live="polite">
            Loading player…
          </div>
        }>
          <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-modal="true" aria-label={`Video Player: ${selectedMovie.title}`}>
            <div className="flex items-center justify-between px-4 py-2 bg-black/80 backdrop-blur-md">
              <span className="text-white text-sm font-semibold">{selectedMovie.title}</span>
              <button
                onClick={closePlayer}
                aria-label="Close Video Player"
                className="text-white/70 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="relative flex-1">
              <LazyPlayer
                embedUrl={selectedMovie.embed_url}
                type={selectedMovie.type}
                title={selectedMovie.title}
              />
            </div>
          </div>
        </Suspense>
      )}
    </>
  );
}
