import { describe, expect, it } from "vitest";
import { applyChatEvent, historyItems, verifiedPreview } from "./chat-events";
import type { ChatItem } from "./session";

describe("agent transcript", () => {
  it("marks missing tool results interrupted after a runtime restart while preserving live runs", () => {
    const state = { type: "session.state", messages: [
      { role: "assistant", content: [
        { type: "toolCall", id: "bash", name: "bash", arguments: { command: "start server" } },
        { type: "toolCall", id: "preview", name: "preview", arguments: {} },
      ] },
    ] };
    const active = applyChatEvent([], { ...state, running: true });
    expect(active.every((item) => item.kind === "tool" && item.status === "start")).toBe(true);
    for (const items of [applyChatEvent([], { ...state, running: false }), applyChatEvent(active, { type: "run.end" })]) {
      expect(items).toHaveLength(2);
      expect(items.every((item) => item.kind === "tool" && item.status === "end" && item.isError)).toBe(true);
      expect(items[0]).toMatchObject({ output: expect.stringContaining("interrupted") });
    }
  });
  it("replaces a failed partial reply with a fallback notice while preserving completed tools", () => {
    const items: ChatItem[] = [
      { id: "user", kind: "user", text: "Build an app" },
      { id: "tool", kind: "tool", tool: "write", callId: "call", status: "end", output: "Saved" },
      { id: "partial", kind: "assistant", text: "Interrupted", streaming: true },
    ];
    const next = applyChatEvent(items, { type: "model.fallback", message: "Continuing with a free model" });
    expect(next.map((item) => item.kind)).toEqual(["user", "tool", "system"]);
    expect(next[2]).toMatchObject({ text: "Continuing with a free model" });
    expect(applyChatEvent(next, { type: "message.delta", text: "Recovered" })[3]).toMatchObject({ text: "Recovered", streaming: true });
  });
  it("only offers successful, unexpired HTTPS previews", () => {
    const item: ChatItem = { id: "preview", kind: "tool", tool: "preview", callId: "p", status: "end",
      details: { url: "https://3000-signed.proxy.daytona.work", expiresAt: "2026-10-10T00:00:00.000Z" } };
    const now = Date.parse("2026-10-09T00:00:00Z");
    expect(verifiedPreview(item, now)?.url).toBe("https://3000-signed.proxy.daytona.work/");
    expect(verifiedPreview({ ...item, isError: true }, now)).toBeNull();
    expect(verifiedPreview({ ...item, status: "start" }, now)).toBeNull();
    expect(verifiedPreview(item, now + 86400_000)).toBeNull();
    expect(verifiedPreview({ ...item, details: { url: "http://localhost:3000", expiresAt: "2026-10-10T00:00:00Z" } }, now)).toBeNull();
  });
  it("restores missed history and a partial reply without appending duplicates on sync", () => {
    const state = {
      type: "session.state",
      running: true,
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: [{ type: "text", text: "Earlier reply" }] },
      ],
      streamingMessage: { role: "assistant", content: [{ type: "text", text: "Still writing" }] },
    };
    let items = applyChatEvent([], state);
    items = applyChatEvent(items, state);
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ text: "Still writing", streaming: true });
    items = applyChatEvent(items, { type: "message.delta", text: "…" });
    expect(items[2]).toMatchObject({ text: "Still writing…" });
    items = applyChatEvent(items, {
      type: "session.state",
      running: false,
      messages: [...state.messages, { role: "assistant", content: [{ type: "text", text: "Finished while disconnected" }] }],
    });
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ text: "Finished while disconnected" });
    expect(items.some((item) => item.kind === "assistant" && item.streaming)).toBe(false);
  });
  it("preserves repeated deltas and replaces them with the exact final snapshot", () => {
    let items: ChatItem[] = applyChatEvent([], {
      type: "message.start",
      role: "assistant",
    });
    for (const text of ["Hi", "! ", "Hi", "!", " ", " "])
      items = applyChatEvent(items, { type: "message.delta", text });
    expect(items[0]).toMatchObject({ text: "Hi! Hi!  " });
    items = applyChatEvent(items, {
      type: "message.end",
      role: "assistant",
      text: "Hi! Hi!  ",
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: "Hi! Hi!  ", streaming: false });
  });
  it("drops empty tool-only assistant bubbles and combines tool updates by call ID", () => {
    let items = applyChatEvent([], {
      type: "message.start",
      role: "assistant",
    });
    items = applyChatEvent(items, {
      type: "message.end",
      role: "assistant",
      text: "",
    });
    expect(items).toEqual([]);
    items = applyChatEvent(items, {
      type: "tool.start",
      callId: "call",
      tool: "bash",
      args: { command: "pwd" },
    });
    items = applyChatEvent(items, {
      type: "tool.update",
      callId: "call",
      tool: "bash",
      partial: { content: [{ type: "text", text: "/workspace" }] },
    });
    items = applyChatEvent(items, {
      type: "tool.end",
      callId: "call",
      tool: "bash",
      result: { content: [{ type: "text", text: "/workspace/project" }] },
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      status: "end",
      output: "/workspace/project",
      args: { command: "pwd" },
    });
  });
  it("restores reasoning, tool arguments, results and images from Pi history", () => {
    const items = historyItems([
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Inspect the file" },
          {
            type: "toolCall",
            id: "c",
            name: "read",
            arguments: { path: "logo.png" },
          },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "c",
        toolName: "read",
        content: [
          { type: "text", text: "Image loaded" },
          { type: "image", mimeType: "image/png", data: "example" },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "**Done**" }] },
    ]);
    expect(items).toHaveLength(3);
    expect(items[1]).toMatchObject({
      kind: "tool",
      args: { path: "logo.png" },
      status: "end",
      output: "Image loaded",
      images: ["data:image/png;base64,example"],
    });
    expect(items[2]).toMatchObject({ kind: "assistant", text: "**Done**" });
  });
});
