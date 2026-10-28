#!/usr/bin/env node
/**
 * 色彩回归护栏：
 * 1. src 中不得再出现 Tailwind 默认调色板（blue / indigo / red / ...），必须使用语义色板。
 * 2. src 中用到的每个语义色彩工具类，必须真的出现在构建产物 CSS 里（防止类名写错或被配置移除）。
 *
 * 用法：pnpm run build && pnpm run check:colors
 */
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = "src";
const ASSET_DIR = "templates/assets";

/** 数值色阶：bg-slate-50 / hover:text-primary-600 / dark:ring-offset-slate-700 */
const NUMERIC_RE =
  /(?<![\w:./!-])(?:[a-z0-9-]+:)*!?(?:border|divide|ring|ring-offset|outline|shadow|text|bg|from|via|to|fill|stroke|placeholder|decoration|accent|caret)-(?:slate|gray|primary|danger|success)-\d{1,3}(?:\/\d{1,3})?(?![\w/-])/g;

/** 语义别名：bg-surface-card / text-content-main / border-line-base */
const NAMED_RE =
  /(?<![\w:./!-])(?:[a-z0-9-]+:)*!?(?:border|divide|ring|ring-offset|outline|shadow|text|bg|from|via|to|fill|stroke|placeholder|decoration|accent|caret)-(?:surface|content|line)-(?:base|card|muted|elevated|main|subtle)(?![\w/-])/g;

/** 无色阶：bg-white / text-black\/90 / ring-offset-white */
const PLAIN_RE =
  /(?<![\w:./!-])(?:[a-z0-9-]+:)*!?(?:border|divide|ring|ring-offset|outline|shadow|text|bg|fill|stroke|placeholder|decoration)-(?:white|black|primary|danger|success)(?:\/\d{1,3})?(?![\w/-])/g;

/** 禁止的默认调色板 */
const FORBIDDEN_RE =
  /(?<![\w:./!-])(?:[a-z0-9-]+:)*!?(?:border|divide|ring|ring-offset|outline|shadow|text|bg|from|via|to|fill|stroke|placeholder|decoration|accent|caret)-(?:blue|indigo|red|green|sky|zinc|neutral|stone|emerald|teal|cyan|lime|amber|orange|yellow|rose|pink|fuchsia|purple|violet)(?:-\d{1,3})?(?:\/\d{1,3})?(?![\w/-])/g;

const LOCAL_RES = [NUMERIC_RE, NAMED_RE, PLAIN_RE];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, files);
    } else if (entry.name.endsWith(".html") || entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }

  return files;
}

function escapeSelector(token) {
  return token.replace(/[:/![\].()%,#]/g, "\\$&");
}

if (!fs.existsSync(ASSET_DIR)) {
  console.error(`未找到构建产物目录 ${ASSET_DIR}，请先执行 pnpm run build`);
  process.exit(1);
}

const css = fs
  .readdirSync(ASSET_DIR)
  .filter((name) => name.endsWith(".css"))
  .map((name) => fs.readFileSync(path.join(ASSET_DIR, name), "utf8"))
  .join("\n");

const localTokens = new Map();
const forbiddenHits = [];

for (const file of walk(SRC_DIR)) {
  const source = fs.readFileSync(file, "utf8");

  for (const pattern of LOCAL_RES) {
    for (const token of source.match(pattern) ?? []) {
      if (!localTokens.has(token)) {
        localTokens.set(token, file);
      }
    }
  }

  for (const token of source.match(FORBIDDEN_RE) ?? []) {
    forbiddenHits.push(`${token} (${file})`);
  }
}

const missing = [];

for (const [token, file] of localTokens) {
  if (!css.includes(escapeSelector(token))) {
    missing.push(`${token} (${file})`);
  }
}

if (forbiddenHits.length > 0) {
  console.error("发现默认调色板用法，请改用 primary / danger / success / surface：");

  for (const hit of forbiddenHits) console.error(`  ✗ ${hit}`);
}

if (missing.length > 0) {
  console.error("以下色彩类未出现在构建产物中（类名拼写错误或色板未定义）：");

  for (const hit of missing) console.error(`  ✗ ${hit}`);
}

if (forbiddenHits.length > 0 || missing.length > 0) {
  process.exit(1);
}

console.log(`色彩护栏通过：${localTokens.size} 个语义色彩类全部命中产物 CSS，无默认调色板残留。`);
