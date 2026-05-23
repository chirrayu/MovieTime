import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { RoomState, User, ChatMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_ORIGINS = [
  'https://movie-time-orcin.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const app = express();
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Allow both polling and websocket so the handshake works cross-origin
  transports: ['polling', 'websocket']
});

// In-memory store for rooms
const rooms: Record<string, RoomState> = {};
const disconnectTimeouts: Record<string, Record<string, ReturnType<typeof setTimeout>>> = {};
const ROOM_GRACE_PERIOD_MS = 15000;

app.get('/health', (req, res) => {
  res.send('Watch Party Server is running');
});

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Heartbeat to keep connection alive and sync latency if needed
  socket.on('ping', (cb) => {
    if (typeof cb === 'function') cb();
  });

  socket.on('join_room', ({ roomId, username, userId, mediaId, mediaType }: { roomId: string, username: string, userId?: string, mediaId?: string, mediaType?: 'movie' | 'tv' }) => {
    let room = rooms[roomId];

    if (!room) {
      // Create new room if it doesn't exist
      room = {
        roomId,
        hostId: socket.id,
        users: {},
        playbackState: {
          isPlaying: false,
          timestamp: 0,
          lastUpdateTime: Date.now(),
          playbackRate: 1,
          mediaId,
          mediaType
        }
      };
      rooms[roomId] = room;
    }

    if (room.users[socket.id]) {
      socket.join(roomId);
      socket.emit('room_state_update', room);
      return;
    }

    if (userId) {
      const existingEntry = Object.values(room.users).find((user) => user.userId === userId);
      if (existingEntry) {
        const previousSocketId = existingEntry.id;
        const wasHost = room.hostId === previousSocketId;
        if (disconnectTimeouts[roomId]?.[previousSocketId]) {
          clearTimeout(disconnectTimeouts[roomId][previousSocketId]);
          delete disconnectTimeouts[roomId][previousSocketId];
        }
        delete room.users[previousSocketId];

        const updatedUser: User = {
          ...existingEntry,
          id: socket.id,
          userId,
          username: username || existingEntry.username,
          isHost: wasHost,
          isConnected: true,
        };

        room.users[socket.id] = updatedUser;
        if (wasHost) {
          room.hostId = socket.id;
        }
        socket.join(roomId);
        socket.emit('room_state_update', room);
        socket.to(roomId).emit('user_joined', updatedUser);
        if (!updatedUser.isHost && room.hostId && room.hostId !== socket.id) {
          io.to(room.hostId).emit('request_host_timeline', { roomId, requesterId: socket.id });
        }
        return;
      }
    }

    // First user in a new room is host; hostId is fixed until host disconnects
    if (Object.keys(room.users).length === 0) {
      room.hostId = socket.id;
    }

    const newUser: User = {
      id: socket.id,
      userId,
      username: username || `User-${socket.id.substring(0, 4)}`,
      isHost: room.hostId === socket.id,
      isConnected: true,
    };

    room.users[socket.id] = newUser;
    socket.join(roomId);

    // Send the current room state to the newly joined user
    socket.emit('room_state_update', room);

    // Notify others that a new user joined
    socket.to(roomId).emit('user_joined', newUser);
    if (!newUser.isHost && room.hostId && room.hostId !== socket.id) {
      io.to(room.hostId).emit('request_host_timeline', { roomId, requesterId: socket.id });
    }
    
    console.log(`User ${newUser.username} (${socket.id}) joined room ${roomId}`);
  });

  socket.on('request_host_timeline', ({ roomId, requesterId }: { roomId: string; requesterId: string }) => {
    const room = rooms[roomId];
    if (!room || !room.hostId || room.hostId === socket.id) return;
    if (!room.users[requesterId]) return;
    io.to(room.hostId).emit('request_host_timeline', { roomId, requesterId });
  });

  socket.on('host_timeline', (payload: { roomId: string; requesterId?: string; type?: 'play' | 'pause' | 'seek'; currentTime?: number; sentAt?: number; mediaId?: string; mediaType?: 'movie' | 'tv' }) => {
    if (
      !payload?.roomId ||
      !payload?.type ||
      typeof payload.currentTime !== 'number' ||
      !['play', 'pause', 'seek'].includes(payload.type)
    ) {
      return;
    }

    const room = rooms[payload.roomId];
    if (!room || room.hostId !== socket.id) return;

    room.playbackState.timestamp = payload.currentTime;
    room.playbackState.lastUpdateTime = Date.now();
    room.playbackState.isPlaying = payload.type === 'play';
    if (payload.mediaId) room.playbackState.mediaId = payload.mediaId;
    if (payload.mediaType) room.playbackState.mediaType = payload.mediaType;

    if (payload.requesterId && room.users[payload.requesterId]) {
      io.to(payload.requesterId).emit('host_timeline', payload);
    } else {
      socket.to(payload.roomId).emit('host_timeline', payload);
    }
  });

  // -------------------------------------------------------------------------
  // Watch party playback sync — single event, host-only authority
  // -------------------------------------------------------------------------
  socket.on('sync', (payload: { roomId?: string; type?: string; currentTime?: number }) => {
    console.log('RECEIVED', payload, 'from', socket.id);

    if (
      !payload?.roomId ||
      !payload?.type ||
      typeof payload.currentTime !== 'number' ||
      !['play', 'pause', 'seek'].includes(payload.type)
    ) {
      console.log('REJECTED: invalid sync payload', payload);
      return;
    }

    const room = rooms[payload.roomId];
    if (!room) {
      console.log('REJECTED: room not found', payload.roomId);
      return;
    }

    if (room.hostId !== socket.id) {
      console.log('REJECTED: sender is not host', { hostId: room.hostId, sender: socket.id });
      return;
    }

    room.playbackState.timestamp = payload.currentTime;
    room.playbackState.lastUpdateTime = Date.now();
    if (payload.type === 'play') {
      room.playbackState.isPlaying = true;
    } else if (payload.type === 'pause') {
      room.playbackState.isPlaying = false;
    }

    const broadcast = {
      roomId: payload.roomId,
      type: payload.type,
      currentTime: payload.currentTime,
      sentAt: Date.now(),
    };
    console.log('BROADCAST', broadcast);
    // Guests only — host already applied locally before EMIT
    socket.to(payload.roomId).emit('sync', broadcast);
  });

  socket.on('sync_state', (payload: { roomId?: string; type?: 'play' | 'pause' | 'seek'; currentTime?: number; sentAt?: number }) => {
    if (
      !payload?.roomId ||
      !payload?.type ||
      typeof payload.currentTime !== 'number' ||
      !['play', 'pause', 'seek'].includes(payload.type)
    ) {
      return;
    }

    const room = rooms[payload.roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;

    room.playbackState.timestamp = payload.currentTime;
    room.playbackState.lastUpdateTime = Date.now();
    if (payload.type === 'play') room.playbackState.isPlaying = true;
    else if (payload.type === 'pause') room.playbackState.isPlaying = false;

    socket.to(payload.roomId).emit('sync_state', {
      roomId: payload.roomId,
      type: payload.type,
      currentTime: payload.currentTime,
      sentAt: payload.sentAt ?? Date.now(),
    });
  });

  // Embedded chat functionality
  socket.on('send_message', ({ roomId, text }: { roomId: string, text: string }) => {
    const room = rooms[roomId];
    if (!room || !room.users[socket.id]) return;

    const user = room.users[socket.id];
    const message: ChatMessage = {
      id: uuidv4(), // Need uuid here
      userId: user.id,
      username: user.username,
      text,
      timestamp: Date.now()
    };

    io.to(roomId).emit('new_message', message);
  });

  // WebRTC signaling for peer-to-peer audio and video mesh
  socket.on('webrtc_signal', ({ to, signal }: { to: string, signal: any }) => {
    io.to(to).emit('webrtc_signal', {
      from: socket.id,
      signal
    });
  });

  socket.on('join_call', ({ roomId }: { roomId: string }) => {
    socket.to(roomId).emit('user_joined_call', socket.id);
  });

  socket.on('leave_call', ({ roomId }: { roomId: string }) => {
    socket.to(roomId).emit('user_left_call', socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find rooms the user was in
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (room.users[socket.id]) {
        const user = room.users[socket.id];
        user.isConnected = false;

        if (!disconnectTimeouts[roomId]) disconnectTimeouts[roomId] = {};
        if (disconnectTimeouts[roomId][socket.id]) {
          clearTimeout(disconnectTimeouts[roomId][socket.id]);
        }
        disconnectTimeouts[roomId][socket.id] = setTimeout(() => {
          delete disconnectTimeouts[roomId][socket.id];

          const cleanupRoom = rooms[roomId];
          if (!cleanupRoom) return;

          const disconnectedUser = cleanupRoom.users[socket.id];
          if (!disconnectedUser || disconnectedUser.isConnected !== false) return;

          const wasHost = cleanupRoom.hostId === socket.id;
          delete cleanupRoom.users[socket.id];

          if (Object.keys(cleanupRoom.users).length === 0) {
            delete rooms[roomId];
            delete disconnectTimeouts[roomId];
            console.log(`Room ${roomId} deleted as it is empty.`);
            return;
          }

          if (wasHost) {
            const newHostId = Object.keys(cleanupRoom.users)[0];
            cleanupRoom.hostId = newHostId;
            cleanupRoom.users[newHostId].isHost = true;
            io.to(roomId).emit('host_changed', newHostId);
          }
        }, ROOM_GRACE_PERIOD_MS);
        
        // Notify connected clients that the user temporarily left
        socket.to(roomId).emit('user_left', socket.id);
      }
    }
  });
});

const PORT = Number(process.env.PORT) || 3002;

function shutdown(_signal: string) {
  server.close(() => {
    io.close(() => process.exit(0));
  });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGUSR2'] as const) {
  process.once(signal, () => shutdown(signal));
}

// Only start the server listening port if we are NOT running in a serverless environment (Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a different value.`);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`Watch Party Server running on port ${PORT}`);
  });
}

export default app;
