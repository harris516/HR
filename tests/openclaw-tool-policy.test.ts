import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { skillIds } from "../src/contracts/capability.js";

const runtimeTools = [
  "aibang_hr_onboarding_task_navigation",
  "aibang_hr_onboarding_case_intake",
  "aibang_hr_onboarding_requirement_tracking",
  "aibang_hr_onboarding_status_control",
  "aibang_hr_onboarding_coordination",
  "aibang_hr_onboarding_delivery"
] as const;
const legacyTool = "aibang_hr_onboarding_test_ready_card";
const requiredDenials = [
  "group:fs",
  "group:runtime",
  "group:web",
  "group:messaging",
  "exec",
  "browser",
  "http",
  "db"
];

function config(name: string): any {
  return JSON.parse(readFileSync(resolve("config", name), "utf8"));
}

function agentPolicy(value: any): any {
  return value.agents.entries["aibang-hr-onboarding-agent"];
}

describe("OpenClaw Step 2 Skill and Tool policy", () => {
  it("locks the target HR Agent to exactly six Skills and six high-level tools", () => {
    const policy = agentPolicy(config("openclaw.step2-target.example.json"));
    expect([...policy.skills].sort()).toEqual([...skillIds].sort());
    expect(policy.tools.profile).toBe("minimal");
    expect(policy.tools.profile).not.toBe("full");
    expect([...policy.tools.alsoAllow].sort()).toEqual([...runtimeTools].sort());
    expect(policy.tools.alsoAllow).not.toContain(legacyTool);
    expect(policy.tools.deny).toEqual(expect.arrayContaining(requiredDenials));
    expect(policy.tools.elevated).toEqual({ enabled: false });
  });

  it("retains the legacy Ready-card tool only in the pre-cutover rollback window", () => {
    const policy = agentPolicy(config("openclaw.step2-precutover.example.json"));
    expect([...policy.skills].sort()).toEqual([...skillIds].sort());
    expect(policy.tools.profile).toBe("minimal");
    expect([...policy.tools.alsoAllow].sort()).toEqual([...runtimeTools, legacyTool].sort());
    expect(policy.tools.deny).toEqual(expect.arrayContaining(requiredDenials));
    expect(policy.tools.elevated).toEqual({ enabled: false });
  });

  it("declares only optional high-level plugin tools and no low-level Capability tools", () => {
    const manifest = JSON.parse(readFileSync(resolve("openclaw-test-tool", "openclaw.plugin.json"), "utf8"));
    expect([...manifest.contracts.tools].sort()).toEqual([...runtimeTools, legacyTool].sort());
    expect(Object.keys(manifest.toolMetadata).sort()).toEqual([...runtimeTools, legacyTool].sort());
    expect(Object.values(manifest.toolMetadata).every((entry: any) => entry.optional === true)).toBe(true);
    expect(manifest.contracts.tools.some((name: string) => name.startsWith("hr.onboarding."))).toBe(false);
  });

  it("routes plugin business execution through the Step 2 runtime composition root", () => {
    const source = readFileSync(resolve("openclaw-test-tool", "index.mjs"), "utf8");
    expect(source).toContain("Step2SyntheticSkillRuntime");
    expect(source).not.toMatch(/SyntheticCapabilityExecutor|SyntheticSkillImplementationRegistry|CapabilityGateway/);
    expect(source).toContain("Deprecated compatibility-only Step 1 Ready-card tool");
  });
});
