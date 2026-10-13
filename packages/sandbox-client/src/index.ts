import {
  Daytona,
  type Sandbox,
  Image,
} from "@daytona/sdk";
import {
  DEFAULT_WEB_PREVIEW_PORT,
  DEFAULT_WORKSPACE_PATH,
  webPreviewConfigPath,
} from "@cloud-agent/protocol";

export type DaytonaClientConfig = {
  apiKey: string;
  apiUrl?: string;
  target?: string;
  /** Pre-built snapshot name. Prefer this in production. */
  snapshot?: string;
  workspacePath?: string;
};

export type CreateSandboxOptions = {
  name: string;
  envVars?: Record<string, string>;
  labels?: Record<string, string>;
  autoStopInterval?: number;
};

export type CloneRepoOptions = {
  repoUrl: string;
  branch?: string;
  path?: string;
};

export type SignedPreview = {
  url: string;
  token?: string;
  port: number;
  expiresInSeconds: number;
};

/**
 * Thin wrapper around @daytona/sdk for environment lifecycle.
 * Repositories and tool execution stay in Daytona; Pi and its credentials stay on the server.
 */
export class SandboxClient {
  readonly daytona: Daytona;
  readonly workspacePath: string;
  readonly snapshot?: string;

  constructor(config: DaytonaClientConfig) {
    this.daytona = new Daytona({
      apiKey: config.apiKey,
      ...(config.apiUrl ? { apiUrl: config.apiUrl } : {}),
      ...(config.target ? { target: config.target } : {}),
    });
    this.workspacePath = config.workspacePath ?? DEFAULT_WORKSPACE_PATH;
    this.snapshot = config.snapshot;
  }

  async create(options: CreateSandboxOptions): Promise<Sandbox> {
    const envVars = {
      WORKSPACE_PATH: this.workspacePath,
      ...options.envVars,
    };

    if (this.snapshot) {
      return this.daytona.create(
        {
          name: options.name,
          snapshot: this.snapshot,
          language: "typescript",
          envVars,
          labels: options.labels,
          autoStopInterval: options.autoStopInterval ?? 60,
          public: false,
        },
        { timeout: 180 },
      );
    }

    // Node is for the user's projects; no Pi process is installed in the sandbox.
    return this.daytona.create(
      {
        name: options.name,
        image: Image.base("node:22-bookworm"),
        language: "typescript",
        envVars,
        labels: options.labels,
        autoStopInterval: options.autoStopInterval ?? 60,
        public: false,
        resources: {
          cpu: 2,
          memory: 4,
          disk: 10,
        },
      },
      { timeout: 300 },
    );
  }

  async get(sandboxId: string): Promise<Sandbox> {
    return this.daytona.get(sandboxId);
  }

  async start(sandboxId: string, timeoutSeconds = 120): Promise<Sandbox> {
    const sandbox = await this.get(sandboxId);
    await sandbox.start(timeoutSeconds);
    return sandbox;
  }

  async stop(sandboxId: string, timeoutSeconds = 60): Promise<void> {
    const sandbox = await this.get(sandboxId);
    await sandbox.stop(timeoutSeconds);
  }

  async delete(sandboxId: string): Promise<void> {
    const sandbox = await this.get(sandboxId);
    await sandbox.delete(60, true);
  }

  async ensureWorkspace(sandbox: Sandbox): Promise<void> {
    await sandbox.process.executeCommand(
      `mkdir -p ${shellQuote(this.workspacePath)}`,
      undefined,
      undefined,
      60,
    );
  }

  async cloneRepository(sandbox: Sandbox, options: CloneRepoOptions): Promise<void> {
    const target = options.path ?? this.workspacePath;
    await sandbox.process.executeCommand(
      `mkdir -p ${shellQuote(target + "/..")} && rm -rf ${shellQuote(target)}`,
      undefined,
      undefined,
      60,
    );

    await sandbox.git.clone(
      options.repoUrl,
      target,
      options.branch,
      undefined,
      undefined,
      undefined,
      false,
      1,
    );
  }

  async initEmptyWorkspace(sandbox: Sandbox, path = this.workspacePath): Promise<void> {
    await this.ensureWorkspace(sandbox);
    await sandbox.process.executeCommand(
      [
        `mkdir -p ${shellQuote(path)}`,
        `cd ${shellQuote(path)}`,
        `if [ ! -d .git ]; then git init -b main; fi`,
        `if [ ! -f README.md ]; then echo "# Workspace" > README.md; fi`,
      ].join(" && "),
      undefined,
      undefined,
      60,
    );
  }

  async configureWebPreview(sandbox: Sandbox, port = DEFAULT_WEB_PREVIEW_PORT): Promise<void> {
    const preview = await this.getSignedPreview(sandbox, port, 86400);
    await sandbox.fs.createFolder("/home/daytona/.cloud-agent", "700");
    if (port !== DEFAULT_WEB_PREVIEW_PORT) await sandbox.fs.createFolder("/home/daytona/.cloud-agent/previews", "700");
    await sandbox.fs.uploadFile(Buffer.from(JSON.stringify({
      url: preview.url,
      port: preview.port,
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
    })), webPreviewConfigPath(port));
  }

  async getSignedPreview(
    sandbox: Sandbox,
    port: number,
    expiresInSeconds = 3600,
  ): Promise<SignedPreview> {
    const signed = await sandbox.getSignedPreviewUrl(port, expiresInSeconds);
    return {
      url: signed.url,
      token: signed.token,
      port,
      expiresInSeconds,
    };
  }

}

export function shellQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function createSandboxClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SandboxClient {
  const apiKey = env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY is required");
  }

  return new SandboxClient({
    apiKey,
    apiUrl: env.DAYTONA_API_URL,
    target: env.DAYTONA_TARGET,
    snapshot: env.DAYTONA_SNAPSHOT || undefined,
    workspacePath: env.WORKSPACE_PATH,
  });
}
