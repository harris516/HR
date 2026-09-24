import { z } from "zod";
import {
  plannedCapabilityIds,
  skillIds,
  type CapabilityId,
  type SkillId
} from "../contracts/capability.js";
import { skillWorkflowIds, type SkillWorkflowId } from "../contracts/skill-orchestration.js";
import { capabilityRegistry } from "../capabilities/registry.js";
import { skillRegistry } from "./registry.js";

const step2SyntheticActivationProfileSchema = z.object({
  profileId: z.literal("STEP2-SYNTHETIC-SKILL-RUNTIME-V1"),
  environment: z.literal("test"),
  syntheticOnly: z.literal(true),
  realCustomerDataAllowed: z.literal(false),
  formalStateChangeAllowed: z.literal(false),
  outboundMessageAllowed: z.literal(false),
  externalSideEffectAllowed: z.literal(false),
  genericToolFallbackAllowed: z.literal(false),
  requestContextVersion: z.literal("2"),
  skillIds: z.array(z.enum(skillIds)).length(skillIds.length),
  workflowIds: z.array(z.enum(skillWorkflowIds)).length(skillWorkflowIds.length),
  capabilityIds: z.array(z.enum(plannedCapabilityIds)).length(plannedCapabilityIds.length)
}).strict();

export type Step2SyntheticActivationProfile = z.infer<typeof step2SyntheticActivationProfileSchema>;

export const step2SyntheticActivationProfile: Readonly<Step2SyntheticActivationProfile> = Object.freeze(
  step2SyntheticActivationProfileSchema.parse({
    profileId: "STEP2-SYNTHETIC-SKILL-RUNTIME-V1",
    environment: "test",
    syntheticOnly: true,
    realCustomerDataAllowed: false,
    formalStateChangeAllowed: false,
    outboundMessageAllowed: false,
    externalSideEffectAllowed: false,
    genericToolFallbackAllowed: false,
    requestContextVersion: "2",
    skillIds: [...skillIds],
    workflowIds: [...skillWorkflowIds],
    capabilityIds: [...plannedCapabilityIds]
  })
);

function exactSet<T extends string>(actual: readonly T[], expected: readonly T[]): boolean {
  return actual.length === expected.length && new Set(actual).size === expected.length &&
    expected.every((item) => actual.includes(item));
}

export function validateStep2SyntheticActivationProfile(
  input: unknown
): Step2SyntheticActivationProfile {
  const profile = step2SyntheticActivationProfileSchema.parse(input);
  if (!exactSet(profile.skillIds, skillIds) ||
    !exactSet(profile.workflowIds, skillWorkflowIds) ||
    !exactSet(profile.capabilityIds, plannedCapabilityIds)) {
    throw new Error("Step 2 activation profile must contain the exact reviewed allowlists");
  }
  const registeredSkills = new Set<SkillId>(skillRegistry.map((skill) => skill.skillId));
  const registeredWorkflows = new Set<SkillWorkflowId>(skillRegistry.flatMap((skill) =>
    skill.workflows.map((workflow) => workflow.workflowId)));
  if (profile.skillIds.some((skillId) => !registeredSkills.has(skillId)) ||
    profile.workflowIds.some((workflowId) => !registeredWorkflows.has(workflowId))) {
    throw new Error("Step 2 activation profile references an unavailable Skill or workflow");
  }
  const entries = new Map<CapabilityId, (typeof capabilityRegistry.capabilities)[number]>(
    capabilityRegistry.capabilities.map((entry) => [entry.capabilityId, entry])
  );
  for (const capabilityId of profile.capabilityIds) {
    const entry = entries.get(capabilityId);
    if (entry === undefined || entry.status !== "PLANNED_TEST_STUB" || entry.featureFlag.enabled ||
      entry.implementationBindingRef !== null || entry.physicalToolBindingRefs.length !== 0 ||
      entry.connectorBindingRefs.length !== 0 ||
      !["NONE_READ", "NONE_ANALYZE", "DRAFT_ONLY"].includes(entry.sideEffectClass)) {
      throw new Error(`Step 2 activation profile cannot activate unsafe capability: ${capabilityId}`);
    }
  }
  return profile;
}
