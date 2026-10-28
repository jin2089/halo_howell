export interface PjaxCacheEntry {
  html: string;
  storedAt: number;
}

export interface PjaxCacheOptions {
  /** Maximum number of pages kept in memory. */
  capacity?: number;
  /** Entry lifetime in milliseconds. */
  ttl?: number;
  /** Injectable clock, so that the cache stays testable in Node. */
  now?: () => number;
}

export interface PjaxCache {
  get(url: string): string | null;
  set(url: string, html: string): void;
  prune(): void;
  size(): number;
}

export const DEFAULT_CACHE_CAPACITY = 12;
export const DEFAULT_CACHE_TTL = 300_000;

/**
 * In-memory LRU cache for Pjax responses.
 *
 * Stores the raw HTML text rather than a parsed Document: navigating moves nodes out of the
 * incoming document, which would corrupt a cached Document. Text can be re-parsed on demand.
 */
export function createPjaxCache(options: PjaxCacheOptions = {}): PjaxCache {
  const capacity = Math.max(1, options.capacity ?? DEFAULT_CACHE_CAPACITY);
  const ttl = Math.max(0, options.ttl ?? DEFAULT_CACHE_TTL);
  const now = options.now ?? Date.now;
  const entries = new Map<string, PjaxCacheEntry>();

  const isExpired = (entry: PjaxCacheEntry): boolean => now() - entry.storedAt > ttl;

  return {
    get(url) {
      const entry = entries.get(url);

      if (!entry) {
        return null;
      }

      if (isExpired(entry)) {
        entries.delete(url);
        return null;
      }

      // Refresh recency on hit so that the LRU order stays accurate.
      entries.delete(url);
      entries.set(url, entry);

      return entry.html;
    },
    set(url, html) {
      if (!html) {
        return;
      }

      entries.delete(url);
      entries.set(url, { html, storedAt: now() });

      while (entries.size > capacity) {
        const oldest = entries.keys().next();

        if (oldest.done) {
          break;
        }

        entries.delete(oldest.value);
      }
    },
    prune() {
      for (const [url, entry] of entries) {
        if (isExpired(entry)) {
          entries.delete(url);
        }
      }
    },
    size() {
      return entries.size;
    },
  };
}
