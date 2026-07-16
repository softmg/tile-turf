import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const buildDir = path.resolve(root, process.env.YANDEX_BUILD_DIR || "dist-yandex");
const maxSize = 100 * 1024 * 1024;
const forbiddenSegments = new Set(["server", "backend", "api", "node_modules"]);
const runtimeNamespaceUrls = new Set([
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/XML/1998/namespace",
]);

function isRuntimeNamespaceUrl(url) {
  return runtimeNamespaceUrls.has(url);
}

const forbiddenContent = [
  {
    pattern: /https?:\/\/localhost(?::\d+)?/gi,
    label: "absolute localhost URL",
  },
  { pattern: /https?:\/\/127\.0\.0\.1(?::\d+)?/gi, label: "absolute loopback URL" },
];
const contentExtensions = new Set([".css", ".html", ".js", ".json", ".map", ".mjs", ".txt"]);
const failures = [];
const warnings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(buildDir, absolute);
    const normalized = relative.split(path.sep).join("/");
    const segments = normalized.split("/");

    if (segments.some((segment) => forbiddenSegments.has(segment.toLowerCase()))) {
      failures.push(`Forbidden path in build: ${normalized}`);
    }
    if (segments.some((segment) => segment.startsWith(".env"))) {
      failures.push(`Environment file in build: ${normalized}`);
    }
    if (/[\s\u0400-\u04ff]/u.test(normalized)) {
      failures.push(`Path has whitespace or Cyrillic characters: ${normalized}`);
    }

    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
    } else if (entry.isFile()) {
      files.push({ absolute, relative: normalized });
    }
  }

  return files;
}

async function run() {
  try {
    const index = await readFile(path.join(buildDir, "index.html"), "utf8");
    const sdkMatch = index.match(/<script\b[^>]*\bsrc=["']\/sdk\.js["'][^>]*>/i);
    const moduleMatch = index.match(/<script\b[^>]*\btype=["']module["'][^>]*>/i);
    if (!sdkMatch) {
      failures.push(`${path.relative(root, buildDir)}/index.html does not load the SDK from /sdk.js.`);
    }
    if (sdkMatch && moduleMatch && sdkMatch.index > moduleMatch.index) {
      failures.push(`${path.relative(root, buildDir)}/index.html loads the application module before /sdk.js.`);
    }
    if (!/onload=["']initSDK\(\)["']/i.test(index)) {
      failures.push(`${path.relative(root, buildDir)}/index.html does not call initSDK() from the SDK onload handler.`);
    }
    if (/onerror=["']initSDK\(\)["']/i.test(index)) {
      failures.push(`${path.relative(root, buildDir)}/index.html treats /sdk.js load errors as SDK readiness.`);
    }
    if (!/onerror=["']__rejectYandexSdkScript\(\)["']/i.test(index)) {
      failures.push(`${path.relative(root, buildDir)}/index.html does not reject the SDK readiness promise on /sdk.js load errors.`);
    }
    if (/(?:src|href)=["']\/assets\//i.test(index)) {
      failures.push(`${path.relative(root, buildDir)}/index.html uses root-absolute Vite asset paths. Yandex build assets must be relative.`);
    }
  } catch {
    failures.push(`${path.relative(root, buildDir)}/index.html is missing.`);
  }

  let files = [];
  try {
    files = await walk(buildDir);
  } catch {
    failures.push(`${path.relative(root, buildDir)} cannot be read. Run npm run build:yandex first.`);
  }

  const externalUrls = new Set();
  let size = 0;
  for (const file of files) {
    size += (await stat(file.absolute)).size;
    if (!contentExtensions.has(path.extname(file.relative))) continue;

    const content = await readFile(file.absolute, "utf8");
    for (const check of forbiddenContent) {
      check.pattern.lastIndex = 0;
      let match;
      while ((match = check.pattern.exec(content)) !== null) {
        failures.push(`${file.relative} contains ${check.label}: ${match[0]}.`);
      }
    }

    for (const match of content.matchAll(/https?:\/\/[^\s"'`<>)\\]+/gi)) {
      const url = match[0];
      if (isRuntimeNamespaceUrl(url)) continue;
      externalUrls.add(`${file.relative}: ${url}`);
    }
  }

  if (size > maxSize) {
    failures.push(`${path.relative(root, buildDir)} is ${(size / 1024 / 1024).toFixed(2)} MB; limit is 100 MB.`);
  }

  for (const externalUrl of externalUrls) {
    failures.push(`Unexpected external URL in build: ${externalUrl}`);
  }

  if (failures.length > 0) {
    console.error("Yandex build validation failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  if (warnings.length > 0) {
    console.warn("Yandex build validation warnings:");
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
  console.log(`Yandex build validation passed: ${files.length} files, ${(size / 1024 / 1024).toFixed(2)} MB.`);
}

await run();
