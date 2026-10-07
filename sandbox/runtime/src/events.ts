import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { ServerEvent } from "@cloud-agent/protocol";

export function mapPiEvent(event: AgentSessionEvent): ServerEvent[] {
  switch (event.type) {
    case "message_start":
      return [
        {
          type: "message.start",
          role: roleFromMessage(event.message),
          messageId: (event.message as { id?: string }).id,
        },
      ];
    case "message_update": {
      const ame = event.assistantMessageEvent as {
        type?: string;
        delta?: string;
      };
      if (ame?.type === "text_delta" && typeof ame.delta === "string") {
        return [{ type: "message.delta", text: ame.delta }];
      }
      if (ame?.type === "thinking_delta" && typeof ame.delta === "string") {
        return [
          { type: "message.delta", text: ame.delta, channel: "thinking" },
        ];
      }
      return [];
    }
    case "message_end": {
      const role = roleFromMessage(event.message);
      const failure = event.message as {
        stopReason?: string;
        errorMessage?: string;
      };
      if (role === "assistant" && failure.stopReason === "error")
        return [
          { type: "message.end", role: "assistant", text: "" },
          {
            type: "error",
            message:
              failure.errorMessage || "The model failed to finish its response",
            code: "model_failed",
          },
        ];
      const content = (event.message as { content?: unknown }).content;
      return [
        {
          type: "message.end",
          role,
          ...(role === "assistant"
            ? {
                text: extractMessageText(content),
                thinking: Array.isArray(content)
                  ? content
                      .filter((p) => p.type === "thinking")
                      .map((p) => p.thinking ?? "")
                      .join("\n")
                  : "",
                content,
              }
            : {}),
        },
      ];
    }
    case "tool_execution_start":
      return [
        {
          type: "tool.start",
          tool: event.toolName,
          callId: event.toolCallId,
          args: (event as { args?: unknown }).args,
        },
      ];
    case "tool_execution_update":
      return [
        {
          type: "tool.update",
          tool: event.toolName,
          callId: event.toolCallId,
          partial: (event as { partialResult?: unknown }).partialResult,
        },
      ];
    case "tool_execution_end":
      return [
        {
          type: "tool.end",
          tool: event.toolName,
          callId: event.toolCallId,
          isError: Boolean((event as { isError?: boolean }).isError),
          result: (event as { result?: unknown }).result,
        },
      ];
    case "agent_start":
      return [{ type: "run.start" }];
    case "agent_settled":
    case "agent_end":
      return [{ type: "run.end" }];
    case "compaction_end":
      return [
        {
          type: "compaction",
          summary: (event as { result?: { summary?: string } }).result?.summary,
        },
      ];
    default:
      return [];
  }
}

function roleFromMessage(message: unknown): "user" | "assistant" | "tool" {
  const role = (message as { role?: string } | undefined)?.role;
  if (role === "toolResult") return "tool";
  if (role === "user" || role === "assistant" || role === "tool") return role;
  return "assistant";
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}
