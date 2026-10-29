import { defineElement } from "./define";
import { isActivationKey } from "./keyboard";

const VISIBILITY_THRESHOLD = 300;

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 回到顶部：`<back-to-top>`。
 *
 * 显隐由组件自己维护（`data-visible`），样式写在 components.css 里，
 * 这样不依赖 Tailwind 对 `opacity-100` 等类的生成顺序。
 *
 * Pjax 兼容要点：组件随页面换掉时 `disconnectedCallback` 会移除 window 监听、
 * 取消待执行的 rAF 并复位可见状态，因此反复导航不会累积监听。
 */
export class BackToTopElement extends HTMLElement {
  #frame = 0;
  #visible = false;

  connectedCallback(): void {
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "button");
    }

    if (!this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "0");
    }

    this.addEventListener("click", this.handleClick);
    this.addEventListener("keydown", this.handleKeydown);
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    this.sync();
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.handleClick);
    this.removeEventListener("keydown", this.handleKeydown);
    window.removeEventListener("scroll", this.handleScroll);

    if (this.#frame !== 0) {
      window.cancelAnimationFrame(this.#frame);
      this.#frame = 0;
    }

    this.#visible = false;
    this.removeAttribute("data-visible");
  }

  get isVisible(): boolean {
    return this.#visible;
  }

  private sync = (): void => {
    const visible = window.scrollY > VISIBILITY_THRESHOLD;

    if (visible === this.#visible) {
      return;
    }

    this.#visible = visible;

    if (visible) {
      this.setAttribute("data-visible", "true");
    } else {
      this.removeAttribute("data-visible");
    }
  };

  private handleScroll = (): void => {
    if (this.#frame !== 0) {
      return;
    }

    // rAF 节流：滚动事件高频触发，直接读 scrollY 会造成同步布局抖动
    this.#frame = window.requestAnimationFrame(() => {
      this.#frame = 0;
      this.sync();
    });
  };

  private handleClick = (): void => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    if (!isActivationKey(event)) {
      return;
    }

    event.preventDefault();
    this.handleClick();
  };
}

defineElement("back-to-top", BackToTopElement);
