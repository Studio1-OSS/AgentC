import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  Square,
  LoaderCircle,
  Check,
  CircleAlert,
  Terminal,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Markdown } from "@/components/Markdown";
import type { Bootstrap, ChatItem } from "@/lib/session";
import { verifiedPreview } from "@/lib/chat-events";

type Props = {
  bootstrap: Bootstrap | null;
  items: ChatItem[];
  conn: "connecting" | "ready" | "error" | "closed";
  error: string | null;
  busy: boolean;
  onSend: (text: string) => void;
  onAbort: () => void;
  reconnect: () => void;
};

export function Chat({
  bootstrap,
  items,
  conn,
  error,
  busy,
  onSend,
  onAbort,
  reconnect,
}: Props) {
  const [draft, setDraft] = useState("");
  const followRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestPreview = [...items].reverse().find((item) => item.kind === "tool" && item.tool === "preview");
  const preview = latestPreview ? verifiedPreview(latestPreview) : null;

  useEffect(() => {
    if (followRef.current)
      bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [items, busy]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy || conn !== "ready") return;
    followRef.current = true;
    onSend(draft);
    setDraft("");
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-5 sm:px-6">
      <header className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.18em] text-ink-soft uppercase">
            Cloud Agent
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-ink">
            {bootstrap?.projectName ?? bootstrap?.environmentName ?? "Session"}
          </h1>
          <p className="mt-1 truncate font-mono text-xs text-ink-soft">
            {bootstrap
              ? `${bootstrap.provider} · ${bootstrap.model}`
              : "Connecting…"}
            {bootstrap?.repoUrl ? ` · ${bootstrap.repoUrl}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {preview && (
            <a href={preview.url} target="_blank" rel="noopener noreferrer"
              title="Open the verified Daytona preview"
              className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent">
              <ExternalLink size={13} /> Open preview
            </a>
          )}
          <StatusPill conn={conn} busy={busy} />
        </div>
      </header>

      <div
        className="chat-transcript min-h-0 flex-1 overflow-y-auto pr-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          followRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
      >
        <div className="flex flex-col gap-4 pb-6">
          {items.length === 0 && conn === "ready" && (
            <p className="rounded-2xl border border-dashed border-line bg-paper-elevated/70 px-4 py-8 text-center text-sm text-ink-soft">
              Ask Pi to explore the repo, run commands, or make changes.
            </p>
          )}
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
          {busy && (
            <p role="status" className="flex items-center gap-2 px-1 text-sm text-ink-soft">
              <LoaderCircle size={14} className="animate-spin" />
              {conn === "ready" ? "Agent working…" : "Reconnecting to your running agent…"}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {(conn === "closed" || conn === "error") && (
        <button type="button" onClick={reconnect} className="mb-3 text-sm font-medium text-accent">
          Reconnect
        </button>
      )}

      <form
        onSubmit={submit}
        className="rounded-2xl border border-line bg-paper-elevated shadow-[0_12px_40px_-24px_rgba(26,29,33,0.45)]"
      >
        <textarea
          aria-label="Message agent"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(e);
            }
          }}
          rows={3}
          placeholder={
            conn === "ready" ? "Message Pi…" : "Waiting for connection…"
          }
          disabled={conn !== "ready"}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-soft/70 disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <span className="font-mono text-[11px] text-ink-soft">
            Enter to send · Shift+Enter for newline
          </span>
          {busy && conn === "ready" ? (
            <button
              type="button"
              onClick={onAbort}
              className="inline-flex size-10 items-center justify-center rounded-full bg-ink text-paper-elevated transition hover:opacity-90"
              aria-label="Stop"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim() || busy || conn !== "ready"}
              className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-paper-elevated transition enabled:hover:opacity-90 disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StatusPill({ conn, busy }: { conn: Props["conn"]; busy: boolean }) {
  const label =
    conn === "connecting"
      ? "Connecting"
      : conn === "error"
        ? "Error"
        : conn === "closed"
          ? "Disconnected"
          : busy
            ? "Running"
            : "Ready";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        conn === "ready" &&
          !busy &&
          "border-accent/25 bg-accent-soft text-accent",
        busy && "border-warn/25 bg-warn/10 text-warn",
        (conn === "connecting" || conn === "closed") &&
          "border-line bg-paper-elevated text-ink-soft",
        conn === "error" && "border-danger/25 bg-danger/5 text-danger",
      )}
    >
      {(conn === "connecting" || busy) && (
        <LoaderCircle className="size-3.5 animate-spin" />
      )}
      {label}
    </span>
  );
}

function Row({ item }: { item: ChatItem }) {
  if (item.kind === "system") {
    return (
      <p className="text-center font-mono text-[11px] tracking-wide text-ink-soft uppercase">
        {item.text}
      </p>
    );
  }

  if (item.kind === "tool") {
    const args =
      item.args && typeof item.args === "object"
        ? (item.args as Record<string, unknown>)
        : null;
    const hint = args?.command ?? args?.path;
    const previewUrl = verifiedPreview(item)?.url;
    return (
      <details className={cn("tool-card", item.isError && "tool-error")}>
        <summary>
          <ChevronRight size={13} className="tool-chevron" />
          <Terminal size={14} />
          <strong>{item.tool}</strong>
          {typeof hint === "string" && <code>{hint}</code>}
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="font-medium text-accent">
              Open preview ↗
            </a>
          )}
          <span className="tool-result-state">
            {item.status === "start" ? (
              <>
                <LoaderCircle size={13} className="animate-spin" />
                Running
              </>
            ) : item.isError ? (
              <>
                <CircleAlert size={13} />
                Failed
              </>
            ) : (
              <>
                <Check size={13} />
                Done
              </>
            )}
          </span>
        </summary>
        {item.args !== undefined && (
          <div className="tool-section">
            <span>Input</span>
            <pre>
              {typeof item.args === "string"
                ? item.args
                : JSON.stringify(item.args, null, 2)}
            </pre>
          </div>
        )}
        {item.details !== undefined &&
          JSON.stringify(item.details) !== "{}" && (
            <div className="tool-section">
              <span>Details</span>
              {item.details &&
              typeof item.details === "object" &&
              "diff" in item.details &&
              typeof item.details.diff === "string" ? (
                <Markdown text={"```diff\n" + item.details.diff + "\n```"} />
              ) : (
                <pre>{JSON.stringify(item.details, null, 2)}</pre>
              )}
            </div>
          )}
        <div className="tool-section">
          <span>Output</span>
          <pre>
            {item.output ||
              (item.status === "start"
                ? "Waiting for output…"
                : "Completed without text output.")}
          </pre>
          <Images sources={item.images} />
        </div>
      </details>
    );
  }
  if (
    item.kind === "assistant" &&
    !item.text &&
    !item.thinking &&
    !item.images?.length
  )
    return null;
  const isUser = item.kind === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "chat-message max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
          isUser
            ? "bg-user text-paper-elevated"
            : "border border-line bg-paper-elevated text-ink",
        )}
      >
        {item.kind === "assistant" && item.thinking && (
          <details className="thinking">
            <summary>{item.streaming ? "Thinking…" : "Reasoning"}</summary>
            <Markdown text={item.thinking} />
          </details>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap">{item.text}</div>
        ) : (
          <Markdown text={item.text} />
        )}
        <Images sources={item.images} />
        {item.kind === "assistant" && item.streaming && item.text && (
          <span className="stream-cursor" aria-label="Reply streaming" />
        )}
      </div>
    </div>
  );
}

function Images({ sources }: { sources?: string[] }) {
  return sources?.length ? (
    <div className="message-images">
      {sources.map((source, index) => (
        <img
          key={index}
          src={source}
          alt={`Agent image ${index + 1}`}
          loading="lazy"
        />
      ))}
    </div>
  ) : null;
}
