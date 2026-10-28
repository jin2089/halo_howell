import { defineElement } from "./define";
import { LightboxElement } from "./lightbox";

/**
 * 视频灯箱：`<video-lightbox src>`。
 *
 * 触发区域里可以放缩略视频 + 播放按钮，弹窗内使用带 controls 的完整播放器。
 */
export class VideoLightboxElement extends LightboxElement {
  protected readonly events = { open: "video-lightbox:open", close: "video-lightbox:close" };

  protected createMedia(): HTMLElement {
    const video = document.createElement("video");

    video.className = "lightbox-media";
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";

    return video;
  }

  protected updateMedia(media: HTMLElement, src: string, alt: string): void {
    if (!(media instanceof HTMLVideoElement)) {
      return;
    }

    if (media.getAttribute("src") !== src) {
      media.src = src;
    }

    if (alt) {
      media.setAttribute("aria-label", alt);
    }
  }

  protected onOpened(): void {
    const media = this.media;

    if (media instanceof HTMLVideoElement) {
      // 自动播放可能被浏览器拦截，失败时保持用户手动点击播放
      void media.play().catch(() => undefined);
    }
  }

  protected onClosed(): void {
    const media = this.media;

    if (media instanceof HTMLVideoElement) {
      media.pause();
    }
  }
}

defineElement("video-lightbox", VideoLightboxElement);
