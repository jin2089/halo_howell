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

initPjax({ container: "#pjax-container" });
