import { afterEach, expect, it, vi } from "vitest";
import { EnvironmentService } from "./environments.js";
import { SandboxClient } from "@cloud-agent/sandbox-client";
import { WEB_PREVIEW_CONFIG_PATH } from "@cloud-agent/protocol";
import { createDatabase, migrateDatabase } from "@cloud-agent/database";

afterEach(() => vi.unstubAllEnvs());

it("provisions a port-scoped preview without copying the sandbox credential into it", async () => {
  const uploadFile = vi.fn(async () => undefined);
  const createFolder = vi.fn(async () => undefined);
  const getSignedPreview = vi.fn(async () => ({ url: "https://3000-signed.proxy.daytona.work", port: 3000, token: "private-token" }));
  const client = { getSignedPreview } as unknown as SandboxClient;
  const sandbox = { fs: { uploadFile, createFolder } } as unknown as Parameters<SandboxClient["configureWebPreview"]>[0];
  await SandboxClient.prototype.configureWebPreview.call(client, sandbox);
  expect(getSignedPreview).toHaveBeenCalledWith(sandbox, 3000, 86400);
  expect(uploadFile).toHaveBeenCalledWith(expect.any(Buffer), WEB_PREVIEW_CONFIG_PATH);
  const content = JSON.parse(uploadFile.mock.calls[0]![0].toString());
  expect(content).toMatchObject({ url: "https://3000-signed.proxy.daytona.work", port: 3000 });
  expect(content).not.toHaveProperty("token");
  expect(Date.parse(content.expiresAt)).toBeGreaterThan(Date.now());
});

it("wakes an automatically stopped sandbox before opening chat and checks the runtime response", async () => {
  const service = Object.create(
    EnvironmentService.prototype,
  ) as EnvironmentService;
  const database = createDatabase(":memory:");
  migrateDatabase(database.sqlite);
  const start = vi.fn(async () => undefined);
  const proxyRuntime = vi.fn(
    async () => new Response("unavailable", { status: 503 }),
  );
  Object.assign(service, {
    db: database.db,
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
  database.sqlite.close();
});

it("resumes the sandbox and refreshes its preview without deploying Pi or credentials", async () => {
  const service = Object.create(EnvironmentService.prototype) as EnvironmentService;
  const sandbox = { id: "sandbox" };
  const sandboxes = {
    start: vi.fn(async () => sandbox),
    configureWebPreview: vi.fn(async () => undefined),
    deployAndStartRuntime: vi.fn(),
  };
  Object.assign(service, {
    requireOwned: () => ({ sandboxId: "sandbox", status: "sleeping" }),
    setStatus: vi.fn(async () => undefined),
    get: vi.fn(async () => ({ status: "ready" })),
    _sandboxes: sandboxes,
  });
  await service.start("owner", "workspace");
  expect(sandboxes.start).toHaveBeenCalledWith("sandbox");
  expect(sandboxes.configureWebPreview).toHaveBeenCalledWith(sandbox);
  expect(sandboxes.deployAndStartRuntime).not.toHaveBeenCalled();
});
