import { describe, expect, it, vi } from "vitest";
import { createBrowserRoutes } from "./browser.js";
import type { EnvironmentService } from "../services/environments.js";
import { mintUiToken } from "../ui-tokens.js";

describe("browser workspace ownership", () => {
  const make = () => {
    const service = {
      list: vi.fn(async (userId: string) => [{ id: userId }]),
      create: vi.fn(async (userId: string) => ({ userId })),
      get: vi.fn(async (userId: string, id: string) =>
        userId === id || (userId === "owner" && id === "workspace") ? { id } : null,
      ),
      listProjects: vi.fn((userId: string, id: string) => [{ userId, id }]),
      createProject: vi.fn(async () => ({ id: "project" })),
      getUiBootstrap: vi.fn(async () => ({ environmentId: "workspace", piSessionId: "pi" })),
      resumeUiChat: vi.fn(async () => ({ token: "renewed-token" })),
      start: vi.fn(async () => ({ status: "ready" })),
      stop: vi.fn(async () => ({ status: "sleeping" })),
    };
    return {
      service,
      app: createBrowserRoutes(
        service as unknown as EnvironmentService,
        "test-secret",
      ),
    };
  };
  it("persists a guest, isolates other browsers, and rejects cookie tampering", async () => {
    const { app } = make();
    const first = await app.request("http://localhost/environments");
    const owner = (await first.json()).environments[0].id;
    const cookie = first.headers.get("set-cookie")!.split(";")[0];
    expect(first.headers.get("set-cookie")).toContain("HttpOnly");
    const resumed = await app.request("http://localhost/environments", {
      headers: { cookie },
    });
    expect((await resumed.json()).environments[0].id).toBe(owner);
    const other = await app.request(`http://localhost/environments/${owner}`);
    expect(other.status).toBe(404);
    const tampered = await app.request("http://localhost/environments", {
      headers: { cookie: cookie.replace("guest-", "evil-") },
    });
    expect((await tampered.json()).environments[0].id).not.toBe(owner);
  });
  it("rejects cross-origin writes and non-GitHub clone URLs", async () => {
    const { app, service } = make();
    const request = (origin: string, repoUrl: string) =>
      app.request("http://localhost/environments", {
        method: "POST",
        headers: {
          host: "localhost",
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ repoUrl }),
      });
    expect(
      (await request("https://attacker.com", "https://github.com/owner/repo"))
        .status,
    ).toBe(403);
    expect(
      (await request("http://localhost", "http://127.0.0.1/private")).status,
    ).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(
      (await request("http://localhost", "https://github.com/owner/repo"))
        .status,
    ).toBe(202);
    expect(service.create).toHaveBeenCalledOnce();
  });
  it("scopes chat tokens to their workspace without listing the owner's other workspaces", async () => {
    const { app, service } = make();
    const { token } = mintUiToken({ userId: "owner", environmentId: "workspace", piSessionId: "pi", secret: "test-secret" });
    const headers = { authorization: `Bearer ${token}` };
    const own = await app.request("http://localhost/environments/workspace/projects", { headers });
    expect(own.status).toBe(200);
    expect(service.listProjects).toHaveBeenCalledWith("owner", "workspace");
    expect((await app.request("http://localhost/environments/other/projects", { headers })).status).toBe(403);
    const listed = await app.request("http://localhost/environments", { headers });
    expect(await listed.json()).toEqual({ environments: [{ id: "workspace" }] });
    expect(service.list).not.toHaveBeenCalled();
    expect((await app.request("http://localhost/environments/workspace", { headers })).status).toBe(200);
    expect((await app.request("http://localhost/environments/other", { headers })).status).toBe(403);
    expect((await app.request("http://localhost/environments", {
      method: "POST", headers: { ...headers, host: "localhost", origin: "http://localhost" }, body: "{}",
    })).status).toBe(403);
  });
  it("keeps the linked workspace visible and usable after leaving the token URL", async () => {
    const { app, service } = make();
    const { token } = mintUiToken({ userId: "owner", environmentId: "workspace", piSessionId: "pi", secret: "test-secret" });
    const boot = await app.request(`http://localhost/bootstrap?t=${encodeURIComponent(token)}`);
    expect(boot.status).toBe(200);
    const cookies = boot.headers.getSetCookie();
    const grantCookie = cookies.find((cookie) => cookie.startsWith("cloud_agent_workspace="))!;
    expect(grantCookie).toContain("HttpOnly");
    expect(grantCookie).toContain("Path=/ui");
    expect(grantCookie).toContain("SameSite=Lax");
    const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    const listed = await app.request("http://localhost/environments", { headers: { cookie } });
    const environments = (await listed.json()).environments;
    expect(environments).toHaveLength(2);
    expect(environments).toContainEqual({ id: "workspace" });
    expect(service.list.mock.calls.at(-1)?.[0]).not.toBe("owner");
    expect((await app.request("http://localhost/environments/workspace", { headers: { cookie } })).status).toBe(200);
    expect((await app.request("http://localhost/environments/owner", { headers: { cookie } })).status).toBe(404);
    for (const action of ["chat", "start", "stop"]) {
      const response = await app.request(`http://localhost/environments/workspace/${action}`, {
        method: "POST", headers: { cookie, host: "localhost", origin: "http://localhost" }, body: "{}",
      });
      expect(response.status).toBe(200);
    }
    expect(service.resumeUiChat).toHaveBeenCalledWith("owner", "workspace");
    expect(service.start).toHaveBeenCalledWith("owner", "workspace");
    expect(service.stop).toHaveBeenCalledWith("owner", "workspace");
    expect((await app.request("http://localhost/environments/workspace/stop", {
      method: "POST", headers: { cookie, host: "localhost", origin: "https://attacker.com" }, body: "{}",
    })).status).toBe(403);
  });
  it("rejects expired or tampered workspace grants without switching guest identity", async () => {
    const { app, service } = make();
    const { token } = mintUiToken({ userId: "owner", environmentId: "workspace", piSessionId: "pi", secret: "test-secret" });
    const { token: expired } = mintUiToken({ userId: "owner", environmentId: "workspace", piSessionId: "pi", secret: "test-secret", ttlMs: -1000 });
    for (const invalid of [expired, `${token}tampered`]) {
      expect((await app.request(`http://localhost/bootstrap?t=${encodeURIComponent(invalid)}`)).status).toBe(401);
      const response = await app.request("http://localhost/environments", { headers: { cookie: `cloud_agent_workspace=${invalid}` } });
      expect((await response.json()).environments).toHaveLength(1);
      expect(service.list.mock.calls.at(-1)?.[0]).not.toBe("owner");
    }
  });
  it("applies the same GitHub-only and origin checks to additional projects", async () => {
    const { app, service } = make();
    const request = (origin: string, repoUrl: string) => app.request("http://localhost/environments/workspace/projects", {
      method: "POST", headers: { origin, host: "localhost", "content-type": "application/json" }, body: JSON.stringify({ repoUrl }),
    });
    expect((await request("http://localhost", "http://127.0.0.1/private")).status).toBe(400);
    expect((await request("https://attacker.com", "https://github.com/owner/repo")).status).toBe(403);
    expect(service.createProject).not.toHaveBeenCalled();
    expect((await request("http://localhost", "https://github.com/owner/repo")).status).toBe(202);
  });
});
