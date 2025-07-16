import Redis from 'ioredis'

if (!process.env.REDIS_URL) {
  console.warn('REDIS_URL not found, Redis features will be disabled')
}

// Create Redis client
const redis = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  : null

// Helper functions for caching
export class RedisCache {
  static async get(key: string): Promise<string | null> {
    if (!redis) return null
    try {
      return await redis.get(key)
    } catch (error) {
      console.error('Redis GET error:', error)
      return null
    }
  }

  static async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!redis) return false
    try {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value)
      } else {
        await redis.set(key, value)
      }
      return true
    } catch (error) {
      console.error('Redis SET error:', error)
      return false
    }
  }

  static async del(key: string): Promise<boolean> {
    if (!redis) return false
    try {
      await redis.del(key)
      return true
    } catch (error) {
      console.error('Redis DEL error:', error)
      return false
    }
  }

  static async exists(key: string): Promise<boolean> {
    if (!redis) return false
    try {
      const result = await redis.exists(key)
      return result === 1
    } catch (error) {
      console.error('Redis EXISTS error:', error)
      return false
    }
  }

  // Cache with JSON serialization
  static async setJSON(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value)
      return await this.set(key, jsonString, ttlSeconds)
    } catch (error) {
      console.error('Redis setJSON error:', error)
      return false
    }
  }

  static async getJSON<T>(key: string): Promise<T | null> {
    try {
      const jsonString = await this.get(key)
      if (!jsonString) return null
      return JSON.parse(jsonString) as T
    } catch (error) {
      console.error('Redis getJSON error:', error)
      return null
    }
  }

  // Rate limiting
  static async rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (!redis) return { allowed: true, remaining: limit - 1, resetTime: Date.now() + windowSeconds * 1000 }
    
    try {
      const current = await redis.incr(key)
      
      if (current === 1) {
        await redis.expire(key, windowSeconds)
      }
      
      const ttl = await redis.ttl(key)
      const resetTime = Date.now() + ttl * 1000
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime
      }
    } catch (error) {
      console.error('Redis rate limit error:', error)
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + windowSeconds * 1000 }
    }
  }
}

export default redis 