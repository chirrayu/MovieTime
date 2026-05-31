import { RoomState, User } from '../types';
import { redisClient } from '../redis/client';

const ROOM_PREFIX = 'room:';

export class RoomService {
  /**
   * Retrieves a room's state from Redis or Memory
   */
  static async getRoom(roomId: string): Promise<RoomState | null> {
    const raw = await redisClient.get(`${ROOM_PREFIX}${roomId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RoomState;
    } catch (err) {
      console.error('Failed to parse room state', err);
      return null;
    }
  }

  /**
   * Saves a room's state to Redis or Memory
   */
  static async saveRoom(room: RoomState): Promise<void> {
    await redisClient.set(`${ROOM_PREFIX}${room.roomId}`, JSON.stringify(room));
  }

  /**
   * Initializes a room if it doesn't exist
   */
  static async initRoom(roomId: string, hostSocketId: string, mediaId?: string, mediaType?: 'movie' | 'tv'): Promise<RoomState> {
    const existing = await this.getRoom(roomId);
    if (existing) return existing;

    const newRoom: RoomState = {
      roomId,
      hostId: hostSocketId,
      users: {},
      playbackState: {
        isPlaying: false,
        timestamp: 0,
        lastUpdateTime: Date.now(),
        mediaId,
        mediaType,
      },
    };

    await this.saveRoom(newRoom);
    return newRoom;
  }

  /**
   * Adds or updates a user in the room
   */
  static async addUser(roomId: string, user: User): Promise<RoomState | null> {
    const room = await this.getRoom(roomId);
    if (!room) return null;

    room.users[user.id] = user;
    if (user.isHost) {
      room.hostId = user.id;
    }
    
    await this.saveRoom(room);
    return room;
  }

  /**
   * Removes a user from the room and handles host migration if necessary
   */
  static async removeUser(roomId: string, socketId: string): Promise<{ room: RoomState | null; deleted: boolean; newHostId?: string }> {
    const room = await this.getRoom(roomId);
    if (!room) return { room: null, deleted: false };

    const wasHost = room.hostId === socketId;
    delete room.users[socketId];

    // If room is empty, delete it
    if (Object.keys(room.users).length === 0) {
      await redisClient.del(`${ROOM_PREFIX}${roomId}`);
      return { room: null, deleted: true };
    }

    let newHostId;
    // Migrate host
    if (wasHost) {
      newHostId = Object.keys(room.users)[0];
      room.hostId = newHostId;
      room.users[newHostId].isHost = true;
    }

    await this.saveRoom(room);
    return { room, deleted: false, newHostId };
  }
}
