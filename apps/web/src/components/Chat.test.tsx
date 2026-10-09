import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Chat } from "./Chat";
import type { ChatItem } from "@/lib/session";

const render = (items: ChatItem[], busy = false) => renderToStaticMarkup(
  <Chat bootstrap={null} items={items} conn="ready" busy={busy} error={null}
    onSend={() => {}} onAbort={() => {}} reconnect={() => {}} />,
);
const preview: ChatItem = { id: "preview", kind: "tool", tool: "preview", callId: "p", status: "end",
  details: { url: "https://3000-signed.proxy.daytona.work", expiresAt: new Date(Date.now() + 86400_000).toISOString() } };
describe("chat preview and progress", () => {
  it("keeps the verified preview accessible outside the collapsed tool card", () => {
    const html = render([preview]);
    expect(html.match(/href="https:\/\/3000-signed.proxy.daytona.work\/"/g)).toHaveLength(2);
    expect(html.slice(0, html.indexOf("</header>"))).toContain("Open preview");
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("hides the header action if the latest preview is not ready or has expired", () => {
    for (const item of [{ ...preview, isError: true }, { ...preview, details: { ...preview.details as object, expiresAt: new Date(0).toISOString() } }]) {
      const html = render([preview, { ...item, id: "latest" }]);
      expect(html.slice(0, html.indexOf("</header>"))).not.toContain("Open preview");
    }
  });
  it("shows progress and an available Stop control while the agent works", () => {
    const html = render([], true);
    expect(html).toContain('role="status"');
    expect(html).toContain("Agent working…");
    expect(html).toContain('aria-label="Stop"');
    expect(html).not.toContain('aria-label="Send"');
  });
});
