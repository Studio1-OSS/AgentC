import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

/**
 * index.html uses __SITE_URL__ for absolute SEO URLs (canonical, Open Graph).
 * Dev and builds with VITE_SITE_URL fill it in here; otherwise the server
 * substitutes the request's origin when it serves the page.
 */
function siteUrl(): Plugin {
  let isServe = false;
  return {
    name: "agentc-site-url",
    configResolved(config) {
      isServe = config.command === "serve";
    },
    transformIndexHtml(html) {
      const fixed = process.env.VITE_SITE_URL?.replace(/\/+$/, "");
      const url = fixed || (isServe ? "http://localhost:5173" : undefined);
      return url ? html.replaceAll("__SITE_URL__", url) : html;
    },
  };
}

export default defineConfig({
  base: "/ui/",
  plugins: [react(), tailwindcss(), siteUrl()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/ui/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
        xfwd: true,
      },
      "/ui/ws": {
        target: "ws://127.0.0.1:8787",
        ws: true,
        xfwd: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
