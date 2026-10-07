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
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  environmentId: text("environment_id")
    .notNull()
    .references(() => environments.id),
  piSessionId: text("pi_session_id").notNull(),
  title: text("title"),
  createdAt: text("created_at").notNull(),
  lastActiveAt: text("last_active_at"),
});

export type UserRow = typeof users.$inferSelect;
export type EnvironmentRow = typeof environments.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
