import { defineElement } from "./define";
import { LightboxElement } from "./lightbox";

/**
 * 图片灯箱：`<image-lightbox src alt>`。
 *
 * 触发区域就是自定义元素本身（声明式内容由服务端渲染），
 * 弹窗在首次打开时才创建，因此一页几十个图标也不会多出几十份隐藏 DOM。
 */
export class ImageLightboxElement extends LightboxElement {
  protected readonly events = { open: "lightbox:open", close: "lightbox:close" };

  protected createMedia(): HTMLElement {
    const image = document.createElement("img");

    image.className = "lightbox-media";
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = "";

    return image;
  }

  protected updateMedia(media: HTMLElement, src: string, alt: string): void {
    if (!(media instanceof HTMLImageElement)) {
      return;
    }

    media.src = src;
    media.alt = alt;
  }
}

defineElement("image-lightbox", ImageLightboxElement);
