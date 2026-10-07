export type Workspace = {
  id: string;
  name: string;
  repoUrl: string | null;
  repoBranch: string | null;
  status: "creating" | "ready" | "sleeping" | "starting" | "stopping" | "error";
  errorMessage?: string | null;
  createdAt: string;
};
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/ui/api/environments${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Unable to reach your workspace");
  return data as T;
}
export function repoLabel(url: string | null) {
  return url
    ? url.replace("https://github.com/", "").replace(/\.git$/, "")
    : "Empty workspace";
}
