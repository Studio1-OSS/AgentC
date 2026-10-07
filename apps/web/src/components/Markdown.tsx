import { useRef, useState, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";

function CodeBlock({ children, ...props }: ComponentProps<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? "");
      setCopied(true);
      setError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(true);
    }
  }
  return (
    <div className="code-block">
      <div className="code-header">
        <span>Code</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
          {error ? "Copy unavailable" : copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre {...props} ref={ref}>
        {children}
      </pre>
    </div>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        skipHtml
        components={{
          pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              target={props.href?.startsWith("#") ? undefined : "_blank"}
              rel="noopener noreferrer"
            />
          ),
          img: ({ node: _node, ...props }) => (
            <img {...props} loading="lazy" referrerPolicy="no-referrer" />
          ),
          table: ({ node: _node, ...props }) => (
            <div className="markdown-table">
              <table {...props} />
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
