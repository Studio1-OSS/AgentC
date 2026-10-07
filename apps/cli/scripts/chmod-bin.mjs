import { chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
chmodSync(resolve(here, "../dist/index.js"), 0o755);
