import { clampGalleryIndex, formatGalleryCounter, galleryNavDelta, normalizeGalleryMeta } from "../utils/gallery";
import { showToast } from "../utils/toast";
import { defineElement } from "./define";

const CLOSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const PREVIOUS_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const NEXT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

type GalleryEntry = {
  element: HTMLElement;
  src: string;
  alt: string;
  title: string;
  description: string;
  detail: string;
  meta: string[];
};

const i18n = (key: string, fallback: string): string => window.i18nResources?.[key] ?? fallback;

/**
 * 图片画廊：`<image-gallery>` 内放若干个 `[data-gallery-item]`。
 *
 * 与 `<image-lightbox>` 共享原生 `<dialog>` 的焦点陷阱 / ESC / 顶层渲染能力，
 * 但增加同组图片的上一张/下一张、标题、EXIF 信息和详情入口。
 * 数据由 Thymeleaf 写在触发元素及其 `data-gallery-meta` 子节点上，不拼接 JS 字符串。
 */
export class ImageGalleryElement extends HTMLElement {
  #dialog: HTMLDialogElement | null = null;
  #image: HTMLImageElement | null = null;
  #title: HTMLHeadingElement | null = null;
  #description: HTMLParagraphElement | null = null;
  #info: HTMLDivElement | null = null;
  #error: HTMLDivElement | null = null;
  #meta: HTMLDivElement | null = null;
  #detail: HTMLAnchorElement | null = null;
  #counter: HTMLDivElement | null = null;
  #previousButton: HTMLButtonElement | null = null;
  #nextButton: HTMLButtonElement | null = null;
  #closeButton: HTMLButtonElement | null = null;
  #items: GalleryEntry[] = [];
  #index = 0;
  #trigger: HTMLElement | null = null;

  connectedCallback(): void {
    if (this.hasAttribute("data-gallery-content") && !this.hasAttribute("tabindex")) {
      this.setAttribute("tabindex", "-1");
    }

    this.addEventListener("click", this.#handleClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#handleClick);

    const dialog = this.#dialog;
    this.#dialog = null;
    dialog?.close();
    this.#image = null;
    this.#title = null;
    this.#description = null;
    this.#info = null;
    this.#error = null;
    this.#meta = null;
    this.#detail = null;
    this.#counter = null;
    this.#previousButton = null;
    this.#nextButton = null;
    this.#closeButton = null;
    this.#items = [];
    this.#index = 0;
    this.#trigger = null;
  }

  #handleClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const item = target.closest<HTMLElement>("[data-gallery-item]");
    const contentImage = item ? null : target.closest<HTMLImageElement>("img");
    const element = item ?? contentImage;

    if (!element || element.closest("dialog") || !this.contains(element)) {
      return;
    }

    const items = this.#collectItems();
    const index = items.findIndex((entry) => entry.element === element);

    if (index < 0) {
      return;
    }

    event.preventDefault();
    this.#items = items;
    this.#index = index;
    this.#trigger = element instanceof HTMLImageElement ? (element.closest<HTMLElement>("a") ?? this) : element;
    this.#open();
  };

  #collectItems(): GalleryEntry[] {
    const itemElements = Array.from(this.querySelectorAll<HTMLElement>("[data-gallery-item]"));
    const contentImages = this.hasAttribute("data-gallery-content")
      ? Array.from(this.querySelectorAll<HTMLImageElement>("img")).filter(
          (image) => !image.closest("[data-gallery-item]") && !image.closest("dialog"),
        )
      : [];

    return [...itemElements, ...contentImages]
      .map((element): GalleryEntry | null => {
        const image = element instanceof HTMLImageElement ? element : element.querySelector<HTMLImageElement>("img");
        const src = element.dataset.gallerySrc?.trim() || image?.currentSrc || image?.src || "";

        if (!src) {
          return null;
        }

        const title = element.dataset.galleryTitle?.trim() || image?.alt?.trim() || i18n("page.photos.photo", "Photo");
        const meta = normalizeGalleryMeta(
          Array.from(element.querySelectorAll<HTMLElement>("[data-gallery-meta]")).map(
            (node) => node.textContent ?? "",
          ),
        );

        return {
          element,
          src,
          alt: image?.alt?.trim() || title,
          title,
          description: element.dataset.galleryDescription?.trim() || "",
          detail: element.dataset.galleryDetail?.trim() || "",
          meta,
        };
      })
      .filter((entry): entry is GalleryEntry => entry !== null);
  }

  #open(): void {
    const dialog = this.#ensureDialog();
    this.#render();
    dialog.showModal();
    this.#closeButton?.focus({ preventScroll: true });
  }

  #ensureDialog(): HTMLDialogElement {
    if (this.#dialog) {
      return this.#dialog;
    }

    const dialog = document.createElement("dialog");
    dialog.className = "lightbox-dialog gallery-dialog";
    dialog.setAttribute(
      "aria-label",
      this.dataset.dialogLabel?.trim() || i18n("fragment.gallery.title", "Image preview"),
    );
    dialog.addEventListener("close", this.#handleClose);
    dialog.addEventListener("click", this.#handleBackdropClick);
    dialog.addEventListener("keydown", this.#handleKeydown);

    const panel = document.createElement("div");
    panel.className = "gallery-panel";

    const stage = document.createElement("div");
    stage.className = "gallery-stage";

    const image = document.createElement("img");
    image.className = "gallery-media";
    image.alt = "";
    image.loading = "eager";
    image.decoding = "async";
    image.addEventListener("error", this.#handleImageError);
    image.addEventListener("load", this.#handleImageLoad);

    const error = document.createElement("div");
    error.className = "gallery-error";
    error.hidden = true;
    stage.append(image, error);

    const info = document.createElement("div");
    info.className = "gallery-info";

    const title = document.createElement("h2");
    title.className = "gallery-title";

    const description = document.createElement("p");
    description.className = "gallery-description";

    const meta = document.createElement("div");
    meta.className = "gallery-meta";

    const actions = document.createElement("div");
    actions.className = "gallery-actions";

    const detail = document.createElement("a");
    detail.className = "gallery-detail";
    detail.textContent = this.dataset.detailLabel?.trim() || i18n("fragment.gallery.detail", "View details");
    actions.append(detail);

    info.append(title, description, meta, actions);

    const closeButton = this.#createButton(
      "lightbox-close gallery-close",
      CLOSE_ICON,
      this.dataset.closeLabel?.trim() || i18n("fragment.lightbox.close", "Close"),
    );
    closeButton.addEventListener("click", () => dialog.close());

    const previousButton = this.#createButton(
      "gallery-nav gallery-nav-previous",
      PREVIOUS_ICON,
      this.dataset.previousLabel?.trim() || i18n("fragment.gallery.previous", "Previous image"),
    );
    previousButton.addEventListener("click", () => this.#go(-1));

    const nextButton = this.#createButton(
      "gallery-nav gallery-nav-next",
      NEXT_ICON,
      this.dataset.nextLabel?.trim() || i18n("fragment.gallery.next", "Next image"),
    );
    nextButton.addEventListener("click", () => this.#go(1));

    const counter = document.createElement("div");
    counter.className = "gallery-counter";
    counter.setAttribute("aria-live", "polite");

    panel.append(stage, info, closeButton, previousButton, nextButton, counter);
    dialog.append(panel);
    this.append(dialog);

    this.#dialog = dialog;
    this.#image = image;
    this.#title = title;
    this.#description = description;
    this.#info = info;
    this.#error = error;
    this.#meta = meta;
    this.#detail = detail;
    this.#counter = counter;
    this.#previousButton = previousButton;
    this.#nextButton = nextButton;
    this.#closeButton = closeButton;

    return dialog;
  }

  #createButton(className: string, icon: string, label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = icon;
    return button;
  }

  #render(): void {
    const entry = this.#items[this.#index];

    if (
      !entry ||
      !this.#image ||
      !this.#title ||
      !this.#description ||
      !this.#info ||
      !this.#error ||
      !this.#meta ||
      !this.#detail ||
      !this.#counter ||
      !this.#previousButton ||
      !this.#nextButton
    ) {
      return;
    }

    this.#image.src = entry.src;
    this.#image.alt = entry.alt;
    this.#error.hidden = true;

    this.#title.textContent = entry.title;
    this.#title.hidden = !entry.title;

    this.#description.textContent = entry.description;
    this.#description.hidden = !entry.description;

    this.#meta.replaceChildren(
      ...entry.meta.map((value) => {
        const item = document.createElement("span");
        item.className = "gallery-meta-item";
        item.textContent = value;
        return item;
      }),
    );
    this.#meta.hidden = entry.meta.length === 0;

    this.#detail.hidden = !entry.detail;

    if (entry.detail) {
      this.#detail.href = entry.detail;
    } else {
      this.#detail.removeAttribute("href");
    }

    this.#info.hidden = !entry.title && !entry.description && entry.meta.length === 0 && !entry.detail;
    this.#counter.textContent = formatGalleryCounter(this.#index, this.#items.length);

    const multiple = this.#items.length > 1;
    this.#previousButton.hidden = !multiple;
    this.#nextButton.hidden = !multiple;
    this.#counter.hidden = !multiple;
    this.#previousButton.disabled = this.#index <= 0;
    this.#nextButton.disabled = this.#index >= this.#items.length - 1;
  }

  #go(delta: number): void {
    const next = clampGalleryIndex(this.#index + delta, this.#items.length);

    if (next === this.#index) {
      return;
    }

    this.#index = next;
    this.#render();
  }

  #handleClose = (): void => {
    const trigger = this.#trigger;

    this.#trigger = null;
    this.#items = [];
    this.#index = 0;
    trigger?.focus({ preventScroll: true });
  };

  #handleBackdropClick = (event: MouseEvent): void => {
    const dialog = this.#dialog;

    if (dialog && event.target === dialog) {
      dialog.close();
    }
  };

  #handleKeydown = (event: KeyboardEvent): void => {
    if (!this.#dialog?.open) {
      return;
    }

    const delta = galleryNavDelta(event.key);

    if (!delta) {
      return;
    }

    event.preventDefault();
    this.#go(delta);
  };

  #handleImageLoad = (): void => {
    if (this.#error) {
      this.#error.hidden = true;
    }
  };

  #handleImageError = (): void => {
    const message = i18n("fragment.gallery.loadError", "Image failed to load");

    if (this.#error) {
      this.#error.textContent = message;
      this.#error.hidden = false;
    }

    showToast(message, "error");
  };
}

defineElement("image-gallery", ImageGalleryElement);
