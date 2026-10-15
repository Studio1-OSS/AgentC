import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";
import { ModelRuntime, createWriteToolDefinition } from "@earendil-works/pi-coding-agent";
import { DEFAULT_OPENROUTER_MODEL, type ServerEvent } from "@agentc/protocol";
import { PiSessionRegistry } from "./pi.js";

it("keeps the real Pi transcript and completed tools intact when a streamed request falls back", async () => {
  const directory = mkdtempSync(join(tmpdir(), "agentc-pi-integration-"));
  const registry = new PiSessionRegistry({ cwd: directory, agentDir: join(directory, ".pi"), previewPort: 3001, tools: [createWriteToolDefinition(directory)],
    llm: { providerId: "openrouter", modelId: DEFAULT_OPENROUTER_MODEL, apiKey: "test-key", apiKeyEnvVar: "OPENROUTER_API_KEY" } });
  const stream = vi.spyOn(ModelRuntime.prototype, "streamSimple").mockImplementation((model, context) => {
    const output = createAssistantMessageEventStream();
    const result: AssistantMessage = {
      role: "assistant", content: [], api: model.api, provider: model.provider, model: model.id,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      timestamp: Date.now(), stopReason: "stop",
    };
    if (!context.messages.some((message) => message.role === "toolResult")) {
      result.content = [{ type: "toolCall", id: "write-call", name: "write", arguments: { path: "result.txt", content: "saved once" } }];
      result.stopReason = "toolUse";
      output.push({ type: "start", partial: result });
      output.push({ type: "done", reason: "toolUse", message: result });
    } else if (model.id === DEFAULT_OPENROUTER_MODEL) {
      result.content = [{ type: "text", text: "Interrupted draft" }];
      output.push({ type: "start", partial: result });
      output.push({ type: "text_delta", contentIndex: 0, delta: "Interrupted draft", partial: result });
      output.push({ type: "error", reason: "error", error: { ...result, stopReason: "error", errorMessage: "Provider unavailable" } });
    } else {
      result.content = [{ type: "text", text: "Completed with the free model" }];
      output.push({ type: "start", partial: result });
      output.push({ type: "done", reason: "stop", message: result });
    }
    output.end();
    return output;
  });
  try {
    const { id } = await registry.createSession();
    const session = registry.getOrThrow(id).session;
    session.setAutoRetryEnabled(false);
    expect(session.systemPrompt).toContain("automatically start it in the background on 0.0.0.0:3001");
    const events: ServerEvent[] = [];
    registry.subscribe(id, (event) => events.push(event));
    await registry.prompt(id, "Write result.txt and explain the result");
    expect(readFileSync(join(directory, "result.txt"), "utf8")).toBe("saved once");
    expect(events.filter((event) => event.type === "tool.start")).toHaveLength(1);
    expect(events.filter((event) => event.type === "model.fallback")).toHaveLength(1);
    expect(events.filter((event) => event.type === "error")).toEqual([]);
    const messages = registry.getMessages(id);
    expect(messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(messages.filter((message) => message.role === "assistant")).toHaveLength(2);
    expect(JSON.stringify(messages)).not.toContain("Interrupted draft");
    expect(messages.at(-1)).toMatchObject({ model: "openrouter/free", content: [{ type: "text", text: "Completed with the free model" }] });
    expect(registry.getState(id)).toMatchObject({ running: false, model: "openrouter/free" });
    expect(events.at(-1)).toEqual({ type: "run.end" });
  } finally {
    registry.disposeAll();
    stream.mockRestore();
    rmSync(directory, { recursive: true, force: true });
  }
}, 20_000);
