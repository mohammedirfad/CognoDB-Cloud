import NodeCache from "node-cache";
import { env } from "../config/env";

const cache = new NodeCache({ stdTTL: env.CACHE_TTL_SECONDS, checkperiod: env.CACHE_TTL_SECONDS * 2 });

/**
 * Memoizes an async producer behind a TTL cache. Benchmark results are
 * expensive to read/parse and change rarely (only when a new run
 * completes), so a short TTL cache meaningfully cuts latency and I/O on a
 * dashboard that polls this API.
 */
export async function cached<T>(key: string, ttlSeconds: number, produce: () => Promise<T> | T): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const value = await produce();
  cache.set(key, value, ttlSeconds);
  return value;
}

export function invalidate(key: string): void {
  cache.del(key);
}

export function invalidateAll(): void {
  cache.flushAll();
}
