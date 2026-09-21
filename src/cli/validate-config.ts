import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateRuntimeConfig } from "../validation/validate-runtime-config.js";

const configPath = resolve(process.argv[2] ?? "config/runtime.test.json");

try {
  const source = await readFile(configPath, "utf8");
  const config = validateRuntimeConfig(JSON.parse(source) as unknown);
  process.stdout.write(
    `Runtime configuration accepted: ${config.agent.id} (${config.runtime.mode})\n`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
