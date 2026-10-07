import { describe, expect, it } from "vitest";
import { applyChatEvent, historyItems } from "./chat-events";
import type { ChatItem } from "./session";

describe("agent transcript", () => {
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
