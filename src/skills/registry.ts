import { z } from "zod";
import {
  capabilityRefSchema,
  plannedCapabilityIds,
  skillIdSchema,
  type CapabilityId,
  type SkillId
} from "../contracts/capability.js";
import {
  skillWorkflowIdSchema,
  type SkillWorkflowId
} from "../contracts/skill-orchestration.js";

const skillWorkflowDefinitionSchema = z.object({
  workflowId: skillWorkflowIdSchema,
  capabilityRefs: z.array(capabilityRefSchema).max(8),
  stopOnNonSuccess: z.literal(true),
  genericToolFallbackAllowed: z.literal(false)
}).strict();

const skillDefinitionSchema = z.object({
  skillId: skillIdSchema,
  skillVersion: z.literal("1.0.0"),
  status: z.literal("PLANNED_TEST_STUB"),
  automationCeiling: z.literal("A2_DRAFT"),
  requiredRequestContextVersion: z.literal("2"),
  workflows: z.array(skillWorkflowDefinitionSchema).min(1),
  featureEnabled: z.literal(false),
  runtimeBindingRef: z.null(),
  owner: z.literal("root")
}).strict();

export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;

function ref(capabilityId: CapabilityId) {
  return { capabilityId, capabilityVersion: "1.0.0" as const };
}

const definitions: SkillDefinition[] = [
  {
    skillId: "onboarding_task_navigation_pack",
    skillVersion: "1.0.0",
    status: "PLANNED_TEST_STUB",
    automationCeiling: "A2_DRAFT",
    requiredRequestContextVersion: "2",
    workflows: [{
      workflowId: "navigation_route_handoff",
      capabilityRefs: [],
      stopOnNonSuccess: true,
      genericToolFallbackAllowed: false
    }],
    featureEnabled: false,
    runtimeBindingRef: null,
    owner: "root"
  },
  {
    skillId: "onboarding_case_intake_pack",
    skillVersion: "1.0.0",
    status: "PLANNED_TEST_STUB",
    automationCeiling: "A2_DRAFT",
    requiredRequestContextVersion: "2",
    workflows: [{
      workflowId: "case_intake_candidate",
      capabilityRefs: [
        ref("hr.onboarding.intake.handoff.read"),
        ref("hr.onboarding.intake.completeness.evaluate"),
        ref("hr.onboarding.intake.draft")
      ],
      stopOnNonSuccess: true,
      genericToolFallbackAllowed: false
    }, {
      workflowId: "synthetic_case_create_from_accepted_offer",
      capabilityRefs: [],
      stopOnNonSuccess: true,
      genericToolFallbackAllowed: false
    }],
    featureEnabled: false,
    runtimeBindingRef: null,
    owner: "root"
  },
  {
    skillId: "onboarding_requirement_tracking_pack",
    skillVersion: "1.0.0",
    status: "PLANNED_TEST_STUB",
    automationCeiling: "A2_DRAFT",
    requiredRequestContextVersion: "2",
    workflows: [{
      workflowId: "requirement_completion_candidate",
      capabilityRefs: [
        ref("hr.onboarding.requirement.status.read"),
        ref("hr.onboarding.requirement.completion.evaluate")
      ],
      stopOnNonSuccess: true,
      genericToolFallbackAllowed: false
    }, {
      workflowId: "synthetic_requirement_completion_update",
      capabilityRefs: [],
      stopOnNonSuccess: true,
      genericToolFallbackAllowed: false
    }],
    featureEnabled: false,
    runtimeBindingRef: null,
    owner: "root"
  },
  {
    skillId: "onboarding_status_control_pack",
    skillVersion: "1.0.0",
    status: "PLANNED_TEST_STUB",
    automationCeiling: "A2_DRAFT",
    requiredRequestContextVersion: "2",
    workflows: [
      {
        workflowId: "case_workbench_read",
        capabilityRefs: [ref("hr.onboarding.case.list")],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      },
      {
        workflowId: "case_status_inspection",
        capabilityRefs: [
          ref("hr.onboarding.case.status.read"),
          ref("hr.onboarding.source_evidence.inspect"),
          ref("hr.onboarding.audit.timeline.read")
        ],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      },
      {
        workflowId: "risk_workbox",
        capabilityRefs: [ref("hr.onboarding.risk.list")],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      }
    ],
    featureEnabled: false,
    runtimeBindingRef: null,
    owner: "root"
  },
  {
    skillId: "onboarding_coordination_pack",
    skillVersion: "1.0.0",
    status: "PLANNED_TEST_STUB",
    automationCeiling: "A2_DRAFT",
    requiredRequestContextVersion: "2",
    workflows: [
      {
        workflowId: "responsibility_reminder_draft",
        capabilityRefs: [
          ref("hr.onboarding.responsibility.workbox.read"),
          ref("hr.onboarding.reminder.draft")
        ],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      },
      {
        workflowId: "responsibility_escalation_draft",
        capabilityRefs: [
          ref("hr.onboarding.responsibility.workbox.read"),
          ref("hr.onboarding.escalation.draft")
        ],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      },
      {
        workflowId: "practice_review_draft",
        capabilityRefs: [ref("hr.onboarding.review_request.draft")],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      }
    ],
    featureEnabled: false,
    runtimeBindingRef: null,
    owner: "root"
  },
  {
    skillId: "onboarding_delivery_pack",
    skillVersion: "1.0.0",
    status: "PLANNED_TEST_STUB",
    automationCeiling: "A2_DRAFT",
    requiredRequestContextVersion: "2",
    workflows: [
      {
        workflowId: "day1_ready_card_candidate",
        capabilityRefs: [
          ref("hr.onboarding.readiness.evaluate"),
          ref("hr.onboarding.ready_card.draft")
        ],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      },
      {
        workflowId: "readiness_revalidation",
        capabilityRefs: [ref("hr.onboarding.readiness.revalidate")],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      },
      {
        workflowId: "artifact_center_read",
        capabilityRefs: [ref("hr.onboarding.artifact.list")],
        stopOnNonSuccess: true,
        genericToolFallbackAllowed: false
      }
    ],
    featureEnabled: false,
    runtimeBindingRef: null,
    owner: "root"
  }
];

export const skillRegistry: readonly SkillDefinition[] = definitions.map((definition) =>
  skillDefinitionSchema.parse(definition)
);

const registeredWorkflowIds = skillRegistry.flatMap((skill) =>
  skill.workflows.map((workflow) => workflow.workflowId)
);
if (new Set(registeredWorkflowIds).size !== registeredWorkflowIds.length) {
  throw new Error("skill workflow IDs must be globally unique");
}

const registeredCapabilityIds = skillRegistry.flatMap((skill) => [
  ...new Set(skill.workflows.flatMap((workflow) =>
    workflow.capabilityRefs.map((item) => item.capabilityId)
  ))
]);
if (
  registeredCapabilityIds.length !== plannedCapabilityIds.length ||
  new Set(registeredCapabilityIds).size !== plannedCapabilityIds.length ||
  plannedCapabilityIds.some((capabilityId) => !registeredCapabilityIds.includes(capabilityId))
) {
  throw new Error("skill registry must cover every planned capability exactly once");
}

export function getSkillDefinition(skillId: SkillId): SkillDefinition {
  const definition = skillRegistry.find((candidate) => candidate.skillId === skillId);
  if (definition === undefined) throw new Error(`skill is not registered: ${skillId}`);
  return definition;
}

export function getSkillWorkflow(skillId: SkillId, workflowId: SkillWorkflowId) {
  return getSkillDefinition(skillId).workflows.find((workflow) => workflow.workflowId === workflowId);
}
