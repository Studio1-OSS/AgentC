import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { previewTool, createPreviewTool } from "./preview.js";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("node:os", () => ({ networkInterfaces: () => ({ eth0: [{ family: "IPv4", internal: false, address: "10.0.0.2" }] }) }));
afterEach(() => vi.unstubAllGlobals());
const run = () => previewTool.execute("call", {}, undefined, undefined, {} as Parameters<ToolDefinition["execute"]>[4]);
const configure = (expiresAt = new Date(Date.now() + 86400_000).toISOString()) => {
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({ url: "https://3000-signed.proxy.daytona.work", port: 3000, expiresAt }));
};

describe("public web previews", () => {
  it("reads the selected project's preview configuration and rejects another project's port", async () => {
    const tool = createPreviewTool(3001);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ url: "https://3001-signed.proxy.daytona.work", port: 3001, expiresAt: new Date(Date.now() + 86400_000).toISOString() }));
    const fetch = vi.fn(async () => new Response("app"));
    vi.stubGlobal("fetch", fetch);
    await tool.execute("call", {}, undefined, undefined, {} as Parameters<ToolDefinition["execute"]>[4]);
    expect(readFile).toHaveBeenCalledWith("/home/daytona/.cloud-agent/previews/3001.json", "utf8");
    expect(fetch).toHaveBeenCalledWith("http://10.0.0.2:3001/", expect.anything());
    configure();
    await expect(tool.execute("call", {}, undefined, undefined, {} as Parameters<ToolDefinition["execute"]>[4])).rejects.toThrow("does not match");
  });
  it("checks the sandbox interface with the preview hostname before giving the agent a link", async () => {
    configure();
    const fetch = vi.fn(async () => new Response("app"));
    vi.stubGlobal("fetch", fetch);
    const result = await run();
    expect(fetch).toHaveBeenCalledWith("http://10.0.0.2:3000/", expect.objectContaining({ headers: { Host: "3000-signed.proxy.daytona.work" } }));
    expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("https://3000-signed.proxy.daytona.work") });
  });
  it("rejects expired links without claiming the app is ready", async () => {
    configure(new Date(Date.now() - 1000).toISOString());
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(run()).rejects.toThrow("expired");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports a failed app and a rejected preview hostname", async () => {
    configure();
    const fetch = vi.fn().mockResolvedValueOnce(new Response("broken", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    await expect(run()).rejects.toThrow("HTTP 500");
    fetch.mockResolvedValueOnce(new Response("blocked host", { status: 403 }));
    await expect(run()).rejects.toThrow("allow hostname 3000-signed.proxy.daytona.work");
  });
  it("reports servers that are stopped or bound only to localhost", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(run()).rejects.toThrow("0.0.0.0:3000");
  });
});
