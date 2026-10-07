import { expect, it, vi } from "vitest";
import { EnvironmentService } from "./environments.js";

it("wakes an automatically stopped sandbox before opening chat and checks the runtime response", async () => {
  const service = Object.create(
    EnvironmentService.prototype,
  ) as EnvironmentService;
  const start = vi.fn(async () => undefined);
  const proxyRuntime = vi.fn(
    async () => new Response("unavailable", { status: 503 }),
  );
  Object.assign(service, {
    config: { browserSessionSecret: "test-secret" },
    requireOwned: () => ({
      status: "ready",
      sandboxId: "sandbox",
      name: "workspace",
    }),
    _sandboxes: { get: async () => ({ state: "stopped" }) },
    start,
    proxyRuntime,
  });
  await expect(
    service.openUiChat("user", "workspace", { piSessionId: "session" }),
  ).rejects.toThrow("Unable to open");
  expect(start).toHaveBeenCalledWith("user", "workspace");
  expect(start.mock.invocationCallOrder[0]).toBeLessThan(
    proxyRuntime.mock.invocationCallOrder[0],
  );
  proxyRuntime.mockResolvedValueOnce(new Response("{}"));
  const opened = await service.openUiChat("user", "workspace", {
    piSessionId: "session",
  });
  expect(opened.piSessionId).toBe("session");
  expect(opened.token).toBeTruthy();
  const createSession = vi.fn(async () => ({
    id: "ref",
    piSessionId: "fresh",
  }));
  Object.assign(service, { createSession });
  proxyRuntime.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "Session not found: empty" }), {
      status: 404,
    }),
  );
  proxyRuntime.mockResolvedValueOnce(new Response("{}"));
  const fresh = await service.openUiChat("user", "workspace", {
    piSessionId: "empty",
  });
  expect(fresh.piSessionId).toBe("fresh");
  expect(createSession).toHaveBeenCalledOnce();
});
