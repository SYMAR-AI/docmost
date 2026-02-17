import { defineConfig, loadEnv, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { createRequire } from "node:module";

export const envPath = path.resolve(process.cwd(), "..", "..");

const require = createRequire(import.meta.url);
// Resolve pdfjs-dist through react-pdf's context so versions match.
// react-pdf pins a specific pdfjs-dist version; the hoisted copy may differ.
const reactPdfPath = path.dirname(require.resolve("react-pdf/package.json"));
const requireFromReactPdf = createRequire(path.join(reactPdfPath, "package.json"));
const pdfjsDistPath = path.dirname(requireFromReactPdf.resolve("pdfjs-dist/package.json"));

export default defineConfig(({ mode }) => {
  const {
    APP_URL,
    FILE_UPLOAD_SIZE_LIMIT,
    FILE_IMPORT_SIZE_LIMIT,
    DRAWIO_URL,
    CLOUD,
    SUBDOMAIN_HOST,
    COLLAB_URL,
    BILLING_TRIAL_DAYS,
    POSTHOG_HOST,
    POSTHOG_KEY,
  } = loadEnv(mode, envPath, "");

  return {
    define: {
      "process.env": {
        APP_URL,
        FILE_UPLOAD_SIZE_LIMIT,
        FILE_IMPORT_SIZE_LIMIT,
        DRAWIO_URL,
        CLOUD,
        SUBDOMAIN_HOST,
        COLLAB_URL,
        BILLING_TRIAL_DAYS,
        POSTHOG_HOST,
        POSTHOG_KEY,
      },
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: normalizePath(path.join(pdfjsDistPath, "cmaps", "*")), dest: "cmaps/" },
          { src: normalizePath(path.join(pdfjsDistPath, "standard_fonts", "*")), dest: "standard_fonts/" },
        ],
      }),
    ],
    resolve: {
      alias: {
        "@": "/src",
        "pdfjs-dist": pdfjsDistPath,
      },
    },
    server: {
      proxy: {
        "/api": {
          target: APP_URL,
          changeOrigin: false,
        },
        "/socket.io": {
          target: APP_URL,
          ws: true,
          rewriteWsOrigin: true,
        },
        "/collab": {
          target: APP_URL,
          ws: true,
          rewriteWsOrigin: true,
        },
      },
    },
  };
});
