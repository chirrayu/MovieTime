import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSyncNamespace } from './sockets/sync.namespace';
import { setupChatNamespace } from './sockets/chat.namespace';
import { setupPresenceNamespace } from './sockets/presence.namespace';

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
  transports: ['polling', 'websocket']
});

// Setup scalable namespace modules
setupSyncNamespace(io);
setupChatNamespace(io);
setupPresenceNamespace(io);

app.get('/health', (req, res) => {
  res.send('Watch Party Server is running with Enterprise Architecture');
});

const PORT = Number(process.env.PORT) || 3002;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Watch Party Server running on port ${PORT}`);
  });
}

export default app;
