import { describe, expect, it } from "vitest";
import { chatReconnectDelay, CHAT_RECONNECT_GIVE_UP, chatTargetFromToken } from "./session";

describe("chat reconnect helpers", () => {
  it("reads the workspace and project from a UI token so a lost socket can remint chat", () => {
    const encode = (payload: object) =>
      btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    expect(chatTargetFromToken(`${encode({ environmentId: "workspace-2d9d480c", projectId: "proj", piSessionId: "pi" })}.sig`))
      .toEqual({ environmentId: "workspace-2d9d480c", projectId: "proj" });
    expect(chatTargetFromToken(`${encode({ environmentId: "workspace-2d9d480c" })}.sig`))
      .toEqual({ environmentId: "workspace-2d9d480c", projectId: "default" });
    expect(chatTargetFromToken("not-a-token")).toBeNull();
  });

  it("keeps backing off after the visible give-up point so a recovered runtime can reconnect", () => {
    expect(CHAT_RECONNECT_GIVE_UP).toBe(8);
    expect(chatReconnectDelay(0)).toBe(1000);
    expect(chatReconnectDelay(8)).toBe(10_000);
    expect(chatReconnectDelay(20)).toBe(10_000);
  });
});
