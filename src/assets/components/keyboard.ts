export interface KeyLike {
  key: string;
}

/**
 * 「激活」键判定：Enter 与 Space 对 role="button" 的元素应当等价于点击。
 * 抽成纯函数，既让 lightbox / back-to-top 共用，也能在 Node 环境直接单测。
 */
export function isActivationKey(event: KeyLike): boolean {
  return event.key === "Enter" || event.key === " ";
}
