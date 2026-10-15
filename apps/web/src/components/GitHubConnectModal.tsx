import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Github, GitBranch, Lock, Globe, Search, X, Settings2, LogOut, Loader2 } from "lucide-react";
import {
  GITHUB_CONNECT_URL,
  GITHUB_INSTALL_URL,
  disconnectGitHub,
  fetchGitHubRepos,
  type GitHubRepo,
  type GitHubStatus,
} from "@/lib/github";
import { normalizeRepoUrl } from "@/lib/workspaces";

type Props = {
  status: GitHubStatus | null;
  onClose: () => void;
  onOpenRepo: (repoUrl: string, branch?: string) => void;
  onStatusChange: () => void;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "updated today";
  if (days < 30) return `updated ${days}d ago`;
  if (days < 365) return `updated ${Math.floor(days / 30)}mo ago`;
  return `updated ${Math.floor(days / 365)}y ago`;
}

/** Sign in with GitHub, pick a repository the app can reach, or paste a public one. */
export function GitHubConnectModal({ status, onClose, onOpenRepo, onStatusChange }: Props) {
  const connected = status?.configured && status.connected;
  const [repos, setRepos] = useState<GitHubRepo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [branch, setBranch] = useState("");
  const [publicRepo, setPublicRepo] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!connected) return;
    let live = true;
    setLoadError(null);
    fetchGitHubRepos()
      .then((list) => live && setRepos(list))
      .catch((err: Error) => live && setLoadError(err.message));
    return () => {
      live = false;
    };
  }, [connected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q));
  }, [repos, query]);

  function openPublic(e: FormEvent) {
    e.preventDefault();
    if (!publicRepo.trim()) return;
    onOpenRepo(normalizeRepoUrl(publicRepo.trim()), branch.trim() || undefined);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect your GitHub account from AgentC?")) return;
    setDisconnecting(true);
    try {
      await disconnectGitHub();
      setRepos(null);
      onStatusChange();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="workspace-modal devin-gh-connect-modal gh-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gh-connect-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close icon-button" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="devin-gh-modal-header">
          <div className="devin-gh-modal-icon-badge">
            <Github size={24} />
          </div>
          <h2 id="gh-connect-heading" className="devin-gh-modal-title">
            {connected ? "Choose a repository" : "Connect GitHub"}
          </h2>
          <p className="devin-gh-modal-subtitle">
            {connected
              ? "AgentC clones it into a private sandbox, works on it, and opens pull requests as you."
              : "Sign in with GitHub to work on your own repositories, including private ones, and open pull requests."}
          </p>
        </div>

        {status?.configured && !status.connected && (
          <a className="gh-signin-btn" href={GITHUB_CONNECT_URL}>
            <Github size={17} />
            Continue with GitHub
          </a>
        )}

        {status && !status.configured && (
          <p className="gh-note">
            GitHub sign-in isn't set up on this server yet. You can still open any public repository below.
          </p>
        )}

        {connected && (
          <div className="gh-connected">
            <div className="gh-account">
              {status.avatarUrl ? (
                <img src={status.avatarUrl} alt="" className="gh-avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="gh-avatar gh-avatar-fallback">
                  <Github size={14} />
                </span>
              )}
              <div className="gh-account-text">
                <span className="gh-account-name">{status.name || status.login}</span>
                <span className="gh-account-login">@{status.login}</span>
              </div>
              <a className="gh-account-action" href={GITHUB_INSTALL_URL} title="Choose which repositories AgentC can access">
                <Settings2 size={14} />
                <span>Manage access</span>
              </a>
              <button type="button" className="gh-account-action" onClick={disconnect} disabled={disconnecting} title="Disconnect GitHub">
                <LogOut size={14} />
              </button>
            </div>

            <div className="devin-gh-modal-input-wrap">
              <Search size={16} className="devin-gh-modal-input-icon" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your repositories"
                className="devin-gh-modal-input"
                aria-label="Search repositories"
              />
            </div>

            <div className="gh-repo-list" role="list">
              {loadError ? (
                <p className="gh-note">{loadError}</p>
              ) : repos === null ? (
                <p className="gh-note gh-loading">
                  <Loader2 size={14} className="gh-spin" /> Loading repositories…
                </p>
              ) : filtered.length ? (
                filtered.map((repo) => (
                  <button
                    key={repo.fullName}
                    type="button"
                    role="listitem"
                    className="gh-repo-row"
                    onClick={() => onOpenRepo(repo.htmlUrl, branch.trim() || undefined)}
                  >
                    {repo.private ? <Lock size={14} className="gh-repo-icon" /> : <Globe size={14} className="gh-repo-icon" />}
                    <span className="gh-repo-name">{repo.fullName}</span>
                    <span className="gh-repo-meta">{timeAgo(repo.pushedAt)}</span>
                    <span className="gh-repo-open">Open</span>
                  </button>
                ))
              ) : repos.length ? (
                <p className="gh-note">No repositories match “{query}”.</p>
              ) : (
                <p className="gh-note">
                  AgentC can't see any repositories yet. <a href={GITHUB_INSTALL_URL}>Choose repositories</a>
                </p>
              )}
            </div>

            <div className="devin-gh-branch-row">
              <GitBranch size={15} className="gh-muted-icon" />
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Branch (defaults to the repository's default branch)"
                className="devin-gh-branch-input"
                aria-label="Branch"
              />
            </div>
          </div>
        )}

        <form onSubmit={openPublic} className="gh-public-form">
          <label className="devin-gh-modal-label" htmlFor="gh-public-input">
            {connected ? "Or open any public repository" : "Or open a public repository"}
          </label>
          <div className="gh-public-row">
            <div className="devin-gh-modal-input-wrap">
              <Github size={16} className="devin-gh-modal-input-icon" />
              <input
                id="gh-public-input"
                type="text"
                value={publicRepo}
                onChange={(e) => setPublicRepo(e.target.value)}
                placeholder="owner/repo or https://github.com/owner/repo"
                className="devin-gh-modal-input"
              />
            </div>
            <button type="submit" className="gh-secondary-btn" disabled={!publicRepo.trim()}>
              Open
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
