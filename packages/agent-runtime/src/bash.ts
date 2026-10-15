import { createBashToolDefinition, type BashOperations, type ToolDefinition } from "@earendil-works/pi-coding-agent";

export function createSandboxBashTool(cwd: string, operations?: BashOperations): ToolDefinition {
  const tool = createBashToolDefinition(cwd, { operations, exposeSessionEnvironment: false });
  return {
    ...tool,
    // The chat UI renders tools itself; Pi's TUI callbacks are unused here.
    renderCall: undefined,
    renderResult: undefined,
    async execute(...[callId, params, signal, onUpdate, context]: Parameters<typeof tool.execute>) {
      // Broad command-line matches can terminate the agent's own server.js process.
      if (/\bpkill\b[^;&|\n]*(?:\s-[a-z]*f[a-z]*\b|\s--full\b)/i.test(params.command)) {
        throw new Error("pkill -f can stop the agent runtime. Stop only the web server's recorded PID with kill <pid>, or reuse the running server.");
      }
      return tool.execute(callId, { ...params, timeout: params.timeout ?? 60 }, signal, onUpdate, context);
    },
  };
}
