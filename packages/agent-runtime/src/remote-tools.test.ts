import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRemoteTools, remoteBashOperations, toSandboxPath } from "./remote-tools.js";

afterEach(() => vi.unstubAllEnvs());
function setup(exitCode?: number) {
  const files = new Map<string, Buffer>();
  const sandbox = {
    fs: {
      downloadFile: vi.fn(async (path: string) => { const content = files.get(path); if (!content) throw new Error("Not found"); return content; }),
      uploadFile: vi.fn(async (content: Buffer, path: string) => { files.set(path, content); }),
      getFileDetails: vi.fn(async () => ({})),
    },
    process: {
      executeCommand: vi.fn(async () => ({ exitCode: 0, result: "200" })),
      createSession: vi.fn(async () => {}),
      executeSessionCommand: vi.fn(async () => ({ cmdId: "command" })),
      getSessionCommand: vi.fn(async () => ({ exitCode })),
      getSessionCommandLogs: vi.fn(async (_session, _command, stdout, stderr) => { stdout("hello"); stderr("warning"); }),
      deleteSession: vi.fn(async () => {}),
    },
  };
  return { files, sandbox, remote: sandbox as unknown as Parameters<typeof createRemoteTools>[0] };
}

describe("Daytona tool boundary", () => {
  it("reads, writes, and edits files in Daytona without touching the host filesystem", async () => {
    const { files, sandbox, remote } = setup();
    const cwd = join(tmpdir(), `remote-only-${randomUUID()}`);
    const tools = createRemoteTools(remote, cwd, 3000);
    const run = (name: string, args: unknown) => tools.find((tool) => tool.name === name)!.execute("call", args, undefined, undefined, undefined as never);
    await run("write", { path: "nested/file.txt", content: "before" });
    await run("edit", { path: "nested/file.txt", edits: [{ oldText: "before", newText: "after" }] });
    const result = await run("read", { path: "nested/file.txt" });
    expect(result.content).toContainEqual({ type: "text", text: "after" });
    expect(files.get(toSandboxPath(join(cwd, "nested/file.txt")))?.toString()).toBe("after");
    expect(sandbox.process.executeCommand).toHaveBeenCalledWith(expect.stringContaining("mkdir -p"), undefined, undefined, 30);
    expect(existsSync(cwd)).toBe(false);
  });
  it("streams stdout and stderr while keeping server credentials out of shell commands", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "server-secret");
    const { sandbox, remote } = setup(0);
    const onData = vi.fn();
    await remoteBashOperations(remote).exec("printf hello", "/remote/project", { onData, env: process.env });
    expect(onData.mock.calls.map(([buffer]) => buffer.toString())).toEqual(["hello", "warning"]);
    const options = sandbox.process.executeSessionCommand.mock.calls[0]![1];
    expect(options.command).toContain("cd '/remote/project'");
    expect(JSON.stringify(options)).not.toContain("server-secret");
    expect(options).not.toHaveProperty("env");
    expect(sandbox.process.deleteSession).toHaveBeenCalledOnce();
  });
  it("deletes the remote command session when aborted", async () => {
    const { sandbox, remote } = setup();
    const controller = new AbortController();
    const pending = remoteBashOperations(remote).exec("sleep 60", "/remote/project", { onData: () => {}, signal: controller.signal });
    const rejection = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(sandbox.process.getSessionCommand).toHaveBeenCalled());
    controller.abort();
    await rejection;
    expect(sandbox.process.deleteSession).toHaveBeenCalledOnce();
  });
  it("preserves failing exit codes and reports remote timeouts", async () => {
    const { sandbox, remote } = setup(1);
    const ops = remoteBashOperations(remote);
    expect(await ops.exec("false", "/remote", { onData: () => {} })).toEqual({ exitCode: 1 });
    sandbox.process.getSessionCommand.mockResolvedValueOnce({ exitCode: 124 });
    await expect(ops.exec("sleep 10", "/remote", { onData: () => {}, timeout: 1 })).rejects.toThrow("timeout:1");
    expect(sandbox.process.deleteSession).toHaveBeenCalledTimes(2);
  });
  it("checks preview readiness inside Daytona using the public hostname", async () => {
    const { files, sandbox, remote } = setup();
    files.set("/home/daytona/.agentc/previews/3001.json", Buffer.from(JSON.stringify({
      url: "https://3001-signed.proxy.daytona.work", port: 3001,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    })));
    const preview = createRemoteTools(remote, "/remote", 3001)[0]!;
    const result = await preview.execute("call", {}, undefined, undefined, {} as never);
    expect(sandbox.process.executeCommand).toHaveBeenCalledWith(expect.stringContaining("3001-signed.proxy.daytona.work"), undefined, undefined, 10);
    expect(result.details).toMatchObject({ port: 3001 });
  });
});

describe("toSandboxPath", () => {
  it("turns paths resolved on a Windows host back into sandbox paths", () => {
    expect(toSandboxPath("D:\\home\\daytona\\workspace\\project\\add.py")).toBe("/home/daytona/workspace/project/add.py");
    expect(toSandboxPath("C:/home/daytona/workspace")).toBe("/home/daytona/workspace");
  });

  it("leaves Linux paths alone", () => {
    expect(toSandboxPath("/home/daytona/workspace/project")).toBe("/home/daytona/workspace/project");
  });
});
