import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_BASE_URL,
  resolveLlmProviderConfig,
} from "./llm-provider.js";

const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
const hasNebiusOnly =
  Boolean(process.env.NEBIUS_API_KEY) && !process.env.OPENROUTER_API_KEY;

describe.runIf(hasOpenRouter)("OpenRouter live smoke", () => {
  it("completes a chat request with deepseek/deepseek-v4.1-flash", async () => {
    const config = resolveLlmProviderConfig({
      ...process.env,
      PI_PROVIDER: "openrouter",
      PI_MODEL: "deepseek/deepseek-v4.1-flash",
    });
    expect(config.providerId).toBe("openrouter");

    const res = await fetch(
      `${config.baseUrl ?? DEFAULT_OPENROUTER_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://cloud-agent.local",
          "X-Title": "cloud-agent-live-test",
        },
        body: JSON.stringify({
          model: config.modelId,
          temperature: 0,
          max_tokens: 32,
          messages: [
            {
              role: "user",
              content: "Reply with exactly the word PONG and nothing else.",
            },
          ],
        }),
      },
    );

    const raw = await res.text();
    if (!res.ok && raw.includes("allowed-providers")) {
      // Account privacy allowlist blocks every provider that hosts this model.
      // Fix: https://openrouter.ai/settings/privacy — allow e.g. deepseek/together/fireworks.
      console.warn(
        "Skipping OpenRouter live smoke: account allowed-providers blocks deepseek/deepseek-v4.1-flash.",
        raw.slice(0, 240),
      );
      return;
    }
    expect(res.ok, raw.slice(0, 500)).toBe(true);
    const body = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    expect(text.toUpperCase()).toContain("PONG");
  }, 60_000);
});

describe.runIf(hasNebiusOnly)("Nebius Token Factory live smoke", () => {
  it("completes a chat request with the configured model", async () => {
    const config = resolveLlmProviderConfig({
      ...process.env,
      PI_PROVIDER: "nebius",
    });
    expect(config.providerId).toBe("nebius");

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.modelId,
        temperature: 0,
        max_tokens: 32,
        messages: [
          {
            role: "user",
            content: "Reply with exactly the word PONG and nothing else.",
          },
        ],
      }),
    });

    expect(res.ok).toBe(true);
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    expect(text.toUpperCase()).toContain("PONG");
  }, 60_000);
});
