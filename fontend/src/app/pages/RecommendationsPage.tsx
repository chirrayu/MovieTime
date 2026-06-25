import { useState, useEffect, lazy, Suspense } from 'react';
import { MoviePreviewModal } from '../components/MoviePreviewModal';
import {
  getHistory,
  getAllWatchProgress
} from '../lib/storage';
import {
  getPopular,
  getTrending,
  getTopRated,
  mapTMDBToItem
} from '../lib/api';
import type { MovieItem, TVShowItem } from '../lib/api';
import {
  loadUserProfile,
  computeCollaborativeSimilarities,
  scoreRecommendationCandidate,
  type UserProfile,
  type RecommenderContext,
  type ScoredRecommendation,
} from '../lib/recommender';
import { Sparkles, Play, Info, RefreshCw, ChevronRight, Star, TrendingUp, Compass } from 'lucide-react';

const LazyPlayer = lazy(() => import('../components/Player'));

const FILTERS = ['For You', 'New Discoveries', 'Trending', 'Highly Rated'];

// ── Small helpers ────────────────────────────────────────────────────────────

function MatchBadge({ score }: { score: number }) {
  const pct = Math.round(score);
  const color =
    pct >= 75 ? '#E50914' :
      pct >= 55 ? '#ff6b6b' : '#a3a3a3';
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>
      {pct}% match
    </span>
  );
}

function CategoryPill({ label }: { label: string }) {
  const colors: Record<string, string> = {
    'Safe Pick': '#E50914',
    'Adjacent Pick': '#E50914',
    'Discovery Pick': '#E50914',
  };
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: colors[label] ?? '#a3a3a3',
      background: (colors[label] ?? '#a3a3a3') + '1a',
      border: `1px solid ${colors[label] ?? '#a3a3a3'}33`,
      borderRadius: 4,
      padding: '2px 7px',
    }}>
      {label}
    </span>
  );
}

// ── Poster card (row) ────────────────────────────────────────────────────────

function PosterCard({ rec, onClick }: { rec: ScoredRecommendation; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const src = rec.personalizedPoster || rec.item.poster_url || '';
  const genres = rec.item.genre?.split(',').map(g => g.trim()).filter(Boolean) ?? [];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width: 160,
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '2/3',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#111111',
        boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.7)' : '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.2s ease',
      }}>
        <img
          src={src}
          alt={rec.item.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 40%, rgba(0,0,0,0.3) 100%)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.2s ease',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: 12, gap: 6,
        }}>
          <MatchBadge score={rec.score} />
          {genres[0] && (
            <span style={{ fontSize: 11, color: '#a3a3a3' }}>{genres[0]}</span>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={e => { e.stopPropagation(); onClick(); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: 'white', color: 'black', border: 'none', borderRadius: 6,
                padding: '6px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Play style={{ width: 12, height: 12 }} fill="black" /> Play
            </button>
          </div>
        </div>

        {/* Category badge top-right */}
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          {rec.category === 'Discovery Pick' && (
            <span style={{
              background: '#f9731620', border: '1px solid #f9731640',
              color: '#f97316', fontSize: 9, fontWeight: 700,
              borderRadius: 4, padding: '2px 5px', letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}>New</span>
          )}
        </div>
      </div>
      <div style={{ marginTop: 10, paddingLeft: 2 }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: hovered ? '#fff' : '#e2e8f0',
          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.2s',
        }}>{rec.item.title}</p>
        <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0', display: 'flex', gap: 6 }}>
          <span>{rec.item.year}</span>
          {rec.item.rating && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Star style={{ width: 10, height: 10, color: '#facc15' }} fill="#facc15" />
              {parseFloat(rec.item.rating).toFixed(1)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Horizontal row section ───────────────────────────────────────────────────

function RowSection({
  title, subtitle, icon, accentColor, recs, onCardClick
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  recs: ScoredRecommendation[];
  onCardClick: (item: MovieItem | TVShowItem) => void;
}) {
  if (recs.length === 0) return null;
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, color: '#ffffff',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: accentColor }}>{icon}</span>
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{subtitle}</p>
        </div>
        <button style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2,
          padding: 0,
        }}>
          See all <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12 }}>
        {recs.map(rec => (
          <PosterCard
            key={rec.item.tmdb_id || rec.item.imdb_id}
            rec={rec}
            onClick={() => onCardClick(rec.item)}
          />
        ))}
      </div>
    </section>
  );
}

// ── Grid card (For You grid) ─────────────────────────────────────────────────

function GridCard({ rec, onClick }: { rec: ScoredRecommendation; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const src = rec.personalizedPoster || rec.item.poster_url || '';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer', transition: 'transform 0.2s', transform: hovered ? 'translateY(-4px)' : 'none' }}
    >
      <div style={{
        position: 'relative', aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden',
        background: '#111111',
        boxShadow: hovered ? '0 12px 32px rgba(0,0,0,0.6)' : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'box-shadow 0.2s',
      }}>
        <img src={src} alt={rec.item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 35%, transparent 70%)',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.2s',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10, gap: 5,
        }}>
          <MatchBadge score={rec.score} />
          <CategoryPill label={rec.category} />
          {rec.reasons[0] && (
            <p style={{
              margin: 0, fontSize: 10, color: '#cbd5e1', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
            }}>
              {rec.reasons[0]}
            </p>
          )}
        </div>
      </div>
      <p style={{
        margin: '8px 0 2px', fontSize: 12, fontWeight: 600,
        color: hovered ? '#f1f5f9' : '#a3a3a3', transition: 'color 0.2s',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{rec.item.title}</p>
      <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>
        {rec.item.genre?.split(',')[0]} · {rec.item.year}
      </p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function RecommendationsPage() {
  const [profile] = useState<UserProfile>(loadUserProfile());
  const [context] = useState<RecommenderContext>(() => {
    const hour = new Date().getHours();
    let timeOfDay: RecommenderContext['timeOfDay'] = 'night';
    if (hour > 5 && hour < 11) timeOfDay = 'morning';
    else if (hour >= 11 && hour < 14) timeOfDay = 'lunch';
    else if (hour >= 14 && hour < 18) timeOfDay = 'afternoon';
    return {
      deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
      timeOfDay,
      dayOfWeek: new Date().getDay(),
      weather: 'sunny',
    };
  });

  const [recommendations, setRecommendations] = useState<ScoredRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('For You');
  const [selectedMovie, setSelectedMovie] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [popMovies, popTV, trending, topMovie, topTV] = await Promise.all([
          getPopular('movie', 1).catch(() => ({ results: [] })),
          getPopular('tv', 1).catch(() => ({ results: [] })),
          getTrending('all', 'week').catch(() => ({ results: [] })),
          getTopRated('movie', 1).catch(() => ({ results: [] })),
          getTopRated('tv', 1).catch(() => ({ results: [] })),
        ]);

        const raw = [
          ...popMovies.results.map(r => mapTMDBToItem({ ...r, media_type: 'movie' })),
          ...popTV.results.map(r => mapTMDBToItem({ ...r, media_type: 'tv' })),
          ...trending.results.map(r => mapTMDBToItem(r)),
          ...topMovie.results.map(r => mapTMDBToItem({ ...r, media_type: 'movie' })),
          ...topTV.results.map(r => mapTMDBToItem({ ...r, media_type: 'tv' })),
        ].filter(Boolean) as (MovieItem | TVShowItem)[];

        const seen = new Set<string>();
        const pool: (MovieItem | TVShowItem)[] = [];
        for (const item of raw) {
          const id = item.tmdb_id || item.imdb_id;
          if (id && !seen.has(id)) { seen.add(id); pool.push(item); }
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
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleCardClick = (item: any) => {
    setSelectedMovie(item);
    setIsModalOpen(true);
    setShowPlayer(false);
  };

  const closeModal = (keepSelected = false) => {
    setIsModalOpen(false);
    if (!keepSelected) setSelectedMovie(null);
    document.body.style.overflow = '';
  };

  const handlePlay = (item: any) => {
    setSelectedMovie(item);
    setShowPlayer(true);
    closeModal(true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <RefreshCw style={{ width: 36, height: 36, color: '#E50914', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const hero = recommendations[0];
  const history = getHistory();

  // Sections
  const discoverRecs = recommendations.filter(r => r.category === 'Discovery Pick' || r.probabilities.novelty > 0.7).slice(0, 12);
  const historyTitle = history.length > 0 ? `Because you watched ${history[0].title}` : 'Picked for your taste';
  const becauseWatched = recommendations.filter(r => r !== hero).slice(2, 14);
  const topRated = [...recommendations].sort((a, b) => parseFloat(b.item.rating) - parseFloat(a.item.rating)).slice(0, 12);

  let gridRecs = [...recommendations];
  if (activeFilter === 'New Discoveries') gridRecs = gridRecs.filter(r => r.probabilities.novelty > 0.6);
  if (activeFilter === 'Trending') gridRecs = gridRecs.sort((a, b) => b.probabilities.watch - a.probabilities.watch);
  if (activeFilter === 'Highly Rated') gridRecs = gridRecs.sort((a, b) => parseFloat(b.item.rating) - parseFloat(a.item.rating));

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#ffffff', fontFamily: 'inherit', overflowX: 'hidden' }}>

      {/* ── Hero ── */}
      {hero && (
        <div style={{ position: 'relative', width: '100%', height: '75vh', minHeight: 460, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <img
              src={hero.personalizedPoster || hero.item.poster_url || ''}
              alt={hero.item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
            />
            {/* vignettes */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #080810 0%, #08081080 50%, transparent 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #080810 0%, #08081050 55%, transparent 100%)' }} />
          </div>

          <div style={{ position: 'relative', zIndex: 2, padding: '0 48px 56px', maxWidth: 680 }}>
            {/* Top Pick badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: '#E5091420', border: '1px solid #E5091440',
                color: '#E50914', fontSize: 11, fontWeight: 800,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                borderRadius: 6, padding: '4px 10px',
              }}>
                <Sparkles style={{ width: 11, height: 11 }} />
                Top pick for you
              </span>
              <MatchBadge score={hero.score} />
            </div>

            <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {hero.item.title}
            </h1>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <CategoryPill label={hero.category} />
              <span style={{ fontSize: 13, color: '#a3a3a3' }}>{hero.item.year}</span>
              {hero.item.rating && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#facc15' }}>
                  <Star style={{ width: 13, height: 13 }} fill="#facc15" />
                  {parseFloat(hero.item.rating).toFixed(1)}
                </span>
              )}
              <span style={{ fontSize: 13, color: '#a3a3a3' }}>{hero.item.genre?.split(',').slice(0, 2).join(' · ')}</span>
            </div>

            {/* Reason blurb */}
            {hero.reasons.length > 0 && (
              <p style={{ margin: '0 0 24px', fontSize: 15, color: '#a3a3a3', lineHeight: 1.6, maxWidth: 520 }}>
                {hero.reasons[0]}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => handlePlay(hero.item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'white', color: '#0f0f0f',
                  border: 'none', borderRadius: 8, padding: '12px 28px',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <Play style={{ width: 16, height: 16 }} fill="#0f0f0f" /> Play
              </button>
              <button
                onClick={() => handleCardClick(hero.item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.08)', color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '12px 24px',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  backdropFilter: 'blur(8px)', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              >
                <Info style={{ width: 16, height: 16 }} /> More info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ padding: '40px 32px 96px', display: 'flex', flexDirection: 'column', gap: 56 }}>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                flexShrink: 0,
                background: activeFilter === f ? 'white' : 'rgba(255,255,255,0.06)',
                color: activeFilter === f ? '#0f0f0f' : '#a3a3a3',
                border: activeFilter === f ? 'none' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20, padding: '7px 18px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Discover Weekly row */}
        <RowSection
          title="Discover Weekly"
          subtitle="Fresh picks based on your taste profile"
          icon={<Compass style={{ width: 18, height: 18 }} />}
          accentColor="#a78bfa"
          recs={discoverRecs.length ? discoverRecs : recommendations.slice(1, 13)}
          onCardClick={handleCardClick}
        />

        {/* Because you watched row */}
        <RowSection
          title={historyTitle}
          subtitle="Viewers with similar tastes also enjoyed these"
          icon={<TrendingUp style={{ width: 18, height: 18 }} />}
          accentColor="#34d399"
          recs={becauseWatched}
          onCardClick={handleCardClick}
        />

        {/* For You grid */}
        <section>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles style={{ width: 18, height: 18, color: '#fb923c' }} />
                {activeFilter === 'For You' ? 'Your Picks' : activeFilter}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                {gridRecs.length} titles matched to your profile
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '20px 14px' }}>
            {gridRecs.slice(0, 40).map(rec => (
              <GridCard
                key={rec.item.tmdb_id || rec.item.imdb_id}
                rec={rec}
                onClick={() => handleCardClick(rec.item)}
              />
            ))}
          </div>
        </section>

      </div>

      {/* ── Modal ── */}
      {isModalOpen && selectedMovie && (
        <MoviePreviewModal
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

      {/* ── Inline player ── */}
      {showPlayer && selectedMovie && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            height: 52, background: '#0a0a0a', padding: '0 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Now Playing: {selectedMovie.title}</span>
            <button
              onClick={() => setShowPlayer(false)}
              style={{
                background: '#E50914', border: 'none', color: 'white',
                borderRadius: 6, padding: '5px 14px', fontSize: 12,
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Exit
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <Suspense fallback={
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw style={{ width: 32, height: 32, color: '#E50914', animation: 'spin 1s linear infinite' }} />
              </div>
            }>
              <LazyPlayer type={selectedMovie.type} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}