import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
import { PiSessionRegistry } from "./pi.js";
import type { ServerEvent } from "@agentc/protocol";

vi.mock("@earendil-works/pi-coding-agent", () => ({
  createAgentSession: vi.fn(),
  createBashToolDefinition: vi.fn(() => ({ name: "bash", execute: vi.fn() })),
  DefaultResourceLoader: vi.fn(function () { return { reload: vi.fn() }; }),
  ModelRuntime: { create: vi.fn() },
  SettingsManager: { inMemory: vi.fn() },
  SessionManager: { create: vi.fn(), open: vi.fn(), list: vi.fn() },
}));
const directories: string[] = [];
afterEach(() => {
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  vi.clearAllMocks();
});

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "agentc-test-"));
  directories.push(dir);
  let listener: (event: AgentSessionEvent) => void = () => {};
  const session = {
    sessionId: "session", messages: [], isIdle: true,
    agent: { state: { streamingMessage: undefined } },
    prompt: vi.fn(async () => {}), steer: vi.fn(), followUp: vi.fn(), abort: vi.fn(), dispose: vi.fn(),
    subscribe: vi.fn((fn: typeof listener) => { listener = fn; return () => {}; }),
  };
  vi.mocked(ModelRuntime.create).mockResolvedValue({ getModel: (_provider: string, id: string) => id === "openrouter/free" ? undefined : ({ maxTokens: 8192, contextWindow: 100_000 }), setRuntimeApiKey: vi.fn() } as never);
  vi.mocked(createAgentSession).mockResolvedValue({ session: session as unknown as AgentSession } as never);
  const registry = new PiSessionRegistry({ cwd: dir, agentDir: dir, llm: { providerId: "openrouter", modelId: "test", apiKey: "test" } });
  await registry.createSession();
  const events: ServerEvent[] = [];
  registry.subscribe("session", (event) => events.push(event));
  return { registry, session, events, emit: (event: unknown) => listener(event as AgentSessionEvent) };
}

describe("Pi run ownership", () => {
  it("rejects a concurrent prompt without falsely ending the active run", async () => {
    const { registry, session, events, emit } = await setup();
    let finish!: () => void;
    session.prompt.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const pending = registry.prompt("session", "first");
    expect(registry.isRunning("session")).toBe(true);
    await expect(registry.prompt("session", "second")).rejects.toThrow("still replying");
    emit({ type: "agent_end", messages: [], willRetry: true });
    emit({ type: "agent_settled" });
    expect(events.filter((event) => event.type === "run.end")).toEqual([]);
    finish();
    await pending;
    expect(registry.isRunning("session")).toBe(false);
    expect(events.filter((event) => event.type === "run.end")).toHaveLength(1);
  });
  it("clears failed prompts and starts idle follow-ups instead of leaving them queued", async () => {
    const { registry, session, events } = await setup();
    session.prompt.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(registry.prompt("session", "first")).rejects.toThrow("provider unavailable");
    expect(registry.isRunning("session")).toBe(false);
    expect(events.at(-1)).toEqual({ type: "run.end" });
    await registry.followUp("session", "retry");
    expect(session.prompt).toHaveBeenLastCalledWith("retry");
    expect(session.followUp).not.toHaveBeenCalled();
  });
  it("shares a single session load between simultaneous reconnects", async () => {
    const { registry } = await setup();
    vi.mocked(SessionManager.list).mockResolvedValue([{ id: "reopened", path: "session.jsonl" }] as never);
    await Promise.all([registry.openSession("reopened"), registry.openSession("reopened")]);
    expect(SessionManager.list).toHaveBeenCalledOnce();
    expect(createAgentSession).toHaveBeenCalledTimes(2);
  });
});
