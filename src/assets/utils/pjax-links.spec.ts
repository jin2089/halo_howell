import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_SKIP_EXTENSIONS,
  DEFAULT_SKIP_PATHS,
  isEligibleNavigation,
  type PjaxLinkDescriptor,
} from "./pjax-links";

const context = {
  origin: "https://example.com",
  currentHref: "https://example.com/archives/hello",
  skipPaths: DEFAULT_SKIP_PATHS,
  skipExtensions: DEFAULT_SKIP_EXTENSIONS,
};

function createLink(overrides: Partial<PjaxLinkDescriptor> = {}): PjaxLinkDescriptor {
  return {
    href: "/posts/next",
    target: null,
    download: false,
    rel: "",
    disabled: false,
    ...overrides,
  };
}

describe("isEligibleNavigation", () => {
  it("accepts same-origin html links", () => {
    expect(isEligibleNavigation(createLink(), context)).toBe(true);
  });

  it("rejects links pointing to another origin", () => {
    expect(isEligibleNavigation(createLink({ href: "https://other.example.com/posts/next" }), context)).toBe(false);
  });

  it("rejects non http schemes and hash targets", () => {
    for (const href of ["mailto:a@example.com", "tel:+8613800000000", "javascript:void(0)", "#content"]) {
      expect(isEligibleNavigation(createLink({ href }), context)).toBe(false);
    }
  });

  it("rejects links that opt out of pjax", () => {
    expect(isEligibleNavigation(createLink({ disabled: true }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ download: true }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ target: "_blank" }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ target: "_self" }), context)).toBe(true);
    expect(isEligibleNavigation(createLink({ rel: "noopener external" }), context)).toBe(false);
  });

  it("rejects navigations to the same document", () => {
    expect(isEligibleNavigation(createLink({ href: "/archives/hello#comments" }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ href: "https://example.com/archives/hello" }), context)).toBe(false);
  });

  it("accepts the same path with a different query string", () => {
    expect(isEligibleNavigation(createLink({ href: "/archives/hello?page=2" }), context)).toBe(true);
  });

  it("rejects console, api and auth paths", () => {
    expect(isEligibleNavigation(createLink({ href: "/console/posts" }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ href: "/apis/api.halo.run/v1alpha1/posts" }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ href: "/login" }), context)).toBe(false);
  });

  it("rejects feeds and binary assets", () => {
    expect(isEligibleNavigation(createLink({ href: "/feed.xml" }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ href: "/upload/photo.png" }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ href: "/download/file.pdf" }), context)).toBe(false);
  });

  it("rejects empty or unparsable hrefs", () => {
    expect(isEligibleNavigation(createLink({ href: "" }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ href: null }), context)).toBe(false);
    expect(isEligibleNavigation(createLink({ href: "http://" }), context)).toBe(false);
  });
});
