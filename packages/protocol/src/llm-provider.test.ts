import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEBIUS_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  NEBIUS_PROVIDER_ID,
  OPENROUTER_PROVIDER_ID,
  buildOpenRouterPiProviderRegistration,
  buildSandboxModelEnv,
  resolveLlmProviderConfig,
} from "./llm-provider.js";

describe("resolveLlmProviderConfig", () => {
  it("selects OpenRouter when OPENROUTER_API_KEY is set", () => {
    const config = resolveLlmProviderConfig({
      OPENROUTER_API_KEY: "test-or-key",
    });

    expect(config.providerId).toBe(OPENROUTER_PROVIDER_ID);
    expect(config.modelId).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(config.baseUrl).toBe(DEFAULT_OPENROUTER_BASE_URL);
    expect(config.apiKey).toBe("test-or-key");
    expect(config.apiKeyEnvVar).toBe("OPENROUTER_API_KEY");
  });

  it("prefers OpenRouter over Nebius when both keys are present", () => {
    const config = resolveLlmProviderConfig({
      OPENROUTER_API_KEY: "test-or-key",
      NEBIUS_API_KEY: "test-nebius-key",
      PI_MODEL: "deepseek/deepseek-v4.1-flash",
    });

    expect(config.providerId).toBe(OPENROUTER_PROVIDER_ID);
    expect(config.modelId).toBe("deepseek/deepseek-v4.1-flash");
  });

  it("selects Nebius when only NEBIUS_API_KEY is set", () => {
    const config = resolveLlmProviderConfig({
      NEBIUS_API_KEY: "test-nebius-key",
    });

    expect(config.providerId).toBe(NEBIUS_PROVIDER_ID);
    expect(config.baseUrl).toBe(DEFAULT_NEBIUS_BASE_URL);
  });

  it("falls back to anthropic when only ANTHROPIC_API_KEY is set", () => {
    const config = resolveLlmProviderConfig({
      ANTHROPIC_API_KEY: "sk-ant-test",
    });

    expect(config.providerId).toBe("anthropic");
    expect(config.apiKeyEnvVar).toBe("ANTHROPIC_API_KEY");
  });
});

describe("buildSandboxModelEnv", () => {
  it("injects OpenRouter key and provider settings for sandboxes", () => {
    const env = buildSandboxModelEnv({
      OPENROUTER_API_KEY: "test-or-key",
      PI_MODEL: "deepseek/deepseek-v4.1-flash",
    });

    expect(env).toMatchObject({
      OPENROUTER_API_KEY: "test-or-key",
      PI_PROVIDER: OPENROUTER_PROVIDER_ID,
      PI_MODEL: "deepseek/deepseek-v4.1-flash",
      OPENROUTER_BASE_URL: DEFAULT_OPENROUTER_BASE_URL,
    });
  });
});

describe("buildOpenRouterPiProviderRegistration", () => {
  it("builds openai-completions provider pointing at OpenRouter", () => {
    const config = resolveLlmProviderConfig({
      OPENROUTER_API_KEY: "test-or-key",
      PI_MODEL: "deepseek/deepseek-v4.1-flash",
    });

    const reg = buildOpenRouterPiProviderRegistration(config);
    expect(reg.baseUrl).toBe(DEFAULT_OPENROUTER_BASE_URL);
    expect(reg.api).toBe("openai-completions");
    expect(reg.models[0]?.id).toBe("deepseek/deepseek-v4.1-flash");
  });
});
