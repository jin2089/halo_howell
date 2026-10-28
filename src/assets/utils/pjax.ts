import Alpine from "alpinejs";

import { runPageRefreshes } from "./page-ready";
import { createPjaxCache, type PjaxCache } from "./pjax-cache";
import {
  DEFAULT_SKIP_EXTENSIONS,
  DEFAULT_SKIP_PATHS,
  isEligibleNavigation,
  type PjaxLinkContext,
  type PjaxLinkDescriptor,
} from "./pjax-links";
import { initPrefetch } from "./pjax-prefetch";

export interface PjaxOptions {
  /** Selector of the element that gets replaced on navigation. */
  container?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Use the View Transitions API when the browser supports it. */
  transitions?: boolean;
  /** Show the top loading bar while a navigation is in flight. */
  progress?: boolean;
  /** Keep an in-memory LRU cache of responses and prefetch links on hover. */
  cache?: boolean;
  /** Paths that always fall back to a full page load. */
  skipPaths?: RegExp[];
  /** File extensions that always fall back to a full page load. */
  skipExtensions?: RegExp;
}

interface PjaxHistoryState {
  pjax?: boolean;
  scrollY?: number;
}

interface PjaxEventDetail {
  url: string;
  timedOut?: boolean;
}

type NavigateMode = "push" | "none";

interface ResolvedPjaxOptions {
  container: string;
  timeout: number;
  transitions: boolean;
  progress: boolean;
  cache: boolean;
  skipPaths: RegExp[];
  skipExtensions: RegExp;
}

const DEFAULT_CONTAINER = "#pjax-container";
const DEFAULT_TIMEOUT = 10000;
const HEAD_ASSET_SELECTOR = 'link[rel="stylesheet"][href], link[rel="modulepreload"][href]';
const EXECUTABLE_SCRIPT_TYPES = ["", "text/javascript", "application/javascript", "module"];
const PLUGIN_HEAD_ASSET_SELECTOR = 'script[src*="/plugins/"], link[href*="/plugins/"]';

let initialized = false;
let options: ResolvedPjaxOptions | null = null;
let pendingController: AbortController | null = null;
let navigationId = 0;

const loadedScriptSources = new Set<string>();

let cacheStore: PjaxCache | null = null;
let stopPrefetch: (() => void) | null = null;

export function initPjax(userOptions: PjaxOptions = {}): void {
  if (initialized) {
    return;
  }

  // Escape hatch: opening any page with ?no-pjax falls back to full page loads.
  if (new URLSearchParams(window.location.search).has("no-pjax")) {
    return;
  }

  const container = userOptions.container ?? DEFAULT_CONTAINER;

  // Pages rendered with another layout (for example the docs plugin) opt out automatically.
  if (!document.querySelector(container)) {
    return;
  }

  initialized = true;
  const resolvedOptions: ResolvedPjaxOptions = {
    container,
    timeout: userOptions.timeout ?? DEFAULT_TIMEOUT,
    transitions: userOptions.transitions ?? true,
    progress: userOptions.progress ?? true,
    cache: userOptions.cache ?? true,
    skipPaths: userOptions.skipPaths ?? DEFAULT_SKIP_PATHS,
    skipExtensions: userOptions.skipExtensions ?? DEFAULT_SKIP_EXTENSIONS,
  };

  options = resolvedOptions;
  cacheStore = resolvedOptions.cache ? createPjaxCache() : null;

  // Hover/focus prefetch warms the same cache the navigation reads from. ?no-prefetch opts out.
  if (cacheStore && !new URLSearchParams(window.location.search).has("no-prefetch")) {
    const cache = cacheStore;

    stopPrefetch = initPrefetch({
      cache,
      isEligible: (url) =>
        isEligibleNavigation(
          { href: url, target: null, download: false, rel: "", disabled: false },
          {
            origin: window.location.origin,
            currentHref: window.location.href,
            skipPaths: resolvedOptions.skipPaths,
            skipExtensions: resolvedOptions.skipExtensions,
          },
        ),
    });
  }

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  // Scripts already executed by the browser must not be executed again on the next navigation.
  for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"))) {
    loadedScriptSources.add(script.src);
  }

  document.addEventListener("click", handleClick);
  window.addEventListener("popstate", handlePopState);
  window.addEventListener("pagehide", () => {
    stopPrefetch?.();
  });
}

function handleClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const target = event.target;

  if (!(target instanceof Element) || !options) {
    return;
  }

  const anchor = target.closest<HTMLAnchorElement>("a[href]");

  if (!anchor) {
    return;
  }

  const link: PjaxLinkDescriptor = {
    href: anchor.getAttribute("href"),
    target: anchor.getAttribute("target"),
    download: anchor.hasAttribute("download"),
    rel: anchor.getAttribute("rel") ?? "",
    disabled: anchor.closest("[data-no-pjax]") !== null,
  };

  const context: PjaxLinkContext = {
    origin: window.location.origin,
    currentHref: window.location.href,
    skipPaths: options.skipPaths,
    skipExtensions: options.skipExtensions,
  };

  if (!isEligibleNavigation(link, context)) {
    return;
  }

  event.preventDefault();
  void navigate(new URL(link.href ?? "", window.location.href).href, "push");
}

function handlePopState(): void {
  const state = history.state as PjaxHistoryState | null;
  const scrollY = typeof state?.scrollY === "number" ? state.scrollY : 0;

  void navigate(window.location.href, "none", scrollY);
}

async function navigate(url: string, mode: NavigateMode, restoreScrollY = 0): Promise<void> {
  if (!options) {
    return;
  }

  const requestId = ++navigationId;
  const previousScrollY = window.scrollY;

  pendingController?.abort();
  const controller = new AbortController();
  pendingController = controller;

  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeout);

  setLoading(true);
  dispatchPjaxEvent("pjax:before", { url });

  let nextDocument: Document;

  try {
    nextDocument = await loadDocument(url, controller.signal);
  } catch {
    // A newer navigation already took over, nothing to do here.
    if (requestId !== navigationId) {
      return;
    }

    dispatchPjaxEvent("pjax:error", { url, timedOut });
    setLoading(false);
    window.location.href = url;
    return;
  } finally {
    window.clearTimeout(timeoutId);

    if (pendingController === controller) {
      pendingController = null;
    }
  }

  if (requestId !== navigationId) {
    return;
  }

  const nextContainer = nextDocument.querySelector<HTMLElement>(options.container);

  // Targets that need head assets of a plugin which the current page did not load (docs plugin, ...)
  // fall back to a full page load. Globally injected plugin assets and body level widgets, such as the
  // comment widget, are handled like any other markup.
  if (!nextContainer || hasNewHeadPluginAssets(nextDocument)) {
    dispatchPjaxEvent("pjax:error", { url, timedOut: false });
    setLoading(false);
    window.location.href = url;
    return;
  }

  syncHead(nextDocument);

  let swapped = false;
  const swap = () => {
    if (swapped) {
      return;
    }

    swapped = true;

    const currentContainer = document.querySelector<HTMLElement>(options?.container ?? DEFAULT_CONTAINER);

    if (!currentContainer) {
      return;
    }

    Alpine.destroyTree(currentContainer);
    currentContainer.replaceWith(nextContainer);
    window.scrollTo({ top: mode === "none" ? restoreScrollY : 0, left: 0, behavior: "instant" });
  };

  try {
    if (options.transitions && typeof document.startViewTransition === "function") {
      await document.startViewTransition(swap).finished.catch(() => undefined);
    } else {
      swap();
    }
  } catch {
    swap();
  }

  if (requestId !== navigationId) {
    return;
  }

  const mountedContainer = document.querySelector<HTMLElement>(options.container);

  if (mountedContainer) {
    Alpine.initTree(mountedContainer);
    reexecuteScripts(mountedContainer);
  }

  runPageRefreshes();

  if (mode === "push") {
    storeHistoryState({ scrollY: previousScrollY });
    history.pushState({ pjax: true, scrollY: 0 } satisfies PjaxHistoryState, "", url);
  } else {
    storeHistoryState({ scrollY: window.scrollY });
  }

  setLoading(false);
  dispatchPjaxEvent("pjax:success", { url });
  dispatchPjaxEvent("pjax:complete", { url });
}

/**
 * Reads a page from the in-memory cache first and falls back to the network.
 * Successful responses are cached so that back navigation and hovering stay instant.
 */
async function loadDocument(url: string, signal: AbortSignal): Promise<Document> {
  const cached = cacheStore?.get(url);

  if (cached) {
    dispatchPjaxEvent("pjax:cache-hit", { url });
    return new DOMParser().parseFromString(cached, "text/html");
  }

  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "text/html,application/xhtml+xml" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const html = await response.text();

  // 与预取保持同一标准：只缓存真正可替换的页面，避免把无容器的页面塞进缓存。
  if (html.includes('id="pjax-container"')) {
    cacheStore?.set(url, html);
  }

  return new DOMParser().parseFromString(html, "text/html");
}

function storeHistoryState(state: PjaxHistoryState): void {
  history.replaceState({ ...history.state, ...state }, "", window.location.href);
}

function hasNewHeadPluginAssets(nextDocument: Document): boolean {
  const knownAssets = new Set<string>();

  for (const element of Array.from(
    document.head.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]"),
  )) {
    const asset = getAssetAttribute(element);

    if (asset) {
      knownAssets.add(asset);
    }
  }

  for (const element of Array.from(
    nextDocument.head.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(PLUGIN_HEAD_ASSET_SELECTOR),
  )) {
    const asset = getAssetAttribute(element);

    if (asset && !knownAssets.has(asset)) {
      return true;
    }
  }

  return false;
}

function getAssetAttribute(element: HTMLScriptElement | HTMLLinkElement): string | null {
  return element instanceof HTMLScriptElement ? element.getAttribute("src") : element.getAttribute("href");
}

function syncHead(nextDocument: Document): void {
  // Keep the title in sync before Alpine initializes, because some components read document.title.
  if (nextDocument.title) {
    document.title = nextDocument.title;
  }

  const existing = new Set(
    Array.from(document.head.querySelectorAll<HTMLLinkElement>(HEAD_ASSET_SELECTOR)).map((link) =>
      link.getAttribute("href"),
    ),
  );

  for (const link of Array.from(nextDocument.head.querySelectorAll<HTMLLinkElement>(HEAD_ASSET_SELECTOR))) {
    const href = link.getAttribute("href");

    if (!href || existing.has(href)) {
      continue;
    }

    existing.add(href);

    const clone = link.cloneNode(true) as HTMLLinkElement;
    clone.dataset.pjaxAsset = "true";
    document.head.append(clone);
  }
}

function reexecuteScripts(container: HTMLElement): void {
  const scripts = Array.from(container.querySelectorAll<HTMLScriptElement>("script:not([data-pjax-skip])"));

  for (const script of scripts) {
    const type = (script.getAttribute("type") ?? "").trim().toLowerCase();

    if (!EXECUTABLE_SCRIPT_TYPES.includes(type)) {
      continue;
    }

    const src = script.getAttribute("src");

    if (src) {
      const absoluteSource = new URL(src, window.location.href).href;

      // External scripts are executed at most once per session to avoid re-initializing plugins.
      if (loadedScriptSources.has(absoluteSource)) {
        continue;
      }

      loadedScriptSources.add(absoluteSource);
    }

    const replacement = document.createElement("script");

    for (const attribute of Array.from(script.attributes)) {
      replacement.setAttribute(attribute.name, attribute.value);
    }

    replacement.text = script.text;
    script.replaceWith(replacement);
  }
}

function setLoading(active: boolean): void {
  if (!options?.progress) {
    return;
  }

  document.body.toggleAttribute("data-pjax-loading", active);
}

function dispatchPjaxEvent(name: string, detail: PjaxEventDetail): void {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}
