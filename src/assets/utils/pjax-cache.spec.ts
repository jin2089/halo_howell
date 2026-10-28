import { describe, expect, it } from "vite-plus/test";

import { createPjaxCache, DEFAULT_CACHE_CAPACITY } from "./pjax-cache";

function createClock(start = 1000) {
  let current = start;

  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("createPjaxCache", () => {
  it("stores and returns html", () => {
    const cache = createPjaxCache();
    cache.set("/posts/a", "<html>a</html>");

    expect(cache.get("/posts/a")).toBe("<html>a</html>");
    expect(cache.size()).toBe(1);
  });

  it("returns null for unknown urls", () => {
    const cache = createPjaxCache();

    expect(cache.get("/missing")).toBeNull();
  });

  it("ignores empty payloads", () => {
    const cache = createPjaxCache();
    cache.set("/empty", "");

    expect(cache.size()).toBe(0);
  });

  it("evicts the least recently used entry when full", () => {
    const cache = createPjaxCache({ capacity: 2 });
    cache.set("/a", "a");
    cache.set("/b", "b");
    cache.get("/a"); // /b is now the oldest
    cache.set("/c", "c");

    expect(cache.get("/a")).toBe("a");
    expect(cache.get("/b")).toBeNull();
    expect(cache.get("/c")).toBe("c");
    expect(cache.size()).toBe(2);
  });

  it("expires entries after the ttl", () => {
    const clock = createClock();
    const cache = createPjaxCache({ ttl: 1000, now: clock.now });
    cache.set("/a", "a");

    clock.advance(999);
    expect(cache.get("/a")).toBe("a");

    clock.advance(2);
    expect(cache.get("/a")).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("drops expired entries on prune", () => {
    const clock = createClock();
    const cache = createPjaxCache({ ttl: 1000, now: clock.now });
    cache.set("/a", "a");
    cache.set("/b", "b");

    clock.advance(1500);
    cache.prune();

    expect(cache.size()).toBe(0);
  });

  it("re-setting an url refreshes its age", () => {
    const clock = createClock();
    const cache = createPjaxCache({ ttl: 1000, now: clock.now });
    cache.set("/a", "old");

    clock.advance(800);
    cache.set("/a", "new");

    clock.advance(800);
    expect(cache.get("/a")).toBe("new");
  });

  it("never exceeds the default capacity", () => {
    const cache = createPjaxCache();

    for (let index = 0; index < DEFAULT_CACHE_CAPACITY + 5; index++) {
      cache.set(`/page-${index}`, `html-${index}`);
    }

    expect(cache.size()).toBe(DEFAULT_CACHE_CAPACITY);
    expect(cache.get("/page-0")).toBeNull();
    expect(cache.get(`/page-${DEFAULT_CACHE_CAPACITY + 4}`)).toBe(`html-${DEFAULT_CACHE_CAPACITY + 4}`);
  });
});
