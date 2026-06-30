import { useState, useMemo, useCallback } from 'react';
import { useRecommendations } from '../hooks/useRecommendations';
import { HeroRecommendation } from '../components/recommendations/HeroRecommendation';
import { RecommendationFilters } from '../components/recommendations/RecommendationFilters';
import { RecommendationRows } from '../components/recommendations/RecommendationRows';
import { RecommendationGrid } from '../components/recommendations/RecommendationGrid';
import { RecommendationModal } from '../components/recommendations/RecommendationModal';
import { getHistory } from '../lib/storage';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function RecommendationsPage() {
  const { recommendations, loading, error, retry } = useRecommendations();
  const [activeFilter, setActiveFilter] = useState<string>('For You');
  
  const [ui, setUI] = useState({
    selectedMovie: null as any | null,
    isModalOpen: false,
    showPlayer: false,
  });

  const handleCardClick = useCallback((item: any) => {
    setUI(prev => ({
      ...prev,
      selectedMovie: item,
      isModalOpen: true,
      showPlayer: false,
    }));
  }, []);

  const closeModal = useCallback(() => {
    setUI(prev => ({
      ...prev,
      isModalOpen: false,
      selectedMovie: null,
    }));
    document.body.style.overflow = '';
  }, []);

  const handlePlay = useCallback((item: any) => {
    setUI(prev => ({
      ...prev,
      selectedMovie: item,
      showPlayer: true,
      isModalOpen: false,
    }));
  }, []);

  const closePlayer = useCallback(() => {
    setUI(prev => ({
      ...prev,
      showPlayer: false,
      selectedMovie: null,
    }));
  }, []);

  // ── Derived/Memoized Computations ──────────────────────────────────────────

  const hero = useMemo(() => recommendations[0] ?? null, [recommendations]);

  const discoverRecs = useMemo(() => {
    return recommendations
      .filter(r => r.category === 'Discovery Pick' || r.probabilities.novelty > 0.7)
      .slice(0, 15);
  }, [recommendations]);

  const becauseTitle = useMemo(() => {
    const history = getHistory();
    return history.length > 0
      ? `Because you watched ${history[0].title}`
      : 'Picked for your taste';
  }, [recommendations]);

  const becauseWatched = useMemo(() => {
    return recommendations.filter(r => r !== hero).slice(2, 17);
  }, [recommendations, hero]);

  const topRated = useMemo(() => {
    return [...recommendations]
      .sort((a, b) => parseFloat(b.item.rating) - parseFloat(a.item.rating))
      .slice(0, 15);
  }, [recommendations]);

  const gridRecs = useMemo(() => {
    let recs = [...recommendations];
    if (activeFilter === 'New Discoveries') {
      recs = recs.filter(r => r.probabilities.novelty > 0.6);
    } else if (activeFilter === 'Trending') {
      recs = recs.sort((a, b) => b.probabilities.watch - a.probabilities.watch);
    } else if (activeFilter === 'Highly Rated') {
      recs = recs.sort((a, b) => parseFloat(b.item.rating) - parseFloat(a.item.rating));
    }
    return recs;
  }, [recommendations, activeFilter]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500 animate-bounce">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Couldn't load recommendations</h2>
          <p className="text-[#9A9A9A] text-sm max-w-md">
            {error.message || 'An unexpected error occurred while communicating with the service. Please try again.'}
          </p>
        </div>
        <button
          onClick={retry}
          aria-label="Retry loading recommendations"
          className="flex items-center gap-2 px-6 py-3 bg-[#E50914] text-white rounded-xl font-semibold shadow-[0_0_20px_rgba(229,9,20,0.4)] hover:bg-[#ff1a25] transition-all hover:scale-105 duration-200 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pb-10">
      {/* Ambient dynamic backdrop glow */}
      {hero && (
        <div
          className="fixed inset-0 pointer-events-none transition-all duration-1000 ease-in-out -z-10"
          style={{
            backgroundImage: `url(${hero.personalizedPoster || hero.item.poster_url})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            filter: 'blur(100px) saturate(1.4) opacity(0.15)',
          }}
        />
      )}

      {/* Hero Header */}
      <HeroRecommendation
        recommendations={recommendations}
        loading={loading}
        onPlay={handlePlay}
        onInfoClick={handleCardClick}
      />

      <div className="space-y-10 py-6">
        {/* Filter chips */}
        <RecommendationFilters
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
        />

        {/* Dynamic content sections */}
        {activeFilter === 'For You' ? (
          <RecommendationRows
            loading={loading}
            discoverRecs={discoverRecs}
            becauseTitle={becauseTitle}
            becauseWatched={becauseWatched}
            topRated={topRated}
            onCardClick={handleCardClick}
          />
        ) : (
          <RecommendationGrid
            activeFilter={activeFilter}
            gridRecs={gridRecs}
            loading={loading}
            onCardClick={handleCardClick}
          />
        )}
      </div>

      {/* Modal and Player manager */}
      <RecommendationModal
        ui={ui}
        closeModal={closeModal}
        handlePlay={handlePlay}
        closePlayer={closePlayer}
      />
    </div>
  );
}