import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skillIds } from "../src/contracts/capability.js";
import { skillRegistry } from "../src/skills/registry.js";

const skillRoot = join(process.cwd(), "workspace-template", "skills");
const expectedTools: Record<(typeof skillIds)[number], string> = {
  onboarding_task_navigation_pack: "aibang_hr_onboarding_task_navigation",
  onboarding_case_intake_pack: "aibang_hr_onboarding_case_intake",
  onboarding_requirement_tracking_pack: "aibang_hr_onboarding_requirement_tracking",
  onboarding_status_control_pack: "aibang_hr_onboarding_status_control",
  onboarding_coordination_pack: "aibang_hr_onboarding_coordination",
  onboarding_delivery_pack: "aibang_hr_onboarding_delivery"
};

function skillFile(skillId: string): string {
  return readFileSync(join(skillRoot, skillId, "SKILL.md"), "utf8");
}

function frontmatterValue(content: string, field: string): string | undefined {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  return frontmatter?.split(/\r?\n/).find((line) => line.startsWith(`${field}:`))
    ?.slice(field.length + 1).trim();
}

describe("OpenClaw Step 2 Skill packaging", () => {
  it("packages exactly the six canonical workspace Skills", () => {
    const directories = readdirSync(skillRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(directories).toEqual([...skillIds].sort());
  });

  it.each(skillIds)("keeps %s aligned with its registry workflows and one controlled tool", (skillId) => {
    const content = skillFile(skillId);
    const definition = skillRegistry.find((candidate) => candidate.skillId === skillId);
    expect(frontmatterValue(content, "name")).toBe(skillId);
    expect(frontmatterValue(content, "description")?.length).toBeGreaterThan(0);
    expect(frontmatterValue(content, "version")).toBe("1.0.0");
    expect(definition).toBeDefined();
    for (const workflow of definition!.workflows) {
      expect(content).toContain(`\`${workflow.workflowId}\``);
    }
    expect(content).toContain(`\`${expectedTools[skillId]}\``);
    for (const [otherSkillId, toolName] of Object.entries(expectedTools)) {
      if (otherSkillId !== skillId) expect(content).not.toContain(`\`${toolName}\``);
    }
    expect(content).toContain("A2_DRAFT");
    expect(content).toContain("可信运行时");
    expect(content).toMatch(/不得.*(shell|exec)/);
    expect(content).toMatch(/正式|READY/);
    expect(content).toMatch(/不得|不可用|不改变/);
  });

  it("contains no real credentials or known real Feishu identifiers", () => {
    const combined = skillIds.map(skillFile).join("\n");
    expect(combined).not.toMatch(/app_secret|client_secret|access_token|BEGIN .*PRIVATE KEY/i);
    expect(combined).not.toMatch(/\bou_[A-Za-z0-9]{16,}\b/);
  });
});
