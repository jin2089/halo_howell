const STORAGE_KEY = "theme-hue";

export const DEFAULT_HUE = 250;

/**
 * 归一化色相：取整并按 360 取模（支持负值），非法输入回退到默认值。
 * 保持为纯函数，便于在 Node 环境下单测。
 */
export function normalizeHue(input: unknown, fallback: number = DEFAULT_HUE): number {
  // Number(null) 与 Number("") 都是 0，必须先排除"没有值"的情况，否则会误判成红色 0°
  if (input === null || input === undefined) {
    return fallback;
  }

  if (typeof input === "string" && input.trim() === "") {
    return fallback;
  }

  const value = typeof input === "number" ? input : Number(input);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return ((Math.round(value) % 360) + 360) % 360;
}

/** 从查询串的 `?hue=` 读取预览色相，缺失或非法时返回 null */
export function readHueFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search).get("hue");

  if (raw === null || raw.trim() === "" || !Number.isFinite(Number(raw))) {
    return null;
  }

  return normalizeHue(raw);
}

/** 当前生效的色相：优先读取行内样式，其次读取计算值 */
export function currentHue(): number {
  const root = document.documentElement;
  const inline = root.style.getPropertyValue("--hue");

  if (inline.trim() !== "") {
    return normalizeHue(inline);
  }

  return normalizeHue(getComputedStyle(root).getPropertyValue("--hue"));
}

/**
 * 应用色相。
 * @param store 是否写入本地存储，让刷新后依然保持；URL 预览时应传 false
 */
export function applyHue(hue: unknown, store = true): number {
  const value = normalizeHue(hue);

  document.documentElement.style.setProperty("--hue", String(value));

  if (store) {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // 隐私模式等场景下写入失败时忽略：仅失去持久化，不影响本次切换
    }
  }

  return value;
}
