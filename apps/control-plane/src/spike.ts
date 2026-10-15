/** Live check: server-side Pi + Nebius → Daytona clone/tools → stop/resume. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { createSandboxClientFromEnv } from "@agentc/sandbox-client";
import { PiSessionRegistry, createRemoteTools, loadRemoteAgentsFiles } from "@agentc/agent-runtime";
import { loadConfig } from "./config.js";

const config = loadConfig();
const client = createSandboxClientFromEnv();
const directory = await mkdtemp(join(tmpdir(), "agentc-spike-"));
const repoIndex = process.argv.indexOf("--repo");
const repo = repoIndex < 0 ? "https://github.com/octocat/Hello-World.git" : process.argv[repoIndex + 1]!;
console.log("Creating Daytona sandbox; Pi runs on this server with", config.llm.providerId, config.llm.modelId);
const sandbox = await client.create({ name: `spike-${Date.now()}`, labels: { "agentc/spike": "true" } });
console.log("Sandbox:", sandbox.id);
let registry: PiSessionRegistry | undefined;
const openRegistry = () => new PiSessionRegistry({
  cwd: client.workspacePath, agentDir: directory, llm: config.llm,
  tools: createRemoteTools(sandbox, client.workspacePath, 3000),
  loadAgentsFiles: (cwd) => loadRemoteAgentsFiles(sandbox, cwd),
});
try {
  await client.ensureWorkspace(sandbox);
  await client.cloneRepository(sandbox, { repoUrl: repo });
  await client.configureWebPreview(sandbox);
  const isolation = await sandbox.process.executeCommand("test -z \"$NEBIUS_API_KEY$OPENROUTER_API_KEY$DAYTONA_API_KEY$CONTROL_PLANE_API_KEY\" && test ! -f /home/daytona/sandbox-runtime/server.js");
  assert.equal(isolation.exitCode, 0, "No model keys or Pi server should be present in the sandbox");
  registry = openRegistry();
  const { id } = await registry.createSession("Remote tools smoke test");
  registry.subscribe(id, (event) => {
    if (event.type === "message.delta") process.stdout.write(event.text ?? "");
    else if (event.type === "tool.start") console.log("Tool:", event.tool);
    else if (event.type === "error") console.error("Agent:", event.message);
  });
  await registry.prompt(id, "Use bash to inspect pwd and git remote -v. Use read to inspect README (or README.md). Use write to create agentc-smoke.txt containing exactly REMOTE_TOOLS_OK. Use edit to change it to REMOTE_EDIT_OK. Use read to verify it. Reply briefly when done.");
  assert.equal((await sandbox.fs.downloadFile(join(client.workspacePath, "agentc-smoke.txt"))).toString().trim(), "REMOTE_EDIT_OK");
  console.log("\nRemote file tools verified; stopping and resuming...");
  registry.disposeAll();
  await sandbox.stop(60);
  await sandbox.start(120);
  registry = openRegistry();
  await registry.openSession(id);
  assert(registry.getMessages(id).some((message) => message.role === "toolResult"));
  await registry.prompt(id, "Use bash to cat agentc-smoke.txt and confirm the existing file survived sandbox stop/start. Reply with its contents.");
  assert(registry.getMessages(id).length > 0);
  console.log("Spike complete: server sessions and sandbox files survive restart.");
} finally {
  registry?.disposeAll();
  await rm(directory, { recursive: true, force: true });
  if (process.argv.includes("--keep")) console.log("Keeping sandbox", sandbox.id);
  else await sandbox.delete(60, true);
}
