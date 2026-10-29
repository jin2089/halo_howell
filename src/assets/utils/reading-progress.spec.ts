import { describe, expect, it } from "vite-plus/test";

import { readingProgressPercent } from "./reading-progress";

describe("readingProgressPercent", () => {
  it("returns 0 at the top of the page", () => {
    expect(readingProgressPercent(0, 3000, 1000)).toBe(0);
  });

  it("returns the scroll ratio in the middle of the page", () => {
    expect(readingProgressPercent(1000, 3000, 1000)).toBe(50);
    expect(readingProgressPercent(500, 3000, 1000)).toBe(25);
  });

  it("returns 100 at the bottom of the page", () => {
    expect(readingProgressPercent(2000, 3000, 1000)).toBe(100);
  });

  it("returns 0 when the page cannot scroll", () => {
    expect(readingProgressPercent(0, 1000, 1000)).toBe(0);
    expect(readingProgressPercent(120, 800, 1000)).toBe(0);
  });

  it("clamps negative and overscrolled positions", () => {
    expect(readingProgressPercent(-50, 3000, 1000)).toBe(0);
    expect(readingProgressPercent(2400, 3000, 1000)).toBe(100);
  });

  it("returns 0 for non-finite measurements", () => {
    expect(readingProgressPercent(Number.NaN, 3000, 1000)).toBe(0);
    expect(readingProgressPercent(100, Number.POSITIVE_INFINITY, 1000)).toBe(0);
  });
});
