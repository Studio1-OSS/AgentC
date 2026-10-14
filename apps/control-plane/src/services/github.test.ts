import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { GitHubApp, TokenCipher, parseGitHubRepo } from "./github.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = {
  appId: "123",
  slug: "cloud-agent-test",
  clientId: "Iv1.client",
  clientSecret: "secret",
  privateKey: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("parseGitHubRepo", () => {
  it("reads owner and repo from github.com URLs only", () => {
    expect(parseGitHubRepo("https://github.com/Studio1-OSS/cloud-agent")).toEqual({ owner: "Studio1-OSS", repo: "cloud-agent" });
    expect(parseGitHubRepo("https://github.com/a/b.git")).toEqual({ owner: "a", repo: "b" });
    expect(parseGitHubRepo("https://gitlab.com/a/b")).toBeNull();
    expect(parseGitHubRepo("https://github.com/only-owner")).toBeNull();
  });
});

describe("TokenCipher", () => {
  it("round-trips and rejects tampering or the wrong secret", () => {
    const cipher = new TokenCipher("one");
    const sealed = cipher.encrypt("ghu_secret");
    expect(sealed).not.toContain("ghu_secret");
    expect(cipher.decrypt(sealed)).toBe("ghu_secret");
    expect(() => new TokenCipher("two").decrypt(sealed)).toThrow();
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => cipher.decrypt(parts.join("."))).toThrow();
  });
});

describe("GitHubApp", () => {
  it("signs app JWTs that verify with the app's public key", () => {
    const jwt = new GitHubApp(config).appJwt(1_000_000);
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(payload!, "base64url").toString())).toEqual({ iat: 999_940, exp: 1_000_540, iss: "123" });
    const valid = createVerify("RSA-SHA256").update(`${header}.${payload}`).verify(publicKey, Buffer.from(signature!, "base64url"));
    expect(valid).toBe(true);
  });

  it("lists repositories across installations, newest first and without duplicates", async () => {
    const repo = (name: string, pushed: string) => ({
      full_name: name, private: true, default_branch: "main", html_url: `https://github.com/${name}`,
      clone_url: `https://github.com/${name}.git`, pushed_at: pushed, permissions: { push: true },
    });
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const path = String(url).replace("https://api.github.com", "");
      if (path.startsWith("/user/installations?")) return json({ installations: [{ id: 1 }, { id: 2 }] });
      if (path.startsWith("/user/installations/1/")) return json({ total_count: 1, repositories: [repo("me/old", "2024-01-01")] });
      return json({ total_count: 2, repositories: [repo("org/new", "2025-01-01"), repo("me/old", "2024-01-01")] });
    }) as unknown as typeof fetch;
    const repos = await new GitHubApp(config, fetchImpl).listRepos("ghu_token");
    expect(repos.map((r) => r.fullName)).toEqual(["org/new", "me/old"]);
    expect(repos[0]).toMatchObject({ private: true, canPush: true, defaultBranch: "main" });
  });

  it("asks for a token limited to the one repository", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/repos/me/app/installation")) return json({ id: 7 });
      expect(String(url)).toBe("https://api.github.com/app/installations/7/access_tokens");
      expect(JSON.parse(String(init?.body))).toEqual({ repositories: ["app"] });
      return json({ token: "ghs_scoped" }, 201);
    }) as unknown as typeof fetch;
    await expect(new GitHubApp(config, fetchImpl).repoToken("me", "app")).resolves.toBe("ghs_scoped");
  });

  it("surfaces GitHub's error message", async () => {
    const fetchImpl = (async () => json({ message: "Not Found" }, 404)) as unknown as typeof fetch;
    await expect(new GitHubApp(config, fetchImpl).getRepo("t", "a", "b")).rejects.toMatchObject({ message: "Not Found", status: 404 });
  });
});
