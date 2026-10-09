import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_WEB_PREVIEW_PORT, webPreviewConfigPath, WebPreviewSchema } from "@cloud-agent/protocol";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";

export function previewSystemPrompt(port = DEFAULT_WEB_PREVIEW_PORT): string {
  return `You are working in a remote Daytona sandbox. Complete the user's request with minimal interruptions and concise progress updates.
Whenever you create or update a runnable website, app, or visual artifact, automatically start it in the background on 0.0.0.0:${port}, call the preview tool, fix any readiness or hostname errors, and include the verified Daytona HTTPS URL as a Markdown link in your final reply. Do this without waiting for the user to ask for a preview.
For static HTML or visual artifacts, use the installed Python standard-library server: nohup python3 -m http.server ${port} --bind 0.0.0.0 </dev/null >/tmp/cloud-agent-web-${port}.log 2>&1 & echo $!. Avoid npx serve for static pages: it may wait for installation or network access. For Vite, use --host 0.0.0.0 --port ${port} --strictPort and allow the Daytona preview proxy domain from ${webPreviewConfigPath(port)}. This port belongs to the current project; do not use another project's port.
Detach all long-lived servers with nohup, redirect stdin, stdout, and stderr, and record the returned PID. Never use pkill -f to stop a server: it can kill this agent's runtime. Reuse a healthy server or stop only its recorded PID with kill <pid>. Complete file writes and server startup before checking the preview.
Never present localhost, 127.0.0.1, 0.0.0.0, or an invented URL as a link the user can open. Read the current link through the preview tool rather than reusing an old signed URL. Keep the server running after your reply. If a preview cannot be made ready, explain the specific blocker and do not claim it works.
For work without a browser view, report the completed result and relevant checks. Lead final replies with the outcome and, when available, the preview link.`;
}

export function createPreviewTool(port = DEFAULT_WEB_PREVIEW_PORT): ToolDefinition {
  const configPath = webPreviewConfigPath(port);
  return {
    name: "preview",
    executionMode: "sequential",
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
      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        signal?.throwIfAborted();
        try {
          // Probe the sandbox interface with the public Host; outbound access to the preview proxy may be blocked.
          response = await fetch(`http://${address}:${preview.port}/`, {
            headers: { Host: new URL(preview.url).host },
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
            redirect: "manual",
          });
          break;
        } catch (err) {
          signal?.throwIfAborted();
          if (attempt === 2) throw new Error(`Web server is unreachable. Start it in the background on 0.0.0.0:${preview.port} before sharing a preview.`, { cause: err });
          await delay(500, undefined, { signal });
        }
      }
      if (!response) throw new Error("Web server did not become ready");
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
