import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_NEBIUS_BASE_URL,
  DEFAULT_NEBIUS_MODEL,
  resolveLlmProviderConfig,
  type LlmProviderConfig,
} from "@cloud-agent/protocol";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

export type AppConfig = {
  port: number;
  host: string;
  apiKey: string;
  databaseUrl: string;
  runtimeAccessSecret: string;
  browserSessionSecret: string;
  workspacePath: string;
  piAgentDir: string;
  llm: LlmProviderConfig;
  daytonaApiKey?: string;
  /** Set only when every GitHub App setting is present. */
  github?: GitHubAppConfig;
};

export type GitHubAppConfig = {
  appId: string;
  slug: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
};

/** GitHub App settings from .env; the private key comes from a file path or inline PEM. */
export function loadGitHubConfig(env: NodeJS.ProcessEnv): GitHubAppConfig | undefined {
  const appId = env.GITHUB_APP_ID?.trim();
  const slug = env.GITHUB_APP_SLUG?.trim();
  const clientId = env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = env.GITHUB_CLIENT_SECRET?.trim();
  const keyPath = env.GITHUB_APP_PRIVATE_KEY_PATH?.trim();
  let privateKey = env.GITHUB_APP_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  if (!privateKey && keyPath) {
    try {
      privateKey = readFileSync(keyPath, "utf8");
    } catch {
      console.warn(`GitHub App private key not readable at ${keyPath}; GitHub sign-in is disabled.`);
    }
  }
  if (!appId || !slug || !clientId || !clientSecret || !privateKey) return undefined;
  return { appId, slug, clientId, clientSecret, privateKey };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.CONTROL_PLANE_API_KEY ?? "dev-api-key-change-me";
  const runtimeAccessSecret = env.RUNTIME_ACCESS_SECRET ?? "change-me-runtime-secret";
  const root = resolve(here, "../../..");
  let llm: LlmProviderConfig;
  try {
    llm = resolveLlmProviderConfig(env);
  } catch {
    // Boot without a model key so the UI and Daytona routes still work; agent
    // turns fail until a key is configured (index.ts warns about it).
    llm = {
      providerId: env.PI_PROVIDER?.trim() || "nebius",
      modelId: env.PI_MODEL?.trim() || DEFAULT_NEBIUS_MODEL,
      apiKey: "",
      apiKeyEnvVar: "NEBIUS_API_KEY",
      baseUrl: env.NEBIUS_BASE_URL?.trim() || DEFAULT_NEBIUS_BASE_URL,
      api: "openai-completions",
    };
  }
  const dataDir = env.RAILWAY_VOLUME_MOUNT_PATH || resolve(root, "data");

  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? "0.0.0.0",
    apiKey,
    databaseUrl: env.DATABASE_URL ?? `file:${resolve(dataDir, "cloud-agent.db")}`,
    runtimeAccessSecret,
    browserSessionSecret: env.BROWSER_SESSION_SECRET?.trim() || runtimeAccessSecret,
    workspacePath: env.WORKSPACE_PATH ?? "/home/daytona/workspace/project",
    piAgentDir: env.PI_AGENT_DIR ?? resolve(dataDir, "pi"),
    llm,
    daytonaApiKey: env.DAYTONA_API_KEY,
    github: loadGitHubConfig(env),
  };
}
