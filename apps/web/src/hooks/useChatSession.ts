import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Bootstrap,
  type ChatItem,
  fetchBootstrap,
  wsUrlForToken,
} from "@/lib/session";

import { applyChatEvent, historyItems } from "@/lib/chat-events";

type ConnState = "connecting" | "ready" | "error" | "closed";

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function useChatSession(token: string | null) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing chat token. Open a link from `cloud-agent open`.");
      setConn("error");
      return;
    }

    setConn("connecting");
    setError(null);
    setItems([]);
    setBootstrap(null);
    setBusy(false);
    let cancelled = false;
    let ws: WebSocket | null = null;

    (async () => {
      try {
        const boot = await fetchBootstrap(token);
        if (cancelled) return;
        setBootstrap(boot);
        setItems(historyItems(boot.messages ?? []));

        ws = new WebSocket(wsUrlForToken(token));
        wsRef.current = ws;

        ws.onopen = () => {
          if (!cancelled) setConn("ready");
        };

        ws.onmessage = (evt) => {
          if (cancelled) return;
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(String(evt.data)) as Record<string, unknown>;
          } catch {
            return;
          }
          const type = String(data.type ?? "");

          if (type === "session.state") {
            setItems((prev) => [
              ...prev,
              {
                id: nextId("sys"),
                kind: "system",
                text: "Connected to Pi session",
              },
            ]);
            return;
          }

          if (type === "run.start") {
            setBusy(true);
            return;
          }

          if (type === "run.end") setBusy(false);
          setItems((prev) => applyChatEvent(prev, data));

          if (type === "error") {
            setError(String(data.message ?? "Unknown error"));
            setBusy(false);
          }
        };

        ws.onerror = () => {
          if (!cancelled) {
            setConn("error");
            setError("WebSocket connection failed");
          }
        };

        ws.onclose = () => {
          if (!cancelled) {
            setConn("closed");
            setBusy(false);
          }
        };
      } catch (err) {
        if (!cancelled) {
          setConn("error");
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      ws?.close();
      wsRef.current = null;
    };
  }, [token]);

  const sendPrompt = useCallback((content: string) => {
    const text = content.trim();
    if (
      !text ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    setItems((prev) => [...prev, { id: nextId("u"), kind: "user", text }]);
    setError(null);
    setBusy(true);
    wsRef.current.send(JSON.stringify({ type: "prompt", content: text }));
  }, []);

  const abort = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "abort" }));
    }
  }, []);

  return { bootstrap, items, conn, error, busy, sendPrompt, abort };
}
