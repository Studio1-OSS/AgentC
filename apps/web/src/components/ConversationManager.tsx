import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { api, normalizeRepoUrl, type Project, type Conversation } from "@/lib/workspaces";
import type { Bootstrap } from "@/lib/session";

type Props = { token: string; bootstrap: Bootstrap | null; onSelect: (token: string) => void };

export function ConversationManager({ token, bootstrap, onSelect }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Conversation[]>([]);
  const [form, setForm] = useState<"project" | "chat" | null>(null);
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [pending, setPending] = useState(false);
  const [creatingProject, setCreatingProject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const environmentId = bootstrap?.environmentId;
  const projectId = bootstrap?.projectId ?? "default";

  useEffect(() => {
    if (!environmentId) return;
    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const [projectList, sessionList] = await Promise.all([
          api<{ projects: Project[] }>(`/${environmentId}/projects`, "GET", undefined, token),
          api<{ sessions: Conversation[] }>(`/${environmentId}/projects/${projectId}/sessions`, "GET", undefined, token),
        ]);
        if (cancelled) return;
        setProjects(projectList.projects);
        setSessions(sessionList.sessions);
        const created = projectList.projects.find((project) => project.id === creatingProject);
        if (created?.status === "error") {
          setError(created.errorMessage ?? "Unable to create project");
          setCreatingProject(null);
        } else if (created?.status === "ready") {
          const chat = await api<{ token: string }>(`/${environmentId}/projects/${created.id}/chat`, "POST", {}, token);
          if (!cancelled) onSelect(chat.token);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [environmentId, projectId, token, creatingProject, onSelect]);

  async function openChat(selectedProject: string, sessionId?: string) {
    setPending(true);
    setError(null);
    try {
      const chat = await api<{ token: string }>(`/${environmentId}/projects/${selectedProject}/chat`, "POST", { sessionId }, token);
      onSelect(chat.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (form === "project") {
        const project = await api<Project>(`/${environmentId}/projects`, "POST", {
          name: name.trim(),
          ...(repo.trim() ? { repoUrl: normalizeRepoUrl(repo), ...(branch.trim() ? { repoBranch: branch.trim() } : {}) } : { initEmpty: true }),
        }, token);
        setCreatingProject(project.id);
        setForm(null);
      } else {
        const chat = await api<{ token: string }>(`/${environmentId}/projects/${projectId}/sessions`, "POST", { title: name.trim() || undefined }, token);
        onSelect(chat.token);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (!bootstrap) return null;
  const selectedSession = sessions.find((session) => session.piSessionId === bootstrap.piSessionId)?.id ?? "";
  return (
    <section className="conversation-manager" aria-label="Projects and conversations">
      <div className="conversation-controls">
        <label>
          Project
          <select aria-label="Project" value={projectId} disabled={pending || !!creatingProject || !projects.length} onChange={(event) => void openChat(event.target.value)}>
            {!projects.length && <option value={projectId}>{bootstrap.projectName ?? bootstrap.environmentName}</option>}
            {projects.map((project) => <option key={project.id} value={project.id} disabled={project.status !== "ready"}>
              {project.name}{project.status === "creating" ? " (creating…)" : project.status === "error" ? " (failed)" : ""}
            </option>)}
          </select>
        </label>
        <label>
          Conversation
          <select aria-label="Conversation" value={selectedSession} disabled={pending || !sessions.length} onChange={(event) => void openChat(projectId, event.target.value)}>
            {!selectedSession && <option value="">Current conversation</option>}
            {sessions.map((session) => <option key={session.id} value={session.id}>{session.title ?? "New chat"}{session.running ? " (replying…)" : ""}</option>)}
          </select>
        </label>
        <button className="text-button" type="button" disabled={pending} onClick={() => { setForm("chat"); setName(""); setError(null); }}><Plus size={14} /> New chat</button>
        <button className="text-button" type="button" disabled={pending || !!creatingProject} onClick={() => { setForm("project"); setName(""); setRepo(""); setBranch(""); setError(null); }}><Plus size={14} /> New project</button>
      </div>
      {creatingProject && <p className="project-progress" role="status"><LoaderCircle size={14} className="animate-spin" /> Creating project… Your current chat can keep running.</p>}
      {form && <form onSubmit={create} className="conversation-form">
        <label>{form === "project" ? "Project name" : "Conversation title (optional)"}
          <input autoFocus required={form === "project"} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={pending} />
        </label>
        {form === "project" && <>
          <label>GitHub repository (optional)
            <input value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="owner/repository, or leave empty" disabled={pending} />
          </label>
          {repo.trim() && <label>Branch (optional)<input value={branch} onChange={(event) => setBranch(event.target.value)} maxLength={200} disabled={pending} /></label>}
        </>}
        <button className="primary-button" disabled={pending || (form === "project" && !name.trim())}>{pending ? "Creating…" : form === "project" ? "Create project" : "Start new chat"}</button>
        <button type="button" className="text-button" disabled={pending} onClick={() => setForm(null)}><X size={14} /> Cancel</button>
      </form>}
      {error && <p className="card-error" role="alert">{error}</p>}
    </section>
  );
}
