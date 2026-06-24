import React, { forwardRef } from 'react';

interface PlayerProps {
  embedUrl: string;
  type: 'movie' | 'tv';
  title?: string;
  className?: string;
}

export const Player = forwardRef<HTMLIFrameElement, PlayerProps>(
  ({ embedUrl, type, title, className }, ref) => {
    return (
      <iframe
        ref={ref}
        src={embedUrl}
        className={className || "w-full h-full border-0 absolute inset-0 z-0"}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        title={type === 'movie' ? 'Movie Player' : title || 'Video Player'}
      />
    );
  }
);

Player.displayName = 'Player';
export default Player;
