const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  size(): number {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

export function cacheKey(parts: Record<string, string | null | undefined>): string {
  return JSON.stringify(
    Object.keys(parts)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = parts[key] ?? "";
        return acc;
      }, {}),
  );
}

let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheHit(): void {
  cacheHits += 1;
}

export function recordCacheMiss(): void {
  cacheMisses += 1;
}

export function cacheHitRate(): number {
  const total = cacheHits + cacheMisses;
  if (total === 0) return 0;
  return Math.round((cacheHits / total) * 1000) / 10;
}

export function resetCacheStatsForTests(): void {
  cacheHits = 0;
  cacheMisses = 0;
}
