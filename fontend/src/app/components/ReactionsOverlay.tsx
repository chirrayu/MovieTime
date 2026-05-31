import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Socket } from 'socket.io-client';

interface ReactionEvent {
  id: string;
  emoji: string;
  username: string;
  x: number;
}

interface ReactionsOverlayProps {
  socket: Socket | null;
}

export function ReactionsOverlay({ socket }: ReactionsOverlayProps) {
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleReaction = (payload: { userId: string; username: string; emoji: string; timestamp: number }) => {
      // Create a unique id for the animation key
      const newReaction: ReactionEvent = {
        id: `${payload.userId}-${payload.timestamp}-${Math.random()}`,
        emoji: payload.emoji,
        username: payload.username,
        // Random horizontal position for the floating effect (between 10% and 90% of screen width)
        x: 10 + Math.random() * 80,
      };

      setReactions((prev) => [...prev, newReaction]);

      // Remove after animation completes (approx 3 seconds)
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
      }, 3000);
    };

    socket.on('reaction_event', handleReaction);

    return () => {
      socket.off('reaction_event', handleReaction);
    };
  }, [socket]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{ opacity: 0, y: '100%', scale: 0.5 }}
            animate={{ 
              opacity: [0, 1, 1, 0], 
              y: '-50%', 
              scale: [0.5, 1.2, 1, 1],
              x: `${reaction.x}vw` // keep the same horizontal base
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            className="absolute bottom-0 left-0 text-4xl flex flex-col items-center gap-1"
            style={{ left: `${reaction.x}%` }}
          >
            <span className="drop-shadow-lg">{reaction.emoji}</span>
            <span className="text-[10px] text-white font-bold bg-black/40 px-1.5 py-0.5 rounded-full drop-shadow-md">
              {reaction.username}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
