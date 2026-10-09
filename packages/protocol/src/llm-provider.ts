export const OPENROUTER_PROVIDER_ID = "openrouter" as const;
export const NEBIUS_PROVIDER_ID = "nebius" as const;

/** Daytona Tier 1/2 allowlists openrouter.ai — preferred for sandboxes. */
export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL = "qwen/qwen3-235b-a22b-2507";

export const DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1";
export const DEFAULT_NEBIUS_MODEL = "moonshotai/Kimi-K2.7-Code";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
export const DEFAULT_OPENAI_MODEL = "gpt-4.1";

export type LlmProviderConfig = {
  providerId: string;
  modelId: string;
  apiKey: string;
  apiKeyEnvVar: string;
  /** Present for OpenAI-compatible custom endpoints. */
  baseUrl?: string;
  api?: "openai-completions" | "anthropic-messages" | "openai-responses";
  /** Optional request headers (e.g. OpenRouter HTTP-Referer). */
  headers?: Record<string, string>;
};

/**
 * Resolve which LLM provider the runtime/control-plane should use.
 * OpenRouter wins when OPENROUTER_API_KEY is set (Daytona-reachable).
 */
export function resolveLlmProviderConfig(
  env: Record<string, string | undefined>,
): LlmProviderConfig {
  const explicitProvider = env.PI_PROVIDER?.trim();

  if (
    env.OPENROUTER_API_KEY &&
    (!explicitProvider || explicitProvider === OPENROUTER_PROVIDER_ID)
  ) {
    return {
      providerId: OPENROUTER_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      apiKey: env.OPENROUTER_API_KEY,
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      baseUrl: env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL,
      api: "openai-completions",
      headers: {
        "HTTP-Referer":
          env.OPENROUTER_HTTP_REFERER?.trim() || "https://cloud-agent.local",
        "X-Title": env.OPENROUTER_APP_TITLE?.trim() || "cloud-agent",
      },
    };
  }

  if (explicitProvider === OPENROUTER_PROVIDER_ID) {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error("PI_PROVIDER=openrouter requires OPENROUTER_API_KEY");
    }
    return {
      providerId: OPENROUTER_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      apiKey: env.OPENROUTER_API_KEY,
      apiKeyEnvVar: "OPENROUTER_API_KEY",
      baseUrl: env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL,
      api: "openai-completions",
      headers: {
        "HTTP-Referer":
          env.OPENROUTER_HTTP_REFERER?.trim() || "https://cloud-agent.local",
        "X-Title": env.OPENROUTER_APP_TITLE?.trim() || "cloud-agent",
      },
    };
  }

  if (
    env.NEBIUS_API_KEY &&
    (!explicitProvider || explicitProvider === NEBIUS_PROVIDER_ID)
  ) {
    return {
      providerId: NEBIUS_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_NEBIUS_MODEL,
      apiKey: env.NEBIUS_API_KEY,
      apiKeyEnvVar: "NEBIUS_API_KEY",
      baseUrl: env.NEBIUS_BASE_URL?.trim() || DEFAULT_NEBIUS_BASE_URL,
      api: "openai-completions",
    };
  }

  if (explicitProvider === NEBIUS_PROVIDER_ID) {
    if (!env.NEBIUS_API_KEY) {
      throw new Error("PI_PROVIDER=nebius requires NEBIUS_API_KEY");
    }
    return {
      providerId: NEBIUS_PROVIDER_ID,
      modelId: env.PI_MODEL?.trim() || DEFAULT_NEBIUS_MODEL,
      apiKey: env.NEBIUS_API_KEY,
      apiKeyEnvVar: "NEBIUS_API_KEY",
      baseUrl: env.NEBIUS_BASE_URL?.trim() || DEFAULT_NEBIUS_BASE_URL,
      api: "openai-completions",
    };
  }

  if (
    env.ANTHROPIC_API_KEY &&
    (!explicitProvider || explicitProvider === "anthropic")
  ) {
    return {
      providerId: "anthropic",
      modelId: env.PI_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
      apiKey: env.ANTHROPIC_API_KEY,
      apiKeyEnvVar: "ANTHROPIC_API_KEY",
      api: "anthropic-messages",
    };
  }

  if (
    env.OPENAI_API_KEY &&
    (!explicitProvider || explicitProvider === "openai")
  ) {
    return {
      providerId: "openai",
      modelId: env.PI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      apiKeyEnvVar: "OPENAI_API_KEY",
      api: "openai-responses",
    };
  }

  throw new Error(
    "No LLM API key found. Set OPENROUTER_API_KEY (preferred for Daytona), NEBIUS_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.",
  );
}

/**
 * Environment variables injected into each Daytona sandbox so the in-sandbox
 * Pi runtime can authenticate to the configured provider.
 */
export function buildSandboxModelEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const config = resolveLlmProviderConfig(env);
  const out: Record<string, string> = {
    PI_PROVIDER: config.providerId,
    PI_MODEL: config.modelId,
    [config.apiKeyEnvVar]: config.apiKey,
  };

  if (config.providerId === OPENROUTER_PROVIDER_ID && config.baseUrl) {
    out.OPENROUTER_BASE_URL = config.baseUrl;
  }
  if (config.providerId === NEBIUS_PROVIDER_ID && config.baseUrl) {
    out.NEBIUS_BASE_URL = config.baseUrl;
  }
  if (env.OPENROUTER_API_KEY) {
    out.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;
    out.OPENROUTER_BASE_URL = env.OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL;
  }

  return out;
}

/** Pi `registerProvider` payload for OpenAI-compatible gateways (OpenRouter / Nebius). */
export function buildOpenAICompatiblePiProviderRegistration(
  config: LlmProviderConfig,
  displayName: string,
) {
  if (!config.baseUrl || config.api !== "openai-completions") {
    throw new Error(
      `buildOpenAICompatiblePiProviderRegistration requires openai-completions + baseUrl for ${config.providerId}`,
    );
  }

  return {
    name: displayName,
    baseUrl: config.baseUrl,
    api: "openai-completions" as const,
    apiKey: config.apiKey,
    ...(config.headers ? { headers: config.headers } : {}),
    models: [
      {
        id: config.modelId,
        name: config.modelId,
        api: "openai-completions" as const,
        reasoning: false,
        input: ["text"] as ("text" | "image")[],
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
        },
        contextWindow: 1_048_576,
        maxTokens: 8192,
      },
    ],
  };
}

/** @deprecated Prefer buildOpenAICompatiblePiProviderRegistration */
export function buildNebiusPiProviderRegistration(config: LlmProviderConfig) {
  if (config.providerId !== NEBIUS_PROVIDER_ID || !config.baseUrl) {
    throw new Error(
      "buildNebiusPiProviderRegistration requires a Nebius config",
    );
  }
  return buildOpenAICompatiblePiProviderRegistration(
    config,
    "Nebius Token Factory",
  );
}

export function buildOpenRouterPiProviderRegistration(
  config: LlmProviderConfig,
) {
  if (config.providerId !== OPENROUTER_PROVIDER_ID || !config.baseUrl) {
    throw new Error(
      "buildOpenRouterPiProviderRegistration requires an OpenRouter config",
    );
  }
  return buildOpenAICompatiblePiProviderRegistration(config, "OpenRouter");
}
