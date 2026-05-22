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

app.get('/health', (req, res) => {
  res.send('Watch Party Server is running');
});

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Heartbeat to keep connection alive and sync latency if needed
  socket.on('ping', (cb) => {
    if (typeof cb === 'function') cb();
  });

  socket.on('join_room', ({ roomId, username, mediaId, mediaType }: { roomId: string, username: string, mediaId?: string, mediaType?: 'movie' | 'tv' }) => {
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
          mediaId,
          mediaType
        }
      };
      rooms[roomId] = room;
    }

    const isHost = room.hostId === socket.id || Object.keys(room.users).length === 0;
    
    // In case the host left and someone else joins, or it's the first user
    if (isHost && room.hostId !== socket.id) {
        room.hostId = socket.id;
    }

    const newUser: User = {
      id: socket.id,
      username: username || `User-${socket.id.substring(0, 4)}`,
      isHost
    };

    room.users[socket.id] = newUser;
    socket.join(roomId);

    // Send the current room state to the newly joined user
    socket.emit('room_state_update', room);

    // Notify others that a new user joined
    socket.to(roomId).emit('user_joined', newUser);
    
    console.log(`User ${newUser.username} (${socket.id}) joined room ${roomId}`);
  });

  socket.on('sync', (payload: { roomId: string; type: 'play' | 'pause' | 'seek'; currentTime: number }) => {
    console.log('RECEIVED', payload, 'from', socket.id);

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
    if (payload.type === 'play') room.playbackState.isPlaying = true;
    else if (payload.type === 'pause') room.playbackState.isPlaying = false;

    const broadcast = { roomId: payload.roomId, type: payload.type, currentTime: payload.currentTime };
    console.log('BROADCAST', broadcast);
    socket.to(payload.roomId).emit('sync', broadcast);
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
        delete room.users[socket.id];
        
        // If room is empty, clean it up
        if (Object.keys(room.users).length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted as it is empty.`);
        } else {
          // If the host disconnected, assign a new host randomly
          if (room.hostId === socket.id) {
            const newHostId = Object.keys(room.users)[0];
            room.hostId = newHostId;
            room.users[newHostId].isHost = true;
            io.to(roomId).emit('host_changed', newHostId);
          }
          
          socket.to(roomId).emit('user_left', socket.id);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
// Only start the server listening port if we are NOT running in a serverless environment (Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Watch Party Server running on port ${PORT}`);
  });
}

export default app;
