#!/usr/bin/env node
/**
 * theme-package 只打包 templates、README、LICENSE 等固定路径，
 * 不包含根目录的 NOTICE。这里在打包前把归属声明复制进 templates，
 * 确保分发的主题包也携带 GPL 归属信息。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "NOTICE");
const targetDir = path.join(root, "templates");
const target = path.join(targetDir, "NOTICE");

if (!fs.existsSync(source)) {
  console.error("未找到 NOTICE，无法打包归属声明");
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log("已复制 NOTICE 到 templates/NOTICE");
