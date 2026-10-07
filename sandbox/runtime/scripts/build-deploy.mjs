#!/usr/bin/env node
/**
 * Produce a self-contained deployable folder for uploading into Daytona sandboxes.
 * Resolves workspace:* deps by bundling with esbuild.
 */
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = resolve(here, "..");
const outDir = resolve(runtimeRoot, "deploy");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [resolve(runtimeRoot, "src/server.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: resolve(outDir, "server.js"),
  packages: "external",
  banner: {
    js: `import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);`,
  },
});

// Deploy package.json with concrete (non-workspace) dependencies.
const srcPkg = JSON.parse(readFileSync(resolve(runtimeRoot, "package.json"), "utf8"));
const deployPkg = {
  name: "sandbox-runtime-deploy",
  version: srcPkg.version,
  type: "module",
  private: true,
  dependencies: {
    "@earendil-works/pi-ai": srcPkg.dependencies["@earendil-works/pi-ai"],
    "@earendil-works/pi-coding-agent": srcPkg.dependencies["@earendil-works/pi-coding-agent"],
    "@hono/node-server": srcPkg.dependencies["@hono/node-server"],
    hono: srcPkg.dependencies.hono,
    ws: srcPkg.dependencies.ws,
    zod: srcPkg.dependencies.zod,
  },
};
writeFileSync(resolve(outDir, "package.json"), JSON.stringify(deployPkg, null, 2));

// esbuild with packages:external still leaves @cloud-agent/protocol inlined
// because we import from source via workspace — verify bundle has no workspace refs.
const bundled = readFileSync(resolve(outDir, "server.js"), "utf8");
if (bundled.includes("@cloud-agent/protocol")) {
  // Re-bundle protocol into the file by not marking it external (default).
  console.warn("Protocol still referenced; rebuilding fully bundled...");
  await build({
    entryPoints: [resolve(runtimeRoot, "src/server.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    outfile: resolve(outDir, "server.js"),
    external: [
      "@earendil-works/*",
      "@hono/node-server",
      "hono",
      "ws",
      "zod",
    ],
    banner: {
      js: `import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);`,
    },
  });
}

console.log(`Deploy bundle written to ${outDir}`);
if (!existsSync(resolve(outDir, "server.js"))) {
  process.exit(1);
}
