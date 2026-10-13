import { useEffect, useState, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";

/* An agent run as compact rows: tool calls with inline chips, then file-diff
 * chips summarising the edits. Rows reveal one by one, each expands to show
 * what the tool did, and hovering a file chip previews its diff. */

const STEP_MS = 700;

export type ToolIcon = "think" | "write" | "run" | "read";
export type ToolDetailLine = { text: string; tone?: "add" };
export type ToolStep = {
  icon: ToolIcon;
  label: string;
  chip: string;
  mono?: boolean;
  detailMono?: boolean;
  detail: ToolDetailLine[];
};
export type DiffLine = { text: string; tone: "add" | "del" | "ctx" };
export type FileDiff = { file: string; add: number; del: number; lines: DiffLine[]; isNew?: boolean };

const ICONS: Record<ToolIcon, ReactNode> = {
  think: <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" fill="currentColor" stroke="none" />,
  write: <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
  run: <path d="M4 17l6-5-6-5M12 19h8" />,
  read: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </>
  ),
};

const PREVIEW_LINES = 8;

function Chevron({ size = 12, rotate = 0, className = "" }: { size?: number; rotate?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

type ToolCallsProps = {
  steps: ToolStep[];
  diffs: FileDiff[];
  animate?: boolean;
  onViewChanges?: () => void;
};

export function ToolCalls({ steps, diffs, animate = true, onViewChanges }: ToolCallsProps) {
  const total = steps.length + 1; // rows, then diff chips
  const [step, setStep] = useState(animate ? 0 : total);
  const [open, setOpen] = useState(true);
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<{ file: string; x: number; top?: number; bottom?: number; dark: boolean } | null>(null);

  useEffect(() => {
    if (step >= total) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, total]);

  const toggleRow = (index: number) =>
    setOpenRows((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const openPreview = (diff: FileDiff) => (event: SyntheticEvent) => {
    const rect = (event.currentTarget as Element).closest("[data-diffchip]")!.getBoundingClientRect();
    const previewHeight = 38 + Math.min(diff.lines.length, PREVIEW_LINES) * 20;
    const fitsBelow = rect.bottom + 6 + previewHeight <= window.innerHeight - 12;
    setPreview({
      file: diff.file,
      // the preview renders in a body portal, outside the themed dashboard
      dark: !!document.querySelector(".dashboard.theme-zinc"),
      x: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
      ...(fitsBelow ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }),
    });
  };
  const closePreview = (file: string) => () => setPreview((current) => (current?.file === file ? null : current));
  const previewDiff = preview ? diffs.find((d) => d.file === preview.file) : undefined;

  const header = `${steps.length} tool call${steps.length === 1 ? "" : "s"}, ${diffs.length} file${diffs.length === 1 ? "" : "s"} changed`;

  return (
    <div className="tool-calls">
      <button type="button" className="tool-calls-header" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Chevron rotate={open ? 0 : -90} className="tool-calls-chevron" />
        <span>{header}</span>
      </button>

      <div className="tool-calls-collapse" style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}>
        <div className="tool-calls-clip">
          <div className="tool-calls-rows">
            {steps.slice(0, step).map((row, index) => {
              const rowOpen = openRows.has(index);
              return (
                <div key={index} className="tool-calls-item">
                  <button
                    type="button"
                    className={`tool-calls-row ${rowOpen ? "open" : ""}`}
                    aria-expanded={rowOpen}
                    onClick={() => toggleRow(index)}
                  >
                    <span className="tool-calls-glyph">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="tool-calls-icon"
                      >
                        {ICONS[row.icon]}
                      </svg>
                      <Chevron rotate={rowOpen ? 0 : -90} className="tool-calls-row-chevron" />
                    </span>
                    <span className="tool-calls-label">{row.label}</span>
                    <span className={`tool-calls-chip ${row.mono ? "mono" : ""}`}>{row.chip}</span>
                  </button>

                  <div className="tool-calls-collapse" style={{ gridTemplateRows: rowOpen ? "1fr" : "0fr", opacity: rowOpen ? 1 : 0 }}>
                    <div className="tool-calls-clip">
                      <div className="tool-calls-detail">
                        {row.detail.map((line, i) => (
                          <span key={i} className={`${row.detailMono ? "mono" : ""} ${line.tone === "add" ? "add" : ""}`}>
                            {line.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {step >= total && diffs.length > 0 && (
            <div className="tool-calls-diffs">
              {diffs.map((diff, i) => (
                <span
                  key={diff.file}
                  data-diffchip
                  className="tool-calls-diff-wrap"
                  onMouseEnter={openPreview(diff)}
                  onMouseLeave={closePreview(diff.file)}
                >
                  <button
                    type="button"
                    className="tool-calls-diff-chip"
                    aria-label={`Show diff for ${diff.file}`}
                    onFocus={openPreview(diff)}
                    onBlur={closePreview(diff.file)}
                    onClick={onViewChanges}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="tool-calls-diff-name">{diff.file}</span>
                    <span className="add">+{diff.add}</span>
                    {diff.del > 0 && <span className="del">−{diff.del}</span>}
                  </button>
                </span>
              ))}
              {onViewChanges && (
                <button
                  type="button"
                  className="tool-calls-more"
                  onClick={onViewChanges}
                  style={{ animationDelay: `${diffs.length * 80}ms` }}
                >
                  View changes
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {preview &&
        previewDiff &&
        createPortal(
          <div
            className={`tool-calls-preview ${preview.dark ? "dark" : ""}`}
            style={{
              left: preview.x,
              top: preview.top,
              bottom: preview.bottom,
              transformOrigin: preview.top === undefined ? "bottom left" : "top left",
            }}
          >
            <div className="tool-calls-preview-head">
              <span className="tool-calls-preview-name">{previewDiff.file}</span>
              <span>
                <span className="add">+{previewDiff.add}</span>
                {previewDiff.del > 0 && <span className="del"> −{previewDiff.del}</span>}
              </span>
            </div>
            <div className="tool-calls-preview-body">
              {previewDiff.lines.slice(0, PREVIEW_LINES).map((line, index) => (
                <div key={index} className={`tool-calls-preview-line ${line.tone}`}>
                  <span className="sign">{line.tone === "add" ? "+" : line.tone === "del" ? "−" : " "}</span>
                  <span className="text">{line.text || " "}</span>
                </div>
              ))}
              {previewDiff.lines.length > PREVIEW_LINES && (
                <div className="tool-calls-preview-more">{previewDiff.lines.length - PREVIEW_LINES} more lines</div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
