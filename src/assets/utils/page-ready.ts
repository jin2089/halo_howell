type PageCallback = () => void;

const refreshers: PageCallback[] = [];

/**
 * Runs the callback on the first load and on every page initialized by Pjax.
 * Pjax never fires `DOMContentLoaded`, so inline scripts should rely on this helper.
 */
export function onPageReady(callback: PageCallback): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }

  queueMicrotask(callback);
}

/**
 * Registers a refresh hook that depends on the freshly replaced DOM,
 * such as the table of contents or third party lightboxes.
 */
export function registerRefresh(callback: PageCallback): void {
  refreshers.push(callback);
}

export function runPageRefreshes(): void {
  for (const refresh of refreshers) {
    try {
      refresh();
    } catch (error) {
      console.error("[halo-theme] Page refresh failed:", error);
    }
  }
}
