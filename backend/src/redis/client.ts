import { Redis } from 'ioredis';

// Graceful fallback memory store if Redis is unavailable
const memoryStore = new Map<string, string>();

class RedisStore {
  private redis: Redis | null = null;
  private isConnected = false;

  constructor() {
    // Attempt to connect to local Redis, but don't crash if it fails
    const client = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        // Stop retrying after 2 attempts to quickly fallback to memory
        if (times > 2) {
          return null;
        }
        return Math.min(times * 50, 2000);
      },
    });

    client.on('connect', () => {
      console.log('Redis connected successfully');
      this.isConnected = true;
      this.redis = client;
    });

    client.on('error', (err) => {
      if (this.isConnected) {
        console.warn('Redis connection lost, falling back to memory store.');
      } else {
        console.warn('Redis not available. Using graceful in-memory fallback.');
      }
      this.isConnected = false;
      this.redis = null;
    });
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.set(key, value);
        return;
      } catch (err) {
        console.warn('Redis set error:', err);
      }
    }
    memoryStore.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.redis) {
      try {
        return await this.redis.get(key);
      } catch (err) {
        console.warn('Redis get error:', err);
      }
    }
    return memoryStore.get(key) || null;
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (err) {
        console.warn('Redis del error:', err);
      }
    }
    memoryStore.delete(key);
  }
}

export const redisClient = new RedisStore();
