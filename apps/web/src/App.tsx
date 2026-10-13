import {
  useEffect,
  useState,
  useRef,
  useCallback,
  lazy,
  Suspense,
  type FormEvent,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  ArrowUp,
  Plus,
  Github,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Cpu,
  X,
  LoaderCircle,
  Moon,
  Sun,
  RefreshCw,
  Check,
  MoreHorizontal,
  User,
  Copy,
  Terminal,
  Box,
  Paperclip,
  Code,
  MessageSquare,
  List,
  Info,
  GitPullRequest,
  Sparkles,
  Shield,
  SlidersHorizontal,
  Play,
  Key,
  FileText,
  ExternalLink,
  Trash2,
  FolderPlus,
  ArrowDownUp,
  Filter,
  LayoutGrid,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  RotateCcw,
  Headphones,
  BookOpen,
  CircleAlert,
  Menu,
  Maximize2,
  Minimize2,
} from "lucide-react";
const Chat = lazy(() =>
  import("@/components/Chat").then((module) => ({ default: module.Chat })),
);
import { useChatSession } from "@/hooks/useChatSession";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { readTokenFromUrl, chatTargetFromToken } from "@/lib/session";
import { api, repoLabel, normalizeRepoUrl, type Workspace } from "@/lib/workspaces";
import { ConversationManager } from "@/components/ConversationManager";
import { AgentLogo } from "@/components/AgentLogo";
import type { CloudAgentId } from "@/components/CloudAgents";
import { LandingPage } from "@/components/LandingPage";
import { AuthModal } from "@/components/AuthModal";
import { DaytonaLogo } from "@/components/DaytonaLogo";
import { TokenFactoryLogo } from "@/components/TokenFactoryLogo";
import { ThinkingTrace } from "@/components/ThinkingTrace";
import { ToolCalls, type FileDiff, type ToolStep } from "@/components/ToolCalls";
import { RepoPanel, type RepoCommit, type RepoPanelTab, type TerminalEntry } from "@/components/RepoPanel";
import { Markdown } from "@/components/Markdown";
import { NotificationsPanel, type AppNotification } from "@/components/NotificationsPanel";
import { buildConversation, type TurnTiming } from "@/lib/conversation";
import { AccountPopover } from "@/components/AccountPopover";
import { WorkspaceIcon } from "@/components/WorkspaceIcon";
import {
  AutomationsIcon,
  SecurityIcon,
  ReviewIcon,
  WikiIcon,
  CustomizeIcon,
  RecentIcon,
  SidebarPanelIcon,
  BellIcon,
  SearchIcon,
  HelpCircleIcon,
  SettingsGearIcon,
} from "@/components/SidebarIcons";

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
  const [view, setView] = useState<"landing" | "app">(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "app") return "app";
    if (params.get("view") === "landing") return "landing";
    return readTokenFromUrl() ? "app" : "landing";
  });
  const [authModal, setAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [userEmail, setUserEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem("cloud_agent_user");
    } catch {
      return null;
    }
  });

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [empty, setEmpty] = useState(false);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filterQuery] = useState("");
  const [accountModal, setAccountModal] = useState(false);
  const [theme, setTheme] = useState<"light" | "zinc">(() => {
    try {
      return (
        (localStorage.getItem("cloud_agent_dashboard_theme") as "light" | "zinc") ??
        "zinc"
      );
    } catch {
      return "zinc";
    }
  });

  const [devinMode, setDevinMode] = useState<"agent" | "ask">("agent");
  const [centralPrompt, setCentralPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("Normal");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [reasoningMode, setReasoningMode] = useState<"auto" | "qa" | "plan">("auto");
  const [deepMode, setDeepMode] = useState(false);
  const [activeNav, setActiveNav] = useState<
    "workspaces" | "automations" | "security" | "review" | "wiki" | "customize"
  >("workspaces");
  const [sessionsPlusMenuOpen, setSessionsPlusMenuOpen] = useState(false);
  const [sessionsPropertiesMenuOpen, setSessionsPropertiesMenuOpen] = useState(false);
  const [sessionsMoreMenuOpen, setSessionsMoreMenuOpen] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [sessionsSort, setSessionsSort] = useState("Last updated");
  const [reviewTopUrl, setReviewTopUrl] = useState("");
  const [reviewMainUrl, setReviewMainUrl] = useState("");

  const handleReviewSubmit = (url: string) => {
    if (!url.trim()) return;
    setRepo(url.trim());
    setModal(true);
    setError(null);
  };

  const agentsList = [
    {
      id: "cloud" as CloudAgentId,
      name: "Cloud Agent",
      role: "Full-Stack Engineer",
      variant: "blue" as const,
      color: "#3b82f6",
      tagline: "Builds full-stack features, fixes regressions, and ships pull requests.",
    },
    {
      id: "spiky" as CloudAgentId,
      name: "System & Architecture",
      role: "Architecture & Planning",
      variant: "purple" as const,
      color: "#a855f7",
      tagline: "Designs scalable systems, refactors architectures, and reviews code.",
    },
    {
      id: "pill" as CloudAgentId,
      name: "Runner Bot",
      role: "CI/CD & DevOps",
      variant: "orange" as const,
      color: "#f97316",
      tagline: "Automates pipelines, tests suites, and heals builds in sandboxes.",
    },
    {
      id: "clover" as CloudAgentId,
      name: "Frontend Agent",
      role: "Web & UI Automation",
      variant: "lime" as const,
      color: "#10b981",
      tagline: "Automates web workflows, component refactoring, and UI responsiveness.",
    },
  ];
  const [selectedAgentId, setSelectedAgentId] = useState<CloudAgentId>("cloud");
  // Brief border sweep in the newly selected agent's colour on the prompt card.
  const [agentFlashKey, setAgentFlashKey] = useState(0);
  const agentFlashMounted = useRef(false);
  useEffect(() => {
    if (!agentFlashMounted.current) {
      agentFlashMounted.current = true;
      return;
    }
    setAgentFlashKey((k) => k + 1);
    const t = setTimeout(() => setAgentFlashKey(0), 2600);
    return () => clearTimeout(t);
  }, [selectedAgentId]);
  type ChatMessageItem = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    agentVariant?: "blue" | "purple" | "orange" | "lime";
    agentName?: string;
    agentRole?: string;
    status?: "thinking" | "booting" | "analyzing" | "streaming" | "ready";
    thinkingStep?: number;
    thinkingTitle?: string;
    thinkingSteps?: string[];
    thinkingStartedAt?: number;
    thinkingDurationMs?: number;
    completedAt?: number;
    toolSteps?: ToolStep[];
    toolDiffs?: FileDiff[];
    markdown?: boolean;
    fileName?: string;
    codeSnippet?: string;
  };
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [msgRatings, setMsgRatings] = useState<Record<string, "up" | "down">>({});
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [supportModal, setSupportModal] = useState(false);
  const [changelogModal, setChangelogModal] = useState(false);
  const [ghConnectModal, setGhConnectModal] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState<string | null>(null);
  const [repoPanelOpen, setRepoPanelOpen] = useState(true);
  const [repoPanelTab, setRepoPanelTab] = useState<RepoPanelTab>("changes");
  const [dockExpanded, setDockExpanded] = useState(false);

  // Once a prompt is sent (cleared), shrink the composer back to its resting size.
  useEffect(() => {
    if (centralPrompt) return;
    setDockExpanded(false);
    document.querySelectorAll<HTMLTextAreaElement>(".devin-prompt-textarea").forEach((el) => {
      el.style.height = "";
    });
  }, [centralPrompt]);
  // "Open PRs" nudge: keeps coming back until a GitHub repository is connected.
  // "Later" only snoozes it for a few minutes; nothing is persisted.
  const [ghPromptSnoozed, setGhPromptSnoozed] = useState(false);
  useEffect(() => {
    if (!ghPromptSnoozed) return;
    const t = setTimeout(() => setGhPromptSnoozed(false), 5 * 60 * 1000);
    return () => clearTimeout(t);
  }, [ghPromptSnoozed]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);




  useEffect(() => {
    document.body.style.backgroundColor = theme === "zinc" ? "#0c0c0e" : "#ffffff";
  }, [theme]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".devin-model-dropdown-wrap") && !target.closest(".devin-split-send-wrap") && !target.closest(".devin-sessions-actions") && !target.closest(".account-popover-container") && !target.closest(".devin-help-container")) {
        setAgentMenuOpen(false);
        setModelMenuOpen(false);
        setAttachMenuOpen(false);
        setModeMenuOpen(false);
        setSendMenuOpen(false);
        setSessionsPlusMenuOpen(false);
        setSessionsPropertiesMenuOpen(false);
        setSessionsMoreMenuOpen(false);
        setAccountPopoverOpen(false);
        setHelpMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleToggleTheme = (newTheme: "light" | "zinc") => {
    setTheme(newTheme);
    try {
      localStorage.setItem("cloud_agent_dashboard_theme", newTheme);
    } catch {}
  };

  const handleUpdateUser = (email: string | null) => {
    setUserEmail(email);
    try {
      if (email) {
        localStorage.setItem("cloud_agent_user", email);
      } else {
        localStorage.removeItem("cloud_agent_user");
      }
    } catch {}
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const railCollapsed = sidebarCollapsed && isDesktop;
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);
  // On phones/tablets the drawer closes once you've navigated somewhere.
  useEffect(() => {
    setSidebarOpen(false);
  }, [activeNav, token, selected?.id]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cloud_agent_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebarCollapsed]);

  const filteredWorkspaces = workspaces.filter((w) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      (w.repoUrl && w.repoUrl.toLowerCase().includes(q))
    );
  });
  const mounted = useRef(true);
  const opening = useRef<string | null>(null);
  const openGeneration = useRef(0);
  const currentWorkspace = useRef<string | null>(null);
  const selectChat = useCallback((value: string) => {
    setToken(value);
    window.history.replaceState({}, "", `/ui/?t=${encodeURIComponent(value)}`);
  }, []);

  // Real agent session (server-side Pi with Daytona-backed tools) for the open workspace.
  const live = useChatSession(token, { onGiveUp: () => void resumeFromToken(), onToken: selectChat });
  const [turnTimings, setTurnTimings] = useState<Map<string, TurnTiming>>(() => new Map());
  const pendingPrompt = useRef<string | null>(null);

  // Time each run from its prompt to run.end so the trace can say how long it thought.
  useEffect(() => {
    const lastUser = [...live.items].reverse().find((item) => item.kind === "user");
    if (!lastUser) return;
    setTurnTimings((previous) => {
      const timing = previous.get(lastUser.id);
      if (live.busy && !timing) {
        const next = new Map(previous);
        next.set(lastUser.id, {
          start: Date.now(),
          stamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        return next;
      }
      if (!live.busy && timing && timing.end === undefined) {
        const next = new Map(previous);
        next.set(lastUser.id, { ...timing, end: Date.now() });
        return next;
      }
      return previous;
    });
  }, [live.items, live.busy]);

  useEffect(() => {
    if (token && live.items.length) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [token, live.items]);

  // Notifications: workspace setup results and finished agent runs.
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPinned, setNotifPinned] = useState(false);
  const notify = useCallback((n: Omit<AppNotification, "id" | "at" | "read">) => {
    setNotifications((prev) => [{ ...n, id: crypto.randomUUID(), at: Date.now(), read: false }, ...prev].slice(0, 50));
  }, []);
  const lastStatuses = useRef<Map<string, Workspace["status"]> | null>(null);
  useEffect(() => {
    const previous = lastStatuses.current;
    const next = new Map(workspaces.map((w) => [w.id, w.status] as const));
    lastStatuses.current = next;
    // The first listing is the baseline; only later transitions are news.
    if (!previous) return;
    for (const w of workspaces) {
      const before = previous.get(w.id);
      if (before === w.status) continue;
      if (w.status === "ready" && before !== undefined) {
        notify({ kind: "workspace-ready", title: `${w.name} is ready`, body: repoLabel(w.repoUrl), workspaceId: w.id });
      } else if (w.status === "error") {
        notify({
          kind: "workspace-error",
          title: `${w.name} couldn't start`,
          body: w.errorMessage ?? "Something went wrong while setting up the sandbox.",
          workspaceId: w.id,
        });
      }
    }
  }, [workspaces, notify]);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !live.busy && token) {
      const lastPrompt = [...live.items].reverse().find((item) => item.kind === "user");
      const prompt = lastPrompt?.kind === "user" ? lastPrompt.text.trim() : "";
      notify({
        kind: "agent-done",
        title: "Cloud Agent finished a run",
        body: prompt ? (prompt.length > 90 ? `${prompt.slice(0, 90)}…` : prompt) : undefined,
        workspaceId: live.bootstrap?.environmentId,
      });
    }
    wasBusy.current = live.busy;
  }, [live.busy, live.items, live.bootstrap, token, notify]);

  // A prompt typed before the workspace finished connecting is sent once it can be.
  useEffect(() => {
    if (!token || live.conn !== "ready" || live.busy || !pendingPrompt.current) return;
    const text = pendingPrompt.current;
    pendingPrompt.current = null;
    live.sendPrompt(text);
  }, [token, live.conn, live.busy, live.sendPrompt]);

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
    refresh().catch(() => {});
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
    // Keep the setup screen in sync with every status, including failures, so a
    // workspace that couldn't start shows why instead of spinning forever.
    if (fresh && (fresh.status !== "error" || selected?.id === fresh.id)) {
      setSelected(fresh);
      if (fresh.status !== "error") currentWorkspace.current = fresh.id;
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
    setSidebarOpen(false);
    setError(null);
    currentWorkspace.current = workspace.id;
    pendingPrompt.current = null;
    setSelected(workspace);
    setToken(null);
    setChatMessages([]);
    setActiveNav("workspaces");
  }

  /** Create a Daytona workspace; the effects above connect the agent once it is ready. */
  async function startWorkspace(body: Record<string, unknown>) {
    setError(null);
    setPending(true);
    try {
      const workspace = await api<Workspace>("", "POST", body);
      await refresh();
      if (workspace.status === "error") {
        setError(workspace.errorMessage || "Could not start workspace: DAYTONA_API_KEY is required.");
        setSelected(null);
        currentWorkspace.current = null;
        pendingPrompt.current = null;
        return;
      }
      currentWorkspace.current = workspace.id;
      setSelected(workspace);
      setToken(null);
      setChatMessages([]);
      setActiveNav("workspaces");
    } catch (err) {
      setError((err as Error).message);
      setSelected(null);
      currentWorkspace.current = null;
      pendingPrompt.current = null;
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
      setModal(false);
      setRepo("");
      setBranch("");
      await refresh();
      if (workspace.status === "error") {
        setError(workspace.errorMessage || "Could not start workspace: DAYTONA_API_KEY is required.");
        setSelected(null);
        currentWorkspace.current = null;
        return;
      }
      currentWorkspace.current = workspace.id;
      setSelected(workspace);
      setToken(null);
    } catch (err) {
      setError((err as Error).message);
      setSelected(null);
      currentWorkspace.current = null;
    } finally {
      setPending(false);
    }
  }
  function handleCopyMsg(msgId: string, content: string) {
    void navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }

  function handleRateMsg(msgId: string, type: "up" | "down") {
    setMsgRatings((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? (undefined as unknown as "up") : type,
    }));
  }

  function handleReadAloud(msgId: string, content: string) {
    if (!("speechSynthesis" in window)) return;
    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  }

  function handleTryAgain() {
    const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
    void handlePromptSubmit(lastUser?.content || "hi");
  }

  function handleNewSession() {
    pendingPrompt.current = null;
    currentWorkspace.current = null;
    setConnectedRepo(null);
    setChatMessages([]);
    setCentralPrompt("");
    setSelected(null);
    setToken(null);
    setModal(false);
    setError(null);
    setActiveNav("workspaces");
    setView("app");
    window.history.replaceState({}, "", "/ui/?view=app");
  }

  async function handlePromptSubmit(overrideText?: unknown) {
    const promptText = (typeof overrideText === "string" ? overrideText : centralPrompt).trim();
    if (!promptText) {
      return;
    }
    if (token) {
      // Keep the text in the box until the agent can actually take it.
      if (live.conn !== "ready" || live.busy) return;
      live.sendPrompt(promptText);
      setCentralPrompt("");
      return;
    }
    // No agent yet: queue the prompt and start an empty workspace for it.
    pendingPrompt.current = promptText;
    setCentralPrompt("");
    if (selected) return;
    await startWorkspace({ initEmpty: true });
  }
  function home() {
    setSidebarOpen(false);
    pendingPrompt.current = null;
    setConnectedRepo(null);
    setChatMessages([]);
    currentWorkspace.current = null;
    setToken(null);
    setSelected(null);
    setError(null);
    window.history.replaceState({}, "", "/ui/?view=app");
  }
  function goToLanding() {
    setSidebarOpen(false);
    currentWorkspace.current = null;
    setToken(null);
    setSelected(null);
    setError(null);
    setView("landing");
    window.history.replaceState({}, "", "/ui/?view=landing");
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

  async function deleteAllSessions() {
    if (!workspaces.length) return;
    if (!window.confirm(`Delete all ${workspaces.length} sandboxes/sessions?`)) return;
    setPending(true);
    setError(null);
    try {
      for (const w of workspaces) {
        try {
          await api(`/${w.id}`, "DELETE");
        } catch {}
      }
      home();
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  // Per-screen document title, and keep everything but the landing page out of
  // search results (app screens are private; chat links carry access tokens).
  useEffect(() => {
    const pageTitles: Record<string, string> = {
      automations: "Automations",
      security: "Security & Governance",
      review: "Review",
      wiki: "Team Wiki & Runbooks",
      customize: "Customize",
    };
    const repoUrl = live.bootstrap?.repoUrl ?? selected?.repoUrl ?? null;
    let title = "New session · Cloud Agent";
    if (view === "landing") title = "Cloud Agent — Autonomous AI coding agent in secure cloud sandboxes";
    else if (token || selected) title = `${repoUrl ? repoLabel(repoUrl) : selected?.name ?? "Session"} · Cloud Agent`;
    else if (activeNav !== "workspaces") title = `${pageTitles[activeNav]} · Cloud Agent`;
    document.title = title;

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = view === "landing" && !token ? "index, follow, max-image-preview:large" : "noindex, nofollow";
  }, [view, token, selected, activeNav, live.bootstrap]);

  if (view === "landing") {
    return (
      <>
        <LandingPage
          onGetStarted={() => {
            if (userEmail) {
              setView("app");
              window.history.replaceState({}, "", "/ui/?view=app");
            } else {
              setAuthMode("signup");
              setAuthModal(true);
            }
          }}
          onLogin={() => {
            if (userEmail) {
              setView("app");
              window.history.replaceState({}, "", "/ui/?view=app");
            } else {
              setAuthMode("signin");
              setAuthModal(true);
            }
          }}
          onLaunchDemo={() => {
            setView("app");
            window.history.replaceState({}, "", "/ui/?view=app");
          }}
          userEmail={userEmail}
        />
        <AuthModal
          isOpen={authModal}
          onClose={() => setAuthModal(false)}
          initialMode={authMode}
          onSuccess={(email) => {
            if (email) {
              try {
                localStorage.setItem("cloud_agent_user", email);
              } catch {}
              setUserEmail(email);
            }
            setAuthModal(false);
            setView("app");
            window.history.replaceState({}, "", "/ui/?view=app");
          }}
        />
      </>
    );
  }

  const liveAgent = agentsList.find((a) => a.id === selectedAgentId) ?? agentsList[0];
  const conversationMessages: ChatMessageItem[] = token
    ? [
        ...buildConversation(live.items, {
          busy: live.busy,
          agent: { variant: liveAgent.variant, name: liveAgent.name, role: liveAgent.role },
          timings: turnTimings,
        }),
        ...(live.error && !live.busy
          ? [{
              id: "live-error",
              role: "assistant" as const,
              content: live.error ?? "",
              timestamp: "",
              agentVariant: liveAgent.variant,
              status: "ready" as const,
            }]
          : []),
      ]
    : chatMessages;
  const liveRepoUrl = live.bootstrap?.repoUrl ?? null;
  const activeRepo = token ? (liveRepoUrl ? repoLabel(liveRepoUrl) : null) : connectedRepo;

  return (
    <div className={`dashboard ${theme === "zinc" ? "theme-zinc" : ""} ${railCollapsed ? "sidebar-is-collapsed" : ""}`} data-theme={theme}>
      {/* Mobile Sidebar Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <NotificationsPanel
        open={notifOpen}
        pinned={notifPinned}
        items={notifications}
        onClose={() => setNotifOpen(false)}
        onTogglePin={() => setNotifPinned((p) => !p)}
        onMarkAllRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
        onClear={() => setNotifications([])}
        onOpenItem={(item) => {
          setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
          const target = item.workspaceId ? workspaces.find((w) => w.id === item.workspaceId) : undefined;
          if (target && target.id !== selected?.id) void connect(target);
          if (!notifPinned) setNotifOpen(false);
        }}
      />
      <aside className={`sidebar devin-sidebar ${sidebarOpen ? "open" : ""} ${railCollapsed ? "collapsed" : ""}`}>
        {/* Row 1: User / Team picker and header actions */}
        <div className="devin-sidebar-top-row">
          <div className="account-popover-container">
            <button
              type="button"
              className="devin-user-team-btn"
              onClick={(e) => {
                e.stopPropagation();
                setAccountPopoverOpen((prev) => !prev);
              }}
              title="Team & Account Settings"
            >
              <div className="devin-team-avatar">
                <User size={13} />
              </div>
              {!railCollapsed && (
                <>
                  <span className="devin-team-name">
                    {userEmail ? userEmail.split("@")[0] : "My Team"}
                  </span>
                  <ChevronDown size={12} className="devin-team-chevron" />
                </>
              )}
            </button>
            <AccountPopover
              isOpen={accountPopoverOpen}
              onClose={() => setAccountPopoverOpen(false)}
              userEmail={userEmail}
              onUpdateUser={handleUpdateUser}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              workspaceCount={workspaces.length}
            />
          </div>
          <div className="devin-header-tools">
            {!railCollapsed && (
              <>
                <button
                  type="button"
                  className="devin-tool-btn"
                  onClick={() => {
                    const el = document.querySelector<HTMLInputElement>(".sidebar-search-input");
                    el?.focus();
                  }}
                  title="Search"
                  aria-label="Search"
                >
                  <SearchIcon size={14} />
                </button>
                <button
                  type="button"
                  className={`devin-tool-btn devin-bell-btn ${notifOpen ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccountPopoverOpen(false);
                    setNotifOpen((open) => !open);
                  }}
                  title="Notifications"
                  aria-label={
                    notifications.some((n) => !n.read)
                      ? `Notifications (${notifications.filter((n) => !n.read).length} unread)`
                      : "Notifications"
                  }
                  aria-expanded={notifOpen}
                >
                  <BellIcon size={14} />
                  {notifications.some((n) => !n.read) && <span className="devin-bell-dot" aria-hidden="true" />}
                </button>
              </>
            )}
            <button
              type="button"
              className="sidebar-collapse-toggle desktop-only"
              onClick={toggleSidebarCollapsed}
              title={railCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <SidebarPanelIcon size={16} />
            </button>
            <button
              type="button"
              className="sidebar-close-btn mobile-only"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Row 2: + New session button */}
        <button
          type="button"
          className="devin-new-session-pill"
          onClick={handleNewSession}
          title="New session"
        >
          <Plus size={15} />
          {!railCollapsed && <span>New session</span>}
        </button>

        {/* Row 3: Navigation Menu with professional SVGs */}
        <nav className="devin-nav-list">
          <button
            type="button"
            className={`devin-nav-item ${activeNav === "workspaces" && !selected ? "active" : ""}`}
            onClick={() => {
              setActiveNav("workspaces");
              home();
            }}
            title="Workspaces"
          >
            <WorkspaceIcon size={16} />
            {!railCollapsed && <span>Workspaces</span>}
          </button>
          <button
            type="button"
            className={`devin-nav-item ${activeNav === "automations" ? "active" : ""}`}
            onClick={() => setActiveNav("automations")}
            title="Automations"
          >
            <AutomationsIcon size={16} />
            {!railCollapsed && <span>Automations</span>}
          </button>
          <button
            type="button"
            className={`devin-nav-item ${activeNav === "security" ? "active" : ""}`}
            onClick={() => setActiveNav("security")}
            title="Security"
          >
            <SecurityIcon size={16} />
            {!railCollapsed && <span>Security</span>}
          </button>
          <button
            type="button"
            className={`devin-nav-item ${activeNav === "review" ? "active" : ""}`}
            onClick={() => setActiveNav("review")}
            title="Review"
          >
            <ReviewIcon size={16} />
            {!railCollapsed && <span>Review</span>}
          </button>
          <button
            type="button"
            className={`devin-nav-item ${activeNav === "wiki" ? "active" : ""}`}
            onClick={() => setActiveNav("wiki")}
            title="Wiki"
          >
            <WikiIcon size={15} />
            {!railCollapsed && <span>Wiki</span>}
          </button>
          <button
            type="button"
            className={`devin-nav-item ${activeNav === "customize" ? "active" : ""}`}
            onClick={() => setActiveNav("customize")}
            title="Customize"
          >
            <CustomizeIcon size={15} />
            {!railCollapsed && <span>Customize</span>}
          </button>
        </nav>

        {/* Row 4: Sessions header and list with exact 3 dropdown menus and delete options */}
        <div className="devin-sessions-section">
          <div className="devin-sessions-header">
            {!railCollapsed ? (
              <>
                <span className="devin-sessions-title">Sessions</span>
                <div className="devin-sessions-actions">
                  {/* 1. Plus Icon Menu */}
                  <div className="devin-sessions-menu-wrap">
                    <button
                      type="button"
                      className={`devin-mini-icon-btn ${sessionsPlusMenuOpen ? "active" : ""}`}
                      onClick={() => {
                        setSessionsPlusMenuOpen((p) => !p);
                        setSessionsPropertiesMenuOpen(false);
                        setSessionsMoreMenuOpen(false);
                      }}
                      title="New session or folder"
                      aria-label="New session or folder"
                    >
                      <Plus size={14} />
                    </button>
                    {sessionsPlusMenuOpen && (
                      <div className="devin-session-popover-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="devin-popover-menu-row"
                          onClick={() => {
                            setSessionsPlusMenuOpen(false);
                            handleNewSession();
                          }}
                        >
                          <Plus size={14} />
                          <span>New session</span>
                        </button>
                        <button
                          type="button"
                          className="devin-popover-menu-row"
                          onClick={() => {
                            setSessionsPlusMenuOpen(false);
                            setModal(true);
                          }}
                        >
                          <FolderPlus size={14} />
                          <span>New folder</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Sliders/Tune Properties Menu matching user screenshot */}
                  <div className="devin-sessions-menu-wrap">
                    <button
                      type="button"
                      className={`devin-mini-icon-btn ${sessionsPropertiesMenuOpen ? "active" : ""}`}
                      onClick={() => {
                        setSessionsPropertiesMenuOpen((p) => !p);
                        setSessionsPlusMenuOpen(false);
                        setSessionsMoreMenuOpen(false);
                      }}
                      title="Properties & display options"
                      aria-label="Properties"
                    >
                      <SlidersHorizontal size={13} />
                    </button>
                    {sessionsPropertiesMenuOpen && (
                      <div className="devin-session-popover-dropdown devin-properties-menu" onClick={(e) => e.stopPropagation()}>
                        <div className="devin-popover-menu-title">Properties</div>
                        <button
                          type="button"
                          className="devin-popover-menu-row justify-between"
                          onClick={() => setSessionsSort(s => s === "Last updated" ? "Created date" : "Last updated")}
                        >
                          <div className="flex items-center gap-2">
                            <ArrowDownUp size={13} />
                            <span>Sort</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>{sessionsSort}</span>
                            <ChevronRight size={12} />
                          </div>
                        </button>
                        <button
                          type="button"
                          className="devin-popover-menu-row justify-between"
                          onClick={() => setSessionsPropertiesMenuOpen(false)}
                        >
                          <div className="flex items-center gap-2">
                            <Filter size={13} />
                            <span>Filter</span>
                          </div>
                          <ChevronRight size={12} className="text-slate-400" />
                        </button>
                        <button
                          type="button"
                          className="devin-popover-menu-row justify-between"
                          onClick={() => setSessionsPropertiesMenuOpen(false)}
                        >
                          <div className="flex items-center gap-2">
                            <LayoutGrid size={13} />
                            <span>Group</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>Folders</span>
                            <ChevronRight size={12} />
                          </div>
                        </button>
                        <div className="devin-popover-menu-sep" />
                        <button
                          type="button"
                          className="devin-popover-menu-row justify-between"
                          onClick={() => setSessionsPropertiesMenuOpen(false)}
                        >
                          <div className="flex items-center gap-2">
                            <Eye size={13} />
                            <span>Property visibility</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <span>5</span>
                            <ChevronRight size={12} />
                          </div>
                        </button>
                        <div
                          className="devin-popover-menu-row justify-between cursor-pointer"
                          onClick={() => setCompactView((c) => !c)}
                        >
                          <div className="flex items-center gap-2">
                            <SlidersHorizontal size={13} />
                            <span>Compact view</span>
                          </div>
                          <button
                            type="button"
                            className={`devin-toggle-switch ${compactView ? "on" : "off"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompactView((c) => !c);
                            }}
                            aria-checked={compactView}
                            role="switch"
                          >
                            <span className="devin-toggle-knob" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. More (...) Menu matching user screenshot */}
                  <div className="devin-sessions-menu-wrap">
                    <button
                      type="button"
                      className={`devin-mini-icon-btn ${sessionsMoreMenuOpen ? "active" : ""}`}
                      onClick={() => {
                        setSessionsMoreMenuOpen((p) => !p);
                        setSessionsPlusMenuOpen(false);
                        setSessionsPropertiesMenuOpen(false);
                      }}
                      title="More session actions"
                      aria-label="More session actions"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {sessionsMoreMenuOpen && (
                      <div className="devin-session-popover-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="devin-popover-menu-row"
                          onClick={() => {
                            setSessionsMoreMenuOpen(false);
                            setActiveNav("workspaces");
                            home();
                          }}
                        >
                          <List size={13} />
                          <span>View all sessions</span>
                        </button>
                        {workspaces.length > 0 && (
                          <button
                            type="button"
                            className="devin-popover-menu-row text-rose-400 hover:text-rose-300"
                            onClick={() => {
                              setSessionsMoreMenuOpen(false);
                              void deleteAllSessions();
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Delete all sessions ({workspaces.length})</span>
                          </button>
                        )}
                        <div className="devin-popover-menu-sep" />
                        <button
                          type="button"
                          className="devin-popover-menu-row justify-between"
                          onClick={() => {
                            setSessionsMoreMenuOpen(false);
                            setAccountModal(true);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <MoreHorizontal size={13} />
                            <span>More actions</span>
                          </div>
                          <ChevronRight size={12} className="text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="devin-mini-icon-btn"
                onClick={handleNewSession}
                title="New session"
              >
                <Plus size={15} />
              </button>
            )}
          </div>

          <div className="devin-sub-section">
            {!railCollapsed && (
              <div className="devin-recent-label">
                <RecentIcon size={14} />
                <span>Recent</span>
              </div>
            )}
            <div className={`devin-session-list ${compactView ? "compact-view" : ""}`}>
              {filteredWorkspaces.length ? (
                filteredWorkspaces.slice(0, 20).map((w) => (
                  <div
                    key={w.id}
                    className={`devin-session-row-wrap ${selected?.id === w.id ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className="devin-session-row-btn"
                      onClick={() => connect(w)}
                      disabled={pending}
                      title={w.name}
                    >
                      {!railCollapsed && <span className="devin-session-name">{w.name}</span>}
                    </button>
                    {!railCollapsed && (
                      <button
                        type="button"
                        className="devin-session-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          void manage(w, "delete");
                        }}
                        title={`Delete ${w.name}`}
                        aria-label={`Delete ${w.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                !railCollapsed && <div className="devin-no-sessions">No sessions</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Powered by Daytona + Footer tools */}
        <div className="devin-sidebar-bottom">
          <a
            href="https://daytona.io"
            target="_blank"
            rel="noopener noreferrer"
            className="devin-powered-daytona"
            title="Daytona - Standardized development environments"
          >
            {!railCollapsed ? (
              <>
                <span className="devin-powered-text">Powered by</span>
                <TokenFactoryLogo height={14} className="devin-powered-brand" />
              </>
            ) : (
              <TokenFactoryLogo variant="icon" width={18} height={18} />
            )}
          </a>
          <div className="devin-sidebar-footer-tools" style={{ position: "relative" }}>
            <div className="devin-help-container">
              <button
                type="button"
                className={`devin-footer-tool-btn ${helpMenuOpen ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setHelpMenuOpen((prev) => !prev);
                }}
                title="Help & Support"
                aria-label="Help & Support"
              >
                <HelpCircleIcon size={16} />
              </button>
              {helpMenuOpen && (
                <div className="devin-help-popover-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="devin-popover-item"
                    onClick={() => {
                      setHelpMenuOpen(false);
                      setSupportModal(true);
                    }}
                  >
                    <Headphones size={15} className="devin-popover-icon text-sky-400" />
                    <span>Contact support</span>
                  </button>
                  <button
                    type="button"
                    className="devin-popover-item"
                    onClick={() => {
                      setHelpMenuOpen(false);
                      window.open("https://daytona.io/docs", "_blank");
                    }}
                  >
                    <BookOpen size={15} className="devin-popover-icon text-emerald-400" />
                    <span>Documentation</span>
                  </button>
                  <button
                    type="button"
                    className="devin-popover-item"
                    onClick={() => {
                      setHelpMenuOpen(false);
                      setChangelogModal(true);
                    }}
                  >
                    <Sparkles size={15} className="devin-popover-icon text-amber-400" />
                    <span>Changelog</span>
                    <span className="devin-beta-pill" style={{ marginLeft: "auto", fontSize: "10px", padding: "1px 5px" }}>v0.9.4</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="devin-footer-tool-btn"
              onClick={() => setAccountModal(true)}
              title="Preferences & Theme"
            >
              <SettingsGearIcon size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <div className="mobile-appbar">
          <button
            type="button"
            className="mobile-appbar-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >
            <Menu size={19} />
          </button>
          <button type="button" className="mobile-appbar-brand" onClick={handleNewSession} aria-label="Cloud Agent home">
            <AgentLogo size={26} showShadow={false} />
            <span className="mobile-appbar-wordmark">
              cloud<span>agent</span>
            </span>
          </button>
          <div className="mobile-appbar-actions">
            <button
              type="button"
              className="mobile-appbar-btn devin-bell-btn"
              onClick={() => setNotifOpen((open) => !open)}
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <BellIcon size={16} />
              {notifications.some((n) => !n.read) && <span className="devin-bell-dot" aria-hidden="true" />}
            </button>
            <button type="button" className="mobile-appbar-btn" onClick={handleNewSession} aria-label="New session">
              <Plus size={18} />
            </button>
          </div>
        </div>
        {selected && !token ? (
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
              <div
                className={`setup-card ${selected?.status === "error" ? "is-error" : ""}`}
                role="status"
                aria-live="polite"
              >
                <div className="setup-card-body">
                <div className="setup-card-head">
                  <span className="setup-card-mascot">
                    <AgentLogo size={36} showShadow={false} isAnimated={selected?.status !== "error"} isWorried={selected?.status === "error"} />
                  </span>
                  <div className="setup-card-heading">
                    <h1 className="setup-card-title">
                      {selected?.status === "error"
                        ? "Workspace failed to start"
                        : selected?.status === "sleeping"
                          ? "Waking up your workspace"
                          : selected?.status === "ready"
                            ? "Connecting your agent"
                            : "Setting up your workspace"}
                    </h1>
                    <p className="setup-card-text">
                      {selected?.status === "error" ? (
                        "The cloud sandbox couldn’t be created."
                      ) : (
                        <>
                          Preparing <strong>{repoLabel(selected?.repoUrl ?? null)}</strong> in an isolated sandbox.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {selected?.status === "error" && (
                  <div className="setup-card-alert">
                    <CircleAlert size={14} />
                    <code>{selected.errorMessage ?? "Something went wrong while creating the sandbox."}</code>
                  </div>
                )}

                <ol className="setup-card-steps">
                  <li className="is-done">
                    <span className="setup-step-icon">
                      <Check size={13} strokeWidth={2.5} />
                    </span>
                    Workspace requested
                  </li>
                  <li
                    className={
                      selected?.status === "ready" ? "is-done" : selected?.status === "error" ? "is-failed" : "is-active"
                    }
                  >
                    <span className="setup-step-icon">
                      {selected?.status === "ready" ? (
                        <Check size={13} strokeWidth={2.5} />
                      ) : selected?.status === "error" ? (
                        <X size={13} strokeWidth={2.5} />
                      ) : (
                        <LoaderCircle size={13} className="animate-spin" />
                      )}
                    </span>
                    {selected?.status === "ready" ? "Repository ready" : "Create sandbox & clone repository"}
                  </li>
                  <li className={selected?.status === "ready" ? "is-active" : "is-pending"}>
                    <span className="setup-step-icon">
                      {selected?.status === "ready" ? <LoaderCircle size={13} className="animate-spin" /> : <Cpu size={13} />}
                    </span>
                    Connect coding agent
                  </li>
                </ol>
                </div>

                <div className={`setup-card-actions ${selected?.status === "error" ? "is-split" : ""}`}>
                  {selected?.status === "ready" && (
                    <button
                      type="button"
                      className="obsidian-glass-button setup-btn"
                      onClick={() => {
                        setError(null);
                        void openChat(selected, true);
                      }}
                    >
                      <RefreshCw size={14} /> Retry connection
                    </button>
                  )}
                  {selected?.status !== "ready" && selected?.status !== "error" && (
                    <>
                      <button type="button" className="setup-btn-ghost" onClick={home}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="obsidian-glass-button setup-btn"
                        onClick={() => void refresh().catch(() => {})}
                      >
                        <RefreshCw size={14} /> Refresh status
                      </button>
                    </>
                  )}
                  {selected?.status === "error" && (
                    <>
                      <button
                        type="button"
                        className="setup-btn-ghost setup-btn-danger"
                        disabled={pending}
                        onClick={() => manage(selected, "delete")}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                      <button type="button" className="obsidian-glass-button setup-btn" onClick={home}>
                        Back to workspaces
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          activeNav === "automations"
            ? renderAutomationsPage()
            : activeNav === "security"
              ? renderSecurityPage()
              : activeNav === "review"
                ? renderReviewPage()
                : activeNav === "wiki"
                  ? renderWikiPage()
                  : activeNav === "customize"
                    ? renderCustomizePage()
                    : renderWorkspacesPage()
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
            <h2 id="new-workspace-heading">Create Workspace</h2>
            <p>Deploy an isolated Daytona sandbox from GitHub or scratch.</p>
            {workspaceForm(true)}
          </section>
        </div>
      )}
      <AuthModal
        isOpen={authModal}
        onClose={() => setAuthModal(false)}
        initialMode={authMode}
        onSuccess={(email) => {
          handleUpdateUser(email || null);
          setAuthModal(false);
        }}
      />
      {/* 1. High-End Preferences & Settings Modal */}
      {accountModal && (
        <div className="modal-backdrop" onClick={() => setAccountModal(false)}>
          <section
            className="workspace-modal devin-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setAccountModal(false)}
            >
              <X size={18} />
            </button>
            <div className="devin-settings-header">
              <h2 id="account-modal-heading" className="devin-settings-title">Preferences & Settings</h2>
              <p className="devin-settings-subtitle">Configure theme, agent environment, and developer account</p>
            </div>

            {/* Section 1: Appearance / Theme Selector */}
            <div className="devin-settings-section">
              <span className="devin-settings-section-label">Interface Theme</span>
              <div className="devin-theme-picker-grid">
                <button
                  type="button"
                  className={`devin-theme-card ${theme === "zinc" ? "selected" : ""}`}
                  onClick={() => handleToggleTheme("zinc")}
                >
                  <div className="devin-theme-card-preview dark">
                    <div className="theme-preview-bar dark" />
                    <div className="theme-preview-box dark" />
                  </div>
                  <div className="devin-theme-card-info">
                    <div className="devin-theme-card-name">
                      <Moon size={14} />
                      <span>Dark Mode</span>
                    </div>
                    {theme === "zinc" && <Check size={14} className="devin-theme-card-check" />}
                  </div>
                </button>

                <button
                  type="button"
                  className={`devin-theme-card ${theme === "light" ? "selected" : ""}`}
                  onClick={() => handleToggleTheme("light")}
                >
                  <div className="devin-theme-card-preview light">
                    <div className="theme-preview-bar light" />
                    <div className="theme-preview-box light" />
                  </div>
                  <div className="devin-theme-card-info">
                    <div className="devin-theme-card-name">
                      <Sun size={14} />
                      <span>Light Mode</span>
                    </div>
                    {theme === "light" && <Check size={14} className="devin-theme-card-check" />}
                  </div>
                </button>
              </div>
            </div>

            {/* Section 2: Sandbox Environment */}
            <div className="devin-settings-section">
              <span className="devin-settings-section-label">Default Sandbox Environment</span>
              <div className="devin-settings-radio-group">
                <div className="devin-settings-radio-item active">
                  <span className="devin-settings-item-icon">
                    <DaytonaLogo variant="mark" width={16} height={16} />
                  </span>
                  <div className="devin-settings-item-text">
                    <div className="devin-settings-item-title">Daytona Cloud MicroVM</div>
                    <div className="devin-settings-item-desc">Hardware-isolated ephemeral environment (Default)</div>
                  </div>
                  <span className="devin-settings-badge">Active</span>
                </div>
              </div>
            </div>

            {/* Section 3: Developer Account */}
            <div className="devin-settings-section">
              <span className="devin-settings-section-label">Developer Account</span>
              <div className="devin-settings-account-row">
                <div className="devin-team-avatar devin-settings-avatar">
                  <User size={15} />
                </div>
                <div className="devin-settings-item-text">
                  <div className="devin-settings-item-title">
                    {userEmail || "Guest Developer"}
                  </div>
                  <div className="devin-settings-item-desc">
                    {userEmail ? "Connected to Cloud Agent account" : "Local guest workspace"}
                  </div>
                </div>
                {userEmail ? (
                  <button
                    type="button"
                    className="devin-settings-btn-danger"
                    onClick={() => {
                      handleUpdateUser(null);
                      setAccountModal(false);
                    }}
                  >
                    Sign out
                  </button>
                ) : (
                  <button
                    type="button"
                    className="devin-settings-btn-primary"
                    onClick={() => {
                      setAccountModal(false);
                      setAuthMode("signin");
                      setAuthModal(true);
                    }}
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. Contact Support Modal */}
      {supportModal && (
        <div className="modal-backdrop" onClick={() => setSupportModal(false)}>
          <section
            className="workspace-modal devin-settings-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setSupportModal(false)}
            >
              <X size={18} />
            </button>
            <div className="devin-settings-header">
              <h2 className="devin-settings-title">Contact Support</h2>
              <p className="devin-settings-subtitle">Need help with your Daytona workspaces or agents? We're here for you.</p>
            </div>
            <div className="devin-support-grid">
              <a
                href="mailto:support@daytona.io"
                className="devin-support-card"
                onClick={() => setSupportModal(false)}
              >
                <div className="devin-settings-item-text">
                  <div className="devin-settings-item-title">Email Support</div>
                  <div className="devin-settings-item-desc">support@daytona.io (Average reply &lt; 2h)</div>
                </div>
              </a>
              <a
                href="https://github.com/Studio1-OSS/cloud-agent/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="devin-support-card"
              >
                <div className="devin-settings-item-text">
                  <div className="devin-settings-item-title">GitHub Community</div>
                  <div className="devin-settings-item-desc">Open bug reports & feature discussions</div>
                </div>
              </a>
            </div>
          </section>
        </div>
      )}

      {/* 3. Changelog Modal */}
      {changelogModal && (
        <div className="modal-backdrop" onClick={() => setChangelogModal(false)}>
          <section
            className="workspace-modal devin-settings-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setChangelogModal(false)}
            >
              <X size={18} />
            </button>
            <div className="devin-settings-header">
              <h2 className="devin-settings-title">Changelog & Release Notes</h2>
              <p className="devin-settings-subtitle">Latest improvements to Cloud Agent powered by Daytona.</p>
            </div>
            <div className="devin-changelog-list">
              <div className="devin-changelog-item">
                <div className="flex items-center justify-between mb-1">
                  <span className="devin-settings-item-title">v0.9.4 Beta — Unified Docked Input & Multi-Persona</span>
                  <span className="text-[10px] font-mono text-zinc-500">Today</span>
                </div>
                <ul className="devin-changelog-notes">
                  <li>Unified borderless docked input bar matching Devin reference design.</li>
                  <li>Direct Cloud Agent persona selection available within docked chat.</li>
                  <li>Hardware-isolated Daytona microVM runner with realistic multi-phase latency.</li>
                  <li>Monochromatic Daytona branding with pure black light mode support.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Dedicated Connect GitHub Repository Modal */}
      {ghConnectModal && (
        <div className="modal-backdrop" onClick={() => setGhConnectModal(false)}>
          <section
            className="workspace-modal devin-gh-connect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gh-connect-heading"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setGhConnectModal(false)}
            >
              <X size={18} />
            </button>
            <div className="devin-gh-modal-header">
              <div className="devin-gh-modal-icon-badge">
                <Github size={24} />
              </div>
              <h2 id="gh-connect-heading" className="devin-gh-modal-title">
                Connect GitHub Repository
              </h2>
              <p className="devin-gh-modal-subtitle">
                Connect your codebase to let Cloud Agent review code, fix bugs, and open pull requests autonomously.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const targetRepo = repo.trim();
                if (!targetRepo) return;
                setGhConnectModal(false);
                void startWorkspace({
                  repoUrl: normalizeRepoUrl(targetRepo),
                  ...(branch.trim() ? { repoBranch: branch.trim() } : {}),
                });
              }}
              className="devin-gh-modal-form"
            >
              <label className="devin-gh-modal-label">Repository Name or URL</label>
              <div className="devin-gh-modal-input-wrap">
                <Github size={16} className="devin-gh-modal-input-icon" />
                <input
                  type="text"
                  autoFocus
                  required
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="e.g. Studio1-OSS/cloud-agent or facebook/react"
                  className="devin-gh-modal-input"
                />
              </div>

              <div className="devin-gh-quick-chips">
                <span className="devin-gh-quick-chips-label">Popular repositories:</span>
                <div className="devin-gh-chips-row">
                  {[
                    "Studio1-OSS/cloud-agent",
                    "facebook/react",
                    "vercel/next.js",
                    "tailwindlabs/tailwindcss",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className={`devin-gh-chip-btn ${repo === chip ? "selected" : ""}`}
                      onClick={() => setRepo(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="devin-gh-branch-row">
                <GitBranch size={15} className="text-zinc-400" />
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="Default branch (main)"
                  className="devin-gh-branch-input"
                />
              </div>

              <div className="devin-gh-modal-footer">
                <button
                  type="button"
                  className="devin-gh-modal-cancel"
                  onClick={() => setGhConnectModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="obsidian-glass-button devin-gh-modal-submit"
                >
                  Connect & Open Repository →
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* 4. Floating GitHub Onboarding Card matching user screenshot */}
      {!workspaces.some((w) => w.repoUrl && w.status !== "error") && !ghPromptSnoozed && !ghConnectModal && (
        <div className="devin-gh-toast">
          <div className="devin-gh-toast-body">
            <div className="devin-gh-toast-header">
              <Github size={18} className="devin-gh-toast-icon" />
              <span className="devin-gh-toast-title">Open PRs with Cloud Agent</span>
            </div>
            <p className="devin-gh-toast-desc">
              Connect your codebase to try Cloud Agent for free
            </p>
          </div>
          <div className="devin-gh-toast-actions">
            <button
              type="button"
              className="devin-gh-toast-later"
              onClick={() => setGhPromptSnoozed(true)}
            >
              Later
            </button>
            <button
              type="button"
              className="obsidian-glass-button devin-gh-toast-connect"
              onClick={() => {
                setGhConnectModal(true);
                setError(null);
              }}
            >
              Connect
            </button>
          </div>
        </div>
      )}
    </div>
  );

  function renderPromptCard(isDocked = false) {
    return (
      <div className={`devin-prompt-card liquid-glass-card ${isDocked ? "devin-docked-card" : ""} ${isDocked && dockExpanded ? "is-expanded" : ""}`}>
        {agentFlashKey > 0 && (
          <span
            key={agentFlashKey}
            className="agent-flash-ring"
            aria-hidden="true"
            style={{ "--agent-accent": agentsList.find((a) => a.id === selectedAgentId)?.color ?? "#3b82f6" } as CSSProperties}
          />
        )}
        {!isDocked && (
          <div className="devin-card-banner">
            <div className="devin-banner-left">
              <span className="devin-powered-text">Powered by</span>
              <TokenFactoryLogo height={14} className="devin-powered-brand" style={{ marginLeft: 4, flexShrink: 0 }} />
            </div>
            <a
              href="https://daytona.io"
              target="_blank"
              rel="noopener noreferrer"
              className="devin-banner-link"
            >
              Explore sandboxes
            </a>
          </div>
        )}
        <div className="devin-card-body">
          {isDocked && (
            <button
              type="button"
              className="devin-dock-expand-btn"
              onClick={() => setDockExpanded((v) => !v)}
              title={dockExpanded ? "Collapse editor" : "Expand editor"}
              aria-label={dockExpanded ? "Collapse editor" : "Expand editor"}
              aria-pressed={dockExpanded}
            >
              {dockExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}
          <textarea
            className="devin-prompt-textarea"
            placeholder={`Ask ${agentsList.find((a) => a.id === selectedAgentId)?.name || "Cloud Agent"} to build features, fix bugs, or work on your code`}
            value={centralPrompt}
            onChange={(e) => {
              setCentralPrompt(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, isDocked && dockExpanded ? 420 : 180)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handlePromptSubmit();
              }
            }}
            rows={isDocked ? 1 : 3}
          />
          <div className="devin-card-footer">
            <div className="devin-footer-left">
              {/* 1. Plus Icon (Attachment Popover) */}
              <div className="devin-model-dropdown-wrap">
                <button
                  type="button"
                  className={`devin-tool-btn ${attachMenuOpen ? "active" : ""}`}
                  title="Attach files or repositories"
                  aria-label="Attach files or repositories"
                  onClick={() => {
                    setAttachMenuOpen((p) => !p);
                    setModeMenuOpen(false);
                    setAgentMenuOpen(false);
                    setModelMenuOpen(false);
                    setSendMenuOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                {attachMenuOpen && (
                  <div className="devin-small-popover-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="devin-popover-item"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.click();
                      }}
                    >
                      <Paperclip size={15} className="devin-popover-icon" />
                      <span>Upload image</span>
                    </button>
                    <button
                      type="button"
                      className="devin-popover-item"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        setGhConnectModal(true);
                        setError(null);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="devin-popover-icon text-sky-400">
                        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                        <circle cx="12" cy="13" r="2" />
                        <path d="M12 15v3" />
                      </svg>
                      <span>Repositories</span>
                    </button>
                    <button
                      type="button"
                      className="devin-popover-item"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        setModal(true);
                        setError(null);
                      }}
                    >
                      <Code size={15} className="devin-popover-icon" />
                      <span>Files</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. GitHub Repo Icon */}
              <button
                type="button"
                className="devin-tool-btn"
                title="Connect GitHub repository"
                aria-label="Connect GitHub repository"
                onClick={() => {
                  setModal(true);
                  setError(null);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6" cy="6" r="2.5" />
                  <circle cx="18" cy="6" r="2.5" />
                  <circle cx="6" cy="18" r="2.5" />
                  <path d="M6 8.5v7" />
                  <path d="M18 8.5v5.5a4 4 0 0 1-4 4H8.5" />
                </svg>
              </button>

              {/* 3. Sliders/Tune Icon ⚲ (Reasoning Mode popover) */}
              <div className="devin-model-dropdown-wrap">
                <button
                  type="button"
                  className={`devin-tool-btn ${modeMenuOpen ? "active" : ""}`}
                  title="Reasoning mode & settings"
                  aria-label="Reasoning mode & settings"
                  onClick={() => {
                    setModeMenuOpen((p) => !p);
                    setAttachMenuOpen(false);
                    setAgentMenuOpen(false);
                    setModelMenuOpen(false);
                    setSendMenuOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="4" x2="8" y2="20" />
                    <circle cx="8" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <line x1="16" y1="4" x2="16" y2="20" />
                    <circle cx="16" cy="15" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </button>
                {modeMenuOpen && (
                  <div className="devin-mode-popover-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="devin-mode-items-list">
                      <button
                        type="button"
                        className={`devin-mode-item ${reasoningMode === "auto" ? "selected" : ""}`}
                        onClick={() => {
                          setReasoningMode("auto");
                          setModeMenuOpen(false);
                        }}
                      >
                        <div className="devin-mode-item-icon">
                          <Sparkles size={15} />
                        </div>
                        <div className="devin-mode-item-meta">
                          <span className="devin-mode-item-title">Auto</span>
                          <span className="devin-mode-item-desc">Automatically select mode</span>
                        </div>
                        {reasoningMode === "auto" && <Check size={14} className="devin-mode-check" />}
                      </button>
                      <button
                        type="button"
                        className={`devin-mode-item ${reasoningMode === "qa" ? "selected" : ""}`}
                        onClick={() => {
                          setReasoningMode("qa");
                          setModeMenuOpen(false);
                        }}
                      >
                        <div className="devin-mode-item-icon">
                          <MessageSquare size={15} />
                        </div>
                        <div className="devin-mode-item-meta">
                          <span className="devin-mode-item-title">Q&A</span>
                          <span className="devin-mode-item-desc">Answer questions about codebase</span>
                        </div>
                        {reasoningMode === "qa" && <Check size={14} className="devin-mode-check" />}
                      </button>
                      <button
                        type="button"
                        className={`devin-mode-item ${reasoningMode === "plan" ? "selected" : ""}`}
                        onClick={() => {
                          setReasoningMode("plan");
                          setModeMenuOpen(false);
                        }}
                      >
                        <div className="devin-mode-item-icon">
                          <List size={15} />
                        </div>
                        <div className="devin-mode-item-meta">
                          <span className="devin-mode-item-title">Plan</span>
                          <span className="devin-mode-item-desc">Create actionable plans for tasks</span>
                        </div>
                        {reasoningMode === "plan" && <Check size={14} className="devin-mode-check" />}
                      </button>
                    </div>

                    <div className="devin-mode-divider" />

                    <div className="devin-deep-mode-row" onClick={() => setDeepMode(!deepMode)}>
                      <div className="devin-deep-mode-left">
                        <span className="devin-deep-mode-label">Deep mode</span>
                        <span
                          className="devin-deep-mode-info-icon"
                          title="Deep mode performs exhaustive reasoning"
                        >
                          <Info size={13} />
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`devin-toggle-switch ${deepMode ? "on" : "off"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeepMode(!deepMode);
                        }}
                        aria-checked={deepMode}
                        role="switch"
                      >
                        <span className="devin-toggle-knob" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

            <div className="devin-footer-right">

              {/* Agent Selector Dropdown (home mode) */}
              <div className="devin-model-dropdown-wrap">
                <button
                  type="button"
                  className="devin-model-btn devin-agent-btn"
                  onClick={() => {
                    setAgentMenuOpen((prev) => !prev);
                    setModelMenuOpen(false);
                    setAttachMenuOpen(false);
                    setModeMenuOpen(false);
                    setSendMenuOpen(false);
                  }}
                  title="Select Cloud Agent Persona"
                >
                  <AgentLogo size={20} variant={agentsList.find(a => a.id === selectedAgentId)?.variant ?? "blue"} showShadow={false} />
                  <span className="devin-agent-btn-name">{agentsList.find(a => a.id === selectedAgentId)?.name}</span>
                  <ChevronDown size={12} className={`devin-chevron-icon ${agentMenuOpen ? "open" : ""}`} />
                </button>
                {agentMenuOpen && (
                  <div className="devin-agent-popover-menu" onClick={(e) => e.stopPropagation()}>
                    <div className="agent-popover-list">
                      {agentsList.map((ag) => {
                        const isSelected = selectedAgentId === ag.id;
                        return (
                          <button
                            key={ag.id}
                            type="button"
                            className={`agent-popover-item ${isSelected ? "selected" : ""}`}
                            onClick={() => {
                              setSelectedAgentId(ag.id);
                              setAgentMenuOpen(false);
                            }}
                          >
                            <div className="agent-popover-item-avatar">
                              <AgentLogo size={36} variant={ag.variant} showShadow={false} />
                            </div>
                            <div className="agent-popover-item-info">
                              <span className="agent-popover-item-name">{ag.name}</span>
                              <span className="agent-popover-item-role">{ag.role}</span>
                            </div>
                            {isSelected && (
                              <div className="agent-popover-check-wrap" style={{ color: ag.color }}>
                                <Check size={16} strokeWidth={2.5} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Model Selector Dropdown (home mode) */}
              <div className="devin-model-dropdown-wrap">
                <button
                  type="button"
                  className="devin-model-btn"
                  onClick={() => {
                    setModelMenuOpen((prev) => !prev);
                    setAgentMenuOpen(false);
                    setSendMenuOpen(false);
                  }}
                  title="Model & Sandbox Configuration"
                >
                  <span>{selectedModel}</span>
                  <ChevronDown size={12} />
                </button>
                {modelMenuOpen && (
                  <div className="devin-model-menu">
                    <button
                      type="button"
                      className={selectedModel === "Normal" ? "selected" : ""}
                      onClick={() => {
                        setSelectedModel("Normal");
                        setModelMenuOpen(false);
                      }}
                    >
                      Normal (Daytona VM)
                    </button>
                    <button
                      type="button"
                      className={selectedModel === "Fusion" ? "selected" : ""}
                      onClick={() => {
                        setSelectedModel("Fusion");
                        setModelMenuOpen(false);
                      }}
                    >
                      Fusion (Multi-Core)
                    </button>
                    <button
                      type="button"
                      className={selectedModel === "Ultra" ? "selected" : ""}
                      onClick={() => {
                        setSelectedModel("Ultra");
                        setModelMenuOpen(false);
                      }}
                    >
                      Ultra (GPU Sandbox)
                    </button>
                  </div>
                )}
              </div>

              {/* Professional Split Send Button matching user screenshot */}
              <div className="devin-split-send-wrap">
                <div className={`devin-split-send-pill ${centralPrompt.trim() ? "can-send" : "empty"}`}>
                  <button
                    type="button"
                    className="devin-split-send-main"
                    onClick={() => {
                      if (centralPrompt.trim()) {
                        void handlePromptSubmit();
                      }
                    }}
                    disabled={!centralPrompt.trim() || pending}
                    title={centralPrompt.trim() ? "Start session (Enter)" : "Enter a prompt"}
                    aria-label="Send prompt"
                  >
                    <ArrowUp size={15} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    className={`devin-split-send-caret-btn ${sendMenuOpen ? "active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSendMenuOpen((p) => !p);
                    }}
                    title="Session start options"
                  >
                    <ChevronDown size={12} strokeWidth={2.5} />
                  </button>
                </div>

                {sendMenuOpen && (
                  <div className="devin-send-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="devin-send-menu-item"
                      onClick={() => {
                        setSendMenuOpen(false);
                        handlePromptSubmit();
                      }}
                    >
                      <span>Start session in background</span>
                      <span className="devin-send-menu-shortcut">Ctrl ↵</span>
                    </button>
                    <div className="devin-send-menu-divider" />
                    <button
                      type="button"
                      className="devin-send-menu-item"
                      onClick={() => {
                        setSendMenuOpen(false);
                        handlePromptSubmit();
                      }}
                    >
                      <span>Start & send in Slack</span>
                      <ChevronRight size={13} className="text-slate-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderConversationMode() {
    const chatMessages = conversationMessages;
    const connectedRepo = activeRepo;
    const firstPrompt = chatMessages.find((m) => m.role === "user")?.content.trim() ?? "";
    const sessionTitle = firstPrompt ? (firstPrompt.length > 64 ? `${firstPrompt.slice(0, 64)}…` : firstPrompt) : "New session";
    const branchSlug = firstPrompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "session";
    const commits: RepoCommit[] = chatMessages
      .filter((m) => m.toolDiffs?.length)
      .map((m) => ({
        id: Array.from(m.id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, "0"),
        message: `Add ${m.toolDiffs!.map((d) => d.file).join(", ")}`,
        files: m.toolDiffs!,
        time: m.timestamp,
      }));
    const terminal: TerminalEntry[] = chatMessages.flatMap((m) =>
      (m.toolSteps ?? [])
        .filter((step) => step.icon === "run")
        .map((step) => ({ command: step.chip, output: step.detail.map((d) => d.text) })),
    );
    const showPanel = !!connectedRepo && repoPanelOpen;

    return (
      <div className={`devin-conversation-layout ${showPanel ? "has-repo-panel" : ""}`}>
        <div className="devin-conversation-main">
        {connectedRepo && (
          <div className="devin-conversation-header">
            <div className="devin-connected-repo-pill">
              <Github size={14} className="text-zinc-400" />
              <span className="font-semibold text-zinc-100">{connectedRepo}</span>
              <span className="devin-repo-branch-pill">main</span>
              <span className="devin-repo-status-dot">●</span>
              <span className="devin-repo-status-text">Synced</span>
            </div>
            <div className="flex items-center gap-2">
              {!repoPanelOpen && (
                <button
                  type="button"
                  className="devin-header-action-btn"
                  onClick={() => setRepoPanelOpen(true)}
                  title="Show workspace panel"
                >
                  <GitBranch size={13} />
                  <span>Changes</span>
                </button>
              )}
              <button
                type="button"
                className="devin-header-action-btn"
                onClick={() => setGhConnectModal(true)}
                title="Switch repository"
              >
                <GitBranch size={13} />
                <span>Switch Repo</span>
              </button>
              <button
                type="button"
                className="devin-header-action-btn text-zinc-400 hover:text-red-400"
                onClick={home}
                title="Disconnect repository"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
        <div className="devin-conversation-stream">
          <div className="devin-conversation-stream-inner">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`devin-chat-item ${msg.role}`}>
                {msg.role === "user" ? (
                  <div className="devin-user-bubble">
                    <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                  </div>
                ) : (
                  <div className="devin-asst-bubble">
                    <div className={`devin-asst-avatar ${msg.status === "thinking" ? "thinking" : ""}`}>
                      <AgentLogo size={28} variant={msg.agentVariant ?? "blue"} showShadow={false} isAnimated={true} />
                      {msg.status === "thinking" && (
                        <span className="devin-think-dots" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      )}
                    </div>
                    <div className="devin-asst-content">
                      {(msg.thinkingSteps?.length || (msg.status && msg.status !== "ready")) && (
                        <ThinkingTrace
                          working={!!msg.status && msg.status !== "ready"}
                          steps={msg.thinkingSteps?.length ? msg.thinkingSteps : [msg.thinkingTitle || "Autonomous reasoning"]}
                          durationMs={msg.thinkingDurationMs}
                        />
                      )}
                      {msg.status && msg.status !== "ready" ? null : (
                        <>
                          {msg.markdown ? (
                            <div className="devin-asst-message-text devin-asst-markdown">
                              <Markdown text={msg.content} />
                            </div>
                          ) : (
                            <div className="devin-asst-message-text">{msg.content}</div>
                          )}
                          {msg.toolSteps && msg.toolDiffs && (
                            <ToolCalls
                              steps={msg.toolSteps}
                              diffs={msg.toolDiffs}
                              animate={Date.now() - (msg.completedAt ?? 0) < 4000}
                              onViewChanges={
                                connectedRepo
                                  ? () => {
                                      setRepoPanelOpen(true);
                                      setRepoPanelTab("changes");
                                    }
                                  : undefined
                              }
                            />
                          )}
                          {msg.codeSnippet && !connectedRepo && (
                            <div className="stream-code-block mt-2">
                              <div className="stream-code-header">
                                <div className="flex items-center gap-2">
                                  <Terminal size={13} className="text-zinc-400" />
                                  <span>{msg.fileName || "solution.ts"}</span>
                                </div>
                                <button
                                  type="button"
                                  className="stream-copy-btn"
                                  onClick={() => {
                                    if (msg.codeSnippet) void navigator.clipboard.writeText(msg.codeSnippet);
                                  }}
                                >
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </button>
                              </div>
                              <pre className="stream-code-pre">
                                <code>{msg.codeSnippet}</code>
                              </pre>
                            </div>
                          )}
                          <div className="devin-msg-actions-bar">
                            <button
                              type="button"
                              className="devin-msg-action-btn"
                              title={copiedMsgId === msg.id ? "Copied" : "Copy response"}
                              aria-label="Copy response"
                              onClick={() => handleCopyMsg(msg.id, msg.content)}
                            >
                              {copiedMsgId === msg.id ? (
                                <Check size={15} strokeWidth={2} />
                              ) : (
                                <Copy size={15} strokeWidth={1.75} />
                              )}
                            </button>
                            <button
                              type="button"
                              className={`devin-msg-action-btn ${msgRatings[msg.id] === "up" ? "active" : ""}`}
                              title="Helpful"
                              aria-label="Helpful"
                              aria-pressed={msgRatings[msg.id] === "up"}
                              onClick={() => handleRateMsg(msg.id, "up")}
                            >
                              <ThumbsUp size={15} strokeWidth={1.75} fill={msgRatings[msg.id] === "up" ? "currentColor" : "none"} />
                            </button>
                            <button
                              type="button"
                              className={`devin-msg-action-btn ${msgRatings[msg.id] === "down" ? "active" : ""}`}
                              title="Not helpful"
                              aria-label="Not helpful"
                              aria-pressed={msgRatings[msg.id] === "down"}
                              onClick={() => handleRateMsg(msg.id, "down")}
                            >
                              <ThumbsDown size={15} strokeWidth={1.75} fill={msgRatings[msg.id] === "down" ? "currentColor" : "none"} />
                            </button>
                            <button
                              type="button"
                              className={`devin-msg-action-btn ${speakingMsgId === msg.id ? "active" : ""}`}
                              title={speakingMsgId === msg.id ? "Stop reading" : "Read aloud"}
                              onClick={() => handleReadAloud(msg.id, msg.content)}
                            >
                              <Volume2 size={15} strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              className="devin-msg-action-btn"
                              title="Try again"
                              aria-label="Try again"
                              onClick={() => handleTryAgain()}
                            >
                              <RotateCcw size={15} strokeWidth={1.75} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Sliding docked prompt card at bottom */}
        <div className="devin-docked-bottom-bar">
          <div className="devin-docked-bottom-container">
            {renderPromptCard(true)}
            <div className="devin-docked-disclaimer">
              Cloud Agent can make mistakes. Verify important info.
            </div>
          </div>
        </div>
        </div>

        {showPanel && connectedRepo && (
          <RepoPanel
            repo={connectedRepo}
            branch={`agent/${branchSlug}`}
            title={sessionTitle}
            commits={commits}
            terminal={terminal}
            tab={repoPanelTab}
            onTabChange={setRepoPanelTab}
            onClose={() => setRepoPanelOpen(false)}
          />
        )}
      </div>
    );
  }

  function renderWorkspacesPage() {
    if (token || conversationMessages.length > 0) {
      return renderConversationMode();
    }
    return (
      <main className="devin-canvas">
        {error && !modal && (
          <div className="error-banner" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        <div className="devin-center-stage">
          {/* Brand & Mode Switcher */}
          <div className="devin-brand-row">
            <div
              className="devin-brand-identity"
              onClick={goToLanding}
              style={{ cursor: "pointer" }}
              title="Return to Cloud Agent Overview"
            >
              <AgentLogo size={36} className="devin-logo-mark" variant={agentsList.find(a => a.id === selectedAgentId)?.variant ?? "blue"} />
              <span className="devin-brand-heading">
                cloud<span className="devin-brand-light">agent</span>
              </span>
              <span className="devin-beta-pill">Beta</span>
            </div>
            <div className="devin-mode-switcher">
              <button
                type="button"
                className={`devin-mode-pill ${devinMode === "agent" ? "active" : ""}`}
                onClick={() => setDevinMode("agent")}
              >
                Agent
              </button>
              <button
                type="button"
                className={`devin-mode-pill ${devinMode === "ask" ? "active" : ""}`}
                onClick={() => setDevinMode("ask")}
              >
                Ask
              </button>
            </div>
          </div>

          {/* Liquid Glass Prompt Card */}
          {renderPromptCard(false)}
        </div>
      </main>
    );
  }

  function renderAutomationsPage() {
    return (
      <div className="devin-page-view">
        <div className="devin-page-header">
          <div>
            <h1 className="devin-page-title">Automations</h1>
            <p className="devin-page-subtitle">Schedule autonomous background agents, PR auto-reviewers, and continuous CI/CD healing.</p>
          </div>
          <button
            type="button"
            className="obsidian-glass-button devin-glass-link"
            onClick={() => {
              setModal(true);
              setError(null);
            }}
          >
            <Plus size={14} /> New Automation
          </button>
        </div>

        <div className="devin-cards-grid">
          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge active">● Active</span>
              <span className="text-xs text-slate-400 font-mono">cron: 0 2 * * *</span>
            </div>
            <h3 className="card-title">Nightly Test Suite & Self-Healing</h3>
            <p className="card-description">Runs end-to-end regression suites in an isolated Daytona microVM, diagnoses failures, and drafts auto-fix PRs.</p>
            <div className="card-footer-row">
              <span>Last run 42m ago • 0 regressions</span>
              <button type="button" className="card-btn" onClick={() => void handlePromptSubmit()}>
                <Play size={12} /> Run now
              </button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge scheduled">Webhook</span>
              <span className="text-xs text-slate-400 font-mono">pr.opened</span>
            </div>
            <h3 className="card-title">PR Auto-Review & Security Scan</h3>
            <p className="card-description">Triggered automatically when a PR is created or updated. Performs architecture checks and flags secrets.</p>
            <div className="card-footer-row">
              <span>All repositories active</span>
              <button type="button" className="card-btn" onClick={() => setActiveNav("review")}>
                Configure PRs →
              </button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge verified">Weekly</span>
              <span className="text-xs text-slate-400 font-mono">Monday 09:00</span>
            </div>
            <h3 className="card-title">Dependency Vulnerability Patcher</h3>
            <p className="card-description">Audits npm, pnpm, and pip dependencies for CVE advisories and generates verified bump branches.</p>
            <div className="card-footer-row">
              <span>Next run in 2 days</span>
              <button type="button" className="card-btn" onClick={() => void handlePromptSubmit()}>
                <Play size={12} /> Trigger check
              </button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge active">● Active</span>
              <span className="text-xs text-slate-400 font-mono">git.push</span>
            </div>
            <h3 className="card-title">Codebase AST & Knowledge Indexer</h3>
            <p className="card-description">Incrementally parses TypeScript/Python ASTs, builds symbol maps, and updates agent memory stores.</p>
            <div className="card-footer-row">
              <span>Indexed 1,420 files</span>
              <button type="button" className="card-btn" onClick={() => void handlePromptSubmit()}>
                Re-index AST
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSecurityPage() {
    return (
      <div className="devin-page-view">
        <div className="devin-page-header">
          <div>
            <h1 className="devin-page-title">Security & Governance</h1>
            <p className="devin-page-subtitle">Hardware-isolated Daytona microVMs, credential vault, and autonomous agent guardrails.</p>
          </div>
        </div>

        <div className="devin-cards-grid">
          <div className="devin-pro-card">
            <div className="card-top-row">
              <Shield size={18} className="text-zinc-900 dark:text-zinc-100" />
              <span className="card-badge">Hardware Level</span>
            </div>
            <h3 className="card-title">MicroVM Hypervisor Isolation</h3>
            <p className="card-description">Each agent session runs inside an ephemeral, dedicated microVM with separate kernel memory and storage isolation.</p>
            <div className="card-footer-row">
              <span>Powered by Daytona MicroVMs</span>
              <span className="text-zinc-600 dark:text-zinc-400 font-mono text-xs">100% Isolated</span>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <Key size={18} className="text-zinc-900 dark:text-zinc-100" />
              <span className="card-badge">Encrypted AES-256</span>
            </div>
            <h3 className="card-title">Secrets & Key Vault</h3>
            <p className="card-description">API credentials (DAYTONA_API_KEY, Git OAuth Tokens) are injected directly into microVM memory and never persisted.</p>
            <div className="card-footer-row">
              <span>Environment keys secured</span>
              <button type="button" className="card-btn" onClick={() => setAccountModal(true)}>
                Manage keys →
              </button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <SlidersHorizontal size={18} className="text-zinc-900 dark:text-zinc-100" />
              <span className="card-badge">Policy Active</span>
            </div>
            <h3 className="card-title">Agent Execution Boundaries</h3>
            <p className="card-description">Autonomous agents are restricted by strict file-system read/write barriers and outbound network filtering.</p>
            <div className="card-footer-row">
              <span>Egress: Restricted to Git & npm</span>
              <button type="button" className="card-btn" onClick={() => setAccountModal(true)}>
                View policy →
              </button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <FileText size={18} className="text-zinc-900 dark:text-zinc-100" />
              <span className="card-badge">Audit Log</span>
            </div>
            <h3 className="card-title">Real-Time Audit Stream</h3>
            <p className="card-description">Every command, file write, and bash process spawned by the agent is cryptographically timestamped and logged.</p>
            <div className="card-footer-row">
              <span>Audit retention: 90 days</span>
              <span className="text-zinc-600 dark:text-zinc-400 text-xs">Compliance ready</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderReviewPage() {
    return (
      <div className="devin-review-page">
        <div className="review-page-top-bar">
          <div className="review-top-input-wrap">
            <input
              type="text"
              className="review-top-input"
              placeholder="gitlab.com/org/repo/-/merge_requests/1"
              value={reviewTopUrl}
              onChange={(e) => setReviewTopUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && reviewTopUrl.trim()) handleReviewSubmit(reviewTopUrl.trim());
              }}
            />
          </div>
          <button
            type="button"
            className="review-top-btn"
            onClick={() => {
              if (reviewTopUrl.trim()) handleReviewSubmit(reviewTopUrl.trim());
            }}
          >
            Go to pull request
          </button>
        </div>

        <div className="review-center-stage">
          <h1 className="review-hero-title">Review any PR URL</h1>
          <div className="review-input-box">
            <input
              type="text"
              className="review-main-input"
              placeholder="https://github.com/owner/repo/pull/123"
              value={reviewMainUrl}
              onChange={(e) => setReviewMainUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && reviewMainUrl.trim()) handleReviewSubmit(reviewMainUrl.trim());
              }}
              autoFocus
            />
            <button
              type="button"
              className="review-submit-arrow-btn"
              onClick={() => {
                if (reviewMainUrl.trim()) handleReviewSubmit(reviewMainUrl.trim());
              }}
              title="Review Pull Request"
            >
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="review-divider-row">or</div>

          <button
            type="button"
            className="review-connect-link"
            onClick={() => {
              setModal(true);
              setError(null);
            }}
          >
            <GitPullRequest size={14} />
            <span>Connect a git provider to view your PRs</span>
          </button>
        </div>
      </div>
    );
  }

  function renderWikiPage() {
    return (
      <div className="devin-page-view">
        <div className="devin-page-header">
          <div>
            <h1 className="devin-page-title">Team Wiki & Runbooks</h1>
            <p className="devin-page-subtitle">Central engineering guidelines, autonomous agent rules, and sandbox environment runbooks.</p>
          </div>
          <a
            href="https://github.com/Studio1-OSS/cloud-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="obsidian-glass-button devin-glass-link"
          >
            <ExternalLink size={13} /> Open GitHub Docs
          </a>
        </div>

        <div className="devin-cards-grid">
          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge active">Runbook</span>
              <span className="text-xs text-slate-400">v2.4</span>
            </div>
            <h3 className="card-title">Daytona MicroVM Sandbox Guide</h3>
            <p className="card-description">How isolated microVM environments spin up in under 400ms, connect to git repositories, and run autonomous workflows.</p>
            <div className="card-footer-row">
              <span>5 min read • Architecture</span>
              <a href="https://daytona.io" target="_blank" rel="noopener noreferrer" className="card-btn">Read guide →</a>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge scheduled">Guidelines</span>
              <span className="text-xs text-slate-400">Coding Standards</span>
            </div>
            <h3 className="card-title">Agent System Prompts & Guardrails</h3>
            <p className="card-description">Rules governing code generation, preserving comments, writing type-safe TypeScript, and preventing breaking changes.</p>
            <div className="card-footer-row">
              <span>4 min read • Best practices</span>
              <button type="button" className="card-btn" onClick={() => setActiveNav("customize")}>Configure rules →</button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge verified">CI/CD</span>
              <span className="text-xs text-slate-400">Containers</span>
            </div>
            <h3 className="card-title">Supported Sandbox Runtimes</h3>
            <p className="card-description">Details on Node.js 20, Python 3.11, Go 1.22, and Rust container runtimes available within isolated sandboxes.</p>
            <div className="card-footer-row">
              <span>3 min read • Environments</span>
              <button type="button" className="card-btn" onClick={() => setActiveNav("workspaces")}>Launch sandbox →</button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge active">Reference</span>
              <span className="text-xs text-slate-400">API</span>
            </div>
            <h3 className="card-title">Control-Plane API Reference</h3>
            <p className="card-description">REST and WebSocket endpoints for programmatic workspace provisioning, streaming chat, and browser subagents.</p>
            <div className="card-footer-row">
              <span>API documentation</span>
              <a href="https://github.com/Studio1-OSS/cloud-agent" target="_blank" rel="noopener noreferrer" className="card-btn">API docs →</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCustomizePage() {
    return (
      <div className="devin-page-view">
        <div className="devin-page-header">
          <div>
            <h1 className="devin-page-title">Customize Cloud Agent</h1>
            <p className="devin-page-subtitle">Configure AI coding models, sandbox compute sizing, agent personas, and dashboard preferences.</p>
          </div>
          <button
            type="button"
            className="obsidian-glass-button devin-glass-link"
            onClick={() => handleToggleTheme(theme === "zinc" ? "light" : "zinc")}
          >
            {theme === "zinc" ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === "zinc" ? "Switch to White Mode" : "Switch to Dark Mode"}</span>
          </button>
        </div>

        <div className="devin-cards-grid">
          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge active">Personas</span>
            </div>
            <h3 className="card-title">Default Coding Agent</h3>
            <p className="card-description">Currently active: <strong>{agentsList.find(a => a.id === selectedAgentId)?.name}</strong> ({agentsList.find(a => a.id === selectedAgentId)?.role}).</p>
            <div className="card-footer-row">
              <div className="flex gap-2">
                {agentsList.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAgentId(a.id)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${selectedAgentId === a.id ? 'bg-sky-500/20 text-sky-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {a.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge scheduled">Hardware</span>
            </div>
            <h3 className="card-title">Compute Sandbox Tier</h3>
            <p className="card-description">Currently selected: <strong>{selectedModel}</strong>. Standard 2 vCPU microVM booted in 380ms.</p>
            <div className="card-footer-row">
              <span>RAM: 4GB • Disk: 20GB</span>
              <button type="button" className="card-btn" onClick={() => setAccountModal(true)}>
                Manage quota →
              </button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge verified">Account</span>
            </div>
            <h3 className="card-title">User & Authentication</h3>
            <p className="card-description">{userEmail ? `Signed in as ${userEmail}` : "Using anonymous local developer workspace."}</p>
            <div className="card-footer-row">
              <span>{userEmail ? "Authenticated" : "Local session"}</span>
              <button type="button" className="card-btn" onClick={() => setAccountModal(true)}>
                Account settings →
              </button>
            </div>
          </div>

          <div className="devin-pro-card">
            <div className="card-top-row">
              <span className="card-badge active">Interface</span>
            </div>
            <h3 className="card-title">Theme & Aesthetics</h3>
            <p className="card-description">Current mode: <strong>{theme === "zinc" ? "Dark Mode (#18181b / #141416)" : "Light Mode (#ffffff)"}</strong>.</p>
            <div className="card-footer-row">
              <span>Pro charcoal palette</span>
              <button type="button" className="card-btn" onClick={() => handleToggleTheme(theme === "zinc" ? "light" : "zinc")}>
                Toggle theme
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
