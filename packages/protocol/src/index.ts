import { z } from "zod";

export * from "./llm-provider.js";

/** Application-level environment lifecycle (control plane). */
export const EnvironmentStatusSchema = z.enum([
  "creating",
  "ready",
  "sleeping",
  "starting",
  "stopping",
  "error",
  "deleted",
]);
export type EnvironmentStatus = z.infer<typeof EnvironmentStatusSchema>;

export const EnvironmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  sandboxId: z.string().nullable(),
  repoUrl: z.string().nullable(),
  repoBranch: z.string().nullable(),
  status: EnvironmentStatusSchema,
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActiveAt: z.string().nullable(),
});
export type Environment = z.infer<typeof EnvironmentSchema>;

export const CreateEnvironmentRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  repoUrl: z
    .string()
    .url()
    .refine(
      (url) => {
        try {
          const u = new URL(url);
          return u.protocol === "https:" || u.protocol === "http:";
        } catch {
          return false;
        }
      },
      { message: "repoUrl must be an http(s) URL" },
    )
    .optional(),
  repoBranch: z.string().min(1).max(200).optional(),
  /** Optional empty workspace when no repo is provided. */
  initEmpty: z.boolean().optional().default(false),
});
export type CreateEnvironmentRequest = z.infer<
  typeof CreateEnvironmentRequestSchema
>;

export const SessionRefSchema = z.object({
  id: z.string(),
  environmentId: z.string(),
  piSessionId: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  lastActiveAt: z.string().nullable(),
});
export type SessionRef = z.infer<typeof SessionRefSchema>;

/** Client → sandbox runtime (WebSocket). */
export const ClientWsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("prompt"),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("steer"),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("follow_up"),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("abort"),
  }),
  z.object({
    type: z.literal("ping"),
  }),
]);
export type ClientWsMessage = z.infer<typeof ClientWsMessageSchema>;

/** Sandbox runtime → client (WebSocket / SSE-style events). */
export const ServerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session.state"),
    sessionId: z.string(),
    title: z.string().nullable().optional(),
    messageCount: z.number().optional(),
  }),
  z.object({
    type: z.literal("message.start"),
    role: z.enum(["user", "assistant", "tool"]),
    messageId: z.string().optional(),
  }),
  z.object({
    type: z.literal("message.delta"),
    text: z.string(),
    channel: z.enum(["text", "thinking"]).optional(),
  }),
  z.object({
    type: z.literal("message.end"),
    role: z.enum(["user", "assistant", "tool"]).optional(),
    text: z.string().optional(),
    thinking: z.string().optional(),
    content: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("tool.start"),
    tool: z.string(),
    callId: z.string(),
    args: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("tool.update"),
    tool: z.string(),
    callId: z.string(),
    partial: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("tool.end"),
    tool: z.string(),
    callId: z.string(),
    isError: z.boolean().optional(),
    result: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("run.start"),
  }),
  z.object({
    type: z.literal("run.end"),
  }),
  z.object({
    type: z.literal("compaction"),
    summary: z.string().optional(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal("pong"),
  }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;

export const RuntimeSessionInfoSchema = z.object({
  id: z.string(),
  path: z.string().optional(),
  title: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  messageCount: z.number().optional(),
  firstMessage: z.string().optional(),
});
export type RuntimeSessionInfo = z.infer<typeof RuntimeSessionInfoSchema>;

export const PreviewRequestSchema = z.object({
  port: z.number().int().min(1).max(65535),
  expiresInSeconds: z
    .number()
    .int()
    .min(60)
    .max(86400)
    .optional()
    .default(3600),
});
export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;

export const PreviewResponseSchema = z.object({
  url: z.string().url(),
  port: z.number(),
  expiresInSeconds: z.number().optional(),
  token: z.string().optional(),
});
export type PreviewResponse = z.infer<typeof PreviewResponseSchema>;

/** Default ports. */
export const DEFAULT_RUNTIME_PORT = 4096;
export const DEFAULT_WORKSPACE_PATH = "/home/daytona/workspace/project";
export const DEFAULT_PI_AGENT_DIR = "/home/daytona/.pi/agent";
