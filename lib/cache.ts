import { createHash } from 'crypto'
import Redis from 'ioredis'

// Redis client with fallback to in-memory cache
class CacheManager {
  private redis: Redis | null = null
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map()
  private readonly CACHE_PREFIX = 'data-wiz:'
  
  constructor() {
    this.initializeRedis()
  }

  private async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL)
        console.log('✅ Redis cache initialized')
      } else {
        console.log('⚠️ Redis not configured, using in-memory cache')
      }
    } catch (error) {
      console.error('❌ Redis initialization failed:', error)
      this.redis = null
    }
  }

  // Generate cache key based on file content and operation
  private generateCacheKey(fileId: string, operation: string, additionalData?: any): string {
    const dataString = additionalData ? JSON.stringify(additionalData) : ''
    const hash = createHash('sha256')
      .update(`${fileId}:${operation}:${dataString}`)
      .digest('hex')
    return `${this.CACHE_PREFIX}${operation}:${hash}`
  }

  // Cache ML analysis results
  async cacheMLAnalysis(fileId: string, fileContent: string, results: any, ttl: number = 3600): Promise<void> {
    const contentHash = createHash('sha256').update(fileContent).digest('hex')
    const cacheKey = this.generateCacheKey(fileId, 'ml_analysis', { contentHash })
    
    const cacheData = {
      results,
      timestamp: Date.now(),
      contentHash,
      fileId
    }

    await this.set(cacheKey, cacheData, ttl)
  }

  // Get cached ML analysis
  async getCachedMLAnalysis(fileId: string, fileContent: string): Promise<any | null> {
    const contentHash = createHash('sha256').update(fileContent).digest('hex')
    const cacheKey = this.generateCacheKey(fileId, 'ml_analysis', { contentHash })
    
    const cached = await this.get(cacheKey)
    if (cached && cached.contentHash === contentHash) {
      console.log('🎯 Cache hit for ML analysis:', fileId)
      return cached.results
    }
    
    return null
  }

  // Cache cleaning operation results
  async cacheCleaning(fileId: string, operation: string, inputData: string, results: any, ttl: number = 1800): Promise<void> {
    const inputHash = createHash('sha256').update(inputData).digest('hex')
    const cacheKey = this.generateCacheKey(fileId, `cleaning_${operation}`, { inputHash })
    
    const cacheData = {
      results,
      timestamp: Date.now(),
      inputHash,
      operation
    }

    await this.set(cacheKey, cacheData, ttl)
  }

  // Get cached cleaning results
  async getCachedCleaning(fileId: string, operation: string, inputData: string): Promise<any | null> {
    const inputHash = createHash('sha256').update(inputData).digest('hex')
    const cacheKey = this.generateCacheKey(fileId, `cleaning_${operation}`, { inputHash })
    
    const cached = await this.get(cacheKey)
    if (cached && cached.inputHash === inputHash) {
      console.log('🎯 Cache hit for cleaning operation:', operation)
      return cached.results
    }
    
    return null
  }

  // Generic cache operations
  private async set(key: string, value: any, ttl: number): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.setex(key, ttl, JSON.stringify(value))
      } else {
        // In-memory cache with TTL
        this.memoryCache.set(key, {
          data: value,
          expiry: Date.now() + (ttl * 1000)
        })
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  private async get(key: string): Promise<any | null> {
    try {
      if (this.redis) {
        const cached = await this.redis.get(key)
        return cached ? JSON.parse(cached) : null
      } else {
        // In-memory cache
        const cached = this.memoryCache.get(key)
        if (cached) {
          if (Date.now() < cached.expiry) {
            return cached.data
          } else {
            this.memoryCache.delete(key)
          }
        }
        return null
      }
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  // Clear cache for specific file
  async clearFileCache(fileId: string): Promise<void> {
    try {
      if (this.redis) {
        const pattern = `${this.CACHE_PREFIX}*:*${fileId}*`
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          await this.redis.del(...keys)
        }
      } else {
        // Clear in-memory cache
        for (const [key] of this.memoryCache.entries()) {
          if (key.includes(fileId)) {
            this.memoryCache.delete(key)
          }
        }
      }
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  // Cache statistics
  async getCacheStats(): Promise<any> {
    try {
      if (this.redis) {
        const info = await this.redis.info('memory')
        return {
          type: 'redis',
          info: info
        }
      } else {
        return {
          type: 'memory',
          size: this.memoryCache.size,
          keys: Array.from(this.memoryCache.keys())
        }
      }
    } catch (error) {
      return { error: error.message }
    }
  }
}

export const cacheManager = new CacheManager()
export default cacheManager