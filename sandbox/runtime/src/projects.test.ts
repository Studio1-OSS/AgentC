import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { ProjectRegistries } from "./projects.js";

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSession: vi.fn(), ModelRuntime: { create: vi.fn() },
  createBashToolDefinition: vi.fn(() => ({ name: "bash", execute: vi.fn() })),
  DefaultResourceLoader: vi.fn(function () { return { reload: vi.fn() }; }),
  SessionManager: { create: vi.fn(), open: vi.fn(), list: vi.fn() },
}));
let directory: string;
const createdSessions = new Map<string, { prompt: ReturnType<typeof vi.fn> }>();
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "cloud-agent-projects-"));
  vi.mocked(ModelRuntime.create).mockResolvedValue({ getModel: () => ({ maxTokens: 8192, contextWindow: 100_000 }), setRuntimeApiKey: vi.fn() } as never);
  vi.mocked(SessionManager.list).mockResolvedValue([]);
  vi.mocked(createAgentSession).mockImplementation(async () => {
    const sessionId = randomUUID();
    const session = {
      sessionId, messages: [], isIdle: true, agent: { state: {} },
      prompt: vi.fn(async () => {}), setSessionName: vi.fn(), subscribe: vi.fn(() => () => {}), dispose: vi.fn(),
    };
    createdSessions.set(sessionId, session);
    return { session } as never;
  });
});
afterEach(() => { rmSync(directory, { recursive: true, force: true }); createdSessions.clear(); vi.clearAllMocks(); });
const setup = () => new ProjectRegistries({ cwd: join(directory, "project"), agentDir: join(directory, ".pi"), llm: { providerId: "openrouter", modelId: "test", apiKey: "test" } });

describe("project conversation registries", () => {
  it("keeps cwd, session discovery and preview tools scoped to each project", async () => {
    const projects = setup();
    const projectId = randomUUID();
    const original = projects.get(), additional = projects.get(projectId, 3001);
    const first = await original.createSession(), second = await additional.createSession();
    expect(createAgentSession).toHaveBeenNthCalledWith(1, expect.objectContaining({ cwd: join(directory, "project") }));
    expect(createAgentSession).toHaveBeenNthCalledWith(2, expect.objectContaining({ cwd: join(directory, "projects", projectId) }));
    const options = vi.mocked(createAgentSession).mock.calls[1]![0]!;
    expect(options.customTools?.[0]?.description).toContain("3001");
    await expect(additional.openSession(first.id)).rejects.toThrow("Session not found");
    expect(() => original.getOrThrow(second.id)).toThrow("not open");
    expect(SessionManager.list).toHaveBeenCalledWith(join(directory, "projects", projectId));
  });
  it("allows separate projects to run independently and lists empty active chats", async () => {
    const projects = setup();
    const original = projects.get(), additional = projects.get(randomUUID(), 3001);
    const first = await original.createSession(), second = await additional.createSession();
    let finish!: () => void;
    createdSessions.get(first.id)!.prompt.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const active = original.prompt(first.id, "keep running");
    await additional.prompt(second.id, "another project");
    expect(original.isRunning(first.id)).toBe(true);
    expect(additional.isRunning(second.id)).toBe(false);
    expect(await original.listSessions()).toEqual([expect.objectContaining({ id: first.id, running: true, messageCount: 0 })]);
    finish();
    await active;
    projects.disposeAll();
  });
  it("rejects directory traversal and changed preview ports", () => {
    const projects = setup();
    expect(() => projects.get("../../outside", 3001)).toThrow();
    const projectId = randomUUID();
    expect(projects.get(projectId, 3001)).toBe(projects.get(projectId, 3001));
    expect(() => projects.get(projectId, 3002)).toThrow("port changed");
    expect(() => projects.get("default", 3001)).toThrow("default project port");
  });
});
