import { useEffect, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface VideoFeedProps {
  stream: MediaStream;
  muted?: boolean;
  username: string;
  isLocal?: boolean;
  micMuted?: boolean;
  camOff?: boolean;
}

export function VideoFeed({ stream, muted, username, isLocal, micMuted, camOff }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  return (
    <div className="relative rounded-xl overflow-hidden bg-black/60 aspect-video border border-white/5 shadow-inner flex items-center justify-center group transition-all hover:border-red-500/30">
      {camOff ? (
        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#E50914] to-red-400 flex items-center justify-center text-white font-bold text-lg shadow-[0_2px_8px_rgba(229,9,20,0.3)] select-none animate-pulse">
          {username.substring(0, 2).toUpperCase()}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover rounded-xl"
        />
      )}
      
      {/* Overlay Status Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] text-white font-semibold">
          {username} {isLocal && '(You)'}
        </span>
        
        <div className="flex gap-1">
          {micMuted && (
            <span className="p-1 rounded-md bg-red-600/90 text-white shadow-sm flex items-center justify-center">
              <AlertCircle className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
