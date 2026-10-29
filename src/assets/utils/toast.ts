/**
 * 轻量 toast：只用于图片预览加载失败等低优先级反馈。
 *
 * 采用 fixed 容器 + 语义颜色，不依赖 OverlayScrollbars，也不会参与 Pjax 的容器替换；
 * 容器在首次调用时创建，之后复用，避免每次提示都往 body 末尾追加节点。
 */
export type ToastType = "info" | "error" | "success";

let toastContainer: HTMLDivElement | null = null;

const ensureContainer = (): HTMLDivElement => {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }

  const container = document.createElement("div");
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  container.style.cssText =
    "position:fixed;top:1.5rem;left:50%;transform:translateX(-50%);z-index:1000;pointer-events:none;display:flex;flex-direction:column;gap:0.5rem;align-items:center;";

  document.body.append(container);
  toastContainer = container;
  return container;
};

const typeBackground: Record<ToastType, string> = {
  info: "var(--text-main)",
  error: "var(--danger)",
  success: "var(--success)",
};

const typeColor: Record<ToastType, string> = {
  info: "var(--bg-card)",
  error: "oklch(100% 0 0)",
  success: "oklch(100% 0 0)",
};

export function showToast(message: string, type: ToastType = "info", duration = 3000): void {
  if (!message) {
    return;
  }

  const container = ensureContainer();
  const toast = document.createElement("div");

  toast.style.cssText = `pointer-events:auto;max-width:90vw;word-break:break-word;padding:0.6rem 1.2rem;border-radius:0.5rem;color:${typeColor[type]};font-size:0.875rem;font-weight:500;box-shadow:0 4px 12px rgb(0 0 0 / 15%);background:${typeBackground[type]};opacity:0;transition:opacity 0.2s ease;`;
  toast.textContent = message;

  container.append(toast);

  window.requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  let hideTimer = window.setTimeout(() => {
    hideTimer = 0;
    toast.style.opacity = "0";
    window.setTimeout(() => toast.remove(), 200);
  }, duration);

  toast.addEventListener("pointerdown", () => {
    if (!hideTimer) {
      return;
    }

    window.clearTimeout(hideTimer);
    hideTimer = 0;
    toast.style.opacity = "0";
    window.setTimeout(() => toast.remove(), 200);
  });
}
