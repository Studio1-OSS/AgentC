import { describe, expect, it } from "vitest";
import { mapPiEvent } from "./events.js";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
const map = (event: unknown) => mapPiEvent(event as AgentSessionEvent);
describe("Pi events", () => {
  it("surfaces model failures rather than leaving a silent blank reply", () => {
    expect(
      map({
        type: "message_end",
        message: {
          role: "assistant",
          content: [],
          stopReason: "error",
          errorMessage: "Provider unavailable",
        },
      }),
    ).toEqual([
      { type: "message.end", role: "assistant", text: "" },
      { type: "error", message: "Provider unavailable", code: "model_failed" },
    ]);
  });
  it("sends final text as a snapshot, never another delta", () => {
    expect(
      map({
        type: "message_end",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello" }],
        },
      }),
    ).toEqual([
      {
        type: "message.end",
        role: "assistant",
        text: "Hello",
        thinking: "",
        content: [{ type: "text", text: "Hello" }],
      },
    ]);
    expect(
      map({ type: "message_start", message: { role: "toolResult" } }),
    ).toEqual([{ type: "message.start", role: "tool", messageId: undefined }]);
  });
  it("passes reasoning and full tool results through", () => {
    expect(
      map({
        type: "message_update",
        assistantMessageEvent: { type: "thinking_delta", delta: "Inspect" },
      }),
    ).toEqual([
      { type: "message.delta", text: "Inspect", channel: "thinking" },
    ]);
    const result = { content: [{ type: "text", text: "actual output" }] };
    expect(
      map({
        type: "tool_execution_end",
        toolName: "bash",
        toolCallId: "c",
        result,
        isError: false,
      }),
    ).toEqual([
      { type: "tool.end", tool: "bash", callId: "c", result, isError: false },
    ]);
  });
});
