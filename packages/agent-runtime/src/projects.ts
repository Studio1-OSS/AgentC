import { dirname, join } from "node:path";
import { z } from "zod";
import { DEFAULT_WEB_PREVIEW_PORT, ProjectIdSchema } from "@agentc/protocol";
import { PiSessionRegistry, type RuntimeConfig } from "./pi.js";

export class ProjectRegistries {
  private readonly registries = new Map<string, PiSessionRegistry>();
  private readonly ports = new Map<string, number>();

  constructor(private readonly config: RuntimeConfig, private readonly toolsForProject?: (cwd: string, port: number) => NonNullable<RuntimeConfig["tools"]>) {}

  get(projectId = "default", previewPort = DEFAULT_WEB_PREVIEW_PORT): PiSessionRegistry {
    ProjectIdSchema.parse(projectId);
    z.number().int().min(1).max(65535).parse(previewPort);
    if (projectId === "default" && previewPort !== DEFAULT_WEB_PREVIEW_PORT) throw new Error("Invalid default project port");
    if (this.ports.has(projectId) && this.ports.get(projectId) !== previewPort) throw new Error("Project preview port changed");
    let registry = this.registries.get(projectId);
    if (!registry) {
      const cwd = projectId === "default" ? this.config.cwd : join(dirname(this.config.cwd), "projects", projectId);
      registry = new PiSessionRegistry({ ...this.config, cwd, agentDir: join(this.config.agentDir, projectId), previewPort, tools: this.toolsForProject?.(cwd, previewPort) ?? this.config.tools });
      this.registries.set(projectId, registry);
      this.ports.set(projectId, previewPort);
    }
    return registry;
  }

  disposeAll(): void {
    for (const registry of this.registries.values()) registry.disposeAll();
  }
}
