import { registerRefresh } from "../utils/page-ready";
import { readingProgressPercent } from "../utils/reading-progress";
import { defineElement } from "./define";

/**
 * 阅读进度条：`<reading-progress>`。
 *
 * 元素位于 Pjax 容器之外，因此换页时不会被替换；滚动/尺寸监听只注册一次。
 * Pjax 换页后由 registerRefresh 主动重算，避免新页面高度尚未生效时进度条停在旧值。
 */
export class ReadingProgressElement extends HTMLElement {
  #frame = 0;
  #observer?: ResizeObserver;

  connectedCallback(): void {
    window.addEventListener("scroll", this.handleScroll, { passive: true });
    window.addEventListener("resize", this.handleScroll);
    window.addEventListener("load", this.handleScroll, { once: true });

    // 首屏 body 由 OverlayScrollbars 从 hidden 切到可见，高度会变化一次；
    // 用 ResizeObserver 补齐这次变化，避免进度条停在 0。
    if (typeof ResizeObserver !== "undefined") {
      this.#observer = new ResizeObserver(this.handleScroll);
      this.#observer.observe(document.body);
    }

    this.handleScroll();
  }

  disconnectedCallback(): void {
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("resize", this.handleScroll);
    window.removeEventListener("load", this.handleScroll);

    this.#observer?.disconnect();
    this.#observer = undefined;

    if (this.#frame !== 0) {
      window.cancelAnimationFrame(this.#frame);
      this.#frame = 0;
    }
  }

  /** 立即按当前文档高度更新进度，供 Pjax 刷新钩子调用 */
  sync(): void {
    const percent = readingProgressPercent(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);

    this.style.setProperty("--reading-progress", `${percent.toFixed(2)}%`);
  }

  private handleScroll = (): void => {
    if (this.#frame !== 0) {
      return;
    }

    // rAF 节流：滚动事件高频触发，直接读 scrollHeight 会引发同步布局
    this.#frame = window.requestAnimationFrame(() => {
      this.#frame = 0;
      this.sync();
    });
  };
}

defineElement("reading-progress", ReadingProgressElement);

registerRefresh(() => {
  document.querySelector<ReadingProgressElement>("reading-progress")?.sync();
});
