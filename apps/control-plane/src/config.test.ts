import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { NEBIUS_PROVIDER_ID, OPENROUTER_PROVIDER_ID } from "@agentc/protocol";

describe("loadConfig", () => {
  it("resolves OpenRouter when OPENROUTER_API_KEY is present", () => {
    const config = loadConfig({
      OPENROUTER_API_KEY: "test-or-key",
      PI_PROVIDER: "openrouter",
      PI_MODEL: "deepseek/deepseek-v4.1-flash",
      CONTROL_PLANE_API_KEY: "dev",
      RUNTIME_ACCESS_SECRET: "secret",
    });

    expect(config.llm.providerId).toBe(OPENROUTER_PROVIDER_ID);
    expect(config.llm.modelId).toBe("deepseek/deepseek-v4.1-flash");
    expect(config.llm.baseUrl).toContain("openrouter.ai");
  });

  it("resolves Nebius when only NEBIUS_API_KEY is present", () => {
    const config = loadConfig({
      NEBIUS_API_KEY: "test-nebius-key",
      PI_PROVIDER: "nebius",
      PI_MODEL: "meta-models/muse-spark-open",
      CONTROL_PLANE_API_KEY: "dev",
      RUNTIME_ACCESS_SECRET: "secret",
    });

    expect(config.llm.providerId).toBe(NEBIUS_PROVIDER_ID);
    expect(config.llm.modelId).toBe("meta-models/muse-spark-open");
    expect(config.llm.baseUrl).toContain("tokenfactory.nebius.com");
  });
});
