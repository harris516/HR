import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RuntimeConfigurationError,
  validateRuntimeConfig
} from "../src/validation/validate-runtime-config.js";

const baseline = JSON.parse(
  readFileSync(resolve("config/runtime.test.json"), "utf8")
) as Record<string, unknown>;

function copyBaseline(): Record<string, any> {
  return structuredClone(baseline);
}

describe("runtime configuration safety gate", () => {
  it("accepts the reviewed synthetic test baseline", () => {
    const config = validateRuntimeConfig(copyBaseline());
    expect(config.agent.id).toBe("aibang-hr-onboarding-agent");
    expect(config.bindings.channels).toEqual([]);
  });

  it("rejects identity drift", () => {
    const config = copyBaseline();
    config.agent.id = "another-agent";
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });

  it("rejects an automation ceiling above A2", () => {
    const config = copyBaseline();
    config.agent.automationCeiling = "A3_EXECUTE";
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });

  it("rejects channel bindings", () => {
    const config = copyBaseline();
    config.bindings.channels = ["hr-bot-01"];
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });

  it("rejects connector bindings", () => {
    const config = copyBaseline();
    config.bindings.connectors = ["hris"];
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });

  it("rejects real customer data", () => {
    const config = copyBaseline();
    config.featureFlags.realCustomerData = true;
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });

  it("rejects external side effects", () => {
    const config = copyBaseline();
    config.featureFlags.externalSideEffects = true;
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });

  it("rejects production mode", () => {
    const config = copyBaseline();
    config.runtime.mode = "production";
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });

  it("rejects unknown configuration fields", () => {
    const config = copyBaseline();
    config.unsafeOverride = true;
    expect(() => validateRuntimeConfig(config)).toThrow(RuntimeConfigurationError);
  });
});
