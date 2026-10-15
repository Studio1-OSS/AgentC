import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  createdAt: text("created_at").notNull(),
});

export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  sandboxId: text("sandbox_id"),
  repoUrl: text("repo_url"),
  repoBranch: text("repo_branch"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastActiveAt: text("last_active_at"),
  /** "owner/repo" when the repository was opened through the user's GitHub connection. */
  githubRepo: text("github_repo"),
});

/** A browser user's linked GitHub account. Tokens are encrypted at rest. */
export const githubConnections = sqliteTable("github_connections", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  githubUserId: integer("github_user_id").notNull(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token").notNull(),
  accessTokenExpiresAt: text("access_token_expires_at"),
  refreshToken: text("refresh_token"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id),
  piSessionId: text("pi_session_id").notNull(),
  projectId: text("project_id").references(() => projects.id),
  title: text("title"),
  createdAt: text("created_at").notNull(),
  lastActiveAt: text("last_active_at"),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  environmentId: text("environment_id").notNull().references(() => environments.id),
  name: text("name").notNull(),
  repoUrl: text("repo_url"),
  repoBranch: text("repo_branch"),
  path: text("path").notNull(),
  previewPort: integer("preview_port").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type EnvironmentRow = typeof environments.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type ProjectRow = typeof projects.$inferSelect;
export type GithubConnectionRow = typeof githubConnections.$inferSelect;
