/** @type {import('tailwindcss').Config} */
const { Icons } = require("tailwindcss-plugin-icons");

/**
 * 色板说明：数值取自 Tailwind 默认 slate 的 sRGB 值换算出的 OKLCH（L%、C）。
 * 亮度与原色板完全一致，因此换色不会改变任何对比度，只改变色相通道。
 */
const NEUTRAL_STEPS = {
  50: [98.4, 0.0034],
  100: [96.8, 0.0069],
  200: [92.9, 0.0126],
  300: [86.9, 0.0198],
  400: [71.1, 0.0351],
  500: [55.4, 0.0407],
  600: [44.6, 0.0374],
  700: [37.2, 0.0392],
  800: [27.9, 0.0368],
  900: [20.8, 0.0398],
  950: [12.9, 0.0406],
};

/** 品牌色阶：L/C 取自 Tailwind blue，色相改由 --accent-hue 驱动 */
const ACCENT_STEPS = {
  50: [97.0, 0.0142],
  100: [93.2, 0.0316],
  200: [88.2, 0.0571],
  300: [80.9, 0.0956],
  400: [71.4, 0.1434],
  500: [62.3, 0.188],
  600: [54.6, 0.2152],
  700: [48.8, 0.2172],
  800: [42.4, 0.1809],
  900: [37.9, 0.1378],
  950: [28.2, 0.0874],
};

/** 危险色：色相固定（红），不参与换色 */
const DANGER_STEPS = {
  400: [71.1, 0.1661, 22.2],
  500: [63.7, 0.2078, 25.3],
  600: [57.7, 0.2152, 27.3],
  700: [50.5, 0.1905, 27.5],
};

/** 中性色：色相随 --hue 变化，饱和度受 --neutral-chroma 统一缩放 */
const neutral = ([l, c]) => `oklch(${l}% calc(${c} * var(--neutral-chroma, 1)) var(--hue) / <alpha-value>)`;
const accent = ([l, c]) => `oklch(${l}% ${c} var(--accent-hue) / <alpha-value>)`;
const fixed = ([l, c, h]) => `oklch(${l}% ${c} ${h} / <alpha-value>)`;
const scale = (steps, format) =>
  Object.fromEntries(Object.entries(steps).map(([step, value]) => [step, format(value)]));

module.exports = {
  content: ["./src/**/*.html", "./src/**/*.ts", "./settings.yaml"],
  darkMode: "class",
  theme: {
    extend: {
      lineClamp: {
        7: "7",
        8: "8",
      },
      colors: {
        // 原有的 slate / gray 两套灰阶收敛为同一张 OKLCH 表，统一视觉也统一换色入口
        slate: scale(NEUTRAL_STEPS, neutral),
        gray: scale(NEUTRAL_STEPS, neutral),
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          ...scale(ACCENT_STEPS, accent),
        },
        danger: {
          DEFAULT: "var(--danger)",
          ...scale(DANGER_STEPS, fixed),
        },
        success: {
          DEFAULT: "var(--success)",
          500: fixed([72.3, 0.192, 149.6]),
          600: fixed([62.7, 0.1699, 149.2]),
        },
        // 语义别名：新代码优先使用，避免再次散落具体色阶
        surface: {
          base: "var(--bg-base)",
          card: "var(--bg-card)",
          muted: "var(--bg-muted)",
          elevated: "var(--bg-elevated)",
        },
        content: {
          main: "var(--text-main)",
          muted: "var(--text-muted)",
          subtle: "var(--text-subtle)",
        },
        line: {
          base: "var(--border-base)",
          subtle: "var(--border-subtle)",
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/aspect-ratio"),
    require("@tailwindcss/typography"),
    Icons(() => ({
      gg: {
        includeAll: true,
      },
      tabler: {
        includeAll: true,
      },
      simpleIcons: {
        includeAll: true,
      },
      bx: {
        includeAll: true,
      },
    })),
  ],
};
