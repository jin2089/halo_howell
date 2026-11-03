// 把 lxgw-wenkai-webfont 的字模镜像到 public/assets/fonts，供主题自托管。
// 构建时 public/ 会原样复制到 templates/assets/，前台即可通过 /assets/fonts 访问。
// 用法：pnpm fetch:fonts（依赖系统自带 tar，Windows 10+ / Linux / macOS 均自带）
//
// 只下载 npm 整包一次再解包，而不是逐文件请求：分片多达 291 个，逐文件拉取在弱网下极易失败。
// 分片按 unicode-range 切分，访客只会下载实际用到的子集，不必担心整包体积。
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PKG = "lxgw-wenkai-webfont";
const VERSION = "1.7.0";
const WEIGHTS = ["light", "regular", "bold"];
const OUT_DIR = path.resolve(process.cwd(), "public", "assets", "fonts");
const ATTEMPTS = 3;

// 国内镜像优先；单个源失败时自动换下一个。
const MIRRORS = [
  `https://registry.npmmirror.com/${PKG}/-/${PKG}-${VERSION}.tgz`,
  `https://registry.npmjs.org/${PKG}/-/${PKG}-${VERSION}.tgz`,
];

const subsetPattern = new RegExp(`^lxgwwenkai-(${WEIGHTS.join("|")})-subset-\\d+\\.woff2$`);

async function downloadTarball(target) {
  let lastError;
  for (const url of MIRRORS) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length === 0) {
          throw new Error("响应为空");
        }
        await fs.writeFile(target, buffer);
        console.log(`已获取 ${PKG}@${VERSION}（${(buffer.length / 1024 / 1024).toFixed(2)} MB）：${url}`);
        return;
      } catch (error) {
        lastError = error;
        console.warn(`第 ${attempt} 次下载失败（${url}）：${error.message}`);
      }
    }
  }
  throw new Error(`无法下载 ${PKG}@${VERSION}，请检查网络或代理：${lastError?.message}`);
}

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "lxgw-wenkai-"));
const tarball = path.join(tmpDir, `${PKG}-${VERSION}.tgz`);

try {
  await downloadTarball(tarball);

  // 用相对文件名并在 tmpDir 内解包：MSYS/Git 的 GNU tar 会把 "C:\..." 当成远程主机名。
  execFileSync("tar", ["-xzf", `${PKG}-${VERSION}.tgz`], { cwd: tmpDir, stdio: "pipe" });

  const packageDir = path.join(tmpDir, "package");
  const subsetsDir = path.join(packageDir, "files");
  const subsets = (await fs.readdir(subsetsDir)).filter((name) => subsetPattern.test(name));

  for (const weight of WEIGHTS) {
    const prefix = `lxgwwenkai-${weight}-subset-`;
    if (!subsets.some((name) => name.startsWith(prefix))) {
      throw new Error(`包内缺少 ${weight} 字重的分片文件`);
    }
  }

  await fs.mkdir(path.join(OUT_DIR, "files"), { recursive: true });

  let totalSize = 0;
  for (const weight of WEIGHTS) {
    const target = path.join(OUT_DIR, `lxgwwenkai-${weight}.css`);
    await fs.copyFile(path.join(packageDir, `lxgwwenkai-${weight}.css`), target);
    totalSize += (await fs.stat(target)).size;
  }
  for (const name of subsets) {
    const target = path.join(OUT_DIR, "files", name);
    await fs.copyFile(path.join(subsetsDir, name), target);
    totalSize += (await fs.stat(target)).size;
  }

  const count = subsets.length + WEIGHTS.length;
  console.log(
    `完成：${count} 个文件（CSS ${WEIGHTS.length} 个 / 分片 ${subsets.length} 个），共 ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
  );
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}
