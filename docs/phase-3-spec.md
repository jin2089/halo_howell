# 阶段三技术方案：一致性 / 速度 / 无障碍（v1.20.0）

> 状态：已实施。本文档记录设计决策、实施范围与验收矩阵，供后续评审与回归使用。

## 1. 背景

阶段一完成了 Pjax + View Transitions，阶段二完成了 OKLCH 色彩系统（`--hue` 驱动、全局换色）。
阶段三解决三处尚未打通的死角：

| 死角         | 实施前现状                                                                                               | 后果                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 正文内容样式 | `github-markdown.css`（29,759 B、126 个 hex）下游规则全部走 `var(--color-*)`，但只有两组变量定义是写死的 | 后台选 `content_style=github` 的读者，正文图表/行内代码/分割线不跟随换色与暗色 |
| "白卡"语义   | `bg-white` 散落 48 行 / 28 个文件，`--bg-card` 是死代码                                                  | 调整卡片色需要改 48 处；4 处视频弹窗在暗色下是白块                             |
| 换页的下一步 | 无缓存、无预取；`view-transition-name` 只有 header；换页后焦点停留在旧链接                               | 每次点击冷启动全量 fetch；列表→详情无视觉连续性；屏幕阅读器感知不到换页        |

## 2. 实施内容

### 2.1 正文变量重绑（`src/assets/styles/markdown-body.scss`）

利用"本文件晚于 `@import url("./github-markdown.css")`"的层叠顺序，仅重绑 14 个被消费的变量，第三方文件零改动。
`.dark` 版本必须单独列出，因为插件用 `.dark .markdown-body`（特异性 0,2,0）覆盖了亮色值。

| GitHub 变量                | 新值                    |
| -------------------------- | ----------------------- |
| `--color-canvas-default`   | `var(--bg-card)`        |
| `--color-canvas-subtle`    | `var(--bg-muted)`       |
| `--color-fg-default`       | `var(--text-main)`      |
| `--color-fg-muted`         | `var(--text-muted)`     |
| `--color-fg-subtle`        | `var(--text-subtle)`    |
| `--color-border-default`   | `var(--border-base)`    |
| `--color-border-muted`     | `var(--border-subtle)`  |
| `--color-accent-fg`        | `var(--primary)`        |
| `--color-accent-emphasis`  | `var(--primary-hover)`  |
| `--color-neutral-muted`    | `var(--bg-muted)`       |
| `--color-danger-fg`        | `var(--danger)`         |
| `--color-attention-fg`     | `var(--warning)`        |
| `--color-attention-subtle` | `var(--warning-subtle)` |
| `--color-done-fg`          | `var(--success)`        |

同时清除本文件内 2 处裸 hex（`#fbf6f6` → `var(--border-subtle)`、`#afb8c133` → `var(--bg-muted)`）。
`prettylights-syntax-*`（代码高亮，约 30 个变量）**刻意保留** GitHub 配色：它是独立语义，按色相推导会牺牲可读性。

### 2.2 语义 token 对齐（`src/assets/styles/tokens.css`）

tokens 与 Tailwind 色板改用**同一表达式**（同一 L/C × 同一个 `--neutral-chroma`），因此
`bg-white dark:bg-slate-800` 与 `bg-surface-card` 逐像素等价，替换不具备视觉风险。

| token           | 亮色      | 暗色（等价类） |
| --------------- | --------- | -------------- |
| `--bg-base`     | slate-50  | slate-900      |
| `--bg-card`     | 纯白      | slate-800      |
| `--bg-elevated` | 纯白      | slate-700      |
| `--bg-muted`    | slate-100 | slate-600      |

新增 `--warning` / `--warning-subtle`：分别由 `#9a6700`（亮）/ `#d29922`（暗）/ `#fff8c5`（亮底）精确换算，暗色底用 `color-mix` 复刻 GitHub 的 15% 叠层。

### 2.3 白卡收敛（45 处）

| 规则 | 模式                                                    | 结果                                |
| ---- | ------------------------------------------------------- | ----------------------------------- |
| R1   | `bg-white` + `dark:bg-slate-800` / `dark:bg-gray-800`   | `bg-surface-card`（删除伴生）       |
| R2   | `bg-white` + `dark:bg-slate-900`                        | `bg-surface-card`（删除伴生）       |
| R3   | `bg-white` + `dark:bg-slate-700`（面板/分页按钮）       | `bg-surface-elevated`（删除伴生）   |
| R4   | `bg-white` + `dark:bg-slate-600`（回到顶部浮动按钮）    | **保留**                            |
| R5   | 无伴生的 4 处视频弹窗（`moment.html` / `moments.html`） | `bg-surface-card`，顺带修复暗色白块 |

同时保留 `group-hover:bg-white`（`category-tree.html`）作为悬停高亮，不在本次范围内。

### 2.4 缓存与预取（`pjax-cache.ts` / `pjax-prefetch.ts`）

- **缓存存 HTML 文本而非 Document**：`replaceWith` 会把节点从传入文档中搬走，缓存 Document 会被污染；命中时用 `DOMParser` 重新解析。
- LRU 容量 12、TTL 300s、`get` 命中提升新鲜度；`pjax-cache.ts` 为纯函数模块，可在 Node 单测。
- `pjax-prefetch.ts` 拆成两层：
  - `createPrefetcher`（无 DOM，可单测）：去重、并发上限、缓存写入、失败可重试、`destroy` 中止在途请求。
  - `initPrefetch`（DOM 层）：`pointerover` 延迟 120ms、`focusin` 立即、`pointerout` 取消定时器；只缓存含 `id="pjax-container"` 的响应，避免把登录页塞进缓存。
- `pjax.ts`：`loadDocument()` 先查缓存（命中派发 `pjax:cache-hit`），成功响应写回缓存；`pagehide` 时释放预取器。
- 逃生开关：`?no-prefetch`。

### 2.5 无障碍与打印

- `layout.html`：`<main id="pjax-container" tabindex="-1">` + `#pjax-announcer`（`aria-live="polite"`）。
- `main.ts`：`pjax:success` 后 `focus({ preventScroll: true })` 并播报 `document.title`；
  `preventScroll` 必须保留，否则会把已恢复的滚动位置带偏。
- `tokens.css`：`@media print` 用 `!important` 强制 `--hue: 250`（首屏脚本写在 `<html>` 行内样式，非 `!important` 覆盖不了）；`prefers-contrast: more` 时 `--neutral-chroma: 0`。

### 2.6 共享元素过渡（C1）

`view-transition-name` 必须页内唯一，因此：

- 详情页/单页标题静态标注 `.vt-post-title`（`post.html`、`page.html`）。
- 列表页只在 `#post-list` 首卡标题上运行时打标（`main.ts`），其余卡片无过渡。

### 2.7 质量护栏（`scripts/check-colors.mjs`）

- 扫描 `src/**/*.html`、`src/**/*.ts`，禁止 `blue/indigo/red/green/sky/...` 等默认调色板。
- 校验每个语义色彩类都出现在 `templates/assets/*.css` 中（类名写错或色板缺失即报错）。
- `pnpm run check:colors`（需先 `pnpm run build`）。

## 3. 矩阵测试清单

### 3.1 色彩矩阵（2 种 content_style × 亮暗 × 5 色相 = 20 组）

每组断言：M-1 分割线/表格框与页面一致 · M-2 表头底有层级 · M-3 引用块底不发灰硬边 ·
M-4 行内 code 底不再是固定灰 · M-5 链接色 = `--primary` · M-6 无"暗色白块"。

| content_style | 亮 250 | 亮 195 | 亮 150 | 亮 60 | 亮 300 | 暗 250 | 暗 195 | 暗 150 | 暗 60 | 暗 300 |
| ------------- | ------ | ------ | ------ | ----- | ------ | ------ | ------ | ------ | ----- | ------ |
| `github`      | ☐      | ☐      | ☐      | ☐     | ☐      | ☐      | ☐      | ☐      | ☐     | ☐      |
| `tailwind`    | ☐      | ☐      | ☐      | ☐     | ☐      | ☐      | ☐      | ☐      | ☐     | ☐      |

探针文章应包含：h2/h3、有序/无序/嵌套列表、带表头表格、引用块、行内 code、`pre` 代码块、分割线、任务列表、图片、脚注。

### 3.2 换色与持久化（6 项）

☐ 5 个预设逐个点击，400ms 平滑过渡 · ☐ 刷新后保持 · ☐ `?hue=195` 预览且不落库 ·
☐ 关闭"允许访客切换"后图标消失并回到默认 · ☐ 三种 `color-scheme` 切换后色相不变 · ☐ 打印色相冻结为 250

### 3.3 Pjax / 预取（10 项）

☐ 首页→文章 · ☐ 文章→归档 · ☐ 后退位置正确（焦点已转移后） · ☐ hover ≥150ms 后点击无 loading 条 ·
☐ Network 无新文档请求（命中缓存） · ☐ 快速连点无竞态 · ☐ `?no-pjax` 整页跳转 · ☐ `?no-prefetch` 关闭预取 ·
☐ 插件页（文档/评论）回退整页 · ☐ 换色后 Pjax 跳转色相不变

### 3.4 无障碍（6 项）

☐ 换页焦点落在 `<main>` 且页面不跳动 · ☐ 屏幕阅读器播报新标题 · ☐ Tab 顺序从新内容开始 ·
☐ 调色盘键盘可操作 · ☐ 色块 `aria-label` 四语言 · ☐ `prefers-reduced-motion` 关闭过渡与进度条动画

### 3.5 打印（3 项）

☐ 换色后打印为中性色 · ☐ 暗色模式打印为亮色 · ☐ 两种 content_style 均无黑底

### 3.6 回归（4 项）

☐ `--hue:250` + 亮色下与 v1.19.0 截图 diff = 0（白卡替换等价） · ☐ 产物中 `@property --hue` / `oklch(` / `var(--hue)` 数量不减少 ·
☐ `pnpm run check` 0 error · ☐ `vp test --run` 全绿 · ☐ `pnpm run check:colors` 退出码 0

## 4. 明确不做

`text-white` 全面语义化（多在图片/遮罩/品牌色上）· GitHub 语法高亮换色 · 整页 `prerender`（会执行插件脚本，污染统计）·
`bg-black/40`、`/80` 遮罩 OKLCH 化 · 多卡共享元素过渡（`view-transition-name` 唯一性约束）。
