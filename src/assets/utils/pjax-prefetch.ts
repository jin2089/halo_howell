import type { PjaxCache } from "./pjax-cache";

export type PrefetchFetchText = (url: string, signal: AbortSignal) => Promise<string>;

export interface PrefetcherOptions {
  cache: PjaxCache;
  fetchText: PrefetchFetchText;
  maxConcurrent?: number;
}

export interface Prefetcher {
  request(url: string): void;
  pending(): number;
  queued(): number;
  destroy(): void;
}

/**
 * Schedules prefetch requests with de-duplication and a concurrency cap.
 * Kept free of DOM APIs so that it can be unit tested in a Node environment.
 */
export function createPrefetcher(options: PrefetcherOptions): Prefetcher {
  const { cache, fetchText } = options;
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 2);
  const queue: string[] = [];
  const active = new Map<string, AbortController>();
  let destroyed = false;

  function pump(): void {
    while (!destroyed && active.size < maxConcurrent && queue.length > 0) {
      const url = queue.shift();

      if (url === undefined) {
        return;
      }

      if (active.has(url) || cache.get(url) !== null) {
        continue;
      }

      const controller = new AbortController();
      active.set(url, controller);

      void fetchText(url, controller.signal)
        .then((html) => {
          if (!destroyed) {
            cache.set(url, html);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          active.delete(url);
          pump();
        });
    }
  }

  return {
    request(url) {
      if (destroyed || active.has(url) || queue.includes(url) || cache.get(url) !== null) {
        return;
      }

      queue.push(url);
      pump();
    },
    pending: () => active.size,
    queued: () => queue.length,
    destroy() {
      destroyed = true;
      queue.length = 0;

      for (const controller of active.values()) {
        controller.abort();
      }

      active.clear();
    },
  };
}

export interface PrefetchInitOptions {
  cache: PjaxCache;
  /** Same-origin, non-skipped html links only. */
  isEligible: (url: string) => boolean;
  /** Hover delay before a request is issued. */
  delay?: number;
  maxConcurrent?: number;
  timeout?: number;
}

const PAGE_MARKER = 'id="pjax-container"';

async function fetchPageText(url: string, signal: AbortSignal, timeout: number): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();

  signal.addEventListener("abort", abort, { once: true });
  const timer = window.setTimeout(abort, timeout);

  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    const text = await response.text();

    // Only cache pages that can actually be swapped in, never a login or error page.
    return text.includes(PAGE_MARKER) ? text : "";
  } catch {
    return "";
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

/**
 * Warms the cache when the visitor shows intent (hover or keyboard focus).
 * Returns an unsubscribe function.
 */
export function initPrefetch(options: PrefetchInitOptions): () => void {
  const { cache, isEligible, delay = 120, maxConcurrent = 2, timeout = 5000 } = options;

  const prefetcher = createPrefetcher({
    cache,
    maxConcurrent,
    fetchText: (url, signal) => fetchPageText(url, signal, timeout),
  });

  const timers = new Map<string, number>();

  const clearTimer = (url: string): void => {
    const timer = timers.get(url);

    if (timer === undefined) {
      return;
    }

    window.clearTimeout(timer);
    timers.delete(url);
  };

  const resolveUrl = (event: Event): string | null => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return null;
    }

    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    const href = anchor?.getAttribute("href");

    if (!href) {
      return null;
    }

    const url = new URL(href, window.location.href);

    return isEligible(url.href) ? url.href : null;
  };

  const schedule = (url: string, wait: number): void => {
    if (timers.has(url)) {
      return;
    }

    const timer = window.setTimeout(() => {
      timers.delete(url);
      prefetcher.request(url);
    }, wait);

    timers.set(url, timer);
  };

  const onPointerOver = (event: PointerEvent): void => {
    const url = resolveUrl(event);

    if (url) {
      schedule(url, delay);
    }
  };

  const onPointerOut = (event: PointerEvent): void => {
    const url = resolveUrl(event);

    if (url) {
      clearTimer(url);
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const url = resolveUrl(event);

    if (url) {
      schedule(url, 0);
    }
  };

  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("focusin", onFocusIn);

  return () => {
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("focusin", onFocusIn);

    for (const timer of timers.values()) {
      window.clearTimeout(timer);
    }

    timers.clear();
    prefetcher.destroy();
  };
}
