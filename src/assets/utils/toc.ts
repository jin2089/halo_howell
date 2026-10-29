type TocHeading = {
  id: string;
  level: number;
  label: string;
  element: HTMLHeadingElement;
  children: TocHeading[];
};

type ThrottledCallback = (() => void) & { cancel: () => void };

const headingSelector = "h1, h2, h3, h4";
let cleanupToc: (() => void) | undefined;

const slugify = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "");

  return slug || "section";
};

/** 为没有 id 的标题补一个稳定 id；已有 id 保持不变，避免破坏站内链接。 */
const ensureHeadingIds = (headings: HTMLHeadingElement[]) => {
  const usedIds = new Set<string>(
    Array.from(document.querySelectorAll<HTMLElement>("[id]")).map((element) => element.id),
  );

  headings.forEach((heading, index) => {
    if (heading.id) {
      return;
    }

    const baseId = slugify(heading.textContent || `section-${index + 1}`);
    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    heading.id = id;
    usedIds.add(id);
  });
};

const buildTocTree = (headings: HTMLHeadingElement[]) => {
  const root: TocHeading = {
    id: "",
    level: 0,
    label: "",
    element: headings[0],
    children: [],
  };
  const stack = [root];

  headings.forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    const label = heading.textContent?.replace(/\s+/g, " ").trim() || "";

    if (!label) {
      return;
    }

    const node: TocHeading = {
      id: heading.id,
      level,
      label,
      element: heading,
      children: [],
    };

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });

  return root.children;
};
const renderTocList = (nodes: TocHeading[]) => {
  const list = document.createElement("ul");
  list.className = "toc-list space-y-1";

  nodes.forEach((node) => {
    const item = document.createElement("li");
    const link = document.createElement("a");

    item.className = "toc-list-item";
    link.className =
      "toc-link group flex items-center justify-between rounded-sm px-1.5 py-1 text-sm text-gray-600 opacity-80 transition-all hover:bg-gray-100 hover:opacity-100 dark:text-slate-50 dark:hover:bg-slate-700";
    link.href = `#${node.id}`;
    link.textContent = node.label;
    link.title = node.label;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      const isTouch = window.matchMedia("(hover: none)").matches;

      node.element.scrollIntoView({
        block: "start",
        behavior: isTouch ? "auto" : "smooth",
      });
      history.pushState(null, "", `#${node.id}`);
      setActiveHeading(node.id);
    });

    item.append(link);

    if (node.children.length > 0) {
      item.append(renderTocList(node.children));
    }

    list.append(item);
  });

  return list;
};

const setActiveHeading = (id: string, tocLinks?: HTMLAnchorElement[]) => {
  const links = tocLinks ?? Array.from(document.querySelectorAll<HTMLAnchorElement>(".toc-link"));
  const activeLink = links.find((link) => link.getAttribute("href") === `#${id}`) ?? null;

  links.forEach((link) => {
    const active = link === activeLink;

    link.classList.toggle("is-active-link", active);
    link.setAttribute("aria-current", active ? "true" : "false");
  });

  if (!activeLink) {
    return;
  }

  if (window.matchMedia("(hover: none)").matches) {
    return;
  }

  const container = activeLink.closest<HTMLElement>(".toc");
  if (!container) {
    return;
  }

  const linkRect = activeLink.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const linkVisibleInContainer = linkRect.top >= containerRect.top && linkRect.bottom <= containerRect.bottom;
  const containerVisibleInViewport = containerRect.bottom > 0 && containerRect.top < window.innerHeight;

  if (!linkVisibleInContainer && containerVisibleInViewport) {
    activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
};

const rafThrottle = (callback: () => void): ThrottledCallback => {
  let frame = 0;

  const throttled = (() => {
    if (frame !== 0) {
      return;
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0;
      callback();
    });
  }) as ThrottledCallback;

  throttled.cancel = () => {
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  return throttled;
};

const createActiveHeadingUpdater = (headings: HTMLHeadingElement[]) => {
  const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(".toc-link"));

  const update = () => {
    const activeHeading =
      [...headings].reverse().find((heading) => heading.getBoundingClientRect().top <= 120) ?? headings[0];

    if (activeHeading) {
      setActiveHeading(activeHeading.id, tocLinks);
    }
  };

  const throttledUpdate = rafThrottle(update);

  window.addEventListener("scroll", throttledUpdate, { passive: true });
  window.addEventListener("resize", throttledUpdate, { passive: true });
  window.addEventListener("load", update, { once: true });
  update();

  return () => {
    window.removeEventListener("scroll", throttledUpdate);
    window.removeEventListener("resize", throttledUpdate);
    window.removeEventListener("load", update);
    throttledUpdate.cancel();
  };
};

/**
 * 销毁当前目录实例。必须在 Pjax 替换 DOM 前调用，
 * 否则旧的 scroll/resize 监听会一直引用已删除的标题节点。
 */
export function destroyToc(): void {
  cleanupToc?.();
  cleanupToc = undefined;
}

/**
 * 在正文 `contentId` 中生成目录，并同时填充页面上所有 `tocSelector` 目标
 * （左侧目录、文内目录、移动端目录可以共用同一份树）。
 */
export function generateToc(contentId: string, tocSelector: string, tocContainerSelector: string) {
  destroyToc();

  const content = document.getElementById(contentId);
  const tocContainers = Array.from(document.querySelectorAll<HTMLElement>(tocContainerSelector));
  const tocTargets = Array.from(document.querySelectorAll<HTMLElement>(tocSelector));
  // 首屏 body 仍是 hidden（OverlayScrollbars 后续才显示），此时 offsetParent 全为 null，
  // 不能据此过滤标题，否则目录会被误判为空并直接移除。
  const headings = Array.from(content?.querySelectorAll<HTMLHeadingElement>(headingSelector) ?? []);

  if (!content || tocTargets.length === 0 || tocContainers.length === 0 || headings.length === 0) {
    tocContainers.forEach((container) => container.remove());
    return;
  }

  ensureHeadingIds(headings);
  const tocTree = buildTocTree(headings);

  if (tocTree.length === 0) {
    tocContainers.forEach((container) => container.remove());
    return;
  }

  tocTargets.forEach((target) => {
    target.replaceChildren(renderTocList(tocTree));
  });

  cleanupToc = createActiveHeadingUpdater(headings);
}
