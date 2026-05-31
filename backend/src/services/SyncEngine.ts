import { RoomState } from '../types';

export class SyncEngine {
  /**
   * Evaluates if a guest's playback drift exceeds the maximum allowed latency.
   * If the drift is > 1.5 seconds, it returns a hard correction payload.
   * Otherwise, for small drifts (200ms - 1500ms), it indicates a soft correction is needed.
   */
  static evaluateDrift(
    hostState: RoomState['playbackState'], 
    guestTimestamp: number, 
    networkDelayMs: number = 0
  ): { needsCorrection: boolean; targetTime: number; type: 'hard' | 'soft' | 'none' } {
    if (!hostState.isPlaying) {
      // If paused, everyone should be at exactly hostState.timestamp
      const drift = Math.abs(hostState.timestamp - guestTimestamp);
      if (drift > 1) {
        return { needsCorrection: true, targetTime: hostState.timestamp, type: 'hard' };
      }
      return { needsCorrection: false, targetTime: hostState.timestamp, type: 'none' };
    }

    // Host is playing. Extrapolate where the host should be right now.
    const elapsedHost = (Date.now() - hostState.lastUpdateTime) / 1000;
    
    // Add network delay compensation (time it took for packet to arrive)
    const compensatedHostTime = hostState.timestamp + elapsedHost + (networkDelayMs / 1000);
    
    const drift = Math.abs(compensatedHostTime - guestTimestamp);

    if (drift > 1.5) {
      // Major desync - requires hard seek jump
      return { needsCorrection: true, targetTime: compensatedHostTime, type: 'hard' };
    } else if (drift > 0.2) {
      // Minor desync - requires soft playback rate adjustment
      return { needsCorrection: true, targetTime: compensatedHostTime, type: 'soft' };
    }

    return { needsCorrection: false, targetTime: compensatedHostTime, type: 'none' };
  }
}
