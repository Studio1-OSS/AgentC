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

If the primary model errors, returns an empty reply, or stops producing model events for 45 seconds, the agent automatically retries that request with [OpenRouter's free router](https://openrouter.ai/openrouter/free). The router selects free models that support the request's tools. Completed tool work and the conversation stay intact; chat shows the switch and the active model. The agent keeps using free models for the rest of that run and tries the configured primary model again on the next prompt. Fallback requires `OPENROUTER_API_KEY`, including when another provider is primary, and your [allowed providers](https://openrouter.ai/settings/privacy) must permit providers serving free models. Free models have their own availability and rate limits; if fallback also fails, chat shows the error and remains usable. Stop cancels the current request without triggering fallback.

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

Every new or resumed sandbox gets a [Daytona signed web preview](https://www.daytona.io/docs/en/preview/) for port **3000**; ngrok and extra tunnel credentials are unnecessary. The agent's system prompt requires it to automatically run created or updated web apps and visual artifacts in the background on `0.0.0.0:3000`, call its `preview` tool to check server readiness and the preview hostname, and share the resulting HTTPS link rather than localhost. Chat keeps a verified **Open preview** action in its header as well as on successful preview tool cards. Vite apps must allow the preview proxy domain. Links last 24 hours and are refreshed when you reopen the chat or resume the sandbox; the app server must keep running for a preview to work. Sandbox control ports remain private. After deploying this update, stop/resume existing workspaces once to upgrade their runtime and apply the new prompt to reopened conversations.

Chat reconnects automatically after connection loss and restores both the transcript and any reply in progress. The running indicator stays active through provider retries until Pi finishes. If reconnect attempts fail, use **Reconnect**; **Stop** remains available during a connected active run.

Server startup and preview checks run in order, with brief readiness retries. The agent detaches web servers and records their PIDs; broad `pkill -f` commands are rejected because they can kill the agent runtime itself. Shell commands default to a 60-second timeout unless a different timeout is supplied. After an interrupted run or runtime restart, unfinished tool cards show an interruption instead of remaining stuck on Running.

The dashboard lists this browser's workspaces with open, stop, resume, and delete actions. Returning to a workspace resumes its most recently opened conversation, including the transcript. No CLI, API key entry, or token link is needed.

Inside a workspace, use **New project** to add a public GitHub repository or an empty project to the existing sandbox. The **Project** picker switches between them. Each project has its own working directory, conversation history, and web preview port; the original project and its existing sessions stay in place. Use **New chat** to start a fresh conversation within a project, and the **Conversation** picker to reopen previous chats. Switching conversations leaves active replies running. Projects share sandbox compute and filesystem access, and stopping the sandbox stops all of them. After deploying this update, stop/resume an older workspace once to enable project management in its runtime.

Guest ownership uses a signed HttpOnly cookie lasting 30 days. Clearing cookies loses access to those workspaces; this version does not provide account login or cross-device access. A guest can keep up to five workspaces. This is a browser guest MVP; account authentication and deployment-wide usage limits are still needed for an unrestricted public service.

Opening a valid chat link also remembers that link's workspace in a separate HttpOnly cookie until the token expires. It appears alongside this browser's workspaces and supports resume and sandbox controls, without granting access to the link owner's other workspaces.

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
| GET/POST | `/environments/:id/projects`                | List/add projects in one sandbox             |
| GET/POST | `/environments/:id/projects/:projectId/sessions` | List/start project conversations         |
| POST     | `/environments/:id/projects/:projectId/chat` | Resume a project or chosen conversation      |
| POST     | `/environments/:id/start`                   | Start sleeping sandbox                       |
| POST     | `/environments/:id/stop`                    | Stop sandbox                                 |
| DELETE   | `/environments/:id`                         | Delete                                       |
| GET/POST | `/ui/api/environments`                      | Browser workspace list/create (guest cookie) |
| POST     | `/ui/api/environments/:id/chat`             | Resume agent conversation (guest cookie)     |
| GET/POST | `/ui/api/environments/:id/projects`         | Browser project list/create                  |
| GET/POST | `/ui/api/environments/:id/projects/:projectId/sessions` | Browser conversation list/create    |
| POST     | `/ui/api/environments/:id/projects/:projectId/chat` | Browser conversation switch            |
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
