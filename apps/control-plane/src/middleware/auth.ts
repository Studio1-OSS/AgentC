import type { Context, Next } from "hono";
import type { AppConfig } from "../config.js";

export type AuthVariables = {
  userId: string;
};

/**
 * MVP auth: Bearer API key + optional X-User-Id.
 * Replace with real auth (Clerk/Auth.js/etc.) before exposing publicly.
 */
export function createAuthMiddleware(config: AppConfig) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || token !== config.apiKey) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const userId = c.req.header("x-user-id") ?? "default-user";
    c.set("userId", userId);
    await next();
  };
}
