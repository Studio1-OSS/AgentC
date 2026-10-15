import { describe, expect, it } from "vitest";
import type { ChatItem } from "@/lib/session";
import { buildConversation, type TurnTiming } from "@/lib/conversation";

const agent = { variant: "blue" as const, name: "Cloud Agent", role: "Full-Stack Engineer" };

describe("buildConversation", () => {
  const items: ChatItem[] = [
    { id: "u1", kind: "user", text: "Add a health route" },
    { id: "t1", kind: "tool", tool: "read", callId: "c1", status: "end", args: { path: "/home/daytona/workspace/project/src/app.ts" }, output: "a\nb" },
    {
      id: "t2",
      kind: "tool",
      tool: "edit",
      callId: "c2",
      status: "end",
      args: { path: "/home/daytona/workspace/project/src/app.ts", edits: [{ oldText: "old", newText: "new\nline" }] },
    },
    { id: "t3", kind: "tool", tool: "bash", callId: "c3", status: "end", args: { command: "npm test" }, output: "✓ passed" },
    { id: "a1", kind: "assistant", text: "Added `/health`." },
  ];

  it("folds a prompt's tools and replies into one finished turn", () => {
    const timings = new Map<string, TurnTiming>([["u1", { start: 1000, end: 4000, stamp: "10:00" }]]);
    const messages = buildConversation(items, { busy: false, agent, timings });

    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    const turn = messages[1];
    expect(turn.status).toBe("ready");
    expect(turn.content).toBe("Added `/health`.");
    expect(turn.thinkingDurationMs).toBe(3000);
    expect(turn.toolSteps?.map((step) => [step.label, step.chip])).toEqual([
      ["Read", "src/app.ts"],
      ["Edit", "src/app.ts"],
      ["Run", "npm test"],
    ]);
    expect(turn.toolDiffs).toEqual([
      {
        file: "src/app.ts",
        add: 2,
        del: 1,
        isNew: false,
        lines: [
          { text: "old", tone: "del" },
          { text: "new", tone: "add" },
          { text: "line", tone: "add" },
        ],
      },
    ]);
  });

  it("marks the latest turn as thinking while the agent runs", () => {
    const running = buildConversation(items.slice(0, 2), { busy: true, agent, timings: new Map() });
    expect(running[1].status).toBe("thinking");
    expect(running[1].thinkingSteps).toEqual(["Understanding the request", "Reading src/app.ts"]);
  });
});
