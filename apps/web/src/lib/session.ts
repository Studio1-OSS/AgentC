export type Bootstrap = {
  messages?: RuntimeMessage[];
  environmentId: string;
  environmentName: string;
  status: string;
  repoUrl: string | null;
  piSessionId: string;
  model: string;
  provider: string;
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

export function wsUrlForToken(token: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ui/ws?token=${encodeURIComponent(token)}`;
}

export async function fetchBootstrap(token: string): Promise<Bootstrap> {
  const res = await fetch(`/ui/api/bootstrap?t=${encodeURIComponent(token)}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `bootstrap failed (${res.status})`);
  }
  return res.json() as Promise<Bootstrap>;
}
