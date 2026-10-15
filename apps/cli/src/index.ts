#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiClient } from "./api.js";
import { loadCliConfig, rememberLastChat } from "./config.js";
import { openBrowser } from "./open-browser.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

async function main() {
  const [cmd = "help", ...args] = process.argv.slice(2);
  const config = loadCliConfig();
  const api = new ApiClient(config);

  switch (cmd) {
    case "open":
      await cmdOpen(api, config.baseUrl, args);
      break;
    case "list":
      await cmdList(api);
      break;
    case "stop":
      await cmdStop(api, args[0]);
      break;
    case "start":
    case "resume":
      await cmdStart(api, config.baseUrl, args[0]);
      break;
    case "rm":
    case "delete":
      await cmdDelete(api, args[0]);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`agentc — open a Pi chat on a remote Daytona sandbox

Usage:
  agentc open [repoUrl]     Create env (or empty), wait, open browser chat
  agentc list               List environments
  agentc resume <id>        Start sleeping env and open chat
  agentc stop <id>          Stop sandbox (filesystem persists)
  agentc rm <id>            Delete environment + sandbox

Env:
  AGENTC_URL            default http://127.0.0.1:8787
  CONTROL_PLANE_API_KEY      API key for the control plane
  AGENTC_USER_ID        optional user id (default: default-user)
  DAYTONA_API_KEY / OPENROUTER_API_KEY  required by the control plane

Flags for open:
  --empty                    Create an empty workspace (no repo)
  --branch <name>            Git branch to clone
  --name <name>              Environment display name
  --no-open                  Print URL only (do not launch browser)
`);
}

async function ensureControlPlane(api: ApiClient): Promise<void> {
  if (await api.health()) return;

  const entry = resolve(repoRoot, "apps/control-plane/dist/index.js");
  const srcEntry = resolve(repoRoot, "apps/control-plane/src/index.ts");
  console.log("Control plane not reachable — starting local instance…");

  if (existsSync(entry)) {
    spawn(process.execPath, [entry], {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      env: process.env,
    }).unref();
  } else if (existsSync(srcEntry)) {
    spawn("pnpm", ["--filter", "@agentc/control-plane", "dev"], {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      env: process.env,
      shell: true,
    }).unref();
  } else {
    throw new Error(
      `Control plane not running at ${loadCliConfig().baseUrl} and no local build found. Run: pnpm --filter @agentc/control-plane build && pnpm --filter @agentc/control-plane start`,
    );
  }

  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (await api.health()) {
      console.log("Control plane is up.");
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for control plane");
}

async function cmdOpen(api: ApiClient, baseUrl: string, args: string[]) {
  await ensureControlPlane(api);

  const flags = parseFlags(args);
  const repoUrl = flags.positional[0];
  if (!repoUrl && !flags.empty) {
    throw new Error("Provide a repo URL or pass --empty");
  }

  console.log(
    repoUrl
      ? `Creating environment for ${repoUrl}…`
      : "Creating empty environment…",
  );

  const created = await api.createEnvironment({
    repoUrl,
    repoBranch: flags.branch,
    name: flags.name,
    initEmpty: flags.empty || undefined,
  });
  console.log(`Environment ${created.id} (${created.status})`);

  const ready = await api.waitUntilReady(created.id, {
    onTick: (env) => {
      process.stdout.write(`\rstatus: ${env.status.padEnd(12)}`);
    },
  });
  process.stdout.write("\n");
  console.log(`Ready: ${ready.name}`);

  await openChat(api, baseUrl, ready.id, ready.name, !flags.noOpen);
}

async function cmdList(api: ApiClient) {
  await ensureControlPlane(api);
  const items = await api.listEnvironments();
  if (items.length === 0) {
    console.log("No environments.");
    return;
  }
  for (const env of items) {
    console.log(
      `${env.id}  ${env.status.padEnd(10)}  ${env.name}${env.repoUrl ? `  ${env.repoUrl}` : ""}`,
    );
  }
}

async function cmdStop(api: ApiClient, id?: string) {
  if (!id) throw new Error("Usage: agentc stop <id>");
  await ensureControlPlane(api);
  const env = await api.stopEnvironment(id);
  console.log(`Stopped ${env.id} (${env.status})`);
}

async function cmdStart(api: ApiClient, baseUrl: string, id?: string) {
  if (!id) throw new Error("Usage: agentc resume <id>");
  await ensureControlPlane(api);
  console.log(`Starting ${id}…`);
  const env = await api.startEnvironment(id);
  console.log(`Status: ${env?.status}`);
  if (env?.status === "ready") {
    await openChat(api, baseUrl, id, env.name, true);
  }
}

async function cmdDelete(api: ApiClient, id?: string) {
  if (!id) throw new Error("Usage: agentc rm <id>");
  await ensureControlPlane(api);
  await api.removeEnvironment(id);
  console.log(`Deleted ${id}`);
}

async function openChat(
  api: ApiClient,
  baseUrl: string,
  environmentId: string,
  name: string,
  launch: boolean,
) {
  console.log("Opening Pi session…");
  const chat = await api.openUi(environmentId, name);
  const url = `${baseUrl}${chat.uiPath}`;
  rememberLastChat(url);
  console.log(`Chat: ${url}`);
  if (launch) {
    openBrowser(url);
    console.log("Browser launched.");
  }
}

function parseFlags(args: string[]) {
  const positional: string[] = [];
  let empty = false;
  let noOpen = false;
  let branch: string | undefined;
  let name: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--empty") empty = true;
    else if (a === "--no-open") noOpen = true;
    else if (a === "--branch") branch = args[++i];
    else if (a === "--name") name = args[++i];
    else if (a.startsWith("-")) throw new Error(`Unknown flag: ${a}`);
    else positional.push(a);
  }

  return { positional, empty, noOpen, branch, name };
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
