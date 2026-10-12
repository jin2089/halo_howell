# Howell Theme

基于 [theme-earth](https://github.com/halo-dev/theme-earth) 定制的 Halo 2.0 个人博客主题。

![Howell Theme](./screenshot.jpg)

## 使用方式

1. 手动下载主题包并在 Console 的主题管理界面安装，安装方式可参考：<https://docs.halo.run/user-guide/themes>
2. 在后台「主题」设置中启用并进行个性化配置。

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

基于 [Halo 官方主题 theme-earth](https://github.com/halo-dev/theme-earth)（GPL-3.0 License）定制开发。
