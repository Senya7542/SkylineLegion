import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const outputDir = path.join(rootDir, "output");
const outputFile = path.join(outputDir, "SkylineLegion.html");

const mimeByExt = new Map([
  [".css", "text/css"],
  [".js", "text/javascript"],
  [".html", "text/html"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"],
  [".json", "application/json"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const build = spawnSync(process.execPath, [viteCli, "build"], {
  cwd: rootDir,
  env: {
    ...process.env,
    SINGLE_FILE_BUILD: "1",
  },
  stdio: "inherit",
});

if (build.error) {
  console.error(build.error);
}

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const stripQuery = (url) => url.split(/[?#]/)[0];
const normalizeAssetPath = (url) => decodeURIComponent(stripQuery(url).replace(/^\/+/, ""));

const toDataUrl = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mime = mimeByExt.get(ext) ?? "application/octet-stream";
  const data = await readFile(filePath);
  return `data:${mime};base64,${data.toString("base64")}`;
};

const collectFiles = async (dir, prefix = "") => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(prefix, entry.name);
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, relativePath)));
    } else {
      files.push({ relativePath, absolutePath });
    }
  }

  return files;
};

const resolveBuiltFile = (rawUrl, fromFile = path.join(distDir, "index.html")) => {
  const normalized = normalizeAssetPath(rawUrl);
  const fromRelative = path.relative(distDir, fromFile).replaceAll("\\", "/");
  const relativePath = rawUrl.startsWith("/")
    ? normalized
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromRelative), normalized));

  return {
    relativePath,
    absolutePath: path.join(distDir, relativePath),
  };
};

const assetFiles = (await collectFiles(distDir)).filter(
  ({ relativePath }) => relativePath !== "index.html",
);
const dataUrlByRelativePath = new Map();

for (const file of assetFiles) {
  dataUrlByRelativePath.set(file.relativePath, await toDataUrl(file.absolutePath));
}

const inlineCssUrls = (css, cssFilePath) =>
  css.replace(/url\((['"]?)(?!data:|blob:|https?:|#)([^'")]+)\1\)/g, (_match, _quote, rawUrl) => {
    const { relativePath } = resolveBuiltFile(rawUrl, cssFilePath);
    const dataUrl = dataUrlByRelativePath.get(relativePath);
    return dataUrl ? `url("${dataUrl}")` : `url("${rawUrl}")`;
  });

const replaceRuntimeAssetStrings = (code) => {
  let nextCode = code;

  for (const [relativePath, dataUrl] of dataUrlByRelativePath) {
    if (relativePath.endsWith(".js") || relativePath.endsWith(".css")) continue;

    nextCode = nextCode.split(`/${relativePath}`).join(dataUrl);
    nextCode = nextCode.split(`./${relativePath}`).join(dataUrl);
    nextCode = nextCode.split(relativePath).join(dataUrl);
  }

  return nextCode;
};

let html = await readFile(path.join(distDir, "index.html"), "utf8");

html = html.replace(
  /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_match, href) => {
    const { relativePath, absolutePath } = resolveBuiltFile(href);
    const dataUrl = dataUrlByRelativePath.get(relativePath);

    if (!dataUrl) return "";

    const cssText = Buffer.from(dataUrl.split(",", 2)[1], "base64").toString("utf8");
    return `<style>\n${inlineCssUrls(cssText, absolutePath)}\n</style>`;
  },
);

html = html.replace(
  /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_match, src) => {
    const { absolutePath } = resolveBuiltFile(src);
    let js = "";

    try {
      js = replaceRuntimeAssetStrings(
        Buffer.from(dataUrlByRelativePath.get(path.relative(distDir, absolutePath).replaceAll("\\", "/")).split(",", 2)[1], "base64").toString("utf8"),
      );
    } catch {
      throw new Error(`Unable to inline script: ${src}`);
    }

    return `<script type="module">\n${js}\n</script>`;
  },
);

html = html.replace(
  /<link\s+rel="icon"[^>]*href="([^"]+)"[^>]*>/g,
  (match, href) => {
    const { relativePath } = resolveBuiltFile(href);
    const dataUrl = dataUrlByRelativePath.get(relativePath);
    return dataUrl ? match.replace(href, dataUrl) : match;
  },
);

html = html.replace("</head>", `  <meta name="build-mode" content="single-file">\n</head>`);

await mkdir(outputDir, { recursive: true });
await writeFile(outputFile, html, "utf8");

console.log(`\nSingle HTML playable build written to:\n${outputFile}`);
