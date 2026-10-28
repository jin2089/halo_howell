import { describe, expect, it } from "vite-plus/test";

import { defineElement } from "./define";

function createFakeRegistry() {
  const tags = new Map<string, CustomElementConstructor>();

  return {
    registry: {
      get: (name: string) => tags.get(name),
      define: (name: string, ctor: CustomElementConstructor) => tags.set(name, ctor),
    },
    tags,
  };
}

/**
 * 测试里不能在 Node 环境实例化 HTMLElement，
 * 因此用一个空类冒充自定义元素构造器。
 */
class FakeElement {}

const FakeCtor = FakeElement as unknown as CustomElementConstructor;

describe("defineElement", () => {
  it("registers a tag once", () => {
    const { registry, tags } = createFakeRegistry();

    expect(defineElement("fake-element", FakeCtor, registry)).toBe(true);
    expect(tags.get("fake-element")).toBe(FakeCtor);
  });

  it("refuses to register a tag twice", () => {
    const { registry, tags } = createFakeRegistry();

    defineElement("fake-element", FakeCtor, registry);

    expect(defineElement("fake-element", FakeCtor, registry)).toBe(false);
    expect(tags.size).toBe(1);
  });

  it("returns false when no registry exists", () => {
    // Node 测试环境没有 customElements：此时必须安静地返回 false，不能抛错
    expect(defineElement("fake-element", FakeCtor)).toBe(false);
  });

  it("keeps different tags independent", () => {
    const { registry, tags } = createFakeRegistry();

    defineElement("a-element", FakeCtor, registry);
    defineElement("b-element", FakeCtor, registry);

    expect(tags.size).toBe(2);
  });
});
