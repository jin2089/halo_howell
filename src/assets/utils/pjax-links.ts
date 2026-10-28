export interface PjaxLinkContext {
  origin: string;
  currentHref: string;
  skipPaths: RegExp[];
  skipExtensions: RegExp;
}

export interface PjaxLinkDescriptor {
  href: string | null;
  target: string | null;
  download: boolean;
  rel: string;
  disabled: boolean;
}

export const DEFAULT_SKIP_PATHS = [
  /^\/console(?:\/|$)/,
  /^\/apis(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/logout(?:\/|$)/,
  /^\/actuator(?:\/|$)/,
];

export const DEFAULT_SKIP_EXTENSIONS = /\.(?:pdf|zip|gz|xml|rss|atom|json|txt|mp4|mp3|jpe?g|png|gif|svg|webp|avif)$/i;

const NON_HTTP_SCHEME = /^(?:mailto:|tel:|sms:|javascript:|data:|blob:)/i;

/**
 * Determines whether a link click can be handled by Pjax instead of a full page load.
 * Kept free of DOM APIs so that it can be unit tested in a Node environment.
 */
export function isEligibleNavigation(link: PjaxLinkDescriptor, context: PjaxLinkContext): boolean {
  if (link.disabled || link.download) {
    return false;
  }

  if (link.target && link.target !== "_self") {
    return false;
  }

  if (link.rel.split(/\s+/).includes("external")) {
    return false;
  }

  const rawHref = link.href?.trim() ?? "";

  if (!rawHref || rawHref.startsWith("#") || NON_HTTP_SCHEME.test(rawHref)) {
    return false;
  }

  let url: URL;
  let current: URL;

  try {
    url = new URL(rawHref, context.currentHref);
    current = new URL(context.currentHref);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (url.origin !== context.origin) {
    return false;
  }

  if (context.skipPaths.some((pattern) => pattern.test(url.pathname))) {
    return false;
  }

  if (context.skipExtensions.test(url.pathname)) {
    return false;
  }

  // Same document (only the hash differs) is handled by the browser itself.
  return !(url.origin === current.origin && url.pathname === current.pathname && url.search === current.search);
}
