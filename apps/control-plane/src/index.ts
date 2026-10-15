import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import type { Server as HttpServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createAuthMiddleware, type AuthVariables } from "./middleware/auth.js";
import { EnvironmentService } from "./services/environments.js";
import { createEnvironmentRoutes } from "./routes/environments.js";
import { createBrowserRoutes } from "./routes/browser.js";
import { attachUiWebSocketProxy } from "./ws-proxy.js";

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();

if (!config.daytonaApiKey) {
  console.warn(
    "DAYTONA_API_KEY is not set. Environment create/start/stop will fail until it is configured.",
  );
}
if (!config.llm.apiKey) {
  console.warn(
    "No LLM API key is set (NEBIUS_API_KEY or another provider key). Agent turns will fail until one is configured in .env.",
  );
}

const service = new EnvironmentService(config);
const app = new Hono<{ Variables: AuthVariables }>();

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "control-plane",
  }),
);

app.route("/ui/api", createBrowserRoutes(service, config.browserSessionSecret));
app.get("/", (c) => c.redirect("/ui/"));

app.use("/environments/*", createAuthMiddleware(config));
app.use("/environments", createAuthMiddleware(config));
app.route("/environments", createEnvironmentRoutes(service));

const webDist = resolve(here, "../../web/dist");
const webIndex = join(webDist, "index.html");

/** Public origin for absolute SEO URLs: PUBLIC_SITE_URL, else the request's own origin. */
function siteUrl(c: Context): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(c.req.url).protocol.replace(":", "");
  const rawHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim() || c.req.header("host") || "localhost";
  // Never echo an arbitrary Host header into the page.
  const host = /^[a-z0-9.-]+(:\d+)?$/i.test(rawHost) ? rawHost : "localhost";
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

/** App screens and token links are private: only the bare landing page is indexable. */
function isIndexable(c: Context): boolean {
  const query = new URL(c.req.url).searchParams;
  return !query.has("t") && !query.has("token") && query.get("view") !== "app";
}

function renderIndex(c: Context) {
  const html = readFileSync(webIndex, "utf8").replaceAll("__SITE_URL__", siteUrl(c));
  c.header("content-type", "text/html; charset=utf-8");
  c.header("cache-control", "no-cache");
  if (!isIndexable(c)) c.header("x-robots-tag", "noindex, nofollow");
  return c.body(html);
}

app.get("/robots.txt", (c) => {
  const origin = siteUrl(c);
  c.header("content-type", "text/plain; charset=utf-8");
  return c.body(
    [
      "User-agent: *",
      "Allow: /ui/",
      "Disallow: /ui/api/",
      "Disallow: /ui/ws",
      "Disallow: /environments",
      "Disallow: /*?t=",
      "Disallow: /*?token=",
      "",
      `Sitemap: ${origin}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

app.get("/sitemap.xml", (c) => {
  const origin = siteUrl(c);
  c.header("content-type", "application/xml; charset=utf-8");
  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${origin}/ui/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
      `</urlset>\n`,
  );
});

if (existsSync(webIndex)) {
  app.get("/ui", (c) => c.redirect("/ui/"));
  app.use(
    "/ui/assets/*",
    serveStatic({
      root: webDist,
      rewriteRequestPath: (path) => path.replace(/^\/ui/, ""),
    }),
  );
  // Files copied from web/public (favicon, fonts, icons, share image, manifest).
  app.use("/ui/*", async (c, next) => {
    const path = c.req.path;
    if (path.startsWith("/ui/api") || path.startsWith("/ui/ws") || !/\.[a-z0-9]+$/i.test(path) || path.endsWith(".html")) {
      return next();
    }
    if (path.endsWith(".webmanifest")) c.header("content-type", "application/manifest+json");
    return serveStatic({ root: webDist, rewriteRequestPath: (p) => p.replace(/^\/ui/, "") })(c, next);
  });
  app.get("/ui/", renderIndex);
  // SPA fallback for any other /ui path (except /ui/api and /ui/ws)
  app.get("/ui/*", (c) => {
    const path = c.req.path;
    if (path.startsWith("/ui/api") || path.startsWith("/ui/ws")) {
      return c.notFound();
    }
    return renderIndex(c);
  });
} else {
  app.get("/ui", (c) =>
    c.text(
      "Web UI not built yet. Run: pnpm --filter @agentc/web build",
      503,
    ),
  );
}

const server = serve(
  { fetch: app.fetch, port: config.port, hostname: config.host },
  (info) => {
    console.log(
      `control-plane listening on http://${info.address}:${info.port}`,
    );
    if (existsSync(webIndex)) {
      console.log(`chat UI: http://${info.address}:${info.port}/ui/`);
    }
  },
);

attachUiWebSocketProxy(
  server as unknown as HttpServer,
  service,
  config.browserSessionSecret,
);

export { app, service, config };

const shutdown = async () => {
  await service.disposeAll();
  server.close(() => process.exit(0));
};
process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
