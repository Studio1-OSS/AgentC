import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPreviewTool } from "./preview.js";

const readFile = vi.fn();
const probe = vi.fn();
const tool = createPreviewTool(3000, { readFile, probe });
const run = (signal?: AbortSignal) => tool.execute("call", {}, signal, undefined, {} as never);
beforeEach(() => {
  readFile.mockReset().mockResolvedValue(Buffer.from(JSON.stringify({
    url: "https://3000-signed.proxy.daytona.work", port: 3000,
    expiresAt: new Date(Date.now() + 86400_000).toISOString(),
  })));
  probe.mockReset().mockResolvedValue(200);
});

describe("sandbox web previews", () => {
  it("probes the remote sandbox, retries startup, and returns the signed URL", async () => {
    probe.mockRejectedValueOnce(new Error("not ready"));
    const result = await run();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(probe).toHaveBeenCalledWith("https://3000-signed.proxy.daytona.work", undefined);
    expect(result.details).toMatchObject({ port: 3000 });
    expect(tool.executionMode).toBe("sequential");
  });
  it("aborts without retrying", async () => {
    const controller = new AbortController();
    probe.mockImplementation(async () => { controller.abort(); throw new Error("not ready"); });
    await expect(run(controller.signal)).rejects.toThrow();
    expect(probe).toHaveBeenCalledOnce();
  });
  it("rejects another project's port", async () => {
    const other = createPreviewTool(3001, { readFile, probe });
    await expect(other.execute("call", {}, undefined, undefined, {} as never)).rejects.toThrow("does not match");
    expect(readFile).toHaveBeenCalledWith("/home/daytona/.agentc/previews/3001.json");
    expect(probe).not.toHaveBeenCalled();
  });
  it("rejects expired URLs", async () => {
    readFile.mockResolvedValue(Buffer.from(JSON.stringify({ url: "https://example.com", port: 3000, expiresAt: new Date(0).toISOString() })));
    await expect(run()).rejects.toThrow("expired");
    expect(probe).not.toHaveBeenCalled();
  });
  it("reports errors from the app and rejected hostnames", async () => {
    probe.mockResolvedValueOnce(500);
    await expect(run()).rejects.toThrow("HTTP 500");
    probe.mockResolvedValueOnce(403);
    await expect(run()).rejects.toThrow("allow hostname 3000-signed.proxy.daytona.work");
  });
  it("reports an unreachable sandbox server", async () => {
    probe.mockRejectedValue(new Error("unreachable"));
    await expect(run()).rejects.toThrow("0.0.0.0:3000");
  });
});
