import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { expect, it, vi } from "vitest";
import { attachUiWebSocketProxy } from "./ws-proxy.js";
import { mintUiToken } from "./ui-tokens.js";
import type { EnvironmentService } from "./services/environments.js";
import type { PiSessionRegistry } from "@agentc/agent-runtime";
import type { ServerEvent } from "@agentc/protocol";

it("syncs session events directly from the server and allows ping, reconnect and abort during a running prompt", async () => {
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
  const service = {
    getRuntimeSessionRegistry: async () => registry,
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
    await Promise.all([
      new Promise<void>((resolve) => proxy.close(() => resolve())),
      new Promise<void>((resolve) => server.close(() => resolve())),
    ]);
  }
});
