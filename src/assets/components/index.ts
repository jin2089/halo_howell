/**
 * 自定义元素统一注册点，只在 main.ts 里 import 一次。
 *
 * `customElements.define()` 对同一个标签全局只能成功一次，而且 Pjax 刻意不重执行
 * head 里的 module 脚本，所以注册天然只发生一次；每个组件内部仍用 defineElement()
 * 做幂等守卫，防止重复 import 或重复构建块导致的二次注册。
 */
import "./back-to-top";
import "./image-lightbox";
import "./number-formatter";
import "./reading-progress";
import "./video-lightbox";
