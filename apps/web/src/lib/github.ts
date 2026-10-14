export type GitHubStatus =
  | { configured: false; connected: false }
  | {
      configured: true;
      connected: boolean;
      installUrl: string;
      login?: string;
      name?: string | null;
      avatarUrl?: string | null;
    };

export type GitHubRepo = {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  pushedAt: string | null;
  canPush: boolean;
};

export type PullRequestResult = { url: string; number: number; branch: string; base: string; created: boolean };

/** Full-page navigations: GitHub's sign-in and install pages can't run inside fetch. */
export const GITHUB_CONNECT_URL = "/ui/api/github/connect";
export const GITHUB_INSTALL_URL = "/ui/api/github/install";

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`/ui/api${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const data = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!response.ok || !data) throw new Error(data?.error ?? "GitHub is unreachable right now");
  return data;
}

export const fetchGitHubStatus = () => request<GitHubStatus>("/github/status");
export const fetchGitHubRepos = () => request<{ repos: GitHubRepo[] }>("/github/repos").then((d) => d.repos);
export const disconnectGitHub = () => request<{ ok: true }>("/github/disconnect", "POST", {});
export const createPullRequest = (environmentId: string, input: { title: string; body?: string; draft?: boolean }) =>
  request<PullRequestResult>(`/environments/${environmentId}/pull-request`, "POST", input);
