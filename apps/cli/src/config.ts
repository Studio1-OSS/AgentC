import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(homedir(), ".agentc", "config.env") });

export type CliConfig = {
  baseUrl: string;
  apiKey: string;
  userId: string;
};

export function loadCliConfig(): CliConfig {
  return {
    baseUrl: (process.env.AGENTC_URL ?? "http://127.0.0.1:8787").replace(
      /\/$/,
      "",
    ),
    apiKey: process.env.CONTROL_PLANE_API_KEY ?? "dev-api-key-change-me",
    userId: process.env.AGENTC_USER_ID ?? "default-user",
  };
}

export function ensureConfigDir(): string {
  const dir = resolve(homedir(), ".agentc");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function rememberLastChat(url: string): void {
  const dir = ensureConfigDir();
  writeFileSync(resolve(dir, "last-chat.url"), url, "utf8");
}

export function readLastChat(): string | null {
  const path = resolve(homedir(), ".agentc", "last-chat.url");
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8").trim() || null;
}
