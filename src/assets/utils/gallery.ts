/**
 * 图片画廊的纯逻辑：与 DOM 无关，方便在 Node 测试环境覆盖边界情况。
 * 组件只负责把服务端渲染的数据映射成结构，然后复用这里的索引 / 文案计算。
 */

export function normalizeGalleryMeta(values: readonly string[]): string[] {
  const seen = new Set<string>();

  return values
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });
}

export function clampGalleryIndex(index: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

export function formatGalleryCounter(index: number, total: number): string {
  if (total <= 0) {
    return "";
  }

  return `${clampGalleryIndex(index, total) + 1} / ${total}`;
}

export function galleryNavDelta(key: string): -1 | 0 | 1 {
  if (key === "ArrowLeft") {
    return -1;
  }

  if (key === "ArrowRight") {
    return 1;
  }

  return 0;
}
