import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/RoomService';
import { User } from '../types';

const ROOM_GRACE_PERIOD_MS = 15000;
const disconnectTimeouts: Record<string, Record<string, ReturnType<typeof setTimeout>>> = {};

export function setupPresenceNamespace(io: Server) {
  const presenceNs = io.of('/watch-party');

  presenceNs.on('connection', (socket: Socket) => {
    
    // Heartbeat mechanism for latency calculation
    socket.on('ping', (cb) => {
      if (typeof cb === 'function') cb();
    });

    socket.on('join_room', async ({ roomId, username, userId, mediaId, mediaType }: { roomId: string, username: string, userId?: string, mediaId?: string, mediaType?: 'movie' | 'tv' }) => {
      if (!roomId) return;
      
      const isFirstInRoom = !(await RoomService.getRoom(roomId));
      const room = await RoomService.initRoom(roomId, socket.id, mediaId, mediaType);
      
      const isHost = isFirstInRoom || room.hostId === socket.id;

      // Handle reconnects clearing timeout
      if (userId) {
        const existingEntry = Object.values(room.users).find((u) => u.userId === userId);
        if (existingEntry) {
          const prevId = existingEntry.id;
          if (disconnectTimeouts[roomId]?.[prevId]) {
            clearTimeout(disconnectTimeouts[roomId][prevId]);
            delete disconnectTimeouts[roomId][prevId];
          }
          await RoomService.removeUser(roomId, prevId);
        }
      }

      const newUser: User = {
        id: socket.id,
        userId,
        username: username || `User-${socket.id.substring(0, 4)}`,
        isHost,
        isConnected: true,
      };

      const updatedRoom = await RoomService.addUser(roomId, newUser);
      socket.join(roomId);

      if (updatedRoom) {
        // Send full room state to everyone so all clients have the latest users list
        presenceNs.to(roomId).emit('room_state_update', updatedRoom);
        // Also notify others a new user joined (for the toast notification)
        socket.to(roomId).emit('user_joined', newUser);
      }
    });

    socket.on('disconnecting', () => {
      // socket.rooms contains the socket.id and any rooms it joined
      for (const roomName of socket.rooms) {
        if (roomName === socket.id) continue;
        const roomId = roomName;

        if (!disconnectTimeouts[roomId]) disconnectTimeouts[roomId] = {};
        
        disconnectTimeouts[roomId][socket.id] = setTimeout(async () => {
          delete disconnectTimeouts[roomId][socket.id];
          
          const result = await RoomService.removeUser(roomId, socket.id);
          if (result.room && result.newHostId) {
             presenceNs.to(roomId).emit('host_changed', result.newHostId);
          }
        }, ROOM_GRACE_PERIOD_MS);

        socket.to(roomId).emit('user_left', socket.id);
      }
    });

    // WebRTC signaling
    socket.on('webrtc_signal', ({ to, signal }: { to: string, signal: any }) => {
      presenceNs.to(to).emit('webrtc_signal', { from: socket.id, signal });
    });
    socket.on('join_call', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('user_joined_call', socket.id);
    });
    socket.on('leave_call', ({ roomId }: { roomId: string }) => {
      socket.to(roomId).emit('user_left_call', socket.id);
    });

  });
}
