# MovieTime Recommendation System Architecture

The recommendation system in MovieTime is a **zero-backend, 10-layer recommendation engine** that runs entirely within the client's browser. Instead of relying on a centralized server for heavy computation and machine learning inference, it utilizes a sophisticated multi-stage pipeline and local storage to construct, analyze, and act on user preferences in real-time.

---

## Core Philosophy

1. **Zero-Backend:** All data processing, scoring, and personalization happen on the client using JavaScript and `localStorage`.
2. **Instant Feedback:** Because it's client-side, the "learning rate" is immediate. Pausing, skipping, or completing a video updates the user's taste vectors instantaneously.
3. **Multi-Dimensional Taste Vectors:** Rather than just tracking simple genre preferences, the system tracks granular attributes like pacing, color palette, sound energy, and dialogue density.

---

## The 10-Layer Pipeline

### Layer 1: User Profiling Engine (State Management)
The engine stores both **explicit** signals (likes, dislikes, watchlist additions) and **implicit** signals (watch percentage, rewatches, pauses, skips, search history).
It constructs a continuous **Taste Vector** that grades user affinity across:
- **Genres:** Action, Romance, Sci-Fi, etc.
- **Pacing:** Slow-burn, steady, fast-paced, frantic.
- **Visuals:** Brightness, color palettes (e.g., Neon Cyberpunk, Warm Amber).
- **Audio:** Music styles, sound energy, and dialogue density.
It also tracks **Contextual Taste Vectors**—maintaining distinct profiles for morning, lunch, night, weekend, mobile, and TV viewing.

### Layer 2 & 3: Content Intelligence & Enrichment
Without a backend to deliver rich metadata for every movie, the engine generates synthetic, deterministic **Enrichment Metadata** on the fly. Using a mathematical seed derived from a movie's Title and ID, it assigns properties to movies based on their core genres:
- **Themes & Moods:** Assigns applicable thematic elements (e.g., "hero's journey", "paranoia") and moods ("dark", "uplifting").
- **Pacing & Audience:** Predicts the pace and target demographic (e.g., "cerebral viewers", "thrill-seekers").
- **Visual & Audio Traits:** Generates scores for camera movement, scene intensity, music style, and brightness.

### Layer 4: Collaborative Filtering with "Virtual Users"
To replicate the "people who liked this also liked..." feature without server-side user data, the system compares the user against predefined **Virtual Users** (e.g., "Cerebral Cinephile", "Popcorn Action Fan", "Obscure Indie Explorer"). Using **Cosine Similarity**, it finds the closest "taste twins" and uses their preferences to surface adjacent picks that the user might not naturally discover.

### Layer 5: Session-Based Adjustments
Temporary weights are applied based on the current session. If the user searches for specific terms (e.g., "space", "zombies"), items matching those themes or genres get an immediate, temporary boost in their probability scores.

### Layer 6: Watch Probability & Preference Matching
The first major scoring layer calculates the baseline likelihood of a user clicking play. It factors in:
- Explicit favorite genres.
- The average match against the user's active Taste Vector.
- Matches against the current session's active searches.

### Layer 7: Completion & Engagement Probability
Predicts the finish rate by comparing a movie's pacing and scene intensity to the user's pacing vector and completion history. For example, if a user frequently skips slow-burn movies on mobile, the system penalizes slow-burn movies when the user is on their phone.

### Layer 8: Multimodal Predictive Probabilities
Calculates granular probabilities for specific user actions:
- **Like Probability:** Modeled based on genre matching, color preference, and explicit past behavior.
- **Rewatch Probability:** Boosted for comedies/family movies, or items the user has already liked and watched before.
- **Retention Impact:** Prioritizes premium, high-rated items that ensure user satisfaction.

### Layer 9: Context-Aware Scaling
Adjusts final scores dynamically based on the user's environment:
- **Time of Day:** Boosts Sci-Fi/Horror at night; Comedy/Animation at lunch.
- **Device Type:** Favors fast-paced content on mobile; sweeping cinematic visuals on TV.
- **Day of Week:** Boosts Action/Adventure on weekends.
- **Weather:** If the environment is "rainy," cozy or moody thrillers receive a boost.

### Layer 10: Real-Time Reinforcement Learning Loop
This is the feedback engine. Every interaction acts as a reinforcement learning trigger, immediately updating the Taste Vector with a specific learning rate (e.g., `0.15`):
- **Play/Complete:** Solidifies the user's preference for that movie's pacing, themes, and audio-visual style.
- **Skip/Pause:** Actively penalizes the movie's pacing and dialogue density in the user's profile.
- **Like/Watchlist Add:** Strongly reinforces genre coefficients and themes.

---

## Output Generation

After passing candidates through these 10 layers, the algorithm outputs an array of `ScoredRecommendation` objects. These are categorized into:
- **Safe Picks:** High probability matches with strong past affinity.
- **Adjacent Picks:** Recommended through the user's Virtual Twins.
- **Discovery Picks:** Surfaced to ensure novelty and prevent the recommendation pool from becoming an echo chamber.
