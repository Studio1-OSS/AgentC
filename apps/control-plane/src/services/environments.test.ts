import { afterEach, expect, it, vi } from "vitest";
import { EnvironmentService } from "./environments.js";
import { SandboxClient } from "@cloud-agent/sandbox-client";
import { WEB_PREVIEW_CONFIG_PATH, RUNTIME_VERSION } from "@cloud-agent/protocol";
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

it("restarts a dead runtime on a started sandbox and reopens chat instead of staying disconnected", async () => {
  vi.stubEnv("PI_PROVIDER", "openrouter");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const service = Object.create(EnvironmentService.prototype) as EnvironmentService;
  const database = createDatabase(":memory:");
  migrateDatabase(database.sqlite);
  const sandbox = { state: "started", id: "sandbox" };
  const deployAndStartRuntime = vi.fn(async () => undefined);
  const fetchRuntime = vi.fn(async () => new Response("bad gateway", { status: 502 }));
  const proxyRuntime = vi.fn()
    .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
    .mockResolvedValueOnce(new Response("{}"));
  Object.assign(service, {
    db: database.db,
    config: {
      browserSessionSecret: "test-secret",
      runtimeAccessSecret: "secret",
      runtimeBundleDir: "../../sandbox/runtime",
    },
    requireOwned: () => ({
      status: "ready",
      sandboxId: "sandbox",
      name: "workspace",
    }),
    _sandboxes: {
      get: async () => sandbox,
      fetchRuntime,
      deployAndStartRuntime,
      configureWebPreview: vi.fn(async () => undefined),
    },
    proxyRuntime,
  });
  const opened = await service.openUiChat("user", "workspace", { piSessionId: "session" });
  expect(deployAndStartRuntime).toHaveBeenCalledOnce();
  expect(opened.piSessionId).toBe("session");
  expect(opened.token).toBeTruthy();
  proxyRuntime
    .mockResolvedValueOnce(new Response("gone", { status: 502 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ model: "test", provider: "openrouter" })));
  const boot = await service.getUiBootstrap(opened.token);
  expect(boot.piSessionId).toBe("session");
  expect(deployAndStartRuntime).toHaveBeenCalledTimes(2);
  database.sqlite.close();
});

it("redeploys when public health is fine but authenticated runtime routes reject the access token", async () => {
  vi.stubEnv("PI_PROVIDER", "openrouter");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const service = Object.create(EnvironmentService.prototype) as EnvironmentService;
  const database = createDatabase(":memory:");
  migrateDatabase(database.sqlite);
  const sandbox = { state: "started", id: "sandbox" };
  let deployed = false;
  const deployAndStartRuntime = vi.fn(async () => { deployed = true; });
  const fetchRuntime = vi.fn(async (_sandbox: unknown, path: string) => {
    if (path === "/health") return Response.json({ ok: true, multiProject: true });
    if (!deployed) return new Response("unauthorized", { status: 401 });
    return Response.json({ cwd: "/workspace" });
  });
  const proxyRuntime = vi.fn(async () => deployed ? new Response("{}") : new Response("unauthorized", { status: 401 }));
  Object.assign(service, {
    db: database.db,
    config: {
      browserSessionSecret: "test-secret",
      runtimeAccessSecret: "secret",
      runtimeBundleDir: "../../sandbox/runtime",
    },
    requireOwned: () => ({
      status: "ready",
      sandboxId: "sandbox",
      name: "workspace",
    }),
    _sandboxes: {
      get: async () => sandbox,
      fetchRuntime,
      deployAndStartRuntime,
      waitForRuntimeHealthy: vi.fn(async () => undefined),
      configureWebPreview: vi.fn(async () => undefined),
    },
    proxyRuntime,
  });
  const opened = await service.openUiChat("user", "workspace", { piSessionId: "session" });
  expect(deployAndStartRuntime).toHaveBeenCalledOnce();
  expect(opened.token).toBeTruthy();
  database.sqlite.close();
});

it("upgrades a healthy legacy runtime on resume and keeps a current runtime", async () => {
  vi.stubEnv("PI_PROVIDER", "openrouter");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  const service = Object.create(EnvironmentService.prototype) as EnvironmentService;
  const sandbox = { id: "sandbox" };
  const deployAndStartRuntime = vi.fn(async () => undefined);
  const fetchRuntime = vi.fn(async () => Response.json({ ok: true }));
  Object.assign(service, {
    config: { runtimeAccessSecret: "secret", runtimeBundleDir: "../../sandbox/runtime" },
    requireOwned: () => ({ sandboxId: "sandbox", status: "sleeping" }),
    setStatus: vi.fn(async () => undefined),
    get: vi.fn(async () => ({ status: "ready" })),
    _sandboxes: {
      start: vi.fn(async () => sandbox),
      waitForRuntimeHealthy: vi.fn(async () => undefined),
      fetchRuntime,
      deployAndStartRuntime,
      configureWebPreview: vi.fn(async () => undefined),
    },
  });
  await service.start("owner", "workspace");
  expect(deployAndStartRuntime).toHaveBeenCalledOnce();
  expect(deployAndStartRuntime).toHaveBeenCalledWith(sandbox, expect.objectContaining({ runtimeAccessToken: "secret" }));
  fetchRuntime.mockResolvedValueOnce(Response.json({ ok: true, multiProject: true }));
  await service.start("owner", "workspace");
  expect(deployAndStartRuntime).toHaveBeenCalledTimes(2);
  fetchRuntime.mockResolvedValueOnce(Response.json({ ok: true, multiProject: true, runtimeVersion: RUNTIME_VERSION }));
  await service.start("owner", "workspace");
  expect(deployAndStartRuntime).toHaveBeenCalledTimes(2);
});
