import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { expect, it, vi } from "vitest";
import { attachUiWebSocketProxy } from "./ws-proxy.js";
import { mintUiToken } from "./ui-tokens.js";
import type { EnvironmentService } from "./services/environments.js";
import { handleSessionSocket } from "../../../sandbox/runtime/src/socket.js";
import type { PiSessionRegistry } from "../../../sandbox/runtime/src/pi.js";
import type { ServerEvent } from "@cloud-agent/protocol";

it("syncs missed events through the proxy and allows ping, reconnect and abort during a running prompt", async () => {
  const runtime = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await once(runtime, "listening");
  const server = createServer();
  const listeners = new Set<(event: ServerEvent) => void>();
  let running = false;
  let finish!: () => void;
  const messages = [{ role: "user", content: "earlier message" }];
  const state = () => ({
    type: "session.state", sessionId: "session", messages, running,
    streamingMessage: running ? { role: "assistant", content: [{ type: "text", text: "Partial reply" }] } : undefined,
  });
  const emit = (event: ServerEvent) => listeners.forEach((listener) => listener(event));
  const registry = {
    openSession: async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { id: "session" };
    },
    subscribe: (_id: string, listener: (event: ServerEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState: state,
    isRunning: () => running,
    prompt: async () => {
      running = true;
      emit({ type: "run.start" });
      await new Promise<void>((resolve) => { finish = resolve; });
      emit({ type: "run.end" });
    },
    abort: async () => { running = false; finish(); },
  } as unknown as PiSessionRegistry;
  runtime.on("connection", (socket) => void handleSessionSocket(socket, "session", registry));
  const service = {
    openRuntimeSessionSocket: async () => {
      const socket = new WebSocket(`ws://127.0.0.1:${(runtime.address() as AddressInfo).port}`);
      await once(socket, "open");
      // Events during this gap are missed; the browser must sync after attaching.
      await new Promise((resolve) => setTimeout(resolve, 60));
      return socket;
    },
  } as unknown as EnvironmentService;
  const proxy = attachUiWebSocketProxy(server, service, "test-secret");
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const token = mintUiToken({ userId: "user", environmentId: "env", piSessionId: "session", secret: "test-secret" }).token;
  const browserUrl = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ui/ws?token=${encodeURIComponent(token)}`;
  const browsers: WebSocket[] = [];
  const connect = async () => {
    const socket = new WebSocket(browserUrl);
    browsers.push(socket);
    const events: Record<string, unknown>[] = [];
    socket.on("message", (data) => events.push(JSON.parse(String(data))));
    await once(socket, "open");
    socket.send(JSON.stringify({ type: "sync" }));
    await vi.waitFor(() => expect(events.find((event) => event.type === "session.state")).toBeTruthy());
    return { socket, events };
  };
  try {
    const first = await connect();
    expect(first.events[0]).toMatchObject({ messages, running: false });
    first.socket.send(JSON.stringify({ type: "prompt", content: "hello" }));
    await vi.waitFor(() => expect(running).toBe(true));
    first.socket.send(JSON.stringify({ type: "ping" }));
    await vi.waitFor(() => expect(first.events).toContainEqual({ type: "pong", running: true }));
    first.socket.close();
    await once(first.socket, "close");
    const resumed = await connect();
    expect(resumed.events[0]).toMatchObject({ messages, running: true, streamingMessage: { role: "assistant" } });
    resumed.socket.send(JSON.stringify({ type: "abort" }));
    await vi.waitFor(() => expect(resumed.events).toContainEqual({ type: "run.end" }));
    resumed.socket.send(JSON.stringify({ type: "sync" }));
    await vi.waitFor(() => expect(resumed.events).toContainEqual(state()));
  } finally {
    browsers.forEach((socket) => socket.terminate());
    proxy.clients.forEach((socket) => socket.terminate());
    runtime.clients.forEach((socket) => socket.terminate());
    await Promise.all([
      new Promise<void>((resolve) => proxy.close(() => resolve())),
      new Promise<void>((resolve) => runtime.close(() => resolve())),
      new Promise<void>((resolve) => server.close(() => resolve())),
    ]);
  }
});
