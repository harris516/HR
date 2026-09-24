import { z } from "zod";
import { skillIdSchema } from "../contracts/capability.js";
import { requestContextSchema } from "../contracts/navigation.js";
import { skillWorkflowIdSchema, type SkillWorkflowId } from "../contracts/skill-orchestration.js";

const refSchema = z.string().min(1).max(128);
const languageSchema = z.string().min(2).max(16).default("zh-CN");
const pageSizeSchema = z.number().int().positive().max(50).default(20);
const caseInputSchema = z.object({
  caseRef: refSchema,
  expectedCaseVersion: z.number().int().nonnegative().default(7)
}).strict();

export const step2WorkflowInputSchemas = {
  navigation_route_handoff: z.object({ requestText: z.string().min(1).max(2000) }).strict(),
  case_intake_candidate: z.object({
    handoffRef: refSchema,
    expectedSourceVersion: refSchema.default("ats-offer-v3"),
    language: languageSchema
  }).strict(),
  synthetic_case_create_from_accepted_offer: z.object({
    offerRef: refSchema,
    candidateRef: refSchema,
    candidateDisplayName: z.string().trim().min(1).max(128),
    plannedStartAt: z.iso.datetime({ offset: true }).nullable().optional(),
    sourceVersionRef: refSchema.default("synthetic-offer-v1")
  }).strict(),
  requirement_completion_candidate: caseInputSchema.extend({
    requirementRef: refSchema,
    expectedRequirementVersion: z.number().int().nonnegative().default(3)
  }).strict(),
  synthetic_requirement_completion_update: z.object({
    caseRef: refSchema.optional(),
    candidateDisplayName: z.string().trim().min(1).max(128).optional(),
    requirementKind: z.enum(["DOCUMENTS", "IT_ACCOUNT", "DEVICE"]),
    expectedCaseVersion: z.number().int().positive(),
    expectedRequirementVersion: z.number().int().positive(),
    evidenceRef: refSchema.default("synthetic-human-confirmation"),
    evidenceValidationRef: refSchema.default("synthetic-validation-v1"),
    sourceVersionRef: refSchema.default("synthetic-update-v1")
  }).strict().refine((value) => value.caseRef !== undefined || value.candidateDisplayName !== undefined,
    "caseRef or candidateDisplayName is required"),
  case_workbench_read: z.object({ pageSize: pageSizeSchema }).strict(),
  case_status_inspection: caseInputSchema,
  risk_workbox: z.object({ caseRef: refSchema, pageSize: pageSizeSchema }).strict(),
  responsibility_reminder_draft: caseInputSchema.extend({ language: languageSchema }).strict(),
  responsibility_escalation_draft: caseInputSchema.extend({ language: languageSchema }).strict(),
  practice_review_draft: caseInputSchema.extend({ language: languageSchema }).strict(),
  day1_ready_card_candidate: caseInputSchema.extend({ language: languageSchema }).strict(),
  readiness_revalidation: caseInputSchema.extend({
    previousEvaluationRef: refSchema,
    invalidationTriggerRef: refSchema
  }).strict(),
  artifact_center_read: z.object({ caseRef: refSchema, pageSize: pageSizeSchema }).strict()
} as const satisfies Record<SkillWorkflowId, z.ZodType>;

export const step2RuntimeInvocationSchema = z.object({
  skillId: skillIdSchema,
  workflowId: skillWorkflowIdSchema,
  requestContext: requestContextSchema,
  trustedInvocationId: refSchema.optional(),
  businessInput: z.unknown()
}).strict();

export interface Step2RuntimeInvocation {
  skillId: z.infer<typeof skillIdSchema>;
  workflowId: SkillWorkflowId;
  requestContext: z.infer<typeof requestContextSchema>;
  businessInput: unknown;
}

export function parseStep2WorkflowInput(
  workflowId: SkillWorkflowId,
  input: unknown
): Record<string, unknown> {
  return step2WorkflowInputSchemas[workflowId].parse(input) as Record<string, unknown>;
}
