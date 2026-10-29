/**
 * 阅读进度百分比：0 表示页首，100 表示已滚到底部。
 * 短页面（没有可滚动距离）返回 0，避免除以 0 或出现 NaN。
 */
export function readingProgressPercent(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const scrollable = scrollHeight - viewportHeight;

  if (!Number.isFinite(scrollY) || !Number.isFinite(scrollable) || scrollable <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (scrollY / scrollable) * 100));
}
