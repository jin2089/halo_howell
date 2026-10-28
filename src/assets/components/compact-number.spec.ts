import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_LOCALE, formatCompactNumber, getCompactFormatter, parseCount, resolveLocale } from "./compact-number";

describe("parseCount", () => {
  it("parses integers and trims whitespace", () => {
    expect(parseCount(" 42 ")).toBe(42);
    expect(parseCount("0")).toBe(0);
  });

  it("returns null for missing or non numeric values", () => {
    expect(parseCount(null)).toBeNull();
    expect(parseCount(undefined)).toBeNull();
    expect(parseCount("")).toBeNull();
    expect(parseCount("   ")).toBeNull();
    expect(parseCount("N/A")).toBeNull();
  });
});

describe("resolveLocale", () => {
  it("falls back to English without a usable tag", () => {
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("xx-YY")).toBe(DEFAULT_LOCALE);
  });

  it("keeps a supported tag", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("zh-CN")).toBe("zh-CN");
  });
});

describe("getCompactFormatter", () => {
  it("reuses one instance per locale", () => {
    expect(getCompactFormatter("en")).toBe(getCompactFormatter("en"));
    expect(getCompactFormatter("en")).not.toBe(getCompactFormatter("zh-CN"));
  });
});

describe("formatCompactNumber", () => {
  it("formats thousands and millions", () => {
    expect(formatCompactNumber("12345", "en")).toMatch(/^12(\.\d)?K$/);
    expect(formatCompactNumber("1500000", "en")).toBe("1.5M");
  });

  it("keeps small numbers readable", () => {
    expect(formatCompactNumber("42", "en")).toBe("42");
  });

  it("returns non numeric input unchanged", () => {
    expect(formatCompactNumber("N/A", "en")).toBe("N/A");
    expect(formatCompactNumber("", "en")).toBe("");
  });

  it("uses locale specific units", () => {
    // 中文紧凑记法的单位是「万」；ICU 数据缺失时至少不会抛错
    expect(formatCompactNumber("12345", "zh-CN")).not.toBe(formatCompactNumber("12345", "en"));
  });
});
