import { formatCompactNumber } from "./compact-number";
import { defineElement } from "./define";

/**
 * 数字紧凑格式化：`10000` → `10K`（en）/ `1万`（zh）。
 *
 * 沿用原有的 Light DOM 写法，只更新文本内容，不需要额外样式。
 */
export class NumberFormatterElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["value", "locale"];
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  render(): void {
    const value = this.getAttribute("value");

    if (value === null) {
      this.textContent = "0";
      return;
    }

    this.textContent = formatCompactNumber(value, this.locale());
  }

  /** 优先使用显式 locale 属性，其次跟随页面 `<html lang>`。 */
  locale(): string {
    return this.getAttribute("locale") ?? document.documentElement.lang ?? "";
  }
}

defineElement("number-formatter", NumberFormatterElement);
