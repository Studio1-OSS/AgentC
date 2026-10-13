import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
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
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const apiKey = env.CONTROL_PLANE_API_KEY ?? "dev-api-key-change-me";
  const runtimeAccessSecret = env.RUNTIME_ACCESS_SECRET ?? "change-me-runtime-secret";
  const root = resolve(here, "../../..");
  const llm = resolveLlmProviderConfig(env);
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
  };
}
