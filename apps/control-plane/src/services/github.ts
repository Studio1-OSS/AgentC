import { createCipheriv, createDecipheriv, createHash, createSign, randomBytes } from "node:crypto";
import type { GitHubAppConfig } from "../config.js";

const API = "https://api.github.com";

export type GitHubUser = { id: number; login: string; name: string | null; avatarUrl: string | null };
export type GitHubRepo = {
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  pushedAt: string | null;
  canPush: boolean;
};
export type UserTokens = { accessToken: string; refreshToken: string | null; expiresAt: string | null };

/** Splits a github.com repository URL into owner and repo, or returns null for anything else. */
export function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com") return null;
    const [owner, repo] = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

/** AES-256-GCM for tokens stored in SQLite, keyed from the server's session secret. */
export class TokenCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash("sha256").update(`github-tokens:${secret}`).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
  }

  decrypt(sealed: string): string {
    const [version, iv, tag, data] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || !data) throw new Error("Unreadable GitHub token");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  }
}

export class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class GitHubApp {
  constructor(
    readonly config: GitHubAppConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Page where a user installs the app on their account or picks more repositories. */
  get installUrl(): string {
    return `https://github.com/apps/${this.config.slug}/installations/new`;
  }

  authorizeUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({ client_id: this.config.clientId, state, redirect_uri: redirectUri });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  /** Short-lived RS256 JWT that authenticates as the app itself. */
  appJwt(now = Math.floor(Date.now() / 1000)): string {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const body = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: this.config.appId })}`;
    const signature = createSign("RSA-SHA256").update(body).sign(this.config.privateKey).toString("base64url");
    return `${body}.${signature}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<UserTokens> {
    return this.tokenRequest({ code, redirect_uri: redirectUri });
  }

  async refresh(refreshToken: string): Promise<UserTokens> {
    return this.tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  async getUser(token: string): Promise<GitHubUser> {
    const user = await this.api<{ id: number; login: string; name: string | null; avatar_url: string | null }>("/user", token);
    return { id: user.id, login: user.login, name: user.name, avatarUrl: user.avatar_url };
  }

  /** Repositories the user granted this app, across every installation they can see. */
  async listRepos(token: string): Promise<GitHubRepo[]> {
    const { installations } = await this.api<{ installations: { id: number }[] }>("/user/installations?per_page=100", token);
    const repos: GitHubRepo[] = [];
    for (const installation of installations) {
      for (let page = 1; page <= 10; page += 1) {
        const data = await this.api<{ repositories: RawRepo[]; total_count: number }>(
          `/user/installations/${installation.id}/repositories?per_page=100&page=${page}`,
          token,
        );
        repos.push(...data.repositories.map(toRepo));
        if (page * 100 >= data.total_count) break;
      }
    }
    const unique = new Map(repos.map((repo) => [repo.fullName.toLowerCase(), repo]));
    return [...unique.values()].sort((a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
  }

  /** The repository as the signed-in user sees it; throws when they cannot reach it through this app. */
  async getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
    return toRepo(await this.api<RawRepo>(`/repos/${owner}/${repo}`, token));
  }

  /** One-hour token scoped to a single repository, for cloning and pushing inside the sandbox. */
  async repoToken(owner: string, repo: string): Promise<string> {
    const jwt = this.appJwt();
    const installation = await this.api<{ id: number }>(`/repos/${owner}/${repo}/installation`, jwt);
    const result = await this.api<{ token: string }>(`/app/installations/${installation.id}/access_tokens`, jwt, {
      method: "POST",
      body: JSON.stringify({ repositories: [repo] }),
    });
    return result.token;
  }

  async createPullRequest(
    token: string,
    input: { owner: string; repo: string; head: string; base: string; title: string; body: string; draft?: boolean },
  ): Promise<{ url: string; number: number }> {
    const pr = await this.api<{ html_url: string; number: number }>(`/repos/${input.owner}/${input.repo}/pulls`, token, {
      method: "POST",
      body: JSON.stringify({ title: input.title, head: input.head, base: input.base, body: input.body, draft: input.draft ?? false }),
    });
    return { url: pr.html_url, number: pr.number };
  }

  /** Revokes the user's grant so the app disappears from their authorized apps. */
  async revoke(token: string): Promise<void> {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
    await this.fetchImpl(`${API}/applications/${this.config.clientId}/grant`, {
      method: "DELETE",
      headers: { ...baseHeaders(), Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token }),
    });
  }

  private async tokenRequest(params: Record<string, string>): Promise<UserTokens> {
    const response = await this.fetchImpl("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: this.config.clientId, client_secret: this.config.clientSecret, ...params }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!response.ok || !data.access_token) {
      throw new GitHubError(data.error_description ?? "GitHub sign-in failed", 401);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
    };
  }

  private async api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${API}${path}`, {
      ...init,
      headers: { ...baseHeaders(), Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { message?: string; errors?: { message?: string }[] };
      const detail = data.errors?.map((e) => e.message).filter(Boolean).join("; ");
      throw new GitHubError(detail || data.message || `GitHub request failed (${response.status})`, response.status);
    }
    return (await response.json()) as T;
  }
}

type RawRepo = {
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  clone_url: string;
  pushed_at: string | null;
  permissions?: { push?: boolean };
};

function toRepo(raw: RawRepo): GitHubRepo {
  return {
    fullName: raw.full_name,
    private: raw.private,
    defaultBranch: raw.default_branch,
    htmlUrl: raw.html_url,
    cloneUrl: raw.clone_url,
    pushedAt: raw.pushed_at,
    canPush: raw.permissions?.push ?? false,
  };
}

function baseHeaders() {
  return { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "cloud-agent" };
}
