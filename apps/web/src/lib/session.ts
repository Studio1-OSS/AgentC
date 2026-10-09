export type Bootstrap = {
  messages?: RuntimeMessage[];
  environmentId: string;
  environmentName: string;
  projectId?: string;
  projectName?: string;
  previewPort?: number;
  status: string;
  repoUrl: string | null;
  piSessionId: string;
  model: string;
  provider: string;
  token?: string;
};

export type RuntimeContent = {
  type: string;
  text?: string;
  thinking?: string;
  data?: string;
  mimeType?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
};
export type RuntimeMessage = {
  role: string;
  content: string | RuntimeContent[];
  toolCallId?: string;
  toolName?: string;
  details?: unknown;
  isError?: boolean;
};
export type ChatItem =
  | { id: string; kind: "user"; text: string; images?: string[] }
  | {
      id: string;
      kind: "assistant";
      text: string;
      thinking?: string;
      images?: string[];
      streaming?: boolean;
    }
  | {
      id: string;
      kind: "tool";
      tool: string;
      callId: string;
      args?: unknown;
      status: "start" | "end";
      isError?: boolean;
      details?: unknown;
      output?: string;
      images?: string[];
    }
  | { id: string; kind: "system"; text: string };

export function readTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("t") ?? params.get("token");
}

export function chatTargetFromToken(
  token: string,
): { environmentId: string; projectId: string } | null {
  try {
    const body = token.split(".")[0];
    if (!body) return null;
    const padded = body.replace(/-/g, "+").replace(/_/g, "/");
    const aligned = padded + "=".repeat((4 - (padded.length % 4)) % 4);
    const payload = JSON.parse(atob(aligned)) as {
      environmentId?: string;
      projectId?: string;
    };
    if (typeof payload.environmentId !== "string") return null;
    return {
      environmentId: payload.environmentId,
      projectId: typeof payload.projectId === "string" ? payload.projectId : "default",
    };
  } catch {
    return null;
  }
}

export const CHAT_RECONNECT_GIVE_UP = 8;
export function chatReconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** Math.min(Math.max(attempt, 0), 10), 10_000);
}

export function wsUrlForToken(token: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ui/ws?token=${encodeURIComponent(token)}`;
}

export async function fetchBootstrap(token: string): Promise<Bootstrap> {
  const res = await fetch(`/ui/api/bootstrap?t=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `bootstrap failed (${res.status})`);
  }
  return res.json() as Promise<Bootstrap>;
}
