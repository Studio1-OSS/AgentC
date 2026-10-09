import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { DEFAULT_WEB_PREVIEW_PORT, webPreviewConfigPath, WebPreviewSchema } from "@cloud-agent/protocol";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

export function createPreviewTool(port = DEFAULT_WEB_PREVIEW_PORT): ToolDefinition {
  const configPath = webPreviewConfigPath(port);
  return {
    name: "preview",
    label: "Web preview",
    description: `Check this project's web server on port ${port} and return its shareable HTTPS preview URL.`,
    promptSnippet: "Check the web app and get its public preview URL",
    promptGuidelines: [
      `For this project's web apps, use port ${port}. Start the dev server in the background on 0.0.0.0:${port} (Vite: --host 0.0.0.0 --port ${port} --strictPort). Other projects in this sandbox use different ports.`,
      `If the dev server restricts hostnames, allow the preview proxy domain suffix from ${configPath} so refreshed signed links keep working.`,
      "Call preview before sharing a web app. Include the returned HTTPS URL as a Markdown link in your reply instead of localhost. No ngrok installation or credentials are needed.",
    ],
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_callId, _params, signal) {
      const preview = WebPreviewSchema.parse(JSON.parse(await readFile(configPath, "utf8")));
      if (preview.port !== port) throw new Error("Preview configuration does not match this project");
      if (Date.parse(preview.expiresAt) <= Date.now()) {
        throw new Error("Preview link expired. Reopen the workspace to refresh it.");
      }
      const address = Object.values(networkInterfaces()).flat().find((info) => info?.family === "IPv4" && !info.internal)?.address ?? "127.0.0.1";
      let response: Response;
      try {
        // Probe the sandbox interface with the public Host; outbound access to the preview proxy may be blocked.
        response = await fetch(`http://${address}:${preview.port}/`, {
          headers: { Host: new URL(preview.url).host },
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
          redirect: "manual",
        });
      } catch (err) {
        throw new Error(`Web server is unreachable. Start it in the background on 0.0.0.0:${preview.port} before sharing a preview.`, { cause: err });
      }
      await response.body?.cancel();
      if (response.status >= 400) {
        throw new Error(`Web server returned HTTP ${response.status}. Fix the app and allow hostname ${new URL(preview.url).hostname} in its dev-server config before sharing the preview.`);
      }
      return {
        content: [{ type: "text", text: `Web preview: ${preview.url}\nValid until ${preview.expiresAt}. Keep the server running on 0.0.0.0:${preview.port}.` }],
        details: preview,
      };
    },
  };
}

export const previewTool = createPreviewTool();
