/**
 * Phase 0 technical spike (PLAN.md §30).
 *
 * Proves: create Daytona sandbox → clone repo → start Pi runtime →
 * prompt → stop → start → resume session.
 *
 * Requires:
 *   DAYTONA_API_KEY
 *   OPENROUTER_API_KEY (preferred; Daytona allowlisted) or NEBIUS_API_KEY /
 *   ANTHROPIC_API_KEY / OPENAI_API_KEY
 *
 * Usage:
 *   pnpm spike
 *   pnpm spike -- --repo https://github.com/expressjs/express.git
 */
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSandboxModelEnv } from "@cloud-agent/protocol";
import { createSandboxClientFromEnv } from "@cloud-agent/sandbox-client";
import { randomUUID } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const repo =
    argValue("--repo") ?? "https://github.com/expressjs/express.git";
  const branch = argValue("--branch");
  const client = createSandboxClientFromEnv();
  const runtimeToken = process.env.RUNTIME_ACCESS_SECRET ?? `spike-${randomUUID()}`;
  const bundleDir =
    process.env.RUNTIME_BUNDLE_DIR ??
    resolve(here, "../../../sandbox/runtime/deploy");

  console.log("Creating sandbox...");
  const sandbox = await client.create({
    name: `spike-${Date.now()}`,
    labels: { "cloud-agent/spike": "true" },
    envVars: {
      RUNTIME_ACCESS_TOKEN: runtimeToken,
      ...buildSandboxModelEnv(process.env),
    },
  });
  console.log("Sandbox:", sandbox.id);

  try {
    console.log("Cloning", repo);
    await client.ensureWorkspace(sandbox);
    await client.cloneRepository(sandbox, { repoUrl: repo, branch });

    console.log("Deploying runtime...");
    await client.deployAndStartRuntime(sandbox, {
      runtimeBundleLocalDir: bundleDir,
      runtimeAccessToken: runtimeToken,
      modelEnv: buildSandboxModelEnv(process.env),
    });

    console.log("Creating Pi session...");
    const health = await sandbox.process.executeCommand(
      [
        `curl -sf http://127.0.0.1:${client.runtimePort}/health && echo`,
        `echo "PI_PROVIDER=$PI_PROVIDER PI_MODEL=$PI_MODEL"`,
        `(printenv OPENROUTER_API_KEY | wc -c)`,
        `curl -sf -o /dev/null -w "openrouter_http=%{http_code}\\n" https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY" || echo openrouter_curl_failed`,
      ].join(" && "),
      undefined,
      {
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
        PI_PROVIDER: process.env.PI_PROVIDER ?? "",
        PI_MODEL: process.env.PI_MODEL ?? "",
      },
      60,
    );
    console.log("Preflight:", health.result);

    let res = await client.fetchRuntime(sandbox, "/sessions", {
      method: "POST",
      body: JSON.stringify({ title: "spike" }),
      runtimeAccessToken: runtimeToken,
    });
    if (!res.ok) throw new Error(`create session: ${res.status} ${await res.text()}`);
    const session = (await res.json()) as { id: string };
    console.log("Session:", session.id);

    console.log("Prompting...");
    const openCmd = await sandbox.process.executeCommand(
      [
        `curl -sf -X POST http://127.0.0.1:${client.runtimePort}/sessions/${session.id}/open`,
        `-H "Authorization: Bearer ${runtimeToken}"`,
        `-H "Content-Type: application/json"`,
      ].join(" "),
      undefined,
      undefined,
      30,
    );
    console.log("Open session:", openCmd.result);

    const wsScript = `import WebSocket from "ws";

const token = ${JSON.stringify(runtimeToken)};
const sessionId = ${JSON.stringify(session.id)};
const port = ${client.runtimePort};

const ws = new WebSocket(
  "ws://127.0.0.1:" + port + "/ws/sessions/" + sessionId + "?token=" + encodeURIComponent(token),
);

let sawText = "";
const events = [];
ws.on("open", () => {
  ws.send(
    JSON.stringify({
      type: "prompt",
      content: "Respond with only this exact token: <<SPIKE_OK>>",
    }),
  );
});

ws.on("message", (data) => {
  const evt = JSON.parse(String(data));
  events.push(evt.type + (evt.message ? ":" + evt.message : "") + (evt.tool ? ":" + evt.tool : ""));
  if (evt.type === "message.delta") {
    sawText += evt.text || "";
    process.stdout.write(evt.text || "");
  }
  if (evt.type === "error") {
    console.error("ERROR", evt.message);
    console.error("EVENTS", events.join(","));
    process.exit(1);
  }
  if (evt.type === "run.end") {
    // Ignore early run.end with no content; settle on text or later timeout.
    if (sawText.includes("<<SPIKE_OK>>")) {
      console.log("\\n[run.end]");
      console.log("FULL_TEXT:" + sawText);
      console.log("EVENTS", events.join(","));
      ws.close();
      process.exit(0);
    }
  }
});

ws.on("error", (err) => {
  console.error("WS_ERROR", err);
  console.error("EVENTS", events.join(","));
  process.exit(1);
});

setTimeout(() => {
  console.error("timeout");
  console.error("FULL_TEXT:" + sawText);
  console.error("EVENTS", events.join(","));
  process.exit(sawText.includes("<<SPIKE_OK>>") ? 0 : 2);
}, 120000);
`;
    await sandbox.fs.uploadFile(
      Buffer.from(wsScript),
      "/home/daytona/sandbox-runtime/spike-prompt.mjs",
    );
    const runPrompt = await sandbox.process.executeCommand(
      "cd /home/daytona/sandbox-runtime && node ./spike-prompt.mjs",
      undefined,
      undefined,
      200,
    );
    console.log("Prompt result exit:", runPrompt.exitCode);
    console.log(runPrompt.result);
    if (runPrompt.exitCode !== 0) {
      const logs = await sandbox.process.executeCommand(
        "ls -la /home/daytona/.pi/agent 2>/dev/null; tail -n 80 /tmp/runtime.log 2>/dev/null || tail -n 80 /home/daytona/sandbox-runtime/*.log 2>/dev/null || journalctl -n 20 2>/dev/null || true; ls /home/daytona/sandbox-runtime 2>/dev/null | head",
        undefined,
        undefined,
        30,
      );
      console.error("Runtime diagnostics:\n", logs.result);
      // Direct OpenRouter chat probe (same key/model as runtime) for a clear error body.
      const probe = await sandbox.process.executeCommand(
        `curl -sS -w "\\nhttp=%{http_code}\\n" https://openrouter.ai/api/v1/chat/completions -H "Authorization: Bearer $OPENROUTER_API_KEY" -H "Content-Type: application/json" -d ${JSON.stringify(
          JSON.stringify({
            model: process.env.PI_MODEL ?? "google/gemma-3-27b-it",
            max_tokens: 32,
            messages: [{ role: "user", content: "Say PONG" }],
          }),
        )} | head -c 1200`,
        undefined,
        { OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "" },
        60,
      );
      console.error("OpenRouter probe:\n", probe.result);
      throw new Error(`Spike prompt failed with exit ${runPrompt.exitCode}`);
    }

    console.log("Stopping sandbox...");
    await sandbox.stop(60);

    console.log("Starting sandbox again...");
    await sandbox.start(120);
    try {
      await client.waitForRuntimeHealthy(sandbox, 20_000);
    } catch {
      console.log("Runtime not healthy after restart; redeploying...");
      await client.deployAndStartRuntime(sandbox, {
        runtimeBundleLocalDir: bundleDir,
        runtimeAccessToken: runtimeToken,
        modelEnv: buildSandboxModelEnv(process.env),
      });
    }

    res = await client.fetchRuntime(sandbox, "/sessions", {
      method: "GET",
      runtimeAccessToken: runtimeToken,
    });
    const after = await res.text();
    console.log("Sessions after resume:", after);
    if (!after.includes(session.id) && !after.includes('"sessions":[')) {
      throw new Error("Expected sessions list after resume");
    }
    const parsed = JSON.parse(after) as { sessions?: Array<{ id: string }> };
    if (!parsed.sessions?.some((s) => s.id === session.id)) {
      throw new Error(`Session ${session.id} missing after resume: ${after}`);
    }

    console.log("Spike complete.");
  } finally {
    if (process.argv.includes("--keep")) {
      console.log("Keeping sandbox", sandbox.id);
    } else {
      console.log("Deleting sandbox...");
      await sandbox.delete(60, true);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
