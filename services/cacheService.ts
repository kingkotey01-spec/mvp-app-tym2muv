import { logger } from '../utils/logger';

/**
 * Clean, safe client-side in-memory caching engine.
 * Eliminates the security risk of baking read/write Upstash Redis REST credentials in public client bundles.
 * This ensures that cache pollution or erasure is impossible from browser DevTools, while retaining
 * performant client-side query and response caching.
 */
class InMemoryRedisClient {
  private cache = new Map<string, { value: any; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<void> {
    const ttl = options?.ex ?? 3600; // default 1 hour in seconds
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) {
      this.cache.delete(key);
    }
  }

  async scan(cursor: number | string, options?: { match?: string; count?: number }): Promise<[number | string, string[]]> {
    const matchPattern = options?.match;
    if (!matchPattern) return [0, []];
    
    // Convert match pattern (e.g. "prefix:*") to prefix check
    const prefix = matchPattern.replace('*', '');
    const keys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      // Clean up naturally during scan if expired
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        continue;
      }
      if (key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return [0, keys];
  }

  clear(): void {
    this.cache.clear();
  }
}

// In-Memory Redis client instance to support existing references safely without token exposure
export const redisClient = new InMemoryRedisClient();

/**
 * Valid caching TTLs in seconds as requested:
 * - Properties/Listings: 5 minutes (300s)
 * - User Profiles: 10 minutes (600s)
 * - Location Data: 1 hour (3600s)
 * - Search Results: 2 minutes (120s)
 */
export const CACHE_TTL = {
  LISTINGS: 300,
  PROFILES: 600,
  LOCATION: 3600,
  SEARCH: 120,
};

/**
 * Generates a consistent cache key based on a prefix and parameters
 */
export const cacheKey = (prefix: string, params?: Record<string, any> | string): string => {
  if (!params) return prefix;
  if (typeof params === 'string') return `${prefix}:${params}`;
  
  // Sort keys to ensure consistent JSON stringification
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);
    
  return `${prefix}:${JSON.stringify(sortedParams)}`;
};

/**
 * Gets a value from the cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;
  
  try {
    const getPromise = redisClient.get<T>(key);
    const data = await Promise.race([
      getPromise,
      new Promise<null>((resolve) => setTimeout(() => {
        logger.warn(`[CACHE TIMEOUT] Get operation timed out for key: ${key}`);
        resolve(null);
      }, 600))
    ]);

    if (data) {
      logger.info(`[CACHE HIT] ${key}`);
      return data;
    }
    logger.info(`[CACHE MISS] ${key}`);
    return null;
  } catch (error) {
    logger.error(`Error reading from redis cache (key: ${key}):`, { error });
    return null;
  }
}

/**
 * Sets a value in the cache with a TTL (in seconds)
 */
export async function setCache<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  if (!redisClient) return;
  
  try {
    const setPromise = redisClient.set(key, value, { ex: ttlSeconds });

    await Promise.race([
      setPromise,
      new Promise<void>((resolve) => setTimeout(() => {
        logger.warn(`[CACHE TIMEOUT] Set operation timed out for key: ${key}`);
        resolve();
      }, 600))
    ]);
    logger.info(`[CACHE SET] ${key}`);
  } catch (error) {
    logger.error(`Error writing to redis cache (key: ${key}):`, { error });
  }
}

/**
 * Deletes a specific key from the cache
 */
export async function delCache(key: string): Promise<void> {
  if (!redisClient) return;
  
  try {
    const delPromise = redisClient.del(key);
    await Promise.race([
      delPromise,
      new Promise<void>((resolve) => setTimeout(() => {
        logger.warn(`[CACHE TIMEOUT] Del operation timed out for key: ${key}`);
        resolve();
      }, 600))
    ]);
    logger.info(`[CACHE DEL] ${key}`);
  } catch (error) {
    logger.error(`Error deleting from redis cache (key: ${key}):`, { error });
  }
}

/**
 * Invalidates cache by pattern or multiple keys
 */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  if (!redisClient) return;
  
  try {
    let cursor: number | string = 0;
    const startTime = Date.now();
    do {
      if (Date.now() - startTime > 1500) {
        logger.warn(`[CACHE TIMEOUT] Invalidate prefix scan exceeded limit for prefix: ${prefix}`);
        break;
      }

      const scanPromise = redisClient.scan(cursor, { match: `${prefix}*`, count: 100 });
      const result = await Promise.race([
        scanPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 600))
      ]);

      if (!result) {
        logger.warn(`[CACHE TIMEOUT] Invalidate scan operation timed out for prefix: ${prefix}`);
        break;
      }

      cursor = result[0];
      const keys = result[1];
      
      if (keys.length > 0) {
        const delPromise = redisClient.del(...keys);
        await Promise.race([
          delPromise,
          new Promise<void>((resolve) => setTimeout(() => resolve(), 600))
        ]);
      }
    } while (cursor !== 0 && cursor !== '0');
    logger.info(`[CACHE INVALIDATE PREFIX] ${prefix}*`);
  } catch (error) {
    logger.error(`Error invalidating redis cache prefix (prefix: ${prefix}):`, { error });
  }
}

/**
 * Wrapper to fetch data from cache, or fallback to a promise and set cache if missed.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = CACHE_TTL.LISTINGS
): Promise<T> {
  if (!redisClient) {
    return await fetcher();
  }

  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  
  if (data !== undefined && data !== null) {
    await setCache(key, data, ttlSeconds);
  }
  
  return data;
}
