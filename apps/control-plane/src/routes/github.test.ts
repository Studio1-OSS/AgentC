import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { EnvironmentService } from "../services/environments.js";
import { createGitHubRoutes } from "./github.js";

function setup() {
  const github = {
    installUrl: "https://github.com/apps/test/installations/new",
    authorizeUrl: (state: string, redirectUri: string) =>
      `https://github.com/login/oauth/authorize?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    exchangeCode: vi.fn(async () => ({ accessToken: "ghu", refreshToken: null, expiresAt: null })),
  };
  const service = {
    github,
    githubStatus: vi.fn(() => ({ configured: true, connected: false })),
    connectGitHub: vi.fn(async () => ({})),
    listGitHubRepos: vi.fn(async () => [{ fullName: "me/app" }]),
  } as unknown as EnvironmentService;
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "guest-1");
    await next();
  });
  app.route("/ui/api/github", createGitHubRoutes(service, "test-secret"));
  return { app, github, service };
}

async function startSignIn(app: Hono<{ Variables: { userId: string } }>) {
  const res = await app.request("http://localhost:5173/ui/api/github/connect", { headers: { host: "localhost:5173" } });
  const location = new URL(res.headers.get("location")!);
  const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
  return { state: location.searchParams.get("state")!, redirectUri: location.searchParams.get("redirect_uri")!, cookie };
}

describe("GitHub sign-in routes", () => {
  it("redirects to GitHub with a state bound to this browser", async () => {
    const { app } = setup();
    const { state, redirectUri, cookie } = await startSignIn(app);
    expect(state.length).toBeGreaterThan(20);
    expect(redirectUri).toBe("http://localhost:5173/ui/api/github/callback");
    expect(cookie).toMatch(/^cloud_agent_gh_state=/);
  });

  it("links the account when the state matches", async () => {
    const { app, github, service } = setup();
    const { state, cookie, redirectUri } = await startSignIn(app);
    const res = await app.request(`http://localhost:5173/ui/api/github/callback?code=abc&state=${state}`, { headers: { cookie, host: "localhost:5173" } });
    expect(res.headers.get("location")).toBe("/ui/?view=app&github=connected");
    expect(github.exchangeCode).toHaveBeenCalledWith("abc", redirectUri);
    expect(service.connectGitHub).toHaveBeenCalledWith("guest-1", expect.objectContaining({ accessToken: "ghu" }));
  });

  it("rejects a callback whose state does not match, without exchanging the code", async () => {
    const { app, github } = setup();
    const { cookie } = await startSignIn(app);
    const forged = await app.request("http://localhost:5173/ui/api/github/callback?code=abc&state=attacker", { headers: { cookie, host: "localhost:5173" } });
    const missing = await app.request("http://localhost:5173/ui/api/github/callback?code=abc&installation_id=1");
    expect(forged.headers.get("location")).toBe("/ui/?view=app&github=error");
    expect(missing.headers.get("location")).toBe("/ui/?view=app&github=error");
    expect(github.exchangeCode).not.toHaveBeenCalled();
  });

  it("sends accounts with no granted repositories on to install the app", async () => {
    const { app, service } = setup();
    vi.mocked(service.listGitHubRepos).mockResolvedValueOnce([]);
    const { state, cookie } = await startSignIn(app);
    const res = await app.request(`http://localhost:5173/ui/api/github/callback?code=abc&state=${state}`, { headers: { cookie, host: "localhost:5173" } });
    expect(res.headers.get("location")).toMatch(/^https:\/\/github\.com\/apps\/test\/installations\/new\?state=/);
  });
});
