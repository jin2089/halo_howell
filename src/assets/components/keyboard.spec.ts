import { describe, expect, it } from "vite-plus/test";

import { isActivationKey } from "./keyboard";

describe("isActivationKey", () => {
  it("accepts Enter", () => {
    expect(isActivationKey({ key: "Enter" })).toBe(true);
  });

  it("accepts Space", () => {
    expect(isActivationKey({ key: " " })).toBe(true);
  });

  it("rejects other keys", () => {
    expect(isActivationKey({ key: "Tab" })).toBe(false);
    expect(isActivationKey({ key: "Escape" })).toBe(false);
    expect(isActivationKey({ key: "a" })).toBe(false);
  });
});
