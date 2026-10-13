import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { importSandboxSessions } from "./migrate-sessions.js";

it("imports legacy transcripts once without overwriting server copies or importing provider credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cloud-agent-migration-"));
  const path = "/home/daytona/.pi/agent/sessions/encoded-cwd/session.jsonl";
  const content = Buffer.from('{"type":"session","id":"legacy","cwd":"/remote/project"}\n');
  const sandbox = {
    process: { executeCommand: vi.fn(async () => ({ exitCode: 0, result: JSON.stringify([{ path, cwd: "/remote/project" }]) })) },
    fs: { downloadFile: vi.fn(async () => content) },
  };
  try {
    const remote = sandbox as unknown as Parameters<typeof importSandboxSessions>[0];
    await importSandboxSessions(remote, "/remote/project", directory);
    const destination = join(directory, "default/sessions/session.jsonl");
    expect(await readFile(destination)).toEqual(content);
    await writeFile(destination, "server copy");
    await importSandboxSessions(remote, "/remote/project", directory);
    expect(await readFile(destination, "utf8")).toBe("server copy");
    expect(sandbox.fs.downloadFile).toHaveBeenCalledOnce();
    expect(sandbox.fs.downloadFile).toHaveBeenCalledWith(path);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
