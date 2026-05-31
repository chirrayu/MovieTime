import { Server, Socket } from 'socket.io';
import { RoomService } from '../services/RoomService';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../types';

export function setupChatNamespace(io: Server) {
  const chatNs = io.of('/watch-party');

  chatNs.on('connection', (socket: Socket) => {
    
    // Text Chat Messages
    socket.on('send_message', async ({ roomId, text }: { roomId: string, text: string }) => {
      if (!roomId || !text.trim()) return;

      const room = await RoomService.getRoom(roomId);
      if (!room || !room.users[socket.id]) return;

      const user = room.users[socket.id];
      const message: ChatMessage = {
        id: uuidv4(),
        userId: user.id,
        username: user.username,
        text,
        timestamp: Date.now()
      };

      chatNs.to(roomId).emit('new_message', message);
    });

    // Emoji Reactions overlay
    socket.on('send_reaction', async ({ roomId, emoji, timestamp }: { roomId: string, emoji: string, timestamp: number }) => {
      if (!roomId || !emoji) return;
      
      const room = await RoomService.getRoom(roomId);
      if (!room || !room.users[socket.id]) return;

      chatNs.to(roomId).emit('reaction_event', {
        userId: socket.id,
        username: room.users[socket.id].username,
        emoji,
        timestamp
      });
    });

  });
}
