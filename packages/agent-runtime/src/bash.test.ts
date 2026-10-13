import { describe, expect, it } from "vitest";
import { createSandboxBashTool } from "./bash.js";

describe("sandbox bash", () => {
  it.each(['pkill -f "serve"; python3 -m http.server 3000 &', 'pkill --full node', 'pkill -TERM -f server.js'])("rejects runtime-killing command %s before execution", async (command) => {
    const tool = createSandboxBashTool(process.cwd());
    await expect(tool.execute("call", { command }, undefined, undefined, undefined as never)).rejects.toThrow("agent runtime");
  });
  it("executes normal commands and honors an explicit timeout", async () => {
    const tool = createSandboxBashTool(process.cwd());
    const result = await tool.execute("call", { command: "printf ready" }, undefined, undefined, undefined as never);
    expect(result.content).toContainEqual({ type: "text", text: "ready" });
    await expect(tool.execute("call", { command: "sleep 2", timeout: 0.05 }, undefined, undefined, undefined as never)).rejects.toThrow("timed out");
  });
});
