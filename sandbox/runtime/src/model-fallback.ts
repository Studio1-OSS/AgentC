import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage, Model, Api } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai/utils/event-stream";

type StreamFn = AgentSession["agent"]["streamFunction"];
export const MODEL_IDLE_TIMEOUT_MS = 45_000;

/** Retry only the failed model request; completed tool calls stay in the transcript. */
export function withModelFallback(
  stream: StreamFn,
  fallback: Model<Api>,
  onFallback: () => void,
): StreamFn {
  let runSignal: AbortSignal | undefined;
  let usingFallback = false;
  return (model, context, options) => {
    if (runSignal !== options?.signal) {
      runSignal = options?.signal;
      usingFallback = false;
    }
    const output = createAssistantMessageEventStream();
    void (async () => {
      let started = false;
      const candidates = usingFallback || (model.provider === fallback.provider && model.id === fallback.id)
        ? [fallback] : [model, fallback];
      for (const [index, candidate] of candidates.entries()) {
        const controller = new AbortController();
        const signal = options?.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let failure: AssistantMessage | undefined;
        const wait = async <T>(pending: Promise<T>): Promise<T> => {
          let cancel: (() => void) | undefined;
          try {
            return await Promise.race([pending, new Promise<never>((_resolve, reject) => {
              cancel = () => reject(new Error(options?.signal?.aborted ? "Reply stopped" : "The model stopped responding"));
              signal.addEventListener("abort", cancel, { once: true });
              if (signal.aborted) cancel();
              timer = setTimeout(() => {
                reject(new Error("The model stopped responding"));
                controller.abort();
              }, MODEL_IDLE_TIMEOUT_MS);
            })]);
          } finally {
            clearTimeout(timer);
            if (cancel) signal.removeEventListener("abort", cancel);
          }
        };
        try {
          if (signal.aborted) throw new Error("Reply stopped");
          const response = await wait(Promise.resolve(stream(candidate, context, {
            ...options, signal, timeoutMs: MODEL_IDLE_TIMEOUT_MS, maxRetries: 0,
            // Resolve credentials for the candidate, rather than reuse the paid provider's key.
            apiKey: candidate.provider === model.provider ? options?.apiKey : undefined,
          })));
          const iterator = response[Symbol.asyncIterator]();
          while (true) {
            const next = await wait(iterator.next());
            if (next.done) throw new Error("The model returned no response");
            const event = next.value;
            if (event.type === "error") {
              failure = event.error;
              throw new Error(event.error.errorMessage || "The model failed to respond");
            }
            if (event.type === "done") {
              if (event.reason !== "deferred" && !event.message.content.some((part) =>
                part.type === "toolCall" || (part.type === "text" && part.text.trim()),
              )) throw new Error("The model returned an empty response");
              output.push(event);
              output.end();
              return;
            }
            // A single request gets one start event, even if its provider changes.
            if (event.type === "start") {
              if (started) continue;
              started = true;
            }
            output.push(event);
          }
        } catch (error) {
          controller.abort();
          if (!options?.signal?.aborted && index + 1 < candidates.length) {
            usingFallback = true;
            onFallback();
            continue;
          }
          const aborted = Boolean(options?.signal?.aborted);
          const detail = error instanceof Error ? error.message : String(error);
          const errorMessage = candidate.provider === "openrouter" && candidate.id === "openrouter/free" && detail.includes("allowed-providers")
            ? "Free-model fallback is blocked by your OpenRouter allowed providers. Enable a provider serving free models at https://openrouter.ai/settings/privacy, then retry."
            : detail;
          const message: AssistantMessage = {
            role: "assistant", content: [], api: candidate.api, provider: candidate.provider, model: candidate.id,
            usage: failure?.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            stopReason: aborted ? "aborted" : "error",
            errorMessage: aborted ? "Reply stopped" : errorMessage,
            timestamp: Date.now(),
          };
          output.push({ type: "error", reason: aborted ? "aborted" : "error", error: message });
          output.end();
          return;
        }
      }
    })();
    return output;
  };
}
