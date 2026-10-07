import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_BASE_URL,
  buildOpenRouterPiProviderRegistration,
  resolveLlmProviderConfig,
} from "./llm-provider.js";

describe("buildOpenRouterPiProviderRegistration", () => {
  it("builds an openai-completions provider pointing at OpenRouter", () => {
    const config = resolveLlmProviderConfig({
      OPENROUTER_API_KEY: "test-or-key",
      PI_MODEL: "deepseek/deepseek-v4.1-flash",
    });

    expect(buildOpenRouterPiProviderRegistration(config)).toMatchObject({
      name: "OpenRouter",
      baseUrl: DEFAULT_OPENROUTER_BASE_URL,
      api: "openai-completions",
      apiKey: "test-or-key",
      models: [
        {
          id: "deepseek/deepseek-v4.1-flash",
          name: "deepseek/deepseek-v4.1-flash",
          api: "openai-completions",
        },
      ],
    });
  });
});
