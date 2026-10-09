import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
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

if (existsSync(webIndex)) {
  app.get("/ui", (c) => c.redirect("/ui/"));
  app.use(
    "/ui/assets/*",
    serveStatic({
      root: webDist,
      rewriteRequestPath: (path) => path.replace(/^\/ui/, ""),
    }),
  );
  app.get("/ui/", (c) => {
    c.header("content-type", "text/html; charset=utf-8");
    return c.body(readFileSync(webIndex));
  });
  // SPA fallback for any other /ui path (except /ui/api and /ui/ws)
  app.get("/ui/*", (c) => {
    const path = c.req.path;
    if (path.startsWith("/ui/api") || path.startsWith("/ui/ws")) {
      return c.notFound();
    }
    c.header("content-type", "text/html; charset=utf-8");
    return c.body(readFileSync(webIndex));
  });
} else {
  app.get("/ui", (c) =>
    c.text(
      "Web UI not built yet. Run: pnpm --filter @cloud-agent/web build",
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
