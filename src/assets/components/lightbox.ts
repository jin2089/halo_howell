import { isActivationKey } from "./keyboard";

const CLOSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

export interface LightboxEvents {
  open: string;
  close: string;
}

/**
 * 弹窗型媒体组件的共用骨架。
 *
 * 采用 Light DOM（不使用 Shadow DOM），这样全局 Tailwind 与图标类都能直接生效；
 * 弹窗本体用原生 `<dialog>` + `showModal()`，因此免费获得焦点陷阱、ESC 关闭、
 * 顶层渲染（不受祖先 overflow/transform 裁剪）与 `::backdrop`。
 *
 * Pjax 兼容要点：
 * - 浏览器在元素插入活动文档时自动 upgrade，`connectedCallback` 无需手动唤醒；
 * - 换页会把元素整体移除，因此 `disconnectedCallback` 必须显式关闭顶层 dialog，
 *   否则弹窗会残留在上一页的位置。
 */
export abstract class LightboxElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["src", "alt"];
  }

  #dialog: HTMLDialogElement | null = null;
  #media: HTMLElement | null = null;
  #trigger: HTMLElement | null = null;

  protected abstract readonly events: LightboxEvents;

  protected abstract createMedia(): HTMLElement;

  protected abstract updateMedia(media: HTMLElement, src: string, alt: string): void;

  /** 打开后的钩子，例如自动播放视频。 */
  protected onOpened(): void {
    // 默认无操作，由子类按需覆盖
  }

  /** 关闭后的钩子，例如暂停视频。 */
  protected onClosed(): void {
    // 默认无操作，由子类按需覆盖
  }

  protected get media(): HTMLElement | null {
    return this.#media;
  }

  connectedCallback(): void {
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "button");
    }

    if (!this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0");
    }

    this.addEventListener("click", this.handleActivate);
    this.addEventListener("keydown", this.handleKeydown);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.handleActivate);
    this.removeEventListener("keydown", this.handleKeydown);

    this.#dialog?.close();
    this.#dialog = null;
    this.#media = null;
    this.#trigger = null;
  }

  attributeChangedCallback(_name: string, previous: string | null, next: string | null): void {
    // upgrade 阶段属性回调先于 connectedCallback，此时弹窗还不存在，跳过即可。
    if (previous === next || !this.#media) {
      return;
    }

    this.updateMedia(this.#media, this.getAttribute("src") ?? "", this.getAttribute("alt") ?? "");
  }

  get isOpen(): boolean {
    return this.#dialog?.open ?? false;
  }

  /** 供 Alpine 或其它脚本调用。 */
  open(): void {
    const src = this.getAttribute("src");

    if (!src || this.isOpen) {
      return;
    }

    this.#trigger = document.activeElement instanceof HTMLElement ? document.activeElement : this;

    const dialog = this.ensureDialog();

    if (this.#media) {
      this.updateMedia(this.#media, src, this.getAttribute("alt") ?? "");
    }

    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });

    this.onOpened();
    this.emit(this.events.open);
  }

  close(): void {
    this.#dialog?.close();
  }

  private ensureDialog(): HTMLDialogElement {
    if (this.#dialog) {
      return this.#dialog;
    }

    const dialog = document.createElement("dialog");
    dialog.className = "lightbox-dialog";
    dialog.addEventListener("close", this.handleClose);
    dialog.addEventListener("click", (event) => {
      // 点击遮罩时事件目标是 dialog 自身
      if (event.target === dialog) {
        dialog.close();
      }
    });

    const media = this.createMedia();

    const button = document.createElement("button");
    button.type = "button";
    button.className = "lightbox-close";
    button.setAttribute("aria-label", this.dataset.closeLabel ?? "Close");
    button.innerHTML = CLOSE_ICON;
    button.addEventListener("click", () => dialog.close());

    const panel = document.createElement("div");
    panel.className = "lightbox-panel";
    panel.append(media, button);

    dialog.append(panel);
    // 挂在组件内部而不是 teleport 到 body：换页时随组件一起销毁，不会跨页残留。
    this.append(dialog);

    this.#dialog = dialog;
    this.#media = media;

    return dialog;
  }

  private handleClose = (): void => {
    const trigger = this.#trigger;

    this.#trigger = null;
    this.onClosed();
    trigger?.focus({ preventScroll: true });
    this.emit(this.events.close);
  };

  private handleActivate = (event: MouseEvent): void => {
    const target = event.target;

    if (this.isOpen) {
      return;
    }

    // 弹窗内部的点击（关闭按钮、媒体本身）不应再次打开
    if (target instanceof Element && target.closest("dialog")) {
      return;
    }

    // 组件内部若有普通链接（例如社交外链图标），不要劫持点击
    if (target instanceof Element && target.closest("a")) {
      return;
    }

    this.open();
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!isActivationKey(event)) {
      return;
    }

    event.preventDefault();
    this.open();
  };

  private emit(type: string): void {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }
}
