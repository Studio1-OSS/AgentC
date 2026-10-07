import type { ChatItem, RuntimeContent, RuntimeMessage } from "./session";

const id = () => crypto.randomUUID();
const parts = (content: unknown): RuntimeContent[] =>
  typeof content === "string"
    ? [{ type: "text", text: content }]
    : Array.isArray(content)
      ? content
      : [];
export const textOf = (content: unknown) =>
  parts(content)
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
export const imagesOf = (content: unknown) =>
  parts(content).flatMap((p) =>
    p.type === "image" &&
    p.data &&
    /^(image\/(png|jpeg|webp|gif))$/.test(p.mimeType ?? "")
      ? [`data:${p.mimeType};base64,${p.data}`]
      : [],
  );
export function outputOf(result: unknown) {
  if (result && typeof result === "object" && "content" in result)
    return textOf(result.content);
  return typeof result === "string"
    ? result
    : result === undefined
      ? ""
      : JSON.stringify(result, null, 2);
}
export function historyItems(messages: RuntimeMessage[]): ChatItem[] {
  const items: ChatItem[] = [];
  for (const m of messages) {
    if (m.role === "toolResult" || m.role === "tool") {
      const target = items.findIndex(
        (i) => i.kind === "tool" && i.callId === m.toolCallId,
      );
      const tool: ChatItem = {
        id: target >= 0 ? items[target].id : id(),
        kind: "tool",
        tool: m.toolName ?? "tool",
        callId: m.toolCallId ?? id(),
        status: "end",
        isError: m.isError,
        details: m.details,
        output: textOf(m.content),
        images: imagesOf(m.content),
      };
      if (target >= 0) items[target] = { ...items[target], ...tool };
      else items.push(tool);
    } else if (m.role === "user") {
      items.push({
        id: id(),
        kind: "user",
        text: textOf(m.content),
        images: imagesOf(m.content),
      });
    } else if (m.role === "assistant") {
      const text = textOf(m.content),
        thinking = parts(m.content)
          .filter((p) => p.type === "thinking")
          .map((p) => p.thinking ?? "")
          .join("\n"),
        images = imagesOf(m.content);
      if (text || thinking || images.length)
        items.push({ id: id(), kind: "assistant", text, thinking, images });
      for (const p of parts(m.content))
        if (p.type === "toolCall")
          items.push({
            id: id(),
            kind: "tool",
            tool: p.name ?? "tool",
            callId: p.id ?? id(),
            args: p.arguments,
            status: "start",
          });
    }
  }
  return items;
}
export function applyChatEvent(
  items: ChatItem[],
  event: Record<string, unknown>,
): ChatItem[] {
  const current = items
    .map((i) => i.kind === "assistant" && !!i.streaming)
    .lastIndexOf(true);
  switch (event.type) {
    case "message.start":
      return event.role === "assistant"
        ? [...items, { id: id(), kind: "assistant", text: "", streaming: true }]
        : items;
    case "message.delta": {
      if (typeof event.text !== "string") return items;
      const field = event.channel === "thinking" ? "thinking" : "text";
      if (current < 0)
        return [
          ...items,
          {
            id: id(),
            kind: "assistant",
            text: "",
            [field]: event.text,
            streaming: true,
          },
        ];
      return items.map((item, i) =>
        i === current && item.kind === "assistant"
          ? { ...item, [field]: (item[field] ?? "") + event.text }
          : item,
      );
    }
    case "message.end": {
      if (event.role !== "assistant") return items;
      if (current < 0)
        return event.text || event.thinking || imagesOf(event.content).length
          ? [
              ...items,
              {
                id: id(),
                kind: "assistant",
                text: String(event.text ?? ""),
                thinking: String(event.thinking ?? ""),
                images: imagesOf(event.content),
              },
            ]
          : items;
      return items
        .map((item, i) =>
          i === current && item.kind === "assistant"
            ? {
                ...item,
                text: typeof event.text === "string" ? event.text : item.text,
                thinking:
                  typeof event.thinking === "string"
                    ? event.thinking
                    : item.thinking,
                images: imagesOf(event.content),
                streaming: false,
              }
            : item,
        )
        .filter(
          (i) =>
            i.kind !== "assistant" ||
            i.text ||
            i.thinking ||
            i.images?.length ||
            i.streaming,
        );
    }
    case "run.end":
      return items
        .map((i) => (i.kind === "assistant" ? { ...i, streaming: false } : i))
        .filter(
          (i) =>
            i.kind !== "assistant" || i.text || i.thinking || i.images?.length,
        );
    case "tool.start":
    case "tool.update":
    case "tool.end": {
      const callId = String(event.callId ?? ""),
        target = items.findIndex(
          (i) => i.kind === "tool" && i.callId === callId,
        );
      const result =
        event.type === "tool.update" ? event.partial : event.result;
      const candidate = items[target];
      const old = candidate?.kind === "tool" ? candidate : undefined;
      const tool: ChatItem = {
        id: old?.id ?? id(),
        kind: "tool",
        callId,
        tool: String(event.tool ?? old?.tool ?? "tool"),
        status: event.type === "tool.end" ? "end" : "start",
        args: event.args ?? old?.args,
        details:
          result && typeof result === "object" && "details" in result
            ? result.details
            : old?.details,
        output: result === undefined ? old?.output : outputOf(result),
        images:
          result && typeof result === "object" && "content" in result
            ? imagesOf(result.content)
            : old?.images,
        isError: Boolean(event.isError),
      };
      return target < 0
        ? [...items, tool]
        : items.map((i, index) => (index === target ? tool : i));
    }
    case "compaction":
      return [
        ...items,
        {
          id: id(),
          kind: "system",
          text: String(event.summary ?? "Earlier conversation summarized"),
        },
      ];
    default:
      return items;
  }
}
