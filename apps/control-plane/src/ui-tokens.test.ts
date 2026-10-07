import { describe, expect, it } from "vitest";
import { mintUiToken, verifyUiToken } from "./ui-tokens.js";

describe("ui tokens", () => {
  it("round-trips a valid token", () => {
    const { token, expiresAt } = mintUiToken({
      userId: "u1",
      environmentId: "e1",
      piSessionId: "p1",
      secret: "test-secret",
      ttlMs: 60_000,
    });
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    const payload = verifyUiToken(token, "test-secret");
    expect(payload).toMatchObject({
      userId: "u1",
      environmentId: "e1",
      piSessionId: "p1",
    });
  });

  it("rejects tampered tokens", () => {
    const { token } = mintUiToken({
      userId: "u1",
      environmentId: "e1",
      piSessionId: "p1",
      secret: "test-secret",
    });
    expect(verifyUiToken(token.slice(0, -2) + "ab", "test-secret")).toBeNull();
    expect(verifyUiToken(token, "wrong-secret")).toBeNull();
  });
});
