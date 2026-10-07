Remote Pi Environments
A plan for running persistent Pi coding-agent sessions inside isolated remote sandboxes, with a thin web/control layer for creating environments, reconnecting to sessions, streaming agent activity, and previewing applications.


1. Goal

Build a lightweight remote development environment around Pi where each workspace runs inside an isolated cloud sandbox.
A user should be able to:

1. Create a new remote environment.
2. Clone or initialize a repository inside it.
3. Start a Pi coding session.
4. Chat with Pi from a web interface.
5. Watch tool calls and agent output in real time.
6. Let Pi freely read, edit, search, run commands, install dependencies, and start services inside the sandbox.
7. Close the browser or stop the environment.
8. Return later and resume the same Pi session with the same files and project state.
9. Open applications started by Pi through secure preview URLs.
10. Maintain multiple independent environments and sessions.

The core principle is:

Pi should run where the code runs.

Instead of keeping Pi locally and proxying every filesystem and shell operation to a remote environment, Pi itself should run inside the remote sandbox.

2. Existing Daytona + Pi Integration

Daytona already provides an official Pi extension:

pi install npm:@daytona/pi
pi --daytona

With this extension, Pi itself remains on the user's machine, while Pi's coding tools such as:

* bash
* read
* write
* edit
* ls
* find
* grep

are executed inside a Daytona sandbox.
Each Pi session receives a sandbox and the repository is cloned into it.
Conceptually, Daytona's existing integration works like this:

┌───────────────────────────┐
│       User's Machine      │
│                           │
│  Pi                       │
│  ├── LLM interaction      │
│  ├── agent loop           │
│  ├── session JSONL        │
│  └── extensions           │
└─────────────┬─────────────┘
              │
              │ remote tool calls
              ▼
┌───────────────────────────┐
│      Daytona Sandbox      │
│                           │
│  /workspace/project       │
│                           │
│  read / write / edit      │
│  bash / grep / find       │
│  npm / git / compilers    │
└───────────────────────────┘

This is useful for someone who wants to keep using the normal Pi CLI locally while isolating code execution.
For this project, however, a different architecture is preferable.

3. Recommended Architecture: Run Pi Inside the Sandbox

The recommended design is:

Each remote environment contains its own Pi runtime, Pi sessions, repository, dependencies, processes, and development servers.

The local/browser application becomes primarily a control plane and user interface.

                         USER

                           │
                           ▼

                ┌──────────────────────┐
                │      Web Client      │
                │                      │
                │  Chat                │
                │  Tool activity       │
                │  Environment status  │
                │  Preview             │
                │  Session selector    │
                └──────────┬───────────┘
                           │
                    HTTPS / WebSocket
                           │
                           ▼

                ┌──────────────────────┐
                │    Control Plane     │
                │                      │
                │  Authentication      │
                │  Environment DB      │
                │  Sandbox lifecycle   │
                │  Routing             │
                │  Credentials         │
                └──────────┬───────────┘
                           │
                       Daytona API
                           │
                           ▼

      ╔════════════════════════════════════════════╗
      ║            DAYTONA SANDBOX                ║
      ║                                            ║
      ║  ┌──────────────────────────────────────┐  ║
      ║  │       Sandbox Runtime Server         │  ║
      ║  │                                      │  ║
      ║  │  HTTP / WebSocket endpoint           │  ║
      ║  │  Pi SDK integration                  │  ║
      ║  │  Session router                      │  ║
      ║  │  Process / preview metadata          │  ║
      ║  └──────────────────┬───────────────────┘  ║
      ║                     │                      ║
      ║                     ▼                      ║
      ║            ┌─────────────────┐             ║
      ║            │       Pi        │             ║
      ║            │                 │             ║
      ║            │ AgentSession    │             ║
      ║            │ SessionManager  │             ║
      ║            │ Agent loop      │             ║
      ║            │ Compaction      │             ║
      ║            │ Skills          │             ║
      ║            │ Extensions      │             ║
      ║            │ Tools           │             ║
      ║            └────────┬────────┘             ║
      ║                     │                      ║
      ║           normal local operations         ║
      ║                     │                      ║
      ║                     ▼                      ║
      ║       ┌──────────────────────────┐         ║
      ║       │   /workspace/project     │         ║
      ║       │                          │         ║
      ║       │   repository             │         ║
      ║       │   dependencies           │         ║
      ║       │   build output           │         ║
      ║       │   dev servers            │         ║
      ║       └──────────────────────────┘         ║
      ║                                            ║
      ║       ~/.pi/agent/sessions/*.jsonl         ║
      ║                                            ║
      ╚════════════════════════════════════════════╝
                           │
                           │ port 3000, 5173, etc.
                           ▼
                ┌──────────────────────┐
                │  Signed Preview URL  │
                └──────────────────────┘


4. Why This Architecture Is Better

With this design, Pi does not need to understand that it is operating remotely.
From Pi's perspective:

read("src/server.ts")

is simply a local filesystem read.
Likewise:

bash("npm test")

runs a local command.
And:

edit("src/server.ts")

modifies a local file.
The isolation occurs one level below Pi:

Pi's "local machine"
        =
Daytona sandbox

This avoids introducing a remote network hop into every individual agent tool call.

Alternative architecture

The other possible architecture is:

Pi
 │
 ├── read  ──HTTP──► Daytona
 ├── edit  ──HTTP──► Daytona
 ├── bash  ──HTTP──► Daytona
 ├── grep  ──HTTP──► Daytona
 └── write ──HTTP──► Daytona

This works and is similar to Daytona's existing Pi extension.
But for a product whose entire workspace is meant to be remote, it introduces unnecessary complexity.
The recommended architecture becomes:

Pi
 │
 ├── read
 ├── edit
 ├── bash
 ├── grep
 └── write
       │
       ▼
local sandbox filesystem

The remote boundary exists between:

Web application
      ↕
Sandbox

rather than between:

Pi
 ↕
every tool call


5. Main Components

5.1 Web Client

The web application should remain relatively thin.
Its responsibilities are:

* Environment list
* Create environment
* Start / stop environment
* Conversation UI
* Streaming assistant text
* Tool activity display
* Session selector
* Environment status
* Application preview
* Basic file-change information
* Abort current Pi run
* Send steering/follow-up messages

It should not implement Pi's agent logic.

5.2 Control Plane

A central backend manages infrastructure rather than coding-agent execution.
Responsibilities:

Authentication
Environment ownership
Environment metadata
Daytona sandbox creation
Sandbox start / stop / delete
Connection routing
Credential issuance
Preview URL creation
Usage / billing metadata

The control plane should know:

environment ID
        ↓
Daytona sandbox ID
        ↓
user / project

It does not need to store every Pi message.

5.3 Daytona Sandbox

Each environment corresponds to one isolated sandbox.
For example:

environment_abc
        │
        ▼
Daytona sandbox sbx_123

Inside:

/home/daytona/
├── .pi/
│   └── agent/
│       └── sessions/
│
└── workspace/
    └── project/
        ├── .git/
        ├── package.json
        ├── src/
        └── ...

Daytona sandboxes persist their filesystem across stop/start operations by default, so repositories, dependencies, Pi session files, and build artifacts can survive environment shutdowns.
That makes them naturally suitable for resumable Pi environments.

6. Pi Runtime

Use the official Pi TypeScript SDK inside the sandbox.
Pi exposes:

createAgentSession()

and allows direct programmatic access to:

* agent sessions
* messages
* models
* tools
* compaction state
* extensions
* resources
* persisted session trees

Pi's SessionManager owns the stored session tree and its active leaf. When model context is reconstructed, the manager selects the active branch and applies compaction.
This is exactly what the sandbox runtime needs.
Conceptually:

SandboxRuntime
       │
       ▼
createAgentSession({
    cwd: "/workspace/project",
    sessionManager: ...
})


7. Pi SDK vs RPC

Pi provides two suitable integration mechanisms.

Option 1 — SDK

Sandbox Runtime
      │
      │ direct TypeScript calls
      ▼
Pi AgentSession

Advantages:

* Direct API
* Type-safe
* Easy event subscriptions
* Simple lifecycle management
* No subprocess protocol
* Full access to Pi APIs

Pi recommends its SDK for Node.js/Bun applications that want in-process integration.

Recommended for the MVP

Use this first.

Option 2 — RPC

Sandbox Runtime
       │
       │ JSONL stdin/stdout
       ▼
pi --mode rpc

Pi RPC runs Pi as a long-lived subprocess and exposes commands and streaming events over JSONL.
RPC gives stronger process isolation.
This may eventually be desirable because:

sandbox-runtime crashes
        ≠
Pi process crashes

and Pi can potentially be restarted independently.
But it creates another lifecycle and IPC layer.

Recommendation

MVP
 │
 └── Pi SDK

Later, if needed
 │
 └── Pi RPC subprocess


8. Session Architecture

Do not rebuild Pi's session system in the application database.
Pi already handles:

* conversation messages
* tool calls
* tool results
* branches
* active leaf
* compaction
* model changes
* session metadata

The sandbox should therefore remain authoritative for detailed conversation state.
The central database only needs pointers.
Example:

Environment
-----------
id
user_id
sandbox_id
repo_url
repo_branch
status
created_at
last_active_at
AgentSession
------------
id
environment_id
pi_session_id
title
created_at
last_active_at

The relationship becomes:

User
 │
 └── Environment
       │
       ├── Pi Session A
       ├── Pi Session B
       └── Pi Session C

while actual Pi conversation data lives in:

~/.pi/agent/sessions/

inside the remote environment.

9. Environment Lifecycle

Create

sequenceDiagram
    participant U as User
    participant W as Web App
    participant C as Control Plane
    participant D as Daytona
    participant S as Sandbox Runtime
    participant P as Pi

    U->>W: Create environment
    W->>C: POST /environments
    C->>D: Create sandbox
    D-->>C: sandboxId
    C->>D: Start runtime
    D->>S: Launch runtime
    S->>S: Clone repository
    S->>P: Create AgentSession
    P-->>S: Ready
    S-->>C: Environment ready
    C-->>W: Environment metadata
    W-->>U: Open workspace


Resume

A user returning later should trigger:

Open environment
       │
       ▼
Is sandbox running?
       │
       ├── yes ──► connect
       │
       └── no
            │
            ▼
      start sandbox
            │
            ▼
      runtime starts
            │
            ▼
      locate Pi session
            │
            ▼
      reconnect UI

Because Daytona retains sandbox filesystem state across stop/start, both the repository and persisted Pi sessions remain available.

10. Agent Request Lifecycle

When a user submits:

Fix the authentication bug.

the request flow becomes:

sequenceDiagram
    participant U as Browser
    participant R as Sandbox Runtime
    participant P as Pi
    participant M as Model
    participant F as Sandbox Filesystem

    U->>R: prompt("Fix the authentication bug")
    R->>P: session.prompt(...)

    P->>M: Context + tools + prompt
    M-->>P: toolCall(read auth.ts)

    P->>F: read src/auth.ts
    F-->>P: file contents

    P->>M: Tool result
    M-->>P: toolCall(edit auth.ts)

    P->>F: modify auth.ts
    F-->>P: success

    P->>M: Tool result
    M-->>P: toolCall(bash tests)

    P->>F: npm test
    F-->>P: test output

    P->>M: Tool result
    M-->>P: Final answer

    P-->>R: Agent settled
    R-->>U: Complete

The browser should receive intermediate events throughout this flow.

11. Realtime Event Streaming

The sandbox runtime should translate Pi events into a simple WebSocket protocol.
For example:

{
  "type": "assistant.text.delta",
  "text": "I'll inspect the authentication..."
}
{
  "type": "tool.started",
  "tool": "read",
  "callId": "abc123"
}
{
  "type": "tool.finished",
  "tool": "read",
  "callId": "abc123"
}
{
  "type": "run.finished"
}

The browser should be a renderer of agent events, not the source of agent truth.

12. Recommended Runtime API

The sandbox-side runtime could expose a very small API.

HTTP

GET  /health

GET  /sessions
POST /sessions
GET  /sessions/:id

POST /sessions/:id/abort

GET  /environment
GET  /processes

WebSocket

/ws/sessions/:id

Messages from browser:

{
  "type": "prompt",
  "content": "Implement dark mode."
}
{
  "type": "steer",
  "content": "Don't change the database."
}
{
  "type": "abort"
}

Server events:

session.state
message.start
message.delta
message.end
tool.start
tool.update
tool.end
compaction
run.start
run.end
error

Keep this protocol intentionally small.
Pi remains responsible for the complicated agent state machine.

13. Persistence Strategy

Phase 1 — Persist the Entire Sandbox

For the MVP, keep Pi state directly inside the sandbox.

Sandbox
├── repository
├── installed dependencies
├── build cache
├── .pi sessions
└── runtime configuration

Then:

running
   ↓
stop
   ↓
filesystem preserved
   ↓
start
   ↓
continue

This is the simplest architecture.
Daytona supports filesystem persistence across sandbox stop/start operations.

Phase 2 — External Persistent Session Volume

If environments eventually need to be disposable, mount persistent storage:

Persistent Volume

/pi-state/
├── users/
│   ├── user-a/
│   │   └── environment-123/
│   │       └── sessions/
│   └── user-b/

Daytona volumes persist independently of sandbox lifecycle and can be mounted into other sandboxes.
That allows:

Sandbox A
    │
    X deleted

Pi state survives

    │
    ▼
Sandbox B
    │
    └── resume same sessions

Do not build this for the initial MVP unless sandbox replacement becomes necessary.

14. Application Previews

One of the most useful features should be:

Pi starts an application, and the user can immediately open it.

For example Pi executes:

npm run dev -- --host 0.0.0.0

on:

localhost:3000

The control plane requests a Daytona preview URL.
Daytona supports exposing HTTP services running on sandbox ports.
The UI can then show:

┌────────────────────────────────────────────────────────┐
│ Environment: my-project                         ● Live │
├─────────────────────────┬──────────────────────────────┤
│                         │                              │
│ Chat                    │ Preview                      │
│                         │                              │
│ You                     │ ┌──────────────────────────┐ │
│ Build the dashboard     │ │                          │ │
│                         │ │      localhost:3000      │ │
│ Pi                      │ │                          │ │
│ Implementing it now...  │ │      rendered app       │ │
│                         │ │                          │ │
│ ▸ read app.tsx          │ └──────────────────────────┘ │
│ ✓ edit app.tsx          │                              │
│ ✓ npm run dev           │                              │
│                         │                              │
└─────────────────────────┴──────────────────────────────┘


15. Preview Security

For browser-facing previews, prefer signed preview URLs.
Daytona's standard preview credential applies to the entire sandbox and can authenticate other ports, including sandbox infrastructure services.
Signed preview URLs are:

* scoped to one port
* expiring
* revocable

and are intended for browser-facing sharing/embedding.
Architecture:

Browser
   │
   │ request preview
   ▼
Control Plane
   │
   │ create signed URL
   ▼
Daytona
   │
   ▼
temporary port-specific URL
   │
   ▼
Browser iframe/tab

Never expose a general sandbox-control token to the browser.

16. Credentials and Security

The sandbox should be considered an agent-controlled machine.
Pi can run shell commands.
Therefore anything readable by the sandbox should be treated as potentially readable by the model-driven agent.
Avoid putting permanent high-value secrets directly into the environment.
Bad:

Sandbox
 ├── OPENAI_MASTER_KEY
 ├── GITHUB_ADMIN_TOKEN
 └── production AWS credentials

Prefer:

Sandbox
   │
   │ short-lived credential
   ▼
Credential / model gateway
   │
   ├── OpenAI
   ├── Anthropic
   └── other providers

The same principle should apply to Git access.
Use:

* narrowly scoped repository credentials
* installation tokens
* short-lived credentials where possible
* server-side secret exchange
* per-environment permissions


17. Model Gateway

A production version should strongly consider a model gateway.
Instead of:

Sandbox
   │ permanent provider API key
   ▼
Provider

use:

Sandbox
   │
   │ environment token
   ▼
┌──────────────────────┐
│    Model Gateway     │
│                      │
│ identify user        │
│ enforce quotas       │
│ select provider      │
│ meter tokens         │
│ inject real secret   │
└──────────┬───────────┘
           │
           ▼
      Model Provider

Benefits:

* Provider keys never enter sandboxes
* Usage can be metered centrally
* Tokens can be revoked
* Per-user quotas are straightforward
* Providers can be swapped
* Billing can be centralized

This does not need to exist in the earliest prototype.

18. Skills and Extensions

Because Pi itself runs inside the environment, standard Pi features continue working naturally.
An environment could contain:

.pi/
├── skills/
│   ├── frontend/
│   │   └── SKILL.md
│   └── deployment/
│       └── SKILL.md
│
└── extensions/

Or centrally supplied skills could be installed in the sandbox image.
This means remote environments can still use:

* repository-specific instructions
* Pi skills
* Pi extensions
* custom tools
* project AGENTS.md
* provider configuration

No special remote implementation is required.

19. Base Sandbox Image

Create a standard snapshot/image containing common tooling.
For example:

Ubuntu
├── git
├── curl
├── jq
├── ripgrep
├── Node.js
├── npm
├── pnpm
├── Bun
├── Python
├── uv
├── GitHub CLI
├── Pi
└── sandbox-runtime

Then new environments only need to:

create sandbox
       ↓
clone repository
       ↓
install project dependencies if required
       ↓
start Pi runtime

rather than installing the entire toolchain on every creation.

20. Suggested Repository Structure

remote-pi/
│
├── apps/
│   │
│   ├── web/
│   │   ├── environments/
│   │   ├── sessions/
│   │   ├── chat/
│   │   └── preview/
│   │
│   └── control-plane/
│       ├── auth/
│       ├── environments/
│       ├── sandboxes/
│       ├── previews/
│       └── websocket-routing/
│
├── packages/
│   │
│   ├── protocol/
│   │   ├── client-events.ts
│   │   └── server-events.ts
│   │
│   ├── database/
│   │
│   └── sandbox-client/
│
└── sandbox/
    ├── Dockerfile
    ├── runtime/
    │   ├── server.ts
    │   ├── pi.ts
    │   ├── sessions.ts
    │   ├── events.ts
    │   └── processes.ts
    │
    └── skills/


21. MVP Scope

The MVP should intentionally exclude most advanced IDE functionality.

Include

* Authentication
* Create environment
* Delete environment
* Start / stop environment
* Clone Git repository
* Run Pi inside environment
* Persistent Pi sessions
* Session list
* Resume session
* Streaming assistant output
* Tool-call visualization
* Abort run
* Basic environment status
* Secure app preview
* One repository per environment

Do Not Build Yet

* Collaborative editing
* VS Code replacement
* Complex file browser
* Full terminal emulator
* Multi-agent orchestration
* Agent-to-agent communication
* GitHub pull-request workflow
* Branch visualization
* Full Pi session-tree UI
* Snapshots UI
* Fine-grained permissions system
* Environment sharing
* Multiple sandboxes per environment
* Custom extension marketplace
* Complex billing

The product should initially answer one question extremely well:

Can I open a remote project, ask Pi to work on it, leave, and return later without losing anything?


22. Development Phases

Phase 0 — Technical Spike

Goal: prove Pi can live comfortably inside Daytona.
Build a script that:

1. Creates Daytona sandbox
2. Clones repository
3. Installs / starts Pi runtime
4. Creates Pi AgentSession
5. Sends prompt
6. Streams events
7. Stops sandbox
8. Starts sandbox again
9. Resumes Pi session

Success criteria:

✓ Pi can modify repository
✓ commands execute inside sandbox
✓ session survives restart
✓ next prompt sees previous history


Phase 1 — Sandbox Runtime

Create the reusable service running inside every environment.

sandbox-runtime
├── health endpoint
├── Pi SDK
├── session creation
├── session resume
├── WebSocket events
├── prompt handling
└── abort handling

No polished UI yet.

Phase 2 — Control Plane

Implement:

POST   /environments
GET    /environments
GET    /environments/:id
POST   /environments/:id/start
POST   /environments/:id/stop
DELETE /environments/:id

Responsibilities:

database
    ↕
Daytona API


Phase 3 — Basic Web UI

Build:

Environment List
        ↓
Environment Workspace
        ↓
Session List + Chat

Display:

* user messages
* assistant messages
* streaming text
* tool name
* running/completed state
* errors

Avoid rendering every low-level Pi event initially.

Phase 4 — Persistence & Resume

Test aggressively:

browser refresh
runtime restart
sandbox stop/start
network disconnect
Pi process restart

The user should always be able to recover from durable session data.

Phase 5 — Application Previews

Detect or allow users to select running HTTP ports.
Create signed Daytona preview URLs and embed them in the workspace.
Daytona supports signed port-specific preview URLs through its API/SDK.

Phase 6 — Security Hardening

Add:

* short-lived sandbox access credentials
* scoped repository credentials
* model gateway
* rate limits
* resource quotas
* maximum environment lifetime
* idle shutdown
* preview expiration
* audit logs


Phase 7 — Developer Experience

Later improvements:

Git diff viewer
file changes
session naming
session branching UI
model selector
thinking-level selector
skill management
environment templates
snapshots
fork environment
terminal
Git integration


23. Environment State Machine

Keep the infrastructure lifecycle simple.

stateDiagram-v2
    [*] --> Creating

    Creating --> Running
    Creating --> Failed

    Running --> Stopping
    Running --> Pausing
    Running --> Deleting

    Stopping --> Stopped
    Pausing --> Paused

    Stopped --> Starting
    Paused --> Resuming

    Starting --> Running
    Resuming --> Running

    Stopped --> Deleting
    Paused --> Deleting

    Deleting --> Deleted
    Deleted --> [*]

At the application layer, simplify this to:

creating
ready
sleeping
starting
error
deleted

The UI does not need to expose every provider-specific state.

24. Session and Environment Separation

Do not equate:

environment

with:

conversation

One environment should support multiple Pi sessions:

Environment: my-project
│
├── Session: Build authentication
│
├── Session: Refactor dashboard
│
└── Session: Investigate test failures

All operate against the same repository unless deliberately isolated.
This maps naturally to Pi's existing session architecture.

25. Later: Environment Forking

A powerful future feature would be:

Environment
     │
     ├──── fork ────► Environment A
     │
     └──── fork ────► Environment B

Then two agent experiments can proceed independently.
For example:

               ┌── approach A
original env ──┤
               └── approach B

Daytona provides persistence primitives including snapshots and forks depending on sandbox type, making this a natural future extension.
Do not include this in the first MVP.

26. Failure Model

Design around the assumption that any network/process component can disappear.

Browser disconnects

Nothing happens to Pi's durable state.
Reconnect and fetch current session state.

Control plane restarts

Environment metadata exists in DB.
Reconnect to Daytona.

Sandbox stops

Filesystem persists.
Start it again.

Sandbox runtime crashes

Restart runtime and reopen Pi session.

Pi run crashes

Finalized session entries remain persisted.
Allow user to continue.

Model provider errors

Expose error in conversation and let Pi/user retry.
The most important principle is:

The browser connection must never be the owner of the agent session.


27. Overall Data Ownership

┌───────────────────────┐
│ Central Database      │
│                       │
│ users                 │
│ environments          │
│ sandbox IDs           │
│ session references    │
│ permissions           │
│ usage metadata        │
└───────────────────────┘


┌───────────────────────┐
│ Pi Session Storage    │
│                       │
│ conversation tree     │
│ assistant messages    │
│ tool calls/results    │
│ compactions           │
│ branches              │
│ model state           │
└───────────────────────┘


┌───────────────────────┐
│ Sandbox Filesystem    │
│                       │
│ repository            │
│ dependencies          │
│ generated files       │
│ build artifacts       │
│ running project state │
└───────────────────────┘

Each system should own only what it is good at.

28. Final Architecture

flowchart TB
    User["User"] --> Browser["Web Client"]

    Browser <-->|"HTTPS / WebSocket"| API["Control Plane"]

    API --> Auth["Authentication"]
    API --> DB[("Application DB")]
    API --> Daytona["Daytona API"]

    Daytona --> Sandbox["Remote Sandbox"]

    subgraph Sandbox
        Runtime["Sandbox Runtime<br/>Node.js / TypeScript"]
        Pi["Pi SDK<br/>AgentSession"]
        Sessions[("Pi JSONL Sessions")]
        Repo[("Workspace / Repository")]
        Processes["Dev Servers / Processes"]

        Runtime --> Pi
        Pi <--> Sessions
        Pi <--> Repo
        Pi --> Processes
    end

    API <-->|"Route / Connect"| Runtime

    Processes --> Preview["Signed Preview URL"]
    Preview --> Browser

    Pi --> Gateway["Optional Model Gateway"]
    Gateway --> Models["Model Providers"]


29. Architectural Principle

The entire system can be summarized with three layers:

┌─────────────────────────────────────┐
│               PRODUCT               │
│                                     │
│ UI + auth + environment management  │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│            REMOTE ENVIRONMENT       │
│                                     │
│ Pi + sessions + repository          │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│              SANDBOX                │
│                                     │
│ isolation + persistence + compute   │
└─────────────────────────────────────┘

The responsibilities remain intentionally separate:

Pi
→ intelligence orchestration
→ sessions
→ context
→ tools
→ compaction
→ skills

Daytona
→ compute
→ filesystem isolation
→ persistence
→ lifecycle
→ networking
→ previews

Your application
→ UX
→ authentication
→ environment ownership
→ routing
→ infrastructure orchestration


30. Recommended First Prototype

Do not begin by building the web interface.
First prove this exact flow from one TypeScript script:

create Daytona sandbox
        ↓
clone test repository
        ↓
start sandbox runtime
        ↓
create persistent Pi session
        ↓
prompt:
"Create a hello-world endpoint and run it."
        ↓
Pi edits files
        ↓
Pi starts application
        ↓
obtain signed preview URL
        ↓
verify endpoint
        ↓
stop Daytona sandbox
        ↓
start sandbox
        ↓
reopen same Pi session
        ↓
prompt:
"Now add a /health endpoint."
        ↓
Pi remembers previous work

If this works cleanly, almost every major architectural assumption has been validated.
After that, wrap it with:

database
+
API
+
WebSocket
+
UI

rather than discovering fundamental agent/environment problems after building the frontend.

31. Recommended Decision

Use the remote-runtime architecture:

One persistent remote environment contains the repository, Pi runtime, Pi session data, tools, processes, skills, and development servers.

Use Daytona as the environment and isolation layer.
Use Pi's TypeScript SDK as the agent runtime.
Use your backend only as a lightweight control plane.
Use WebSockets to stream Pi events to a browser.
Use Daytona signed preview URLs for applications running inside environments.
Use Pi's own session system instead of recreating conversation storage.
Start with sandbox filesystem persistence, and only introduce external volumes when environments need to survive sandbox deletion.
The resulting system stays surprisingly small because the two difficult pieces are delegated to systems already designed for them:

                YOUR APPLICATION
                       │
          UX + orchestration + auth
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
           PI                  DAYTONA
            │                     │
       agent runtime           sandbox
       sessions                compute
       context                 storage
       tools                   lifecycle
       skills                  networking
       compaction              previews
            │                     │
            └──────────┬──────────┘
                       ▼
             REMOTE CODING ENVIRONMENT

That should be the foundation of the implementation.
