import { describe, expect, it, vi } from "vitest";
import { createBrowserRoutes } from "./browser.js";
import type { EnvironmentService } from "../services/environments.js";

describe("browser workspace ownership", () => {
  const make = () => {
    const service = {
      list: vi.fn(async (userId: string) => [{ id: userId }]),
      create: vi.fn(async (userId: string) => ({ userId })),
      get: vi.fn(async (userId: string, id: string) =>
        userId === id ? { id } : null,
      ),
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
});
