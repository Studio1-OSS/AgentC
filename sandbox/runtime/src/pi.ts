import type { ServerEvent } from "@cloud-agent/protocol";
import {
  NEBIUS_PROVIDER_ID,
  OPENROUTER_PROVIDER_ID,
  buildNebiusPiProviderRegistration,
  resolveLlmProviderConfig,
  type LlmProviderConfig,
} from "@cloud-agent/protocol";
import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { mkdirSync } from "node:fs";
import { mapPiEvent } from "./events.js";

export type RuntimeConfig = {
  cwd: string;
  agentDir: string;
  /** Optional override; when omitted, resolved from process env / keys below. */
  llm?: LlmProviderConfig;
  provider?: string;
  modelId?: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
  nebiusApiKey?: string;
  nebiusBaseUrl?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
};

type ActiveSession = {
  session: AgentSession;
  listeners: Set<(event: ServerEvent) => void>;
  unsubscribe?: () => void;
};

/**
 * Owns Pi AgentSessions inside the sandbox.
 * Conversation truth lives in ~/.pi/agent/sessions; this registry only keeps
 * in-memory handles for the lifetime of the runtime process.
 */
export class PiSessionRegistry {
  private readonly active = new Map<string, ActiveSession>();
  private modelRuntimePromise: Promise<ModelRuntime> | null = null;

  constructor(private readonly config: RuntimeConfig) {
    mkdirSync(config.cwd, { recursive: true });
    mkdirSync(config.agentDir, { recursive: true });
  }

  private resolveLlm(): LlmProviderConfig {
    if (this.config.llm) return this.config.llm;
    return resolveLlmProviderConfig({
      PI_PROVIDER: this.config.provider,
      PI_MODEL: this.config.modelId,
      OPENROUTER_API_KEY:
        this.config.openrouterApiKey ?? process.env.OPENROUTER_API_KEY,
      OPENROUTER_BASE_URL:
        this.config.openrouterBaseUrl ?? process.env.OPENROUTER_BASE_URL,
      NEBIUS_API_KEY: this.config.nebiusApiKey ?? process.env.NEBIUS_API_KEY,
      NEBIUS_BASE_URL: this.config.nebiusBaseUrl ?? process.env.NEBIUS_BASE_URL,
      ANTHROPIC_API_KEY:
        this.config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: this.config.openaiApiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  private async getModelRuntime(): Promise<ModelRuntime> {
    if (!this.modelRuntimePromise) {
      this.modelRuntimePromise = (async () => {
        const llm = this.resolveLlm();
        const runtime = await ModelRuntime.create({
          authPath: `${this.config.agentDir}/auth.json`,
          modelsPath: `${this.config.agentDir}/models.json`,
        });

        // OpenRouter is built into Pi (incl. deepseek/deepseek-v4.1-flash).
        if (llm.providerId === OPENROUTER_PROVIDER_ID) {
          await runtime.setRuntimeApiKey(OPENROUTER_PROVIDER_ID, llm.apiKey);
        } else if (llm.providerId === NEBIUS_PROVIDER_ID) {
          runtime.registerProvider(
            NEBIUS_PROVIDER_ID,
            buildNebiusPiProviderRegistration(llm),
          );
          await runtime.setRuntimeApiKey(NEBIUS_PROVIDER_ID, llm.apiKey);
        } else if (llm.providerId === "anthropic") {
          await runtime.setRuntimeApiKey("anthropic", llm.apiKey);
        } else if (llm.providerId === "openai") {
          await runtime.setRuntimeApiKey("openai", llm.apiKey);
        }

        return runtime;
      })();
    }
    return this.modelRuntimePromise;
  }

  private async resolveModel(modelRuntime: ModelRuntime) {
    const llm = this.resolveLlm();
    let model = modelRuntime.getModel(llm.providerId, llm.modelId);

    if (!model) {
      throw new Error(
        `No model available for provider=${llm.providerId} model=${llm.modelId}`,
      );
    }

    // OpenRouter catalog maxTokens often exceeds provider endpoint context
    // (e.g. Nebius gemma endpoints cap ~110k). Clamp so input+output fit.
    const maxOut = 8192;
    const maxCtx = 100_000;
    if (
      (model.maxTokens ?? 0) > maxOut ||
      (model.contextWindow ?? 0) > maxCtx
    ) {
      model = {
        ...model,
        maxTokens: Math.min(model.maxTokens ?? maxOut, maxOut),
        contextWindow: Math.min(model.contextWindow ?? maxCtx, maxCtx),
      };
    }

    return model;
  }

  async listSessions() {
    const sessions = await SessionManager.list(this.config.cwd);
    return sessions.map((s) => ({
      id: s.id,
      path: s.path,
      title: s.name ?? (s.firstMessage ? truncate(s.firstMessage, 80) : null),
      createdAt: s.created.toISOString(),
      modifiedAt: s.modified.toISOString(),
      messageCount: s.messageCount,
      firstMessage: s.firstMessage,
    }));
  }

  async createSession(title?: string): Promise<{ id: string }> {
    const modelRuntime = await this.getModelRuntime();
    const model = await this.resolveModel(modelRuntime);

    const { session } = await createAgentSession({
      cwd: this.config.cwd,
      agentDir: this.config.agentDir,
      modelRuntime,
      model,
      sessionManager: SessionManager.create(this.config.cwd),
    });

    const id = session.sessionId;
    if (title) {
      try {
        (
          session as unknown as { setSessionName?: (n: string) => void }
        ).setSessionName?.(title);
      } catch {
        // ignore
      }
    }

    this.track(session);
    return { id };
  }

  async openSession(sessionId: string): Promise<{ id: string }> {
    const existing = this.active.get(sessionId);
    if (existing) return { id: sessionId };

    const sessions = await SessionManager.list(this.config.cwd);
    const match = sessions.find((s) => s.id === sessionId);
    if (!match) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const modelRuntime = await this.getModelRuntime();
    const model = await this.resolveModel(modelRuntime);

    const { session } = await createAgentSession({
      cwd: this.config.cwd,
      agentDir: this.config.agentDir,
      modelRuntime,
      model,
      sessionManager: SessionManager.open(match.path),
    });

    this.track(session);
    return { id: session.sessionId };
  }

  getOrThrow(sessionId: string): ActiveSession {
    const entry = this.active.get(sessionId);
    if (!entry) {
      throw new Error(
        `Session ${sessionId} is not open. Call open/create first.`,
      );
    }
    return entry;
  }

  subscribe(
    sessionId: string,
    listener: (event: ServerEvent) => void,
  ): () => void {
    const entry = this.getOrThrow(sessionId);
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
  }

  async prompt(sessionId: string, content: string): Promise<void> {
    const entry = this.getOrThrow(sessionId);
    this.emit(entry, { type: "run.start" });
    try {
      await entry.session.prompt(content);
    } catch (err) {
      this.emit(entry, {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
        code: "prompt_failed",
      });
      throw err;
    } finally {
      this.emit(entry, { type: "run.end" });
    }
  }

  async steer(sessionId: string, content: string): Promise<void> {
    const entry = this.getOrThrow(sessionId);
    await entry.session.steer(content);
  }

  async followUp(sessionId: string, content: string): Promise<void> {
    const entry = this.getOrThrow(sessionId);
    await entry.session.followUp(content);
  }

  async abort(sessionId: string): Promise<void> {
    const entry = this.getOrThrow(sessionId);
    await entry.session.abort();
  }

  getMessages(sessionId: string) {
    const entry = this.getOrThrow(sessionId);
    return entry.session.messages;
  }

  disposeSession(sessionId: string): void {
    const entry = this.active.get(sessionId);
    if (!entry) return;
    entry.unsubscribe?.();
    entry.session.dispose();
    this.active.delete(sessionId);
  }

  disposeAll(): void {
    for (const id of [...this.active.keys()]) {
      this.disposeSession(id);
    }
  }

  private track(session: AgentSession): void {
    const id = session.sessionId;
    const entry: ActiveSession = {
      session,
      listeners: new Set(),
    };

    entry.unsubscribe = session.subscribe((event) => {
      for (const mapped of mapPiEvent(event)) {
        this.emit(entry, mapped);
      }
    });

    this.active.set(id, entry);
  }

  private emit(entry: ActiveSession, event: ServerEvent): void {
    for (const listener of entry.listeners) {
      try {
        listener(event);
      } catch {
        // never let a bad subscriber kill the runtime
      }
    }
  }
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}
