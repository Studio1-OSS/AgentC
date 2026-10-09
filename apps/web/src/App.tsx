import {
  useEffect,
  useState,
  useRef,
  useCallback,
  lazy,
  Suspense,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Github,
  Box,
  Command,
  GitBranch,
  CircleHelp,
  ChevronRight,
  Cpu,
  Terminal,
  X,
  LoaderCircle,
  Moon,
  Trash2,
  RefreshCw,
  Check,
} from "lucide-react";
const Chat = lazy(() =>
  import("@/components/Chat").then((module) => ({ default: module.Chat })),
);
import { useChatSession } from "@/hooks/useChatSession";
import { readTokenFromUrl, chatTargetFromToken } from "@/lib/session";
import { api, repoLabel, normalizeRepoUrl, type Workspace } from "@/lib/workspaces";
import { ConversationManager } from "@/components/ConversationManager";

function AgentChat({
  token,
  onSelect,
  onResume,
}: {
  token: string;
  onSelect: (token: string) => void;
  onResume: () => void;
}) {
  const chat = useChatSession(token, { onGiveUp: onResume, onToken: onSelect });
  return (
    <Suspense
      fallback={<div className="provisioning">Loading conversation…</div>}
    >
      <ConversationManager token={token} bootstrap={chat.bootstrap} onSelect={onSelect} />
      <Chat {...chat} onSend={chat.sendPrompt} onAbort={chat.abort} />
    </Suspense>
  );
}

export function App() {
  const [token, setToken] = useState(readTokenFromUrl);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [empty, setEmpty] = useState(false);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [help, setHelp] = useState(false);
  const mounted = useRef(true);
  const opening = useRef<string | null>(null);
  const openGeneration = useRef(0);
  const currentWorkspace = useRef<string | null>(null);
  const selectChat = useCallback((value: string) => {
    setToken(value);
    window.history.replaceState({}, "", `/ui/?t=${encodeURIComponent(value)}`);
  }, []);

  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".workspace-modal");
    if (!dialog) return;
    const focusable = () => [
      ...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
      ),
    ];
    if (!dialog.contains(document.activeElement)) focusable()[0]?.focus();
    function trap(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);

  async function refresh() {
    const data = await api<{ environments: Workspace[] }>("");
    if (mounted.current)
      setWorkspaces(
        data.environments.sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
    return data.environments;
  }
  useEffect(() => {
    mounted.current = true;
    refresh()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 3000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const target = token ? chatTargetFromToken(token) : null;
    const id = target?.environmentId ?? selected?.id;
    const fresh = workspaces.find((w) => w.id === id);
    if (fresh) {
      setSelected(fresh);
      currentWorkspace.current = fresh.id;
    }
    if (fresh?.status === "ready" && !token && opening.current !== fresh.id) {
      if (!currentWorkspace.current) currentWorkspace.current = fresh.id;
      void openChat(fresh);
    }
  }, [workspaces, token]);

  async function openChat(workspace: Workspace, force = false) {
    if (!force && opening.current === workspace.id) return;
    const generation = ++openGeneration.current;
    opening.current = workspace.id;
    currentWorkspace.current = workspace.id;
    try {
      const chat = await api<{ token: string }>(
        `/${workspace.id}/chat`,
        "POST",
        {},
        undefined,
        120_000,
      );
      if (generation !== openGeneration.current) return;
      if (mounted.current && currentWorkspace.current === workspace.id) {
        setError(null);
        selectChat(chat.token);
      }
    } catch (err) {
      if (generation === openGeneration.current && currentWorkspace.current === workspace.id)
        setError((err as Error).message);
    } finally {
      if (generation === openGeneration.current) opening.current = null;
    }
  }
  async function resumeFromToken() {
    const target = token ? chatTargetFromToken(token) : null;
    if (target) {
      if (opening.current === target.environmentId) return;
      opening.current = target.environmentId;
      try {
        const chat = await api<{ token: string }>(
          `/${target.environmentId}/projects/${target.projectId}/chat`,
          "POST",
          {},
          token ?? undefined,
          120_000,
        );
        if (mounted.current) {
          setError(null);
          selectChat(chat.token);
        }
        if (opening.current === target.environmentId) opening.current = null;
        return;
      } catch (err) {
        if (opening.current === target.environmentId) opening.current = null;
        if (selected) {
          void openChat(selected, true);
          return;
        }
        if (mounted.current) setError((err as Error).message);
        return;
      }
    }
    if (selected) void openChat(selected, true);
  }
  async function connect(workspace: Workspace) {
    currentWorkspace.current = workspace.id;
    setSelected(workspace);
    setToken(null);
    setError(null);
    setPending(true);
    try {
      if (workspace.status === "sleeping")
        await api(`/${workspace.id}/start`, "POST", {});
      if (workspace.status === "ready") await openChat(workspace);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const repoUrl = normalizeRepoUrl(repo);
      const workspace = await api<Workspace>(
        "",
        "POST",
        empty
          ? { initEmpty: true }
          : {
              repoUrl,
              ...(branch.trim() ? { repoBranch: branch.trim() } : {}),
            },
      );
      currentWorkspace.current = workspace.id;
      setSelected(workspace);
      setToken(null);
      setModal(false);
      setRepo("");
      setBranch("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }
  function home() {
    currentWorkspace.current = null;
    setToken(null);
    setSelected(null);
    setError(null);
    window.history.replaceState({}, "", "/ui/");
  }
  async function manage(workspace: Workspace, action: "stop" | "delete") {
    if (
      action === "delete" &&
      !window.confirm(
        `Delete ${workspace.name} and its sandbox? This removes its files.`,
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      await api(
        `/${workspace.id}${action === "stop" ? "/stop" : ""}`,
        action === "stop" ? "POST" : "DELETE",
        action === "stop" ? {} : undefined,
      );
      if (selected?.id === workspace.id) home();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }
  const active = workspaces.filter((w) => w.status === "ready").length;
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <button className="brand" onClick={home}>
          <span className="brand-mark">
            <Command size={20} />
          </span>{" "}
          cloud<span className="brand-light">agent</span>
          <span className="beta">BETA</span>
        </button>
        <div className="sidebar-label">YOUR SPACE</div>
        <button
          className={`nav-item ${!selected && !token ? "active" : ""}`}
          onClick={home}
        >
          <Box size={17} /> Workspaces{" "}
          <span className="nav-count">{workspaces.length}</span>
        </button>
        <button className="nav-item" onClick={() => setHelp(!help)}>
          <CircleHelp size={17} /> Getting started <ArrowUpRight size={14} />
        </button>
        <div className="sidebar-label recent-label">
          RECENT WORKSPACES{" "}
          <button
            aria-label="New workspace"
            onClick={() => {
              setModal(true);
              setError(null);
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="recent-list">
          {workspaces.slice(0, 5).map((w) => (
            <button
              key={w.id}
              className={`recent-item ${selected?.id === w.id ? "chosen" : ""}`}
              onClick={() => connect(w)}
              disabled={pending}
            >
              <span className={`status-dot ${w.status}`} />{" "}
              <span>{w.name}</span>
            </button>
          ))}
          {!loading && !workspaces.length && (
            <p className="sidebar-empty">Your next idea starts here.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="powered">
            <span className="status-dot ready" /> Powered by Daytona{" "}
            <ArrowUpRight size={13} />
          </div>
          <div className="guest">
            <div className="avatar">G</div>
            <div>
              Guest workspace<span>Saved in this browser</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {selected?.name ?? (token ? "Agent session" : "Overview")}
            </strong>
          </div>
          <span className="topbar-note">
            <span className="status-dot ready" /> A little space to build big
            things
          </span>
        </header>
        {token || selected ? (
          <div className="session-view">
            <div className="session-toolbar">
              <button className="text-button" onClick={home}>
                ← All workspaces
              </button>
              {selected?.status === "ready" && (
                <button
                  className="text-button"
                  disabled={pending}
                  onClick={() => manage(selected, "stop")}
                >
                  <Moon size={14} /> Stop sandbox
                </button>
              )}
            </div>
            {error && (
              <div role="alert" className="error-banner">
                {error}
              </div>
            )}
            {token ? (
              <AgentChat key={token} token={token} onSelect={selectChat} onResume={resumeFromToken} />
            ) : (
              <div className="provisioning">
                <div className="launch-icon">
                  {selected?.status === "error" ? (
                    <Terminal size={30} />
                  ) : (
                    <LoaderCircle size={30} className="animate-spin" />
                  )}
                </div>
                <span className="eyebrow">YOUR REMOTE WORKSPACE</span>
                <h1>
                  {selected?.status === "error"
                    ? "We couldn’t start this workspace"
                    : selected?.status === "sleeping"
                      ? "Waking up your workspace"
                      : selected?.status === "ready"
                        ? "Connecting your agent"
                        : "Making room for your next idea"}
                </h1>
                <p>
                  {selected?.errorMessage ??
                    `Setting up ${repoLabel(selected?.repoUrl ?? null)} in its own cloud sandbox.`}
                </p>
                <div className="setup-steps">
                  <span>
                    <Check size={15} /> Workspace requested
                  </span>
                  <span>
                    <span
                      className={`status-dot ${selected?.status ?? "creating"}`}
                    />{" "}
                    {selected?.status === "ready"
                      ? "Repository ready"
                      : "Create sandbox & clone repository"}
                  </span>
                  <span>
                    <Cpu size={15} /> Connect coding agent
                  </span>
                </div>
                {selected?.status === "ready" && (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setError(null);
                      void openChat(selected, true);
                    }}
                  >
                    Retry connection <RefreshCw size={15} />
                  </button>
                )}
                {selected?.status === "error" && (
                  <button
                    className="secondary-button"
                    disabled={pending}
                    onClick={() => manage(selected, "delete")}
                  >
                    Delete workspace
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <main className="overview">
            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR CLOUD, YOUR CANVAS</span>
                <h1>Let’s build something.</h1>
                <p>
                  A fresh environment. Your favorite repo. An agent ready to
                  help.
                </p>
              </div>
              <button
                className="secondary-button heading-button"
                onClick={() => {
                  setModal(true);
                  setError(null);
                }}
              >
                <Plus size={16} /> New workspace
              </button>
            </div>
            {error && !modal && (
              <div className="error-banner" role="alert">
                {error}
                <button
                  aria-label="Dismiss error"
                  onClick={() => setError(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {help && (
              <div className="help-panel">
                <strong>From repository to remote agent</strong>
                <p>
                  Paste a public GitHub repository below, or start with an empty
                  workspace. We create an isolated Daytona sandbox, clone your
                  code, and connect Pi. Ask the agent to explore, edit files, or
                  run commands. Stop a sandbox when you’re done and resume it
                  here later.
                </p>
                <p>
                  Guest workspaces are remembered in this browser for 30 days.
                  Keep your browser cookies to return to them.
                </p>
              </div>
            )}
            <section className="launch-card">
              <div className="launch-copy">
                <span className="pill">
                  <span className="status-dot ready" /> READY WHEN YOU ARE
                </span>
                <h2>
                  Your repo.
                  <br />A world of possibilities.
                </h2>
                <p>
                  Clone a GitHub repository into a secure cloud sandbox and
                  start building with your AI coding agent.
                </p>
                <div className="feature-line">
                  <span>
                    <Box size={14} /> Isolated sandbox
                  </span>
                  <span>
                    <Terminal size={14} /> Agent runs commands
                  </span>
                </div>
              </div>
              <div className="launch-form-wrap">
                <div className="form-heading">
                  <span className="github-icon">
                    <Github size={23} />
                  </span>
                  <div>
                    <h3>Start a workspace</h3>
                    <p>Bring your code. We’ll handle the setup.</p>
                  </div>
                </div>
                {workspaceForm(false)}
              </div>
            </section>
            <section className="workspaces-section">
              <div className="section-heading">
                <div>
                  <h2>
                    Your workspaces <span>{workspaces.length}</span>
                  </h2>
                  <p>Pick up where you left off.</p>
                </div>
                <span className="active-count">
                  <span className="status-dot ready" />
                  {active} active
                </span>
              </div>
              {loading ? (
                <div className="empty-state">
                  <LoaderCircle className="animate-spin" size={22} /> Loading
                  your workspaces…
                </div>
              ) : workspaces.length ? (
                <div className="workspace-grid">
                  {workspaces.map((w) => (
                    <article className="workspace-card" key={w.id}>
                      <div className="workspace-card-top">
                        <span className="repo-icon">
                          {w.repoUrl ? <Github size={20} /> : <Box size={20} />}
                        </span>
                        <span className={`workspace-status ${w.status}`}>
                          <span className={`status-dot ${w.status}`} />
                          {w.status === "sleeping"
                            ? "Stopped"
                            : w.status === "ready"
                              ? "Ready"
                              : w.status}
                        </span>
                      </div>
                      <h3>{w.name}</h3>
                      <p className="repo-name">{repoLabel(w.repoUrl)}</p>
                      <div className="workspace-meta">
                        <GitBranch size={13} />{" "}
                        {w.repoBranch ?? "default branch"}
                        <span>
                          Created{" "}
                          {new Date(w.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {w.errorMessage && (
                        <p className="card-error">{w.errorMessage}</p>
                      )}
                      <div className="workspace-actions">
                        <button
                          className="text-button"
                          disabled={pending || w.status === "stopping"}
                          onClick={() => connect(w)}
                        >
                          {w.status === "sleeping"
                            ? "Resume workspace"
                            : w.status === "ready"
                              ? "Open workspace"
                              : "View workspace"}
                          <ArrowUpRight size={16} />
                        </button>
                        <div>
                          {w.status === "ready" && (
                            <button
                              className="icon-button"
                              title="Stop sandbox"
                              aria-label={`Stop ${w.name}`}
                              disabled={pending}
                              onClick={() => manage(w, "stop")}
                            >
                              <Moon size={15} />
                            </button>
                          )}
                          <button
                            className="icon-button"
                            title="Delete workspace"
                            aria-label={`Delete ${w.name}`}
                            disabled={
                              pending ||
                              ["creating", "starting", "stopping"].includes(
                                w.status,
                              )
                            }
                            onClick={() => manage(w, "delete")}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                  <button
                    className="add-workspace"
                    onClick={() => {
                      setModal(true);
                      setError(null);
                    }}
                  >
                    <span>
                      <Plus size={22} />
                    </span>
                    <strong>Room for another idea</strong>
                    <p>Create a new workspace</p>
                  </button>
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Box size={25} />
                  </span>
                  <h3>A clean slate, a fresh start.</h3>
                  <p>
                    Your workspaces will appear here. Start by cloning a repo
                    above.
                  </p>
                </div>
              )}
            </section>
            <div className="how-it-works">
              <span className="eyebrow">FROM IDEA TO IN YOUR ELEMENT</span>
              <div className="steps">
                <div>
                  <span>01</span>
                  <strong>Bring a repository</strong>
                  <p>Any public GitHub repo. Or a blank canvas.</p>
                </div>
                <div>
                  <span>02</span>
                  <strong>Get your own sandbox</strong>
                  <p>A real cloud environment, just for this project.</p>
                </div>
                <div>
                  <span>03</span>
                  <strong>Build with your agent</strong>
                  <p>Explore, change, and run your code together.</p>
                </div>
              </div>
            </div>
            <footer className="page-footer">
              <span>Made for the things you haven’t built yet.</span>
              <span>
                Pi agent <span>×</span> Daytona sandboxes
              </span>
            </footer>
          </main>
        )}
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={() => !pending && setModal(false)}
        >
          <section
            className="workspace-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-workspace-heading"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !pending) setModal(false);
            }}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close"
              disabled={pending}
              onClick={() => setModal(false)}
            >
              <X size={20} />
            </button>
            <span className="github-icon">
              <Github size={25} />
            </span>
            <h2 id="new-workspace-heading">A new place to build.</h2>
            <p>Start with a repository or an empty workspace.</p>
            {workspaceForm(true)}
          </section>
        </div>
      )}
    </div>
  );
  function workspaceForm(inModal: boolean) {
    return (
      <form onSubmit={create} className="workspace-form">
        <div className="form-tabs">
          <button
            type="button"
            className={!empty ? "selected" : ""}
            onClick={() => setEmpty(false)}
          >
            <Github size={14} /> Clone repository
          </button>
          <button
            type="button"
            className={empty ? "selected" : ""}
            onClick={() => setEmpty(true)}
          >
            <Plus size={14} /> Start empty
          </button>
        </div>
        {!empty && (
          <>
            <label htmlFor={inModal ? "modal-repo" : "repo"}>
              GitHub repository
            </label>
            <div className="input-wrap">
              <Github size={16} />
              <input
                id={inModal ? "modal-repo" : "repo"}
                autoFocus={inModal}
                required
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="github.com/owner/repository"
                disabled={pending}
              />
            </div>
            <div className="branch-row">
              <GitBranch size={14} />
              <input
                aria-label="Repository branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Default branch (optional)"
                disabled={pending}
              />
              <span>Public repos</span>
            </div>
          </>
        )}
        {empty && (
          <div className="empty-form-copy">
            <Box size={24} />
            <p>
              A fresh sandbox with no repository.
              <br />
              Give your agent an idea and start from scratch.
            </p>
          </div>
        )}
        {inModal && error && (
          <p className="card-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          disabled={pending || (!empty && !repo.trim())}
        >
          {pending ? (
            <>
              <LoaderCircle size={16} className="animate-spin" /> Creating
              workspace…
            </>
          ) : (
            <>
              Create workspace <ArrowRight size={16} />
            </>
          )}
        </button>
        <p className="form-footnote">
          Your code stays in its own isolated environment.
        </p>
      </form>
    );
  }
}
