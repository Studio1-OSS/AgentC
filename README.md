# cloud-agent

[Pi](https://github.com/badlogic/pi-mono) runs on your app server using [Nebius Token Factory](https://docs.tokenfactory.nebius.com/). [Daytona](https://www.daytona.io) sandboxes run repository clones, file operations, shell commands, and the websites the agent creates.

The browser dashboard, API, WebSockets, and Pi share one Node process, ready to deploy on Railway. Model credentials stay on that server. No Pi process, runtime bundle, or model credentials are installed in new sandboxes.

## Architecture

- `apps/web`: dashboard and chat, built and served at `/ui/` by the control plane.
- `apps/control-plane`: browser ownership, API auth, SQLite, environment lifecycle, and server-side chat.
- `packages/agent-runtime`: Pi session registries, model streaming, and tools backed by the Daytona SDK.
- `packages/sandbox-client`: Daytona create/start/stop/delete, Git clone, and signed project previews.
- `packages/protocol`: request schemas, chat events, and provider configuration.
- `packages/database`: workspace/project/session metadata and migrations.
- `apps/cli`: optional client for the API.

Creating a workspace provisions a Daytona sandbox and clones into `/home/daytona/workspace/project`, or initializes an empty Git repository. The server creates a signed preview for port `3000`. Additional projects use separate directories and preview ports in the same sandbox.

Chat connects directly to server-side Pi through `/ui/ws` using a short-lived signed token. Pi calls Nebius from the app server. Its read, write, edit, bash, and preview tools operate remotely in Daytona. Shell output streams back to the browser; aborting a command closes its Daytona process session. Server environment variables are never forwarded to shell tools.

Pi transcripts live in `PI_AGENT_DIR/<environment>/<project>/sessions` on the app server. SQLite stores workspace metadata and session pointers. Both belong on durable server storage. The sandbox retains project files through stop/start; Pi sessions reopen from server storage after a restart.

When an existing environment first opens, the server imports its former sandbox Pi transcripts without overwriting local files. Originals stay in Daytona. New sandboxes have no agent process or injected model credentials; legacy sandboxes retain their original files.

## Deploy on Railway

1. Create a Railway service from this repository. The root `Dockerfile` builds the UI and server; `railway.json` sets `/health` as the health check. Railway supplies `PORT`; the server binds to `0.0.0.0`.
2. Attach a [Railway volume](https://docs.railway.com/volumes) at `/data`. The app uses `RAILWAY_VOLUME_MOUNT_PATH` to default SQLite to `/data/cloud-agent.db` and Pi storage to `/data/pi`. Use one service replica because both SQLite and the live Pi registries belong to one process.
3. Set these Railway variables:

   ```env
   DAYTONA_API_KEY=...
   NEBIUS_API_KEY=...
   PI_PROVIDER=nebius
   PI_MODEL=moonshotai/Kimi-K2.7-Code
   CONTROL_PLANE_API_KEY=...
   BROWSER_SESSION_SECRET=...
   ```

   Generate independent secrets with `openssl rand -hex 32`. Copy your existing Nebius key from local `.env` into Railway's variables. `.env` and local databases are excluded from the Docker build.
4. Generate a public Railway domain and open `/ui/`. HTTPS and WebSocket traffic use the same service.

`NEBIUS_BASE_URL` defaults to `https://api.tokenfactory.nebius.com/v1`. `OPENROUTER_API_KEY` is optional: when configured, the existing fallback retries failed, empty, or stalled model responses through `openrouter/free` while retaining the conversation and completed tools. Without that key, errors stay with the selected primary provider.

Back up the volume. Keep `BROWSER_SESSION_SECRET` stable: changing it signs browsers out of their workspaces. If moving an existing installation to Railway, copy both its SQLite database and `PI_AGENT_DIR` into the volume.

## Local setup

Prerequisites: Node **22.19+**, pnpm **9.15.0**, a Daytona key, and a Nebius Token Factory key. Native SQLite compilation may need Python 3, make, and a C++ compiler.

```bash
cp .env.example .env
# Fill in the keys and independent secrets.
pnpm install
pnpm build
pnpm start
```

Open `http://127.0.0.1:8787/ui/`. `.env` loads from the repository root; process environment variables take precedence. Local storage defaults to `data/cloud-agent.db` and `data/pi` in this repo.

| Variable | Purpose |
| --- | --- |
| `PORT`, `HOST` | Server bind address; defaults `8787`, `0.0.0.0` |
| `DATABASE_URL` | SQLite file URL; use an absolute path on a server |
| `PI_AGENT_DIR` | Durable Pi storage on the **app server**, separate from the sandbox workspace |
| `RAILWAY_VOLUME_MOUNT_PATH` | Supplies storage defaults when a Railway volume is attached |
| `CONTROL_PLANE_API_KEY` | Bearer credential for the CLI and `/environments` API |
| `BROWSER_SESSION_SECRET` | Signs browser ownership cookies and chat tokens |
| `RUNTIME_ACCESS_SECRET` | Compatibility fallback for the browser secret; no sandbox runtime uses it |
| `DAYTONA_API_KEY`, `DAYTONA_API_URL`, `DAYTONA_TARGET` | Daytona credentials and optional endpoint/region |
| `DAYTONA_SNAPSHOT` | Optional snapshot built from `sandbox/Dockerfile`; default image is `node:22-bookworm` |
| `WORKSPACE_PATH` | Project directory **inside Daytona**; default `/home/daytona/workspace/project` |
| `PI_PROVIDER`, `PI_MODEL` | Selected provider and tool-capable model; Nebius is preferred when both provider keys are set |
| `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` | Nebius credentials and endpoint, used on the app server |
| `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` | Optional alternate provider and free-model fallback |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Optional alternate providers |
| `CLOUD_AGENT_URL`, `CLOUD_AGENT_USER_ID` | CLI server URL and user id |

For frontend development, run `pnpm dev:control-plane` and `pnpm dev:web` in separate terminals. Vite serves `http://localhost:5173/ui/` and proxies the API and WebSockets to the control plane.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

`pnpm spike` spends real Daytona and model quota. It creates a temporary sandbox, clones a public repository, prompts server-side Pi to use remote bash/read/write/edit, and checks that files and conversations survive stop/start. It deletes the sandbox afterward; pass `--keep` to retain it or `--repo <url>` for another repository.

## Access and CLI

Browser ownership uses a signed HttpOnly guest cookie lasting 30 days. Clearing it loses access to that browser's workspaces. A browser can keep five workspaces. Chat links grant access to one workspace until their token expires (12 hours). There is no cross-device user login in this version.

The HTTP API uses `Authorization: Bearer <CONTROL_PLANE_API_KEY>` and an optional `X-User-Id`; treat the API key as an admin credential. The API does not apply the browser workspace cap.

```bash
pnpm cloud-agent -- --help
pnpm cloud-agent -- create --repo https://github.com/octocat/Hello-World.git
pnpm cloud-agent -- list
```

A self-hosted HTTPS reverse proxy must preserve the public `Host`, set `X-Forwarded-Proto`, and forward WebSocket upgrades for `/ui/ws`. Browser mutation requests require matching `Origin` and `Host` names.
