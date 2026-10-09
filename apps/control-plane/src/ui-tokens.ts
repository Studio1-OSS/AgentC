import { createHmac, timingSafeEqual } from "node:crypto";
import { ProjectIdSchema } from "@cloud-agent/protocol";

export type UiTokenPayload = {
  userId: string;
  environmentId: string;
  piSessionId: string;
  projectId?: string;
  exp: number;
};

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

export function signUiToken(
  payload: UiTokenPayload,
  secret: string,
): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyUiToken(
  token: string,
  secret: string,
): UiTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = fromB64url(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as UiTokenPayload;
    if (
      !payload.userId ||
      !payload.environmentId ||
      !payload.piSessionId ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    if (payload.projectId !== undefined && !ProjectIdSchema.safeParse(payload.projectId).success) return null;
    return payload;
  } catch {
    return null;
  }
}

export function mintUiToken(args: {
  userId: string;
  environmentId: string;
  piSessionId: string;
  projectId?: string;
  secret: string;
  ttlMs?: number;
}): { token: string; expiresAt: string } {
  const ttlMs = args.ttlMs ?? 12 * 60 * 60 * 1000;
  const exp = Date.now() + ttlMs;
  const token = signUiToken(
    {
      userId: args.userId,
      environmentId: args.environmentId,
      piSessionId: args.piSessionId,
      projectId: args.projectId,
      exp,
    },
    args.secret,
  );
  return { token, expiresAt: new Date(exp).toISOString() };
}
