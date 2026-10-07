import type { CliConfig } from "./config.js";

export type Environment = {
  id: string;
  name: string;
  status: string;
  repoUrl: string | null;
  errorMessage: string | null;
};

export class ApiClient {
  constructor(private readonly config: CliConfig) {}

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.config.apiKey}`,
      "content-type": "application/json",
      "x-user-id": this.config.userId,
    };
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listEnvironments(): Promise<Environment[]> {
    const res = await fetch(`${this.config.baseUrl}/environments`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    const body = (await res.json()) as { environments: Environment[] };
    return body.environments;
  }

  async getEnvironment(id: string): Promise<Environment> {
    const res = await fetch(`${this.config.baseUrl}/environments/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Environment>;
  }

  async createEnvironment(input: {
    repoUrl?: string;
    repoBranch?: string;
    name?: string;
    initEmpty?: boolean;
  }): Promise<Environment> {
    const res = await fetch(`${this.config.baseUrl}/environments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Environment>;
  }

  async startEnvironment(id: string): Promise<Environment> {
    const res = await fetch(`${this.config.baseUrl}/environments/${id}/start`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Environment>;
  }

  async stopEnvironment(id: string): Promise<Environment> {
    const res = await fetch(`${this.config.baseUrl}/environments/${id}/stop`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Environment>;
  }

  async removeEnvironment(id: string): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/environments/${id}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async openUi(id: string, title?: string) {
    const res = await fetch(`${this.config.baseUrl}/environments/${id}/ui`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{
      uiPath: string;
      token: string;
      piSessionId: string;
      environmentName: string;
    }>;
  }

  async waitUntilReady(
    id: string,
    opts?: { timeoutMs?: number; onTick?: (env: Environment) => void },
  ): Promise<Environment> {
    const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const env = await this.getEnvironment(id);
      opts?.onTick?.(env);
      if (env.status === "ready") return env;
      if (env.status === "error") {
        throw new Error(env.errorMessage ?? "environment provisioning failed");
      }
      await sleep(2500);
    }
    throw new Error("timed out waiting for environment");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
