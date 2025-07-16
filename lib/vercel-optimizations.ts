// Vercel-specific optimizations for external MongoDB/Redis connection

import { MongoClient, MongoClientOptions } from 'mongodb'
import Redis from 'ioredis'

// Connection pooling for MongoDB
const mongoOptions: MongoClientOptions = {
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10'),
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2'),
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT || '30000'),
  socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '30000'),
  // Optimize for serverless
  bufferMaxEntries: 0,
  useUnifiedTopology: true,
  // Connection retry
  retryWrites: true,
  retryReads: true,
  // Compression
  compressors: ['zlib'],
  // SSL/TLS for secure connection to Hetzner
  tls: process.env.NODE_ENV === 'production',
  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelay: 300000,
}

// Redis options for external server
const redisOptions = {
  host: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).hostname : 'localhost',
  port: process.env.REDIS_URL ? parseInt(new URL(process.env.REDIS_URL).port) : 6379,
  password: process.env.REDIS_URL ? new URL(process.env.REDIS_URL).password : undefined,
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
  commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  // Optimize for serverless
  lazyConnect: true,
  keepAlive: 30000,
  // Connection pooling
  family: 4,
  // Reconnection strategy
  reconnectOnError: (err) => {
    const targetError = 'READONLY'
    return err.message.includes(targetError)
  },
  // TLS for production
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
}

// Singleton pattern for connections
class ConnectionManager {
  private static mongoClient: MongoClient | null = null
  private static redisClient: Redis | null = null
  private static mongoPromise: Promise<MongoClient> | null = null

  static async getMongoClient(): Promise<MongoClient> {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined')
    }

    if (this.mongoClient) {
      return this.mongoClient
    }

    if (!this.mongoPromise) {
      this.mongoPromise = MongoClient.connect(process.env.MONGODB_URI, mongoOptions)
    }

    this.mongoClient = await this.mongoPromise
    return this.mongoClient
  }

  static getRedisClient(): Redis {
    if (!this.redisClient) {
      this.redisClient = new Redis(redisOptions)
      
      // Error handling
      this.redisClient.on('error', (err) => {
        console.error('Redis connection error:', err)
      })

      this.redisClient.on('connect', () => {
        console.log('✅ Redis connected to external server')
      })
    }

    return this.redisClient
  }

  // Health check for external services
  static async checkConnections(): Promise<{
    mongodb: boolean
    redis: boolean
    latency: { mongodb: number; redis: number }
  }> {
    const result = {
      mongodb: false,
      redis: false,
      latency: { mongodb: 0, redis: 0 }
    }

    // Check MongoDB
    try {
      const start = Date.now()
      const client = await this.getMongoClient()
      await client.db().admin().ping()
      result.mongodb = true
      result.latency.mongodb = Date.now() - start
    } catch (error) {
      console.error('MongoDB health check failed:', error)
    }

    // Check Redis
    try {
      const start = Date.now()
      const redis = this.getRedisClient()
      await redis.ping()
      result.redis = true
      result.latency.redis = Date.now() - start
    } catch (error) {
      console.error('Redis health check failed:', error)
    }

    return result
  }

  // Graceful shutdown
  static async closeConnections(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close()
      this.mongoClient = null
      this.mongoPromise = null
    }

    if (this.redisClient) {
      this.redisClient.disconnect()
      this.redisClient = null
    }
  }
}

// Vercel-specific timeout handling
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  ])
}

// Rate limiting for external services
export class ExternalServiceRateLimiter {
  private static requests: Map<string, number[]> = new Map()
  private static readonly WINDOW_SIZE = 60000 // 1 minute
  private static readonly MAX_REQUESTS = 100

  static async checkRateLimit(serviceKey: string): Promise<boolean> {
    const now = Date.now()
    const windowStart = now - this.WINDOW_SIZE
    
    const requests = this.requests.get(serviceKey) || []
    const recentRequests = requests.filter(time => time > windowStart)
    
    if (recentRequests.length >= this.MAX_REQUESTS) {
      return false
    }

    recentRequests.push(now)
    this.requests.set(serviceKey, recentRequests)
    return true
  }
}

// Connection retry with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      if (attempt === maxRetries) {
        throw lastError
      }

      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export { ConnectionManager, mongoOptions, redisOptions }