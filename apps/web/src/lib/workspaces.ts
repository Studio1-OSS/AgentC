export type Workspace = {
  id: string;
  name: string;
  repoUrl: string | null;
  repoBranch: string | null;
  status: "creating" | "ready" | "sleeping" | "starting" | "stopping" | "error";
  errorMessage?: string | null;
  createdAt: string;
  /** "owner/repo" when opened through the user's GitHub connection; enables pull requests. */
  githubRepo?: string | null;
};
export type Project = {
  id: string;
  name: string;
  repoUrl: string | null;
  status: "creating" | "ready" | "error";
  errorMessage: string | null;
};
export type Conversation = {
  id: string;
  piSessionId: string;
  title: string | null;
  running: boolean;
};
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  timeoutMs = 60_000,
): Promise<T> {
  try {
    const response = await fetch(`/ui/api/environments${path}`, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok)
      throw new Error(data?.error ?? "Unable to reach your workspace");
    if (!data) throw new Error("Unable to reach your workspace");
    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("The workspace took too long to respond. Retry connection.");
    }
    throw err;
  }
}
export function repoLabel(url: string | null) {
  return url
    ? url.replace("https://github.com/", "").replace(/\.git$/, "")
    : "Empty workspace";
}
export function normalizeRepoUrl(repo: string): string {
  const value = repo.trim();
  return value.startsWith("https://") ? value : `https://github.com/${value.replace(/^github\.com\//, "")}`;
}
