import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/RoomService';
import { SyncEngine } from '../services/SyncEngine';

export function setupSyncNamespace(io: Server) {
  // Using the /watch-party namespace as per architectural design
  const syncNs = io.of('/watch-party');

  syncNs.on('connection', (socket: Socket) => {
    
    // Hard forced sync broadcasted by the Host
    socket.on('force_sync', async (payload: { roomId: string; timestamp: number; isPlaying: boolean }) => {
      const room = await RoomService.getRoom(payload.roomId);
      if (!room || room.hostId !== socket.id) return;

      room.playbackState.timestamp = payload.timestamp;
      room.playbackState.lastUpdateTime = Date.now();
      room.playbackState.isPlaying = payload.isPlaying;
      
      await RoomService.saveRoom(room);
      
      syncNs.to(payload.roomId).emit('force_sync_update', room.playbackState);
    });

    // Event-driven playback action from Host (play, pause, seek)
    socket.on('playback_action', async (payload: { roomId: string; action: 'play' | 'pause' | 'seek'; timestamp: number }) => {
      if (!payload?.roomId || !payload?.action || typeof payload.timestamp !== 'number') return;
      
      const room = await RoomService.getRoom(payload.roomId);
      if (!room || room.hostId !== socket.id) return;

      room.playbackState.timestamp = payload.timestamp;
      room.playbackState.lastUpdateTime = Date.now();
      room.playbackState.isPlaying = payload.action === 'play';
      
      await RoomService.saveRoom(room);
      
      // Broadcast to guests
      socket.to(payload.roomId).emit('playback_update', room.playbackState);
    });

    // Periodic state synchronization from Host
    socket.on('sync_state', async (payload: { roomId: string; timestamp: number; isPlaying: boolean }) => {
      if (!payload?.roomId || typeof payload.timestamp !== 'number') return;
      
      const room = await RoomService.getRoom(payload.roomId);
      if (!room || room.hostId !== socket.id) return;

      room.playbackState.timestamp = payload.timestamp;
      room.playbackState.lastUpdateTime = Date.now();
      room.playbackState.isPlaying = payload.isPlaying;
      
      await RoomService.saveRoom(room);
      
      socket.to(payload.roomId).emit('sync_update', room.playbackState);
    });
    
    // Guest sending their time to check for drift (Latency Compensation)
    socket.on('sync_time', async (payload: { roomId: string; timestamp: number; networkDelayMs?: number }) => {
      const room = await RoomService.getRoom(payload.roomId);
      // Only evaluate drift for non-hosts
      if (!room || room.hostId === socket.id) return;
      
      const evaluation = SyncEngine.evaluateDrift(room.playbackState, payload.timestamp, payload.networkDelayMs || 0);
      
      if (evaluation.needsCorrection) {
        socket.emit('drift_correction', evaluation);
      }
    });

  });
}
