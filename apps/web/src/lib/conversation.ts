import type { ChatItem } from "@/lib/session";
import type { DiffLine, FileDiff, ToolIcon, ToolStep } from "@/components/ToolCalls";

/* Maps the live Pi event stream (ChatItem[] from useChatSession) onto the
 * message shape the conversation UI renders: one assistant turn per user
 * prompt, with its tool calls as steps and its file edits as diffs. */

export type LiveAgent = { variant: "blue" | "purple" | "orange" | "lime"; name: string; role: string };

export type LiveMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agentVariant?: LiveAgent["variant"];
  agentName?: string;
  agentRole?: string;
  status?: "thinking" | "ready";
  thinkingSteps?: string[];
  thinkingDurationMs?: number;
  completedAt?: number;
  toolSteps?: ToolStep[];
  toolDiffs?: FileDiff[];
  markdown?: boolean;
};

/** When a turn started and finished, recorded by the caller as events arrive. */
export type TurnTiming = { start: number; end?: number; stamp: string };

type ToolItem = Extract<ChatItem, { kind: "tool" }>;

const WORKSPACE_PREFIX = /^\/home\/daytona\/workspace\/[^/]+\//;

function relativePath(path: unknown): string {
  return typeof path === "string" ? path.replace(WORKSPACE_PREFIX, "") : "";
}

function argsOf(tool: ToolItem): Record<string, unknown> {
  return tool.args && typeof tool.args === "object" ? (tool.args as Record<string, unknown>) : {};
}

function firstLines(text: string | undefined, count: number): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .slice(0, count)
    .map((line) => (line.length > 140 ? `${line.slice(0, 140)}…` : line));
}

type EditPair = { oldText: string; newText: string };

function editsOf(args: Record<string, unknown>): EditPair[] {
  const list = Array.isArray(args.edits) ? args.edits : [args];
  return list.flatMap((edit) => {
    if (!edit || typeof edit !== "object") return [];
    const { oldText, newText } = edit as Record<string, unknown>;
    return typeof oldText === "string" && typeof newText === "string" ? [{ oldText, newText }] : [];
  });
}

function stepFor(tool: ToolItem): ToolStep {
  const args = argsOf(tool);
  const running = tool.status === "start";
  const outputLines = firstLines(tool.output, 2);
  const detail = (lines: string[]) =>
    (running ? ["Running…"] : lines.length ? lines : ["Done"]).map((text) => ({ text }));
  const errorDetail = tool.isError ? firstLines(tool.output, 2).map((text) => ({ text })) : null;

  let icon: ToolIcon = "think";
  let label = tool.tool;
  let chip = "";
  let mono = true;
  let detailLines = detail(outputLines);

  switch (tool.tool) {
    case "read":
      icon = "read";
      label = "Read";
      chip = relativePath(args.path);
      detailLines = detail([`${(tool.output ?? "").split("\n").length} lines read`]);
      break;
    case "write": {
      icon = "write";
      const content = typeof args.content === "string" ? args.content : "";
      label = `Write ${content ? content.split("\n").length : 0} lines`;
      chip = relativePath(args.path);
      detailLines = running
        ? detail([])
        : firstLines(content, 2).map((text) => ({ text: `+ ${text.trim()}`, tone: "add" as const }));
      break;
    }
    case "edit": {
      icon = "write";
      const edits = editsOf(args);
      label = edits.length > 1 ? `Edit ${edits.length} places` : "Edit";
      chip = relativePath(args.path);
      detailLines = running
        ? detail([])
        : edits.slice(0, 1).flatMap((e) => firstLines(e.newText, 2)).map((text) => ({ text: `+ ${text.trim()}`, tone: "add" as const }));
      break;
    }
    case "bash":
      icon = "run";
      label = "Run";
      chip = typeof args.command === "string" ? args.command : "";
      break;
    case "preview":
      icon = "run";
      label = "Preview";
      chip = typeof args.port === "number" ? `port ${args.port}` : "dev server";
      mono = false;
      break;
    default:
      chip = Object.keys(args).length ? JSON.stringify(args).slice(0, 80) : "";
  }

  return {
    icon,
    label,
    chip: chip || "—",
    mono,
    detailMono: tool.tool !== "preview",
    detail: errorDetail?.length ? errorDetail : detailLines.length ? detailLines : [{ text: "Done" }],
  };
}

function stepTitle(tool: ToolItem): string {
  const args = argsOf(tool);
  switch (tool.tool) {
    case "read":
      return `Reading ${relativePath(args.path) || "files"}`;
    case "write":
      return `Writing ${relativePath(args.path) || "a file"}`;
    case "edit":
      return `Editing ${relativePath(args.path) || "a file"}`;
    case "bash":
      return `Running ${typeof args.command === "string" ? args.command.split("\n")[0].slice(0, 60) : "a command"}`;
    case "preview":
      return "Starting the preview";
    default:
      return `Using ${tool.tool}`;
  }
}

function diffsFor(tools: ToolItem[]): FileDiff[] {
  const byFile = new Map<string, FileDiff>();
  for (const tool of tools) {
    if (tool.isError || (tool.tool !== "write" && tool.tool !== "edit")) continue;
    const args = argsOf(tool);
    const file = relativePath(args.path);
    if (!file) continue;
    const lines: DiffLine[] = [];
    if (tool.tool === "write") {
      const content = typeof args.content === "string" ? args.content : "";
      lines.push(...content.split("\n").map((text) => ({ text, tone: "add" as const })));
    } else {
      for (const edit of editsOf(args)) {
        lines.push(...edit.oldText.split("\n").map((text) => ({ text, tone: "del" as const })));
        lines.push(...edit.newText.split("\n").map((text) => ({ text, tone: "add" as const })));
      }
    }
    const previous = byFile.get(file);
    const merged = [...(previous?.lines ?? []), ...lines];
    byFile.set(file, {
      file,
      lines: merged,
      add: merged.filter((l) => l.tone === "add").length,
      del: merged.filter((l) => l.tone === "del").length,
      isNew: previous ? previous.isNew : tool.tool === "write",
    });
  }
  return [...byFile.values()];
}

type Turn = { key: string; items: ChatItem[] };

export function buildConversation(
  items: ChatItem[],
  options: { busy: boolean; agent: LiveAgent; timings: Map<string, TurnTiming> },
): LiveMessage[] {
  const messages: LiveMessage[] = [];
  const turns: Turn[] = [];
  let current: Turn | null = null;

  for (const item of items) {
    if (item.kind === "user") {
      const timing = options.timings.get(item.id);
      messages.push({ id: item.id, role: "user", content: item.text, timestamp: timing?.stamp ?? "" });
      current = { key: item.id, items: [] };
      turns.push(current);
      messages.push({ id: `turn-${item.id}`, role: "assistant", content: "", timestamp: timing?.stamp ?? "" });
    } else {
      if (!current) {
        current = { key: `lead-${item.id}`, items: [] };
        turns.push(current);
        messages.push({ id: `turn-${current.key}`, role: "assistant", content: "", timestamp: "" });
      }
      current.items.push(item);
    }
  }

  const lastTurnKey = turns[turns.length - 1]?.key;
  for (const turn of turns) {
    const index = messages.findIndex((m) => m.id === `turn-${turn.key}`);
    const tools = turn.items.filter((i): i is ToolItem => i.kind === "tool");
    const assistant = turn.items.filter((i): i is Extract<ChatItem, { kind: "assistant" }> => i.kind === "assistant");
    const notes = turn.items.filter((i): i is Extract<ChatItem, { kind: "system" }> => i.kind === "system");
    const working = options.busy && turn.key === lastTurnKey;
    const text = [...assistant.map((a) => a.text.trim()), ...notes.map((n) => n.text.trim())].filter(Boolean).join("\n\n");
    const timing = options.timings.get(turn.key);

    if (!working && !text && !tools.length) {
      messages.splice(index, 1);
      continue;
    }

    const thinkingSteps = ["Understanding the request", ...tools.map(stepTitle)];
    if (working && !tools.length && assistant.some((a) => a.text)) thinkingSteps.push("Writing the response");

    messages[index] = {
      ...messages[index],
      content: text,
      markdown: true,
      agentVariant: options.agent.variant,
      agentName: options.agent.name,
      agentRole: options.agent.role,
      status: working ? "thinking" : "ready",
      thinkingSteps,
      thinkingDurationMs: timing?.end !== undefined ? timing.end - timing.start : undefined,
      completedAt: timing?.end,
      ...(tools.length ? { toolSteps: tools.map(stepFor), toolDiffs: diffsFor(tools) } : {}),
    };
  }

  return messages;
}
