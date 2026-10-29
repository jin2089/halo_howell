import { describe, expect, it } from "vite-plus/test";

import { clampGalleryIndex, formatGalleryCounter, galleryNavDelta, normalizeGalleryMeta } from "./gallery";

describe("gallery helpers", () => {
  it("normalizes metadata by trimming, dropping blanks and removing duplicates", () => {
    expect(normalizeGalleryMeta(["  Canon ", "", "f/2.8", "f/2.8", "   "])).toEqual(["Canon", "f/2.8"]);
  });

  it("clamps selected indexes into the gallery bounds", () => {
    expect(clampGalleryIndex(-3, 5)).toBe(0);
    expect(clampGalleryIndex(2.8, 5)).toBe(2);
    expect(clampGalleryIndex(9, 5)).toBe(4);
  });

  it("returns zero when there are no gallery items", () => {
    expect(clampGalleryIndex(1, 0)).toBe(0);
    expect(formatGalleryCounter(0, 0)).toBe("");
  });

  it("formats the counter with a one-based index", () => {
    expect(formatGalleryCounter(0, 3)).toBe("1 / 3");
    expect(formatGalleryCounter(2, 3)).toBe("3 / 3");
  });

  it("maps arrow keys to previous and next navigation", () => {
    expect(galleryNavDelta("ArrowLeft")).toBe(-1);
    expect(galleryNavDelta("ArrowRight")).toBe(1);
    expect(galleryNavDelta("Enter")).toBe(0);
  });
});
