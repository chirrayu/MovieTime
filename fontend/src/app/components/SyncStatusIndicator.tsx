import { Activity, CheckCircle, AlertTriangle } from 'lucide-react';

interface SyncStatusIndicatorProps {
  isHost: boolean;
  connStatus: 'disconnected' | 'connecting' | 'connected';
  latency: number;
}

export function SyncStatusIndicator({ isHost, connStatus, latency }: SyncStatusIndicatorProps) {
  if (connStatus !== 'connected') return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 backdrop-blur-md rounded border border-white/5 shadow-inner">
      {isHost ? (
        <>
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          <span className="text-[10px] text-emerald-500 font-medium tracking-wide uppercase">Host Sync Active</span>
        </>
      ) : (
        <>
          {latency < 200 ? (
            <Activity className="w-3 h-3 text-emerald-500" />
          ) : latency < 500 ? (
            <Activity className="w-3 h-3 text-yellow-500" />
          ) : (
            <AlertTriangle className="w-3 h-3 text-red-500" />
          )}
          <span className="text-[10px] text-[#A0A0A0] font-mono">
            Ping: <span className={latency > 500 ? 'text-red-400' : latency > 200 ? 'text-yellow-400' : 'text-emerald-400'}>{latency}ms</span>
          </span>
        </>
      )}
    </div>
  );
}
