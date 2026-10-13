import { useLayoutEffect, useRef, useState } from "react";

/* Expandable agent thinking trace: a step list with a spinner on the active
 * step and muted checks on finished ones. Starts collapsed; the header shows
 * "Thinking" then "Thought for N seconds", and toggles the list on click. */

type ThinkingTraceProps = {
  working: boolean;
  steps: string[];
  durationMs?: number;
  activeLabel?: string;
};

function formatDuration(ms?: number) {
  if (ms === undefined) return "Thought";
  const seconds = Math.max(1, Math.round((ms ?? 0) / 1000));
  return `Thought for ${seconds} second${seconds === 1 ? "" : "s"}`;
}

export function ThinkingTrace({ working, steps, durationMs, activeLabel = "Thinking" }: ThinkingTraceProps) {
  const [expanded, setExpanded] = useState(false);
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [steps.length, expanded, working]);

  return (
    <div className={`thinking-trace ${working ? "is-working" : "is-done"}`}>
      <button
        type="button"
        className="thinking-trace-header"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span role="status" className="thinking-trace-status">
          {working ? (
            <span className="thinking-trace-label shimmer">{activeLabel}</span>
          ) : (
            <span key="done" className="thinking-trace-label done">
              {formatDuration(durationMs)}
            </span>
          )}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="thinking-trace-chevron"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="thinking-trace-collapse" style={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0 }}>
        <div className="thinking-trace-clip">
          <div className="thinking-trace-body">
            <span aria-hidden className="thinking-trace-line" style={{ height: lineHeight ? lineHeight - 2 : 0 }} />
            <div ref={traceRef} className="thinking-trace-rows">
              {steps.map((step, i) => {
                const active = working && i === steps.length - 1;
                return (
                  <div key={`${i}-${step}`} className="thinking-trace-row" style={{ animationDelay: `${Math.min(i, 3) * 60}ms` }}>
                    {active ? (
                      <span className="thinking-trace-spinner" />
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="thinking-trace-check"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    <span className={`thinking-trace-step ${active ? "active" : ""}`}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
