import { afterEach, describe, expect, it, vi } from "vitest";
import type { Api, AssistantMessage, AssistantMessageEvent, Model } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";
import { MODEL_IDLE_TIMEOUT_MS, withModelFallback } from "./model-fallback.js";

const paid: Model<Api> = { type: "chat", id: "paid", name: "Paid", api: "openai-completions", provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1", reasoning: false, input: ["text"],
  cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100_000, maxTokens: 8192 };
const free: Model<Api> = { ...paid, id: "openrouter/free", cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
const message = (model: Model<Api>, text = "", stopReason: AssistantMessage["stopReason"] = "stop"): AssistantMessage => ({
  role: "assistant", content: text ? [{ type: "text", text }] : [], api: model.api, provider: model.provider, model: model.id,
  usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
  timestamp: Date.now(), stopReason,
});
const response = (model: Model<Api>, text = "", fail = false) => {
  const output = createAssistantMessageEventStream();
  const final = message(model, text, fail ? "error" : "stop");
  output.push({ type: "start", partial: final });
  output.push(fail ? { type: "error", reason: "error", error: { ...final, errorMessage: "Provider unavailable" } }
    : { type: "done", reason: "stop", message: final });
  output.end();
  return output;
};
afterEach(() => vi.useRealTimers());

describe("model fallback", () => {
  it.each(["error", "empty", "throw"])("recovers from %s without repeating context or adding another user message", async (failure) => {
    const context = { messages: [{ role: "user" as const, content: "build this", timestamp: 1 }] };
    const stream = vi.fn((model: Model<Api>) => {
      if (model.id === free.id) return response(model, "Done");
      if (failure === "throw") throw new Error("Connection lost");
      return response(model, "", failure === "error");
    });
    const switched = vi.fn();
    const wrapped = withModelFallback(stream, free, switched);
    const result = wrapped(paid, context, { signal: new AbortController().signal });
    const events: AssistantMessageEvent[] = [];
    for await (const event of await result) events.push(event);
    expect((await (await result).result()).model).toBe(free.id);
    expect(events.filter((event) => event.type === "start")).toHaveLength(1);
    expect(events.some((event) => event.type === "error")).toBe(false);
    expect(switched).toHaveBeenCalledOnce();
    expect(stream.mock.calls.map(([model]) => model.id)).toEqual([paid.id, free.id]);
    expect(stream).toHaveBeenLastCalledWith(free, context, expect.objectContaining({ maxRetries: 0 }));
    expect(context.messages).toHaveLength(1);
  });
  it("uses free models for the rest of a run, then tries the primary model on the next run", async () => {
    const stream = vi.fn((model: Model<Api>) => response(model, model.id === paid.id ? "" : "Done", model.id === paid.id));
    const wrapped = withModelFallback(stream, free, vi.fn());
    const signal = new AbortController().signal;
    for (const current of [signal, signal, new AbortController().signal]) {
      await (await wrapped(paid, { messages: [] }, { signal: current })).result();
    }
    expect(stream.mock.calls.map(([model]) => model.id)).toEqual([paid.id, free.id, free.id, paid.id, free.id]);
  });
  it("leaves successful replies and tool calls on the primary model", async () => {
    const output = response(paid, "Done");
    const stream = vi.fn(() => output);
    const switched = vi.fn();
    const wrapped = withModelFallback(stream, free, switched);
    expect((await (await wrapped(paid, { messages: [] })).result()).model).toBe(paid.id);
    const tools = createAssistantMessageEventStream();
    const toolMessage = { ...message(paid, "", "toolUse"), content: [{ type: "toolCall" as const, id: "call", name: "bash", arguments: { command: "pwd" } }] };
    tools.push({ type: "start", partial: toolMessage });
    tools.push({ type: "done", reason: "toolUse", message: toolMessage });
    tools.end();
    stream.mockReturnValueOnce(tools);
    expect((await (await wrapped(paid, { messages: [] })).result()).stopReason).toBe("toolUse");
    expect(switched).not.toHaveBeenCalled();
  });
  it("bounds stalled requests and switches to a free model", async () => {
    vi.useFakeTimers();
    const stream = vi.fn((model: Model<Api>) => model.id === paid.id ? createAssistantMessageEventStream() : response(model, "Recovered"));
    const wrapped = withModelFallback(stream, free, vi.fn());
    const result = (await wrapped(paid, { messages: [] })).result();
    await vi.advanceTimersByTimeAsync(MODEL_IDLE_TIMEOUT_MS);
    expect((await result).model).toBe(free.id);
    expect(stream).toHaveBeenCalledTimes(2);
  });
  it("stops promptly without fallback when the user aborts a stalled request", async () => {
    const controller = new AbortController();
    const stream = vi.fn(() => createAssistantMessageEventStream());
    const switched = vi.fn();
    const wrapped = withModelFallback(stream, free, switched);
    const output = await wrapped(paid, { messages: [] }, { signal: controller.signal });
    controller.abort();
    expect((await output.result()).stopReason).toBe("aborted");
    expect(stream).toHaveBeenCalledOnce();
    expect(switched).not.toHaveBeenCalled();
  });
  it("reports exhausted free fallback and never sends a different provider's API key", async () => {
    const primary = { ...paid, provider: "openai" };
    const stream = vi.fn((model: Model<Api>) => response(model, "", true));
    const wrapped = withModelFallback(stream, free, vi.fn());
    const output = await wrapped(primary, { messages: [] }, { apiKey: "private-primary-key" });
    expect((await output.result()).stopReason).toBe("error");
    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream).toHaveBeenLastCalledWith(free, expect.anything(), expect.objectContaining({ apiKey: undefined }));
  });
  it("explains how to fix an account allowlist blocking free models", async () => {
    const wrapped = withModelFallback(() => { throw new Error("404: account's allowed-providers setting blocks this model"); }, free, vi.fn());
    const result = await (await wrapped(paid, { messages: [] })).result();
    expect(result.errorMessage).toBe("Free-model fallback is blocked by your OpenRouter allowed providers. Enable a provider serving free models at https://openrouter.ai/settings/privacy, then retry.");
  });
});
