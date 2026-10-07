import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./Markdown";

describe("Markdown output", () => {
  it("renders formatted text, tables, tasks and highlighted code while blocking executable markup", () => {
    const html = renderToStaticMarkup(
      <Markdown
        text={
          "## Summary\n\n**Bold** and `inline`\n\n- One\n- Two\n\n| Name | State |\n| --- | --- |\n| App | Ready |\n\n- [x] Done\n\n```js\nconst value = 42;\n```\n\n[Unsafe](javascript:alert(1))\n\n<script>alert(1)</script>\n\n[Docs](https://example.com)\n\n![Preview](https://example.com/image.png)"
        }
      />,
    );
    for (const expected of [
      "<h2>Summary</h2>",
      "<strong>Bold</strong>",
      "<ul>",
      "<table>",
      'type="checkbox"',
      "hljs-keyword",
      "Copy code",
      "noopener noreferrer",
      "<img",
    ])
      expect(html).toContain(expected);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script>");
  });
  it("accepts incomplete streaming code fences", () => {
    const html = renderToStaticMarkup(
      <Markdown text={"Starting…\n\n```typescript\nconst value ="} />,
    );
    expect(html).toContain("const");
    expect(html).toContain("code-block");
  });
});
