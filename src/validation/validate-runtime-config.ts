import { runtimeConfigSchema, type RuntimeConfig } from "../contracts/runtime-config.js";

export class RuntimeConfigurationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Unsafe or incompatible runtime configuration:\n${issues.join("\n")}`);
    this.name = "RuntimeConfigurationError";
    this.issues = issues;
  }
}

export function validateRuntimeConfig(input: unknown): RuntimeConfig {
  const result = runtimeConfigSchema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    });
    throw new RuntimeConfigurationError(issues);
  }

  return result.data;
}
