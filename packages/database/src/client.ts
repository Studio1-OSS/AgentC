import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export function createDatabase(databaseUrl: string): {
  db: AppDatabase;
  sqlite: Database.Database;
} {
  const path = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function migrateDatabase(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT,
      display_name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      sandbox_id TEXT,
      repo_url TEXT,
      repo_branch TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      environment_id TEXT NOT NULL REFERENCES environments(id),
      pi_session_id TEXT NOT NULL,
      title TEXT,
      created_at TEXT NOT NULL,
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      environment_id TEXT NOT NULL REFERENCES environments(id),
      name TEXT NOT NULL,
      repo_url TEXT,
      repo_branch TEXT,
      path TEXT NOT NULL,
      preview_port INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(environment_id, preview_port)
    );

    CREATE INDEX IF NOT EXISTS idx_environments_user_id ON environments(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_environment_id ON sessions(environment_id);
    CREATE INDEX IF NOT EXISTS idx_projects_environment_id ON projects(environment_id);
  `);
  const columns = sqlite.pragma("table_info(sessions)") as { name: string }[];
  if (!columns.some((column) => column.name === "project_id")) {
    sqlite.exec("ALTER TABLE sessions ADD COLUMN project_id TEXT REFERENCES projects(id)");
  }
}
