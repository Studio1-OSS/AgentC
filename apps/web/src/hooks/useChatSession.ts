import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHAT_RECONNECT_GIVE_UP,
  chatReconnectDelay,
  type Bootstrap,
  type ChatItem,
  fetchBootstrap,
  wsUrlForToken,
} from "@/lib/session";
import { applyChatEvent, historyItems } from "@/lib/chat-events";

type ConnState = "connecting" | "ready" | "error" | "closed";

export function useChatSession(
  token: string | null,
  hooks?: { onGiveUp?: () => void; onToken?: (token: string) => void },
) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const busyRef = useRef(false);
  const readyRef = useRef(false);
  const onGiveUpRef = useRef(hooks?.onGiveUp);
  const onTokenRef = useRef(hooks?.onToken);
  onGiveUpRef.current = hooks?.onGiveUp;
  onTokenRef.current = hooks?.onToken;
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  useEffect(() => {
    if (!token) {
      setError("Missing chat token. Open a workspace to connect.");
      setConn("error");
      return;
    }
    setConn("connecting");
    setError(null);
    setItems([]);
    setBootstrap(null);
    setBusy(false);
    busyRef.current = false;
    readyRef.current = false;
    let cancelled = false;
    let bootstrapped = false;
    let retries = 0;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let connectionTimer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const updateBusy = (running: boolean) => {
      busyRef.current = running;
      setBusy(running);
    };
    const retry = () => {
      if (cancelled) return;
      readyRef.current = false;
      if (retries === CHAT_RECONNECT_GIVE_UP) {
        setConn("closed");
        setError("Connection lost. Reconnect to restore the conversation.");
        onGiveUpRef.current?.();
      } else if (retries < CHAT_RECONNECT_GIVE_UP) {
        setConn("connecting");
      }
      retryTimer = setTimeout(() => void connect(), chatReconnectDelay(retries++));
    };
    const connect = async () => {
      try {
        if (!bootstrapped) {
          const boot = await fetchBootstrap(token);
          if (cancelled) return;
          if (boot.token && boot.token !== token) {
            onTokenRef.current?.(boot.token);
            return;
          }
          setBootstrap(boot);
          setItems(historyItems(boot.messages ?? []));
          bootstrapped = true;
        }
        if (cancelled) return;
        const socket = new WebSocket(wsUrlForToken(token));
        ws = socket;
        wsRef.current = socket;
        let lastReceived = Date.now();
        connectionTimer = setTimeout(() => socket.close(), 20_000);
        socket.onopen = () => {
          if (cancelled) return;
          socket.send(JSON.stringify({ type: "sync" }));
          heartbeat = setInterval(() => {
            if (Date.now() - lastReceived > 45_000) {
              socket.close();
            } else if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping" }));
            }
          }, 15_000);
        };
        socket.onmessage = (evt) => {
          if (cancelled) return;
          lastReceived = Date.now();
          let data: Record<string, unknown>;
          try {
            data = JSON.parse(String(evt.data)) as Record<string, unknown>;
          } catch {
            return;
          }
          if (["session.state", "run.start", "model.fallback"].includes(String(data.type)) &&
              typeof data.model === "string" && typeof data.provider === "string") {
            setBootstrap((previous) => previous ? { ...previous, model: String(data.model), provider: String(data.provider) } : previous);
          }
          if (data.type === "session.state") {
            clearTimeout(connectionTimer);
            retries = 0;
            if (!readyRef.current) setError(null);
            readyRef.current = true;
            setConn("ready");
            updateBusy(Boolean(data.running));
          } else if (data.type === "run.start") {
            setError(null);
            updateBusy(true);
          } else if (data.type === "model.fallback") {
            setError(null);
          } else if (data.type === "run.end") {
            updateBusy(false);
          } else if (data.type === "pong") {
            if (typeof data.running === "boolean") {
              updateBusy(data.running);
              if (!data.running) setItems((prev) => applyChatEvent(prev, { type: "run.end" }));
            }
            return;
          } else if (data.type === "error") {
            setError(String(data.message ?? "Unknown error"));
          }
          setItems((prev) => applyChatEvent(prev, data));
        };
        socket.onerror = () => socket.close();
        socket.onclose = () => {
          clearTimeout(connectionTimer);
          clearInterval(heartbeat);
          if (wsRef.current === socket) wsRef.current = null;
          bootstrapped = false;
          retry();
        };
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        if (message === "Unable to load conversation" || message === "Unable to open the agent conversation") {
          onGiveUpRef.current?.();
          return;
        }
        retry();
      }
    };
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(connectionTimer);
      clearInterval(heartbeat);
      ws?.close();
      wsRef.current = null;
      readyRef.current = false;
    };
  }, [token, connectionAttempt]);

  const sendPrompt = useCallback((content: string) => {
    const text = content.trim();
    const socket = wsRef.current;
    if (!text || busyRef.current || !readyRef.current || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "prompt", content: text }));
    busyRef.current = true;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), kind: "user", text }]);
    setError(null);
    setBusy(true);
  }, []);

  const abort = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "abort" }));
    }
  }, []);
  const reconnect = useCallback(() => {
    if (onGiveUpRef.current) onGiveUpRef.current();
    else setConnectionAttempt((attempt) => attempt + 1);
  }, []);

  return { bootstrap, items, conn, error, busy, sendPrompt, abort, reconnect };
}
