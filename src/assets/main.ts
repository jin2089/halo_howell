import "./styles/tailwind.css";
import "./styles/tokens.css";
import "./styles/main.scss";
import "./styles/pjax.scss";
import Alpine from "alpinejs";

import accentHueSwitcher from "./alpine-data/accent-hue-switcher";
import colorSchemeSwitcher from "./alpine-data/color-scheme-switcher";
import dropdown from "./alpine-data/dropdown";
import share from "./alpine-data/share";
import uiPermission from "./alpine-data/ui-permission";
import upvote from "./alpine-data/upvote";
import "./components/number-formatter";
import "./utils/overlayscrollbars";
import { onPageReady, registerRefresh, runPageRefreshes } from "./utils/page-ready";
import { initPjax } from "./utils/pjax";
import { destroyToc, generateToc } from "./utils/toc";

window.Alpine = Alpine;

Alpine.data("dropdown", dropdown);
Alpine.data("accentHueSwitcher", accentHueSwitcher);
Alpine.data("colorSchemeSwitcher", colorSchemeSwitcher);
Alpine.data("upvote", upvote);
Alpine.data("share", share);
Alpine.data("uiPermission", uiPermission);

Alpine.start();

// 目录（TOC）依赖替换后的 DOM，因此放进刷新注册表，而不是一次性脚本里。
registerRefresh(() => {
  if (document.getElementById("content") && document.querySelector(".toc")) {
    generateToc("content", ".toc", ".toc-container");
  }
});

// 离开文章页前先销毁上一份目录实例，避免滚动监听在 Pjax 多次导航后累积。
document.addEventListener("pjax:before", () => {
  destroyToc();
});

const onScroll = () => {
  const headerMenu = document.getElementById("header-menu");
  if (window.scrollY > 0) {
    headerMenu?.classList.add("menu-sticky");
  } else {
    headerMenu?.classList.remove("menu-sticky");
  }
};

window.addEventListener("scroll", onScroll);

onPageReady(() => {
  const scrollToTopButton = document.getElementById("btn-scroll-to-top");

  if (!scrollToTopButton) {
    return;
  }

  scrollToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", _handleScroll);

  function _handleScroll() {
    if (!scrollToTopButton) {
      return;
    }

    const isDown = window.scrollY > 300;

    if (isDown) {
      scrollToTopButton.style.opacity = "1";
    } else {
      scrollToTopButton.style.opacity = "0";
    }
  }
});

runPageRefreshes();

// 换页后把共享元素过渡的标记补到列表首卡标题上：
// view-transition-name 必须页内唯一，因此只在列表页标记一张卡。
const markSharedPostTitle = () => {
  document.querySelector<HTMLElement>("#post-list > :first-child h1")?.classList.add("vt-post-title");
};

// 换页后移动焦点并播报新标题，否则屏幕阅读器用户感知不到内容已替换。
// preventScroll 是必须的：否则焦点会把已恢复的滚动位置带偏。
const announcePageChange = () => {
  const announcer = document.getElementById("pjax-announcer");

  if (announcer) {
    announcer.textContent = document.title;
  }

  document.getElementById("pjax-container")?.focus({ preventScroll: true });

  markSharedPostTitle();
};

document.addEventListener("pjax:success", announcePageChange);

onPageReady(markSharedPostTitle);

initPjax({ container: "#pjax-container" });
