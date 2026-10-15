import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { shellQuote, type SandboxClient } from "@agentc/sandbox-client";
import { ProjectIdSchema } from "@agentc/protocol";

type Sandbox = Awaited<ReturnType<SandboxClient["get"]>>;

/** Copy only transcripts from the former sandbox agent, once per environment. */
export async function importSandboxSessions(sandbox: Sandbox, workspacePath: string, agentDir: string) {
  const marker = join(agentDir, ".sandbox-sessions-imported");
  try { await readFile(marker); return; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const script = `import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const files = [];
async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      const first = (await readFile(path, 'utf8')).split('\\n')[0];
      const header = JSON.parse(first);
      if (header.type === 'session') files.push({ path, cwd: header.cwd });
    }
  }
}
await walk('/home/daytona/.pi/agent/sessions'); console.log(JSON.stringify(files));`;
  const result = await sandbox.process.executeCommand(`node --input-type=module -e ${shellQuote(script)}`, undefined, undefined, 30);
  if (result.exitCode !== 0) throw new Error(`Unable to import sandbox conversations: ${result.result}`);
  const files = JSON.parse(result.result) as { path: string; cwd: string }[];
  const projectRoot = posix.join(posix.dirname(workspacePath), "projects");
  for (const file of files) {
    const projectId = file.cwd === workspacePath ? "default" : posix.basename(file.cwd);
    if (!ProjectIdSchema.safeParse(projectId).success) continue;
    if (projectId !== "default" && file.cwd !== posix.join(projectRoot, projectId)) continue;
    if (!file.path.startsWith("/home/daytona/.pi/agent/sessions/") || posix.extname(file.path) !== ".jsonl") throw new Error("Invalid sandbox transcript path");
    const destination = join(agentDir, projectId, "sessions");
    await mkdir(destination, { recursive: true });
    const content = await sandbox.fs.downloadFile(file.path);
    try { await writeFile(join(destination, posix.basename(file.path)), content, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  await mkdir(agentDir, { recursive: true });
  await writeFile(marker, "Imported sandbox transcripts. Originals remain in Daytona.\n");
}
