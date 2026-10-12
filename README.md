# cloud-agent

Remote [Pi](https://github.com/badlogic/pi-mono) coding-agent environments inside [Daytona](https://www.daytona.io) sandboxes, with a browser workspace dashboard and an optional CLI.

Each environment is one isolated sandbox. Pi runs inside that sandbox. This repository's control plane creates sandboxes, stores workspace metadata, and proxies chat. Conversation transcripts stay in Pi session files on the sandbox filesystem.

The longer design rationale is in [PLAN.md](./PLAN.md). This file is the setup and architecture guide for running the service.

## Architecture

```
Browser  ──HTTPS / WebSocket──►  Control plane  ──Daytona API──►  Sandbox
   ▲                                    │                              │
   │                                    │ SQLite                       │
   │                                    ▼                              │
   │                              users, environments,                 │
   │                              projects, session ids                │
   │                                                                   │
   │                          Signed preview (port 3000+)              │
   └───────────────────────────────────────────────────────────────────┘

CLI ──Bearer API key──► Control plane
```

| Piece | Where it runs | What it owns |
| --- | --- | --- |
| Web dashboard (`apps/web`) | Built files served by the control plane at `/ui/` | Workspace list, chat, tool cards, preview links |
| Control plane (`apps/control-plane`) | Your server, one Node process | Auth, SQLite, sandbox lifecycle, chat proxy |
| CLI (`apps/cli`) | A developer machine | Create, list, stop, resume, and open a chat link |
| Protocol (`packages/protocol`) | Shared library | Request schemas, WebSocket events, LLM provider selection |
| Database (`packages/database`) | Control-plane process | SQLite schema and startup migration |
| Sandbox client (`packages/sandbox-client`) | Control-plane process | Daytona create/start/stop, repo clone, runtime upload |
| Sandbox runtime (`sandbox/runtime`) | Inside each Daytona sandbox | Pi SDK, session router, preview checks |

### What happens when someone creates a workspace

1. The browser (or CLI) asks the control plane to create an environment. The browser accepts a public `https://github.com/owner/repo` URL, `owner/repo`, or an empty workspace, plus an optional branch.
2. The control plane writes a row in SQLite and asks Daytona for a sandbox. Without `DAYTONA_SNAPSHOT`, that sandbox is a `node:22-bookworm` image with 2 CPUs, 4 GB RAM, and 10 GB disk. Idle sandboxes stop after 60 minutes; the filesystem remains.
3. The sandbox clones the repository into `/home/daytona/workspace/project`, or runs `git init` for an empty workspace.
4. The control plane uploads `sandbox/runtime/deploy` (produced by `pnpm build`), runs `npm install` inside the sandbox, and starts `node server.js` on port `4096`.
5. The runtime starts Pi against the configured model. Pi's reads, edits, and shell commands are local to the sandbox.
6. The control plane asks Daytona for a signed HTTPS preview of port `3000` (24 hours) and stores it in the sandbox for the agent. Additional projects in the same sandbox get the next free preview port.

### What happens during chat

The browser opens `wss://<your-host>/ui/ws?token=…`. The control plane checks that short-lived UI token, then opens its own WebSocket to the sandbox runtime through Daytona's preview link for port `4096`. The browser never receives the Daytona API key, the runtime access token, or the model API key.

Pi session JSONL files live under `/home/daytona/.pi/agent` inside the sandbox. SQLite only stores environment metadata and pointers to those session ids. Stopping a sandbox keeps the files. Resuming starts the sandbox again, redeploys the runtime when its version is older than this build, and refreshes preview links.

### Accounts and limits in this version

The dashboard identifies a browser with a signed HttpOnly cookie (`cloud_agent_guest`) that lasts 30 days. Clearing cookies drops access to the workspaces that cookie owned. There is no user login and no cross-device account. A browser can keep five workspaces. Opening a valid chat link stores a separate cookie for that one workspace until the token expires (12 hours).

The HTTP API uses `Authorization: Bearer <CONTROL_PLANE_API_KEY>` and an optional `X-User-Id`. That API does not apply the five-workspace browser cap. Treat the API key as an admin credential.

## Prerequisites

On the machine that will run the control plane:

- Linux or macOS with outbound HTTPS
- Node.js **22.19.0 or newer** (`node -v`)
- pnpm **9.15.0** (the version in `package.json`'s `packageManager` field)
- `git`, `curl`, and `ca-certificates`
- A C/C++ toolchain and Python 3, so `better-sqlite3` can compile during `pnpm install` (`build-essential` and `python3` on Debian/Ubuntu)
- A Daytona account and API key
- An OpenRouter API key

Daytona sandboxes also need outbound access to GitHub, `registry.npmjs.org`, and `openrouter.ai`. That egress is from Daytona's network, not from your server.

## 1. Install Node and pnpm

Debian/Ubuntu packages for the native module build:

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates python3 make g++ build-essential
```

Install Node 22.19 or newer, then activate the repo's pnpm version:

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
node -v
pnpm -v
```

If you later change the Node version, run `pnpm rebuild better-sqlite3` in this repo before starting the server again.

## 2. Create the third-party accounts

**Daytona.** Sign in at [app.daytona.io](https://app.daytona.io) and create an API key. The account needs quota for each live sandbox (2 CPUs, 4 GB RAM, 10 GB disk on the default image). Optional: note a target region if you want sandboxes created in a specific Daytona target, and a snapshot name if you publish `sandbox/Dockerfile` yourself.

**OpenRouter.** Create an API key at [openrouter.ai](https://openrouter.ai). Use a model that supports tool calls. The default is [`qwen/qwen3-235b-a22b-2507`](https://openrouter.ai/qwen/qwen3-235b-a22b-2507). In OpenRouter's [allowed providers](https://openrouter.ai/settings/privacy) setting, allow the providers that serve that model. Daytona Tier 1 and Tier 2 sandboxes can reach `openrouter.ai`. Nebius Token Factory is not reachable from those tiers, so leave `PI_PROVIDER=openrouter` unless you have confirmed another provider from inside a sandbox.

If the primary model errors, returns an empty reply, or stops producing model events for 45 seconds, the runtime retries that request through [OpenRouter's free router](https://openrouter.ai/openrouter/free). Fallback needs `OPENROUTER_API_KEY` even when another provider is primary, and your allowed providers must include providers that serve free models. The conversation and completed tool work stay in place. The next user prompt tries the configured primary model again. Free models have their own availability and rate limits.

## 3. Configure the environment

```bash
git clone git@github.com:Studio1-OSS/cloud-agent.git
cd cloud-agent
cp .env.example .env
```

Generate three independent secrets and paste them into `.env`:

```bash
openssl rand -hex 32   # CONTROL_PLANE_API_KEY
openssl rand -hex 32   # RUNTIME_ACCESS_SECRET
openssl rand -hex 32   # BROWSER_SESSION_SECRET
```

Then set the provider keys:

```bash
DAYTONA_API_KEY=...
OPENROUTER_API_KEY=...
PI_PROVIDER=openrouter
PI_MODEL=qwen/qwen3-235b-a22b-2507
```

On a server, set `DATABASE_URL` to an absolute path. The value in `.env.example` (`file:./data/cloud-agent.db`) is resolved from the process working directory, which changes if you start the app with `pnpm --filter`.

```bash
mkdir -p /var/lib/cloud-agent
# in .env:
DATABASE_URL=file:/var/lib/cloud-agent/cloud-agent.db
```

Keep `BROWSER_SESSION_SECRET` and `RUNTIME_ACCESS_SECRET` stable. Changing the browser secret signs every browser out. Changing the runtime secret no longer matches sandboxes that are already running; the next chat redeploys the runtime with the new secret. Back up the SQLite file. This process is the only writer; do not point two control planes at the same database.

| Variable | Required | Role |
| --- | --- | --- |
| `PORT` | no (default `8787`) | HTTP and WebSocket port |
| `HOST` | no (default `0.0.0.0`) | Bind address |
| `CONTROL_PLANE_API_KEY` | yes on a shared server | Bearer token for `/environments` and the CLI |
| `DATABASE_URL` | yes | SQLite file URL. Use an absolute `file:` path on a server |
| `BROWSER_SESSION_SECRET` | yes | Signs guest cookies and chat tokens. Falls back to `RUNTIME_ACCESS_SECRET` if empty |
| `RUNTIME_ACCESS_SECRET` | yes | Bearer token injected into each sandbox runtime |
| `DAYTONA_API_KEY` | yes | Daytona API credential |
| `DAYTONA_API_URL` | no | Default `https://app.daytona.io/api` |
| `DAYTONA_TARGET` | no | Daytona target/region. Empty uses the account default |
| `DAYTONA_SNAPSHOT` | no | Prebuilt snapshot name. Empty uses `node:22-bookworm` |
| `OPENROUTER_API_KEY` | yes for the default setup | Model access and free-model fallback |
| `OPENROUTER_BASE_URL` | no | Default `https://openrouter.ai/api/v1` |
| `PI_PROVIDER` | no | `openrouter` (default when its key is set), `anthropic`, `openai`, or `nebius` |
| `PI_MODEL` | no | Provider model id. Must support tool calls |
| `OPENROUTER_HTTP_REFERER` | no | OpenRouter `HTTP-Referer` header. Default `https://cloud-agent.local` |
| `OPENROUTER_APP_TITLE` | no | OpenRouter `X-Title` header. Default `cloud-agent` |
| `RUNTIME_PORT` | no | Port Pi's runtime listens on inside the sandbox. Default `4096` |
| `WORKSPACE_PATH` | no | Default `/home/daytona/workspace/project` |
| `PI_AGENT_DIR` | no | Default `/home/daytona/.pi/agent` |
| `RUNTIME_BUNDLE_DIR` | no | Local directory uploaded into sandboxes. Default `sandbox/runtime`, which resolves to `sandbox/runtime/deploy` after a build |
| `CLOUD_AGENT_URL` | CLI only | Control plane URL. Default `http://127.0.0.1:8787` |
| `CLOUD_AGENT_USER_ID` | CLI only | `X-User-Id` for API calls. Default `default-user` |
| `NEBIUS_API_KEY` | no | Only if `PI_PROVIDER=nebius` and the sandbox can reach Nebius |
| `ANTHROPIC_API_KEY` | no | Used when it is the selected provider |
| `OPENAI_API_KEY` | no | Used when it is the selected provider |

`.env` is loaded from the repository root regardless of the process working directory. Do not commit it.

## 4. Install and build

From the repository root:

```bash
pnpm install
pnpm build
```

`pnpm build` compiles every package and app, writes the web UI to `apps/web/dist`, and writes the sandbox upload bundle to `sandbox/runtime/deploy` (`server.js` plus a concrete `package.json`). Creating a workspace fails until that deploy bundle exists.

The control plane creates the SQLite file and applies migrations on startup. `pnpm db:migrate` is available, but it only sees `DATABASE_URL` when that variable is already exported in the shell; it does not read `.env` by itself.

## 5. Start the server

From the repository root, so relative paths stay predictable:

```bash
node apps/control-plane/dist/index.js
```

Equivalent after a build, if `DATABASE_URL` is absolute:

```bash
pnpm --filter @cloud-agent/control-plane start
```

Check liveness:

```bash
curl -sf http://127.0.0.1:8787/health
```

Open `http://127.0.0.1:8787/`. The root path redirects to `/ui/`. Paste a public GitHub repository (or leave it empty) and choose **Create workspace**. The first sandbox takes several minutes: Daytona creates the machine, the repo is cloned, and the runtime's npm dependencies install inside the sandbox. Later stop/resume cycles reuse the sandbox filesystem and only redeploy the runtime when the running copy is unhealthy or older than `RUNTIME_VERSION`.

A missing web build serves a 503 on `/ui/` that tells you to build `@cloud-agent/web`. A missing `DAYTONA_API_KEY` still lets `/health` succeed; creating a workspace fails until the key is set.

### Keep it running

Example systemd unit. Replace the Node path with `command -v node` on that machine (nvm and corepack shims are often absent from service environments):

```ini
[Unit]
Description=cloud-agent control plane
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/cloud-agent
EnvironmentFile=/opt/cloud-agent/.env
ExecStart=/usr/bin/node apps/control-plane/dist/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`EnvironmentFile` and the app's own `.env` load can both exist. Variables already present in the environment win over `.env`.

### Put HTTPS in front

Serve the site on one origin. The dashboard and `/ui/api` must share a host: browser mutations are rejected when the `Origin` host and the `Host` header differ. Proxy WebSocket upgrades for `/ui/ws`, and forward the public host so cookies and that origin check see the name the browser used.

```nginx
server {
    listen 443 ssl;
    server_name agent.example.com;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

`X-Forwarded-Proto: https` marks guest and workspace cookies `Secure`. Set `OPENROUTER_HTTP_REFERER` to the public `https://` origin if you want OpenRouter rankings attributed to your host.

Inbound traffic is only the control plane port (or 443 on the proxy). The server calls Daytona over outbound HTTPS. Sandbox ports are not published on this machine.

## 6. Optional checks

```bash
pnpm typecheck
pnpm test
```

`pnpm spike` creates a real Daytona sandbox, clones a repository, deploys the runtime, and prompts the model. It spends Daytona and model quota. The script deletes that sandbox when it finishes. Pass `--keep` to leave it, and `--repo` to choose the clone:

```bash
pnpm --filter @cloud-agent/sandbox-runtime build
pnpm spike -- --repo https://github.com/expressjs/express.git
```

## Frontend development

Run the API and the Vite dev server in two terminals, after `pnpm build` has produced `sandbox/runtime/deploy` at least once:

```bash
pnpm dev:control-plane
pnpm dev:web
```

Open http://localhost:5173/ui/. Vite proxies `/ui/api` and `/ui/ws` to `127.0.0.1:8787` and keeps the browser on the Vite origin, which is what the control plane's same-origin check expects.

Rebuild `sandbox/runtime` after runtime changes. Existing sandboxes pick up a new bundle on stop/resume when `runtimeVersion` no longer matches, and also when the control plane has to recover a dead runtime process.

## CLI

The CLI talks to a control plane. It can auto-start a local one when `CLOUD_AGENT_URL` is down and this repo is present. Point `CLOUD_AGENT_URL` at a remote server when the control plane runs elsewhere, and use the same `CONTROL_PLANE_API_KEY`.

```bash
pnpm --filter @cloud-agent/cli build
pnpm --filter @cloud-agent/cli link --global

cloud-agent open https://github.com/expressjs/express.git
cloud-agent open --empty --name scratch
cloud-agent list
cloud-agent resume <env-id>
cloud-agent stop <env-id>
cloud-agent rm <env-id>
```

`open` waits until the environment is ready, mints a chat link, and opens `/ui/?t=…`. `--no-open` prints the URL instead. `--branch` and `--name` set the clone branch and display name.

A copy of the CLI config can also live in `~/.cloud-agent/config.env` (`CLOUD_AGENT_URL`, `CONTROL_PLANE_API_KEY`, `CLOUD_AGENT_USER_ID`). The repo `.env` is loaded first.

## Using the product

- Repositories from the dashboard must be public GitHub HTTPS URLs (`https://github.com/owner/repo`). Private repositories, credentials in the URL, and non-GitHub hosts are rejected in the browser.
- **New project** adds another public repository, or an empty project, to the same sandbox. Projects share compute and can see the same filesystem. Each project has its own directory, conversation list, and preview port. Stopping the sandbox stops all of them.
- **New chat** starts a conversation inside the current project. Switching conversations leaves an active reply running.
- Agent replies render Markdown. Tool cards show arguments, streamed output, errors, and edit diffs.
- The agent is instructed to serve web apps on `0.0.0.0` at that project's preview port, check the signed URL with its `preview` tool, and share the HTTPS link. Vite apps must allow the Daytona preview hostname. The chat header keeps an **Open preview** action after a successful check. Preview links last 24 hours and refresh when the chat is reopened or the sandbox resumes. The app process must still be running.
- Shell commands default to a 60-second timeout. Broad `pkill -f` is rejected so it cannot kill the runtime. After an interrupted run, unfinished tool cards show an interruption.
- Chat reconnects after a dropped socket and restores the transcript and an in-progress reply. **Stop** cancels the current model request and does not trigger free-model fallback.
- After you deploy a newer runtime, stop and resume existing workspaces once so they upload the new bundle and pick up prompt changes.

## Optional Daytona snapshot

`sandbox/Dockerfile` is a Node 22 image with `git`, `curl`, `jq`, `ripgrep`, Python 3, and a global Pi install. Publish it through your Daytona account as a snapshot, then set `DAYTONA_SNAPSHOT` to that snapshot name. Sandbox creation then skips Daytona's on-the-fly image build.

The control plane still uploads `sandbox/runtime/deploy` and runs `npm install` inside the sandbox on first provision and whenever the runtime is upgraded. The snapshot does not replace that step. Leave `DAYTONA_SNAPSHOT` empty until the snapshot exists in the same Daytona account and target you are using.

## HTTP API

Browser routes use the guest cookie. `/environments` routes use the bearer API key.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness |
| GET | `/environments` | List environments for `X-User-Id` |
| POST | `/environments` | Create |
| POST | `/environments/:id/ui` | Mint a browser chat link |
| GET/POST | `/environments/:id/projects` | List or add projects in one sandbox |
| GET/POST | `/environments/:id/projects/:projectId/sessions` | List or start project conversations |
| POST | `/environments/:id/projects/:projectId/chat` | Resume a project or a chosen conversation |
| POST | `/environments/:id/start` | Start a sleeping sandbox |
| POST | `/environments/:id/stop` | Stop a sandbox |
| DELETE | `/environments/:id` | Delete the environment and its sandbox |
| GET/POST | `/ui/api/environments` | Browser workspace list and create |
| POST | `/ui/api/environments/:id/chat` | Resume the agent conversation |
| GET/POST | `/ui/api/environments/:id/projects` | Browser project list and create |
| GET/POST | `/ui/api/environments/:id/projects/:projectId/sessions` | Browser conversation list and create |
| POST | `/ui/api/environments/:id/projects/:projectId/chat` | Browser conversation switch |
| POST | `/ui/api/environments/:id/start` or `/stop` | Browser sandbox lifecycle |
| DELETE | `/ui/api/environments/:id` | Delete a browser workspace |
| GET | `/ui/api/bootstrap?t=` | Chat bootstrap from a UI token |
| WS | `/ui/ws?token=` | Chat WebSocket proxy |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `/ui/` returns 503 | Run `pnpm --filter @cloud-agent/web build` |
| Create fails immediately with a missing runtime bundle | Run `pnpm --filter @cloud-agent/sandbox-runtime build` and confirm `sandbox/runtime/deploy/server.js` exists |
| Create fails with a Daytona auth or quota error | `DAYTONA_API_KEY`, account quota, and `DAYTONA_TARGET` |
| Sandbox stays on `creating`, then `error` during install | The sandbox must reach `registry.npmjs.org` and GitHub. Read the environment error on the dashboard |
| Model replies with text but never runs tools | Choose a tool-capable `PI_MODEL` |
| OpenRouter reports that no endpoint is available | Allow the model's providers in OpenRouter privacy settings |
| Preview link is empty or localhost | The dev server must listen on `0.0.0.0` and the project's preview port, then the agent must call `preview` |
| Browser POSTs return "Request must come from this website" | The reverse proxy must pass the public `Host`. Do not host the UI on a different origin from the API |
| Workspaces disappear for a browser | The guest cookie was cleared, or `BROWSER_SESSION_SECRET` changed |
| Chat works, then the sandbox is gone after an hour | Daytona auto-stop is 60 minutes. Resume from the dashboard |
| Two servers show different workspaces | They are using different SQLite files or different browser secrets |
