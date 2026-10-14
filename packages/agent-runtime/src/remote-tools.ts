import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  createReadToolDefinition,
  createWriteToolDefinition,
  createEditToolDefinition,
  type BashOperations,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { shellQuote, type SandboxClient } from "@cloud-agent/sandbox-client";
import { createSandboxBashTool } from "./bash.js";
import { createPreviewTool } from "./preview.js";

type Sandbox = Awaited<ReturnType<SandboxClient["get"]>>;

/**
 * Pi resolves tool paths with the host's path rules, so on a Windows app server
 * "/home/daytona/x" arrives as "D:\home\daytona\x". The sandbox is Linux.
 */
export function toSandboxPath(path: string): string {
  if (!/^[A-Za-z]:[\\/]/.test(path) && !path.includes("\\")) return path;
  return posix.normalize(path.replace(/^[A-Za-z]:/, "").replace(/\\/g, "/"));
}

/** Never forward Pi's shell environment: it contains the server's credentials. */
export function remoteBashOperations(sandbox: Sandbox): BashOperations {
  return {
    async exec(command, cwd, { onData, signal, timeout = 60 }) {
      signal?.throwIfAborted();
      const sessionId = `tool-${randomUUID()}`;
      const deadline = AbortSignal.timeout(timeout * 1000 + 5000);
      const stop = signal ? AbortSignal.any([signal, deadline]) : deadline;
      await sandbox.process.createSession(sessionId);
      try {
        const result = await sandbox.process.executeSessionCommand(sessionId, {
          command: `cd ${shellQuote(toSandboxPath(cwd))} && timeout --signal=TERM --kill-after=5s ${timeout}s bash -c ${shellQuote(command)}`,
          runAsync: true,
        });
        if (!result.cmdId) throw new Error("Daytona did not return a command id");
        const logs = sandbox.process.getSessionCommandLogs(sessionId, result.cmdId,
          (chunk) => onData(Buffer.from(chunk)), (chunk) => onData(Buffer.from(chunk)));
        // Observe streaming failures while checking completion, timeout, and cancellation.
        let streamError: unknown;
        void logs.catch((error: unknown) => { streamError = error; });
        let exitCode: number | undefined;
        while (exitCode === undefined) {
          stop.throwIfAborted();
          if (streamError) throw streamError;
          exitCode = (await sandbox.process.getSessionCommand(sessionId, result.cmdId)).exitCode;
          if (exitCode === undefined) await delay(250, undefined, { signal: stop });
        }
        await Promise.race([logs, new Promise<never>((_, reject) => {
          if (stop.aborted) reject(stop.reason);
          else stop.addEventListener("abort", () => reject(stop.reason), { once: true });
        })]);
        if (exitCode === 124 || exitCode === 137) throw new Error(`timeout:${timeout}`);
        return { exitCode };
      } finally {
        // Deleting the command session also stops an aborted command in Daytona.
        await sandbox.process.deleteSession(sessionId);
      }
    },
  };
}

export function createRemoteTools(sandbox: Sandbox, cwd: string, port: number): ToolDefinition[] {
  const readFile = (path: string) => sandbox.fs.downloadFile(toSandboxPath(path));
  const access = async (path: string) => { await sandbox.fs.getFileDetails(toSandboxPath(path)); };
  const writeFile = (path: string, content: string) => sandbox.fs.uploadFile(Buffer.from(content), toSandboxPath(path));
  const mkdir = async (path: string) => {
    const result = await sandbox.process.executeCommand(`mkdir -p ${shellQuote(toSandboxPath(path))}`, undefined, undefined, 30);
    if (result.exitCode !== 0) throw new Error(`Unable to create directory: ${result.result}`);
  };
  return [
    createPreviewTool(port, { readFile, probe: async (url, signal) => {
      signal?.throwIfAborted();
      const script = `import { networkInterfaces } from 'node:os';
const address = Object.values(networkInterfaces()).flat().find(i => i?.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';
const response = await fetch('http://' + address + ':${port}/', { headers: { Host: ${JSON.stringify(new URL(url).host)} }, signal: AbortSignal.timeout(5000), redirect: 'manual' });
console.log(response.status); await response.body?.cancel();`;
      const result = await sandbox.process.executeCommand(`node --input-type=module -e ${shellQuote(script)}`, undefined, undefined, 10);
      if (result.exitCode !== 0) throw new Error("Web server is unreachable");
      const status = Number(result.result.trim());
      if (!Number.isInteger(status) || status < 100 || status > 599) throw new Error("Invalid preview response");
      return status;
    } }),
    createReadToolDefinition(cwd, { operations: { readFile, access, detectImageMimeType: async (path) => {
      const extension = posix.extname(path).toLowerCase();
      return ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" } as Record<string, string>)[extension];
    } } }),
    createWriteToolDefinition(cwd, { operations: { writeFile, mkdir } }),
    createEditToolDefinition(cwd, { operations: { readFile, writeFile, access } }),
    createSandboxBashTool(cwd, remoteBashOperations(sandbox)),
  ].map((tool) => ({ ...tool, renderCall: undefined, renderResult: undefined }));
}

export async function loadRemoteAgentsFiles(sandbox: Sandbox, cwd: string) {
  const files: { path: string; content: string }[] = [];
  const listed = await sandbox.fs.listFiles(cwd);
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const path = posix.join(cwd, name);
    if (listed.some((file) => file.name === name && !file.isDir)) {
      files.push({ path, content: (await sandbox.fs.downloadFile(path)).toString("utf8") });
    }
  }
  return files;
}
