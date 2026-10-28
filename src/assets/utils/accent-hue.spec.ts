import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_HUE, normalizeHue, readHueFromSearch } from "./accent-hue";

describe("normalizeHue", () => {
  it("keeps values already inside the hue range", () => {
    expect(normalizeHue(250)).toBe(250);
    expect(normalizeHue("195")).toBe(195);
  });

  it("rounds fractional values", () => {
    expect(normalizeHue(195.4)).toBe(195);
    expect(normalizeHue("195.6")).toBe(196);
  });

  it("wraps values beyond a full turn", () => {
    expect(normalizeHue(725)).toBe(5);
    expect(normalizeHue(360)).toBe(0);
    expect(normalizeHue(720)).toBe(0);
  });

  it("wraps negative values", () => {
    expect(normalizeHue(-10)).toBe(350);
    expect(normalizeHue("-30")).toBe(330);
  });

  it("falls back for non numeric input", () => {
    expect(normalizeHue(undefined)).toBe(DEFAULT_HUE);
    expect(normalizeHue(null)).toBe(DEFAULT_HUE);
    expect(normalizeHue("")).toBe(DEFAULT_HUE);
    expect(normalizeHue("blue")).toBe(DEFAULT_HUE);
    expect(normalizeHue(Number.NaN)).toBe(DEFAULT_HUE);
  });

  it("honours a custom fallback", () => {
    expect(normalizeHue("nope", 195)).toBe(195);
  });
});

describe("readHueFromSearch", () => {
  it("reads the hue query parameter", () => {
    expect(readHueFromSearch("?hue=195")).toBe(195);
    expect(readHueFromSearch("?hue=195&foo=1")).toBe(195);
    expect(readHueFromSearch("?foo=1&hue=300")).toBe(300);
  });

  it("normalises the query value", () => {
    expect(readHueFromSearch("?hue=-30")).toBe(330);
    expect(readHueFromSearch("?hue=360")).toBe(0);
  });

  it("returns null when the parameter is missing or empty", () => {
    expect(readHueFromSearch("")).toBeNull();
    expect(readHueFromSearch("?foo=1")).toBeNull();
    expect(readHueFromSearch("?hue=")).toBeNull();
    expect(readHueFromSearch("?hue=%20")).toBeNull();
  });

  it("returns null for invalid values", () => {
    expect(readHueFromSearch("?hue=blue")).toBeNull();
  });
});
