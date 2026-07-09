import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function yandexSdkHtmlPlugin(): PluginOption {
  const sdkReadyBootstrap = `window.__yandexSdkScriptReady = new Promise(function (resolve, reject) {
  window.initSDK = function () {
    resolve();
  };
  window.__rejectYandexSdkScript = function () {
    reject(new Error("Yandex Games SDK failed to load."));
  };
});`;

  return {
    name: "tile-turf-yandex-sdk-html",
    apply: "build",
    transformIndexHtml(_html, context) {
      if (context.server || process.env.NODE_ENV !== "production") return [];
      return [
        {
          tag: "script",
          children: sdkReadyBootstrap,
          injectTo: "head-prepend",
        },
        {
          tag: "script",
          attrs: {
            async: true,
            src: "/sdk.js",
            onload: "initSDK()",
            onerror: "__rejectYandexSdkScript()",
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

function stripYandexReleaseUrlsPlugin(): PluginOption {
  const urlPattern = /https?:\/\/[^\s"'`<>)\\]+/g;
  const runtimeNamespaces = new Set([
    "http://www.w3.org/2000/svg",
    "http://www.w3.org/1998/Math/MathML",
    "http://www.w3.org/1999/xlink",
    "http://www.w3.org/XML/1998/namespace",
  ]);

  const stripUrls = (code: string) =>
    code.replace(urlPattern, (url) => (runtimeNamespaces.has(url) ? url : ""));

  return {
    name: "tile-turf-strip-yandex-release-urls",
    apply: "build",
    renderChunk(code) {
      return { code: stripUrls(code), map: null };
    },
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== "asset" || typeof asset.source !== "string") continue;
        asset.source = stripUrls(asset.source);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === "yandex" ? "./" : "/",
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    mode === "yandex" && yandexSdkHtmlPlugin(),
    mode === "yandex" && stripYandexReleaseUrlsPlugin(),
  ].filter(Boolean),
  build: {
    outDir: "dist-static",
    emptyOutDir: true,
  },
}));
