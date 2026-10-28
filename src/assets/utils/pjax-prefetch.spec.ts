import { describe, expect, it } from "vite-plus/test";

import { createPjaxCache } from "./pjax-cache";
import { createPrefetcher, type PrefetchFetchText } from "./pjax-prefetch";

interface Deferred {
  promise: Promise<string>;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}

function deferred(): Deferred {
  let resolveFn: (value: string) => void = () => undefined;
  let rejectFn: (reason?: unknown) => void = () => undefined;

  const promise = new Promise<string>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return {
    promise,
    resolve: (value: string) => resolveFn(value),
    reject: (reason?: unknown) => rejectFn(reason),
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createPrefetcher", () => {
  it("de-duplicates concurrent requests for the same url", async () => {
    const cache = createPjaxCache();
    const requested: string[] = [];
    const prefetcher = createPrefetcher({
      cache,
      fetchText: () => {
        requested.push("call");
        return new Promise<string>(() => undefined);
      },
    });

    prefetcher.request("/a");
    prefetcher.request("/a");

    expect(requested).toHaveLength(1);
  });

  it("skips urls that are already cached", () => {
    const cache = createPjaxCache();
    cache.set("/a", "<html>a</html>");

    const requested: string[] = [];
    const prefetcher = createPrefetcher({
      cache,
      fetchText: (url) => {
        requested.push(url);
        return Promise.resolve("");
      },
    });

    prefetcher.request("/a");

    expect(requested).toHaveLength(0);
  });

  it("writes fetched html into the cache", async () => {
    const cache = createPjaxCache();
    const prefetcher = createPrefetcher({
      cache,
      fetchText: () => Promise.resolve("<html>page</html>"),
    });

    prefetcher.request("/a");
    await flush();

    expect(cache.get("/a")).toBe("<html>page</html>");
    expect(prefetcher.pending()).toBe(0);
  });

  it("respects the concurrency cap and drains the queue", async () => {
    const cache = createPjaxCache();
    const started: string[] = [];
    const pending = new Map<string, Deferred>();

    const fetchText: PrefetchFetchText = (url) => {
      started.push(url);
      const item = deferred();
      pending.set(url, item);
      return item.promise;
    };

    const prefetcher = createPrefetcher({ cache, fetchText, maxConcurrent: 2 });

    prefetcher.request("/a");
    prefetcher.request("/b");
    prefetcher.request("/c");

    expect(started).toEqual(["/a", "/b"]);
    expect(prefetcher.queued()).toBe(1);

    pending.get("/a")?.resolve("a");
    await flush();

    expect(started).toEqual(["/a", "/b", "/c"]);
    expect(prefetcher.pending()).toBe(2);
  });

  it("does not cache failures and allows a retry", async () => {
    const cache = createPjaxCache();
    let attempts = 0;

    const prefetcher = createPrefetcher({
      cache,
      fetchText: () => {
        attempts += 1;
        return Promise.reject(new Error("network"));
      },
    });

    prefetcher.request("/a");
    await flush();

    expect(cache.get("/a")).toBeNull();
    expect(prefetcher.pending()).toBe(0);

    prefetcher.request("/a");
    await flush();

    expect(attempts).toBe(2);
  });

  it("aborts in-flight requests on destroy and stops accepting new ones", async () => {
    const cache = createPjaxCache();
    const signals: AbortSignal[] = [];

    const prefetcher = createPrefetcher({
      cache,
      fetchText: (_url, signal) => {
        signals.push(signal);
        return new Promise<string>(() => undefined);
      },
    });

    prefetcher.request("/a");
    prefetcher.destroy();

    expect(signals[0]?.aborted).toBe(true);

    prefetcher.request("/b");
    expect(signals).toHaveLength(1);
  });
});
