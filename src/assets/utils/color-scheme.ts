export type ColorSchemeType = "system" | "dark" | "light";

export let currentColorScheme: ColorSchemeType = "system";

const DEFAULT_REVEAL_DURATION = 700;

/*
 * 同心涟漪依赖 mask 的半径插值，而自定义属性只有注册后才会被浏览器当成可动画的 <length>。
 * registerProperty 存在即代表引擎支持这种插值；注册失败（重复注册等）不影响使用。
 */
const canAnimateRippleRadius = (() => {
  if (typeof CSS === "undefined" || typeof CSS.registerProperty !== "function") {
    return false;
  }
  try {
    CSS.registerProperty({
      name: "--vt-ripple-r",
      syntax: "<length>",
      inherits: true,
      initialValue: "0px",
    });
  } catch {
    // 重复注册会抛错，但支持能力仍在
  }
  return true;
})();

function normalizeRevealDuration(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_REVEAL_DURATION;
  }
  // 上限 2s 避免误填成秒级数值，下限 200ms 保证仍能看清扩散
  return Math.min(2000, Math.max(200, Math.round(numeric)));
}

const colorSchemeValues = ["system", "dark", "light"] as const;

const isColorScheme = (value: string | null): value is ColorSchemeType =>
  colorSchemeValues.includes(value as ColorSchemeType);

export function initColorScheme(defaultColorScheme: ColorSchemeType, enableChangeColorScheme: boolean) {
  let colorScheme = isColorScheme(defaultColorScheme) ? defaultColorScheme : "system";

  if (enableChangeColorScheme) {
    try {
      const storedColorScheme = localStorage.getItem("color-scheme");

      if (isColorScheme(storedColorScheme)) {
        colorScheme = storedColorScheme;
      }
    } catch {
      // 隐私模式下读取失败时使用主题默认配色
    }
  }

  currentColorScheme = colorScheme;
  setColorScheme(colorScheme, false);
}

export function setColorScheme(colorScheme: ColorSchemeType, store: boolean, origin?: { x: number; y: number }) {
  const apply = () => {
    if (colorScheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.add(prefersDark ? "dark" : "light");
      document.documentElement.classList.remove(prefersDark ? "light" : "dark");
    } else {
      document.documentElement.classList.add(colorScheme);
      document.documentElement.classList.remove(colorScheme === "dark" ? "light" : "dark");
    }

    currentColorScheme = colorScheme;

    if (store) {
      try {
        localStorage.setItem("color-scheme", colorScheme);
      } catch {
        // 存储不可用时仍允许本次切换生效
      }
    }
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const currentlyDark = document.documentElement.classList.contains("dark");
  const willBeDark =
    colorScheme === "dark" || (colorScheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (
    !origin ||
    prefersReducedMotion ||
    !document.startViewTransition ||
    currentlyDark === willBeDark ||
    !window.enableColorSchemeAnimation
  ) {
    apply();
    return;
  }

  document.documentElement.classList.add("color-scheme-transitioning");

  const { x, y } = origin;
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const duration = normalizeRevealDuration(window.colorSchemeRevealDuration);

  // 涟漪圆心写在根元素上，由 ::view-transition-new(root) 继承；必须在开始过渡前设置。
  document.documentElement.style.setProperty("--vt-reveal-x", `${x}px`);
  document.documentElement.style.setProperty("--vt-reveal-y", `${y}px`);

  const transition = document.startViewTransition(apply);
  void transition.finished.finally(() => {
    document.documentElement.classList.remove("color-scheme-transitioning");
  });

  if (canAnimateRippleRadius) {
    // 同心涟漪：只推进遮罩半径，波前的两条凹槽由 CSS 按固定宽度跟随，形成一圈圈水纹。
    void transition.ready.then(() => {
      document.documentElement.animate(
        { "--vt-ripple-r": ["0px", `${endRadius}px`] },
        { duration, easing: "ease-out", pseudoElement: "::view-transition-new(root)" },
      );
    });
    return;
  }

  // 回退：不支持自定义属性插值时，用 clip-path 单波 + 两次回抽近似水纹。
  const circleAt = (radius: number) => `circle(${radius}px at ${x}px ${y}px)`;
  const revealFrames = [
    { clipPath: circleAt(0), offset: 0 },
    { clipPath: circleAt(endRadius * 0.46), offset: 0.34 },
    { clipPath: circleAt(endRadius * 0.38), offset: 0.44 },
    { clipPath: circleAt(endRadius * 0.84), offset: 0.76 },
    { clipPath: circleAt(endRadius * 0.76), offset: 0.86 },
    { clipPath: circleAt(endRadius * 1.05), offset: 1 },
  ];

  void transition.ready.then(() => {
    document.documentElement.animate(revealFrames, {
      duration,
      easing: "linear",
      pseudoElement: "::view-transition-new(root)",
    });
  });
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
  if (currentColorScheme === "system") {
    setColorScheme("system", false);
  }
});
