import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, GitBranch, GitCommitHorizontal, X, Monitor, FileCode2, Check } from "lucide-react";
import type { FileDiff } from "@/components/ToolCalls";

/* Right-hand workspace panel shown beside the chat when a GitHub repository is
 * connected: environment details, the agent's changes as reviewable diffs, a
 * terminal log of commands it ran, and the files it touched. */

export type RepoPanelTab = "environment" | "changes" | "desktop" | "terminal" | "files";

export type RepoCommit = { id: string; message: string; files: FileDiff[]; time: string };
export type TerminalEntry = { command: string; output: string[] };

type RepoPanelProps = {
  repo: string;
  branch: string;
  baseBranch?: string;
  title: string;
  commits: RepoCommit[];
  terminal: TerminalEntry[];
  tab: RepoPanelTab;
  onTabChange: (tab: RepoPanelTab) => void;
  onClose: () => void;
};

const TABS: Array<{ id: RepoPanelTab; label: string }> = [
  { id: "environment", label: "Environment" },
  { id: "changes", label: "Changes" },
  { id: "desktop", label: "Desktop" },
  { id: "terminal", label: "Terminal" },
  { id: "files", label: "Files" },
];

function mergeDiffs(commits: RepoCommit[]) {
  const byFile = new Map<string, FileDiff>();
  for (const commit of commits) {
    for (const diff of commit.files) byFile.set(diff.file, diff);
  }
  return [...byFile.values()];
}

function FileDiffCard({ diff }: { diff: FileDiff }) {
  const [open, setOpen] = useState(true);
  let lineNo = 0;
  return (
    <div className="rp-file">
      <button type="button" className="rp-file-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ChevronDown size={14} className="rp-file-chevron" style={{ transform: open ? "rotate(0)" : "rotate(-90deg)" }} />
        <span className="rp-file-name">{diff.file}</span>
        <span className="rp-file-stats">
          <span className="add">+{diff.add}</span>
          {diff.del > 0 && <span className="del"> −{diff.del}</span>}
        </span>
        {diff.isNew && <span className="rp-file-new">New</span>}
      </button>
      {open && (
        <div className="rp-code">
          {diff.lines.map((line, index) => {
            if (line.tone !== "del") lineNo += 1;
            return (
              <div key={index} className={`rp-code-line ${line.tone}`}>
                <span className="rp-code-no">{line.tone === "del" ? "" : lineNo}</span>
                <span className="rp-code-text">{line.text || " "}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rp-empty">
      <span className="rp-empty-icon">{icon}</span>
      <p className="rp-empty-title">{title}</p>
      <p className="rp-empty-text">{text}</p>
    </div>
  );
}

export function RepoPanel({
  repo,
  branch,
  baseBranch = "main",
  title,
  commits,
  terminal,
  tab,
  onTabChange,
  onClose,
}: RepoPanelProps) {
  const [subTab, setSubTab] = useState<"diff" | "review" | "commits">("diff");
  const [prState, setPrState] = useState<"none" | "draft" | "open">("none");
  const [prMenuOpen, setPrMenuOpen] = useState(false);
  const diffs = mergeDiffs(commits);
  const added = diffs.reduce((sum, d) => sum + d.add, 0);
  const removed = diffs.reduce((sum, d) => sum + d.del, 0);

  // A new branch means a new session: reset the PR state.
  useEffect(() => {
    setPrState("none");
  }, [branch]);

  return (
    <aside className="rp" aria-label="Workspace panel">
      <div className="rp-tabs">
        <div className="rp-tab-list" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`rp-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
              {t.id === "changes" && diffs.length > 0 && <span className="rp-tab-count">{diffs.length}</span>}
            </button>
          ))}
        </div>
        <button type="button" className="rp-icon-btn" onClick={onClose} title="Close panel" aria-label="Close panel">
          <X size={15} />
        </button>
      </div>

      <div className="rp-body">
        {tab === "changes" && (
          <>
            <div className="rp-branch-row">
              <div className="rp-branch">
                <span className="rp-branch-pill">
                  <GitBranch size={12} />
                  Branch
                </span>
                <span className="rp-branch-name" title={branch}>{branch}</span>
                <span className="rp-branch-arrow">→</span>
                <span className="rp-branch-base">{baseBranch}</span>
              </div>
              <div className="rp-pr-wrap">
                <div className="rp-pr-split">
                  <button
                    type="button"
                    className="rp-pr-btn"
                    disabled={diffs.length === 0}
                    onClick={() => setPrState((s) => (s === "none" ? "open" : s))}
                  >
                    {prState === "none" ? "Create PR" : prState === "draft" ? "Draft PR opened" : "PR opened"}
                  </button>
                  <button
                    type="button"
                    className="rp-pr-caret"
                    disabled={diffs.length === 0 || prState !== "none"}
                    aria-label="More pull request options"
                    onClick={() => setPrMenuOpen((v) => !v)}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
                {prMenuOpen && (
                  <div className="rp-pr-menu" onMouseLeave={() => setPrMenuOpen(false)}>
                    <button
                      type="button"
                      onClick={() => {
                        setPrState("open");
                        setPrMenuOpen(false);
                      }}
                    >
                      Create pull request
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrState("draft");
                        setPrMenuOpen(false);
                      }}
                    >
                      Create draft pull request
                    </button>
                  </div>
                )}
              </div>
            </div>

            <h3 className="rp-title">{title}</h3>

            <div className="rp-subtabs">
              {(["diff", "review", "commits"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`rp-subtab ${subTab === s ? "active" : ""}`}
                  onClick={() => setSubTab(s)}
                >
                  {s === "diff" ? "Diff" : s === "review" ? "Review" : "Commits"}
                </button>
              ))}
              {diffs.length > 0 && (
                <span className="rp-subtabs-stats">
                  {diffs.length} file{diffs.length === 1 ? "" : "s"} · <span className="add">+{added}</span>
                  {removed > 0 && <span className="del"> −{removed}</span>}
                </span>
              )}
            </div>

            {subTab === "diff" &&
              (diffs.length ? (
                <div className="rp-files">
                  {diffs.map((diff) => (
                    <FileDiffCard key={diff.file} diff={diff} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<FileCode2 size={18} />}
                  title="No changes yet"
                  text="Edits the agent makes in this repository will appear here as a diff."
                />
              ))}

            {subTab === "review" &&
              (diffs.length ? (
                <ul className="rp-checks">
                  <li>
                    <Check size={14} className="rp-check-ok" />
                    <span>Tests passed in the sandbox</span>
                  </li>
                  <li>
                    <Check size={14} className="rp-check-ok" />
                    <span>{diffs.length} file{diffs.length === 1 ? "" : "s"} ready for review</span>
                  </li>
                  <li>
                    <Check size={14} className="rp-check-ok" />
                    <span>No merge conflicts with {baseBranch}</span>
                  </li>
                </ul>
              ) : (
                <EmptyState icon={<Check size={18} />} title="Nothing to review" text="Review checks run once the agent has made changes." />
              ))}

            {subTab === "commits" &&
              (commits.length ? (
                <ul className="rp-commits">
                  {[...commits].reverse().map((c) => (
                    <li key={c.id}>
                      <GitCommitHorizontal size={14} />
                      <span className="rp-commit-msg">{c.message}</span>
                      <span className="rp-commit-meta">
                        {c.id.slice(0, 7)} · {c.time}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<GitCommitHorizontal size={18} />} title="No commits yet" text={`Commits on ${branch} will be listed here.`} />
              ))}
          </>
        )}

        {tab === "environment" && (
          <dl className="rp-env">
            <div>
              <dt>Repository</dt>
              <dd>{repo}</dd>
            </div>
            <div>
              <dt>Working branch</dt>
              <dd className="mono">{branch}</dd>
            </div>
            <div>
              <dt>Base branch</dt>
              <dd className="mono">{baseBranch}</dd>
            </div>
            <div>
              <dt>Sandbox</dt>
              <dd>Daytona Cloud MicroVM</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className="rp-status-dot" /> Ready
              </dd>
            </div>
          </dl>
        )}

        {tab === "desktop" && (
          <EmptyState
            icon={<Monitor size={18} />}
            title="Desktop isn't running"
            text="When the agent opens a browser or GUI app in the sandbox, it streams here."
          />
        )}

        {tab === "terminal" && (
          <div className="rp-terminal">
            {terminal.length ? (
              terminal.map((entry, index) => (
                <div key={index} className="rp-terminal-entry">
                  <div className="rp-terminal-cmd">
                    <span className="rp-terminal-prompt">$</span> {entry.command}
                  </div>
                  {entry.output.map((line, i) => (
                    <div key={i} className="rp-terminal-out">
                      {line}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="rp-terminal-out">No commands have run yet.</div>
            )}
          </div>
        )}

        {tab === "files" &&
          (diffs.length ? (
            <ul className="rp-file-list">
              {diffs.map((d) => (
                <li key={d.file}>
                  <button type="button" onClick={() => onTabChange("changes")}>
                    <FileCode2 size={14} />
                    <span className="rp-file-list-name">{d.file}</span>
                    <span className="add">+{d.add}</span>
                    {d.del > 0 && <span className="del">−{d.del}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<FileCode2 size={18} />} title="No files touched" text="Files the agent reads or edits will be listed here." />
          ))}
      </div>
    </aside>
  );
}
