# cloud-agent

Remote Pi coding-agent environments inside Daytona sandboxes — with a browser workspace dashboard and an optional CLI.

Each environment gets its own isolated sandbox. Pi runs **inside** the sandbox. The control plane owns lifecycle, auth, and routing; conversation state stays in Pi session files on the sandbox filesystem.

See [PLAN.md](./PLAN.md) for the full architecture.

## Monorepo layout

```
apps/cli/               cloud-agent CLI (open / list / stop / resume)
apps/web/               Workspace dashboard + agent chat (served at /ui/)
apps/control-plane/     HTTP API + UI token + WS proxy
packages/protocol/      Shared Zod schemas + WS event types
packages/database/      SQLite schema
packages/sandbox-client/ Daytona lifecycle wrapper
sandbox/runtime/        Pi SDK HTTP + WebSocket service (runs inside each sandbox)
```

## Prerequisites

- Node.js ≥ 22.19
- pnpm 9+
- Daytona API key ([dashboard](https://app.daytona.io))
- OpenRouter API key (`OPENROUTER_API_KEY`) — preferred for Daytona (allowlisted)

Recommended `.env` for Daytona sandboxes:

```bash
PI_PROVIDER=openrouter
PI_MODEL=qwen/qwen3-235b-a22b-2507  # supports agent tool calls
OPENROUTER_API_KEY=…
DAYTONA_API_KEY=…
```

Choose a model that supports tool calls; chat-only models can print commands without executing them. The included configuration uses [Qwen3 235B via OpenRouter](https://openrouter.ai/qwen/qwen3-235b-a22b-2507). Check your OpenRouter [allowed providers](https://openrouter.ai/settings/privacy) if inference reports that no endpoint is available.

## Setup

```bash
cp .env.example .env
# fill DAYTONA_API_KEY and OPENROUTER_API_KEY

pnpm install
pnpm build
```

## Web app

```bash
pnpm build
pnpm --filter @cloud-agent/control-plane start
```

Open **http://127.0.0.1:8787/**. Paste a public GitHub URL (or `owner/repo`), optionally choose a branch, and click **Create workspace**. The app creates a Daytona sandbox, clones the repository, and opens the remote agent chat automatically. You can also start empty.

Agent replies render Markdown with highlighted code and copying, tables, task lists, links, and images. Tool cards show arguments, streamed output, errors, and edit diffs; reasoning is collapsible.

The dashboard lists this browser's workspaces with open, stop, resume, and delete actions. Returning to a workspace resumes its latest Pi conversation, including the transcript. No CLI, API key entry, or token link is needed.

Guest ownership uses a signed HttpOnly cookie lasting 30 days. Clearing cookies loses access to those workspaces; this version does not provide account login or cross-device access. A guest can keep up to five workspaces. This is a browser guest MVP; account authentication and deployment-wide usage limits are still needed for an unrestricted public service.

For frontend development, run `pnpm dev:control-plane` and `pnpm dev:web`, then open http://localhost:5173/ui/.

## CLI (browser chat — no JSON)

```bash
# link the CLI globally from this repo
pnpm --filter @cloud-agent/cli build
pnpm --filter @cloud-agent/cli link --global

# start control plane (in another terminal), or let `open` auto-start it
pnpm --filter @cloud-agent/control-plane start

# create a remote sandbox + open Pi chat in the browser
cloud-agent open https://github.com/expressjs/express.git

# or empty workspace
cloud-agent open --empty --name scratch

cloud-agent list
cloud-agent resume <env-id>
cloud-agent stop <env-id>
cloud-agent rm <env-id>
```

The CLI creates the environment, waits until ready, mints a short-lived UI token, and opens `/ui/?t=…`. The browser never receives Daytona or OpenRouter keys — chat WebSocket traffic is proxied by the control plane.

## Control plane + API

```bash
pnpm dev:control-plane
# → http://127.0.0.1:8787
# chat UI → http://127.0.0.1:8787/ui/
```

Auth (API): `Authorization: Bearer <CONTROL_PLANE_API_KEY>` and optional `X-User-Id`.

| Method   | Path                                        | Description                                  |
| -------- | ------------------------------------------- | -------------------------------------------- |
| GET      | `/health`                                   | Liveness                                     |
| GET      | `/environments`                             | List environments                            |
| POST     | `/environments`                             | Create                                       |
| POST     | `/environments/:id/ui`                      | Mint browser chat link                       |
| POST     | `/environments/:id/start`                   | Start sleeping sandbox                       |
| POST     | `/environments/:id/stop`                    | Stop sandbox                                 |
| DELETE   | `/environments/:id`                         | Delete                                       |
| GET/POST | `/ui/api/environments`                      | Browser workspace list/create (guest cookie) |
| POST     | `/ui/api/environments/:id/chat`             | Resume agent conversation (guest cookie)     |
| POST     | `/ui/api/environments/:id/start` or `/stop` | Browser sandbox lifecycle                    |
| DELETE   | `/ui/api/environments/:id`                  | Delete browser workspace                     |
| GET      | `/ui/api/bootstrap?t=`                      | Chat UI bootstrap (UI token)                 |
| WS       | `/ui/ws?token=`                             | Chat WebSocket proxy (UI token)              |

## Phase 0 spike

```bash
pnpm --filter @cloud-agent/sandbox-runtime build
pnpm spike
```

## Design notes

- **One sandbox per environment.** Public GitHub HTTPS clones work out of the box.
- **Pi owns conversations.** Control-plane DB only stores environment metadata + session ID pointers.
- **Browser uses short-lived UI tokens.** Runtime secrets stay on the server.
- **Prefer `DAYTONA_SNAPSHOT`** with Node preinstalled for faster creates.
