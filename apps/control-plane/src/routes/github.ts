import { randomBytes, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AuthVariables } from "../middleware/auth.js";
import type { EnvironmentService } from "../services/environments.js";

const STATE_COOKIE = "cloud_agent_gh_state";
const APP_PATH = "/ui/?view=app";

/** Browser routes for linking a GitHub account through the GitHub App's OAuth flow. */
export function createGitHubRoutes(service: EnvironmentService, secret: string) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.get("/status", (c) => c.json(service.githubStatus(c.get("userId"))));

  /** Starts a sign-in (or an install, to pick repositories) bound to this browser by a state cookie. */
  const begin = async (c: Context, target: "authorize" | "install") => {
    const github = service.github;
    if (!github) return c.redirect(`${APP_PATH}&github=unavailable`);
    const state = randomBytes(24).toString("base64url");
    const redirectUri = `${requestOrigin(c)}/ui/api/github/callback`;
    await setSignedCookie(c, STATE_COOKIE, JSON.stringify({ state, redirectUri }), secret, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/ui/api/github",
      maxAge: 600,
      secure: isHttps(c),
    });
    return c.redirect(target === "install" ? `${github.installUrl}?state=${state}` : github.authorizeUrl(state, redirectUri));
  };

  app.get("/connect", (c) => begin(c, "authorize"));
  app.get("/install", (c) => begin(c, "install"));

  app.get("/callback", async (c) => {
    const github = service.github;
    if (!github) return c.redirect(`${APP_PATH}&github=unavailable`);
    const code = c.req.query("code");
    // Installing without the OAuth step (or changing repo access) lands here without a code.
    if (!code) return c.redirect(`${APP_PATH}&github=${c.req.query("setup_action") === "update" ? "updated" : "installed"}`);

    const saved = await getSignedCookie(c, secret, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/ui/api/github" });
    let expected: { state?: string; redirectUri?: string } = {};
    try {
      expected = saved ? JSON.parse(saved) : {};
    } catch {
      // treated as a missing state below
    }
    if (!sameString(c.req.query("state") ?? "", expected.state ?? "")) {
      return c.redirect(`${APP_PATH}&github=error`);
    }

    try {
      const redirectUri = expected.redirectUri ?? `${requestOrigin(c)}/ui/api/github/callback`;
      const tokens = await github.exchangeCode(code, redirectUri);
      await service.connectGitHub(c.get("userId"), tokens);
      const repos = await service.listGitHubRepos(c.get("userId"));
      // Signed in but no repositories granted yet: send them to pick some.
      if (!repos.length) return begin(c, "install");
      return c.redirect(`${APP_PATH}&github=connected`);
    } catch (err) {
      console.error("GitHub sign-in failed", err);
      return c.redirect(`${APP_PATH}&github=error`);
    }
  });

  app.get("/repos", async (c) => c.json({ repos: await service.listGitHubRepos(c.get("userId")) }));

  app.post("/disconnect", async (c) => c.json(await service.disconnectGitHub(c.get("userId"))));

  return app;
}

function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

function isHttps(c: Context): boolean {
  return c.req.url.startsWith("https:") || c.req.header("x-forwarded-proto") === "https";
}

/** Origin the browser used, including the Vite dev proxy's forwarded host. */
function requestOrigin(c: Context): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const rawHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim() || c.req.header("host") || "localhost";
  const host = /^[a-z0-9.-]+(:\d+)?$/i.test(rawHost) ? rawHost : "localhost";
  return `${isHttps(c) ? "https" : "http"}://${host}`;
}
