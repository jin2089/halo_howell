# Tailwind 4 迁移记录（S0 Spike）

> 分支：`spike/tailwind4`。目标：只验证构建链与视觉等价性，不包含 S1 之后的视觉移植。
> 结论：**构建链可用**，可以进入 S1；上线前仍需在 Halo 实机与浏览器中做人工视觉验收。

## 1. 构建链

- `tailwindcss@4.3.3` + `@tailwindcss/vite@4.3.3`。
- 实测可与 `@halo-dev/vite-plugin-halo-theme@1.0.3`、`vite-plus-core@1.0.0-rc.0` 共存，`vp build` 正常。
- 删除 `postcss.config.cjs`、`tailwind.config.cjs`、`autoprefixer`、`postcss`、`sass-embedded`。
- Tailwind 配置迁移到 `src/assets/styles/tailwind.css` 的 `@theme`，色相仍由 `tokens.css` 的 `--hue` / `--accent-hue` / `--neutral-chroma` 运行时驱动。
- 7 个 `.scss` 改为 `.css`；`main` / `moment` / `markdown-body` / `prose` 使用 `@reference "./tailwind.css"` 保留 `@apply`；`doc.css` 改为纯 CSS。
- 关闭自动内容探测：`@import "tailwindcss" source(none)`，显式 `@source "../../../src"` 与 `@source "../../../settings.yaml"`，避免扫描构建产物与文档。

## 2. 验收数据（本机）

| 项                      | 结果                                                |
| ----------------------- | --------------------------------------------------- |
| `pnpm run build`        | 通过，`theme-package` 正常产出 zip                  |
| `main` CSS              | 111.47 kB → 122.19 kB（gzip 20.97 → 22.20 kB）      |
| `markdown-body` CSS     | 44.25 kB → 46.17 kB                                 |
| `pnpm run check:colors` | 通过，100 个语义色彩类全部命中                      |
| 图标                    | `src` 43 个 + `settings.yaml` 20 个默认图标全部命中 |
| `vp check`              | 通过（fmt / lint / typecheck）                      |
| `vp test`               | 7 个测试文件、49 个用例通过                         |
| 构建耗时                | 1.7s → 3.8s（图标插件全量解析导致，可接受）         |

## 3. 视觉等价处理

Tailwind 4 把部分尺度整体下移一位，旧类名会直接变小，因此按“保持 v3 视觉”做了等价改名：

| v3                 | v4 等价写法        |
| ------------------ | ------------------ |
| `rounded`          | `rounded-sm`       |
| `rounded-sm`       | `rounded-xs`       |
| `rounded-b`        | `rounded-b-sm`     |
| `shadow`           | `shadow-sm`        |
| `shadow-sm`        | `shadow-xs`        |
| `blur`             | `blur-sm`          |
| `backdrop-blur-sm` | `backdrop-blur-xs` |
| `drop-shadow`      | `drop-shadow-sm`   |
| `outline-none`     | `outline-hidden`   |
| `bg-gradient-to-t` | `bg-linear-to-t`   |

其他兼容项：

- `aspect-w-16 aspect-h-9` → `aspect-video`；`aspect-w-1 aspect-h-1` → `aspect-square`。
- 图标插件换为 `@egoist/tailwindcss-icons`，保留 `i-tabler-*` 语法。
- `flex-shrink-0` → `shrink-0`；`whitespace-no-wrap` → `whitespace-nowrap`（后者原本就是无效类）。
- v4 Preflight 的默认边框色为 `currentColor`，已在 base 层恢复为 `var(--border-base)`。
- `post-card` 的裸 `ring-black` 在 v3 是 3px、v4 是 1px，已补 `ring-[3px]`。
- `!` 前缀重要修饰符在 4.3.3 仍可用，产物已确认生成 `.\!size-5` 等规则。

## 4. 已知差异 / 待人工验收

- 浏览器基线提升为 Safari 16.4+ / Chrome 111+ / Firefox 128+（现有 OKLCH 已要求较新浏览器）。
- `hover:` 在 v4 只对支持 hover 的设备生效，触屏交互需实机确认。
- `space-x/y`、`divide-x/y` 的选择器实现与 v3 不同，视觉通常一致，但需逐屏确认。
- `bg-linear-to-t` 优先使用 oklab 插值，遮罩渐变可能有极轻微色差。
- 动态图标（`th:classappend="${item.icon}"`）仍依赖构建期扫描；`settings.yaml` 的默认值已覆盖，但用户自选的新图标类不会自动生成（v3 同样存在该限制）。
- 尚未执行 Halo 2.22 实机安装与亮/暗 × 5 色相 × 3 布局的浏览器视觉回归。

## 5. 回滚

- 整个 spike 在独立分支，未合入 `ref/前沿技术`。
- 若视觉验收不可接受：丢弃本分支，回到 `ref/前沿技术`，S1–S5 仍可在 Tailwind 3.4 上执行。
