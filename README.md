# Howell Theme

基于 [theme-earth](https://github.com/halo-dev/theme-earth) 定制，并参考 [theme-earthquake](https://github.com/mufengyian/theme-earthquake) 视觉与交互的 Halo 2.0 个人博客主题，采用极简单栏、文字优先的页面排版。

![Howell Theme](./screenshot.jpg)

## 功能

- OKLCH 色彩系统、12 套主题预设与可调主题色相
- 亮/暗配色切换，可选圆形扩散动画
- 毛玻璃导航栏、阅读进度条与 Pjax 无刷新导航
- 文章目录四态、文章显示项与上一篇/下一篇范围配置
- 极简单栏首页、文字优先卡片、列表页无侧栏与文章页去卡片化
- 文章卡片显示项、侧栏开关与图片预览
- 图库 EXIF、键盘操作与焦点管理
- Open Graph、Twitter Card、Canonical 与 JSON-LD SEO 输出
- 经典页脚与可排序的自定义页脚内容

## 使用方式

1. 手动下载主题包并在 Console 的主题管理界面安装，安装方式可参考：<https://docs.halo.run/user-guide/themes>
2. 在后台「主题」设置中启用并进行个性化配置。

## 升级提示（1.23.0）

- 极简布局已移除首页 Hero 和列表页侧边栏，原「首页顶部模块」设置组已删除。
- 「极简布局」默认开启，会自动强制单条列表并使用自定义页脚，因此旧配置里的三列布局和经典页脚不会覆盖新视觉。
- 如需回到三列列表或经典页脚，可在主题设置中关闭「极简布局」，再选择对应的文章列表布局与页脚风格。

## 插件支持

Howell Theme 支持以下 Halo 插件：

- 友情链接（/links）：<https://www.halo.run/store/apps/app-hfbQg>
- 图库（/photos）：<https://www.halo.run/store/apps/app-BmQJW>
- 瞬间（/moments）：<https://www.halo.run/store/apps/app-SnwWD>

为了获得更好的体验，你还可以安装以下插件（如果需要）：

- Shiki 代码高亮：<https://www.halo.run/store/apps/app-kzloktzn>
- lightgallery.js 灯箱：<https://www.halo.run/store/apps/app-OoggD>

## 开发

```shell
git clone https://github.com/jin2089/halo_howell.git ~/halo2-dev/themes/halo_howell
```

```shell
cd ~/halo2-dev/themes/halo_howell
```

```shell
pnpm install
```

```shell
pnpm dev
```

主题开发文档可查阅：<https://docs.halo.run/developer-guide/theme/prepare>

## 构建

```shell
pnpm build
```

然后将 `dist` 目录的 `ZIP` 格式压缩包在 Halo 后台上传安装即可。

## 致谢

本项目基于以下 GPL-3.0 项目开发，完整归属信息见 [NOTICE](./NOTICE)：

- [Halo 官方主题 theme-earth](https://github.com/halo-dev/theme-earth)
- [theme-earthquake](https://github.com/mufengyian/theme-earthquake)，作者：风观

如果你分发本主题，请保留 `LICENSE`、`NOTICE` 及源码中的版权声明，并继续遵守 GPL-3.0 License。
