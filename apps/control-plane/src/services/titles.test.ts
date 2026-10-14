import { describe, expect, it } from "vitest";
import { cleanTitle, fallbackTitle } from "./titles.js";

describe("cleanTitle", () => {
  it("strips quotes, labels, reasoning and trailing punctuation", () => {
    expect(cleanTitle('"Python Add Function."')).toBe("Python Add Function");
    expect(cleanTitle("Title: Fix Login Bug")).toBe("Fix Login Bug");
    expect(cleanTitle("<think>hmm</think>\nBuild Todo App")).toBe("Build Todo App");
  });
});

describe("fallbackTitle", () => {
  it("uses the first sentence without filler words", () => {
    expect(fallbackTitle("can you write a python file to add two numbers. then run it")).toBe(
      "Write a python file to add two numbers",
    );
  });

  it("shortens long prompts at a word boundary", () => {
    const title = fallbackTitle("build a full stack application with authentication and payments and dashboards");
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title.endsWith("…")).toBe(true);
  });
});
