# 阶段四技术方案：Web Components 组件化封装（v1.21.0）

> 状态：已实施（C1~C4 全部落地）。本文档记录边界规范、生命周期语义、Shadow DOM 与 Tailwind 的冲突结论，以及验收清单。

## 1. 背景与目标

交互层原本几乎全部由 Alpine.js 承担。但 Halo 主题里有一类模块并不适合 Alpine：

- 需要**焦点管理**（弹窗打开后焦点进弹窗、关闭后归还触发元素）；
- 需要 **document/window 级监听**，并且必须在 Pjax 换页时清理；
- 会被 `th:each` **循环渲染 N 次**，Alpine 写法会为每个实例复制一整份隐藏弹窗 DOM；
- 触发数据（图片/视频地址）是后台可填内容，用 `x-data="|{image: '${url}'}|"` 拼进 JS 字符串会**引号崩坏**。

Web Components 正好覆盖这四点，且有一个天然优势：**Pjax 换页时浏览器会自动 upgrade 新插入的元素**，不需要 `Alpine.initTree()` 式的手动唤醒。

## 2. 组件清单与边界

| 模块                                | 实现                  | 理由                                                                                          |
| ----------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `<number-formatter>`                | **WC（存量加固）**    | 纯展示、无状态；改为按 `<html lang>` 取 locale（zh 输出 `1.2万`），并缓存 `Intl.NumberFormat` |
| `<image-lightbox>`                  | **WC（新）**          | 弹窗/focus/顶层渲染；替换 2 个 `th:each` 内的 Alpine 弹窗，删除整份 `image-view-modal.html`   |
| `<video-lightbox>`                  | **WC（新）**          | 与图片同一套弹窗骨架；moment / moments 各删 58 行重复模板                                     |
| `<back-to-top>`                     | **WC（新）**          | 拥有 window 滚动监听与 rAF 节流，显隐状态归组件所有                                           |
| 下拉菜单 / 配色 / 换色              | Alpine                | 纯状态切换，无全局监听，WC 只会更啰嗦                                                         |
| `share` / `upvote` / `uiPermission` | Alpine                | 以"取数据 → 改文案"为主，DOM 操作极少                                                         |
| 目录（tocbot）                      | 第三方 + `destroyToc` | 已有清理钩子，不引入包装层                                                                    |

判定口径：**需要 `disconnectedCallback` 的存在意义（全局监听、焦点、顶层元素、定时器）才做 WC。**

## 3. 架构决策：默认 Light DOM

`src/assets/components/lightbox.ts` 是所有弹窗类组件的抽象基类，刻意**不开启 Shadow DOM**：

| 需求                                                | Light DOM                   | Shadow DOM              |
| --------------------------------------------------- | --------------------------- | ----------------------- |
| 复用全局 Tailwind 工具类                            | ✅                          | ❌ 边界隔离             |
| 复用 `tailwindcss-plugin-icons` 生成的 `i-tabler-*` | ✅                          | ❌                      |
| 与 Thymeleaf 服务端渲染协同（无 FOUC）              | ✅ 内容由服务端渲染在标签内 | ⚠️ 需要 slot 或 JS 模板 |
| 样式隔离                                            | ❌                          | ✅                      |
| 调试                                                | ✅ DevTools 直接看到        | ⚠️ 需展开 shadow root   |

主题的卡片/图标/排版全部依赖全局类名，因此**Light DOM 才是正解**。弹窗自身的表现力用原生 `<dialog>` 补齐。

### 3.1 为什么用 `<dialog>` + `showModal()`

- **顶层渲染**：不受祖先 `overflow-hidden` / `transform` 影响（卡片内直接挂弹窗也不会被裁剪）。
- **焦点陷阱 + ESC 关闭 + `aria-modal`** 由浏览器提供，替代手写 trap。
- 未打开时 UA 样式即 `display:none`，**不需要 `x-cloak`**。
- `::backdrop` 可用，样式写在 `src/assets/styles/components.scss`。

### 3.2 Shadow DOM 方案（保留为将来备选）

若某个叶子组件确实需要隔离，结论是"**不要试图把 Tailwind 塞进 Shadow，而要用 token + 自包含 CSS**"：

| 现象                                  | 原因                                       |
| ------------------------------------- | ------------------------------------------ |
| 组件内 `class="bg-surface-card"` 无效 | 工具类在**全局样式表**里                   |
| 组件内 `var(--bg-card)` **有效**      | **CSS 自定义属性可以继承穿透 Shadow 边界** |
| 组件内 `i-tabler-x` 无效              | 图标是全局生成的背景/遮罩规则              |

注入方式（Vite `?inline` + 构造式样式表共享单例）：

```ts
import css from "./image-lightbox.css?inline"; // 编译后的 CSS 字符串（经 PostCSS）

const cache = new Map<string, CSSStyleSheet>();

export function shadowStyles(id: string, source: string): CSSStyleSheet | HTMLStyleElement {
  const cached = cache.get(id);
  if (cached) return cached;

  if ("adoptedStyleSheets" in Document.prototype && "replaceSync" in CSSStyleSheet.prototype) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(source);
    cache.set(id, sheet);
    return sheet;
  }

  const fallback = document.createElement("style");
  fallback.textContent = source;
  return fallback;
}
```

```css
/* image-lightbox.css：只用 token，不用工具类 */
dialog::backdrop {
  background: color-mix(in oklab, var(--bg-base) 45%, transparent);
}
```

## 4. 生命周期与 Pjax 语义

1. **注册只做一次**：`src/assets/components/index.ts` 是唯一注册点，`main.ts` 只 `import "./components"`。每个组件内部再走 `defineElement()` 幂等守卫（`customElements.get()`），因此重复 import、重复 chunk、Node 测试环境都不会抛错。
2. **不需要任何手动唤醒**：Pjax 用 `currentContainer.replaceWith(nextContainer)` 把 `DOMParser` 解析出的节点搬进活动文档，插入瞬间浏览器 upgrade 自定义元素，顺序为 `constructor → attributeChangedCallback（逐个 observed 属性）→ connectedCallback`。
3. **`disconnectedCallback` 是硬性要求**：旧容器被替换时，弹窗若是打开状态必须 `close()`，否则顶层元素残留；`back-to-top` 必须移除 window 监听与 rAF。
4. **不要 teleport 到 `body`**：弹窗挂在组件内部（`this.append(dialog)`），随 swap 一起销毁，杜绝跨页残留。
5. **不依赖 `DOMContentLoaded`**：Pjax 不触发它。

## 5. 与 Alpine 互操作

```html
<!-- Alpine → WC：调用公开方法 -->
<button type="button" x-data @click="$root.querySelector('image-lightbox')?.open()">看大图</button>

<!-- WC → Alpine：监听冒泡的 CustomEvent（bubbles + composed） -->
<div x-data="{ zoomed: false }" @lightbox:open="zoomed = true" @lightbox:close="zoomed = false">
  <image-lightbox src="…" alt="…" role="button" tabindex="0">…</image-lightbox>
</div>
```

公开 API：`open()` / `close()` / `isOpen`（`<back-to-top>` 为 `isVisible`）。
事件：`lightbox:open|close`、`video-lightbox:open|close`。

## 6. 测试策略

项目没有 jsdom / happy-dom，`vite.config.ts` 也未设置 `test.environment`，因此**不在 Node 里实例化 HTMLElement**。做法是把可测逻辑下沉为纯函数：

| 模块                     | 用例数 | 内容                                                           |
| ------------------------ | ------ | -------------------------------------------------------------- |
| `define.spec.ts`         | 4      | 幂等注册、重复注册返回 false、无 registry 时静默、不同标签独立 |
| `compact-number.spec.ts` | 9      | 解析、locale 回退、formatter 缓存、K/M 与中文单位              |
| `keyboard.spec.ts`       | 3      | Enter / Space / 其它键                                         |

测试总数：**49**（33 → 49）。

## 7. 已知限制

1. **弹窗不锁滚动**：`<body>` 的滚动由 OverlayScrollbars 接管，`overflow:hidden` 无法真正锁住；强行实现需改 OverlayScrollbars 选项，属于另一个变更面。现状与改造前的 Alpine 版本一致（`showModal()` 已让背景不可交互）。
2. `<dialog>.showModal()` 基线：Safari 15.4+ / Chrome 105+ / Firefox 98+。更老的浏览器需要退化实现（未包含）。
3. `image-lightbox` 的弹窗在**首次打开时**才创建，因此首屏 N 个实例只有触发标记，没有隐藏弹窗 DOM。
4. `<video-lightbox>` 的自动播放可能被浏览器策略拦截，此时保持用户手动播放。
5. 文档插件页（`doc-layout`）不含 `#pjax-container`，组件只依赖浏览器 upgrade，因此同样可用。

## 8. 验收清单

- [x] `pnpm run check` 0 error（41 files）
- [x] `vp test --run` 49/49
- [x] `pnpm run build` → `halo_howell-1.21.0.zip`
- [x] `pnpm run check:colors` 100 个语义色彩类命中，无默认调色板
- [x] 产物含 `<image-lightbox>` / `<video-lightbox>` / `<back-to-top>` / `<number-formatter>`
- [x] 产物 CSS 含 `.lightbox-dialog` / `::backdrop` / `back-to-top[data-visible=true]`
- [x] 旧片段 `templates/modules/image-view-modal.html` 已随构建消失
- [ ] 人工：弹窗 ESC / 点遮罩 / 关闭按钮 / 焦点归还
- [ ] 人工：打开弹窗后点站内链接触发 Pjax，确认无残留遮罩
- [ ] 人工：Pjax 往返 10 次后 `getEventListeners(window)` 数量不增长
- [ ] 人工：390px 视口下侧栏统计数字不换行

## 9. 变更文件

**新增**：`components/{define,compact-number,keyboard,lightbox,image-lightbox,video-lightbox,back-to-top,index}.ts`、`components/{define,compact-number,keyboard}.spec.ts`、`styles/components.scss`、`docs/phase-4-components.md`。

**删除**：`modules/image-view-modal.html`。

**修改**：`main.ts`（注册点 + 移除命令式滚动逻辑）、`number-formatter.ts`（locale + formatter 缓存）、`partials/layout.html`、`partials/doc-layout.html`（`<back-to-top>`）、`modules/footer-social.html`、`modules/widgets/profile.html`（`<image-lightbox>`）、`moment.html`、`moments.html`（`<video-lightbox>`，共 -116 行）、`i18n/*.properties`（`fragment.lightbox.close`）、`theme.yaml`（1.21.0）。
