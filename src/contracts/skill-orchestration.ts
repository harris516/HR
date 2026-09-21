import { z } from "zod";
import { canonicalReasonCodeSchema } from "../capabilities/reason-codes.js";
import { capabilityGatewayRequestSchema, capabilityGatewayResultSchema } from "./capability-gateway.js";
import { capabilityExecutionOutcomeSchema } from "./capability-execution.js";
import {
  capabilityRefSchema,
  phcSchema,
  semanticVersionSchema,
  skillIdSchema
} from "./capability.js";
import { requestContextSchema } from "./navigation.js";

const refSchema = z.string().min(1);
const dateTimeSchema = z.string().datetime();

export const skillWorkflowIds = [
  "navigation_route_handoff",
  "case_intake_candidate",
  "requirement_completion_candidate",
  "case_workbench_read",
  "case_status_inspection",
  "risk_workbox",
  "responsibility_reminder_draft",
  "responsibility_escalation_draft",
  "practice_review_draft",
  "day1_ready_card_candidate",
  "readiness_revalidation",
  "artifact_center_read"
] as const;

export const skillWorkflowIdSchema = z.enum(skillWorkflowIds);

export const skillRefSchema = z.object({
  skillId: skillIdSchema,
  skillVersion: semanticVersionSchema
}).strict();

export const practiceHandoffSignalSchema = z.object({
  practiceCandidateId: refSchema,
  caseRef: refSchema.optional(),
  affectedObjectRefs: z.array(refSchema),
  candidatePHC: phcSchema.refine((value) => value !== "PHC_0" && value !== "PHC_1"),
  prohibitionClass: z.enum(["NONE", "AGENT_PROHIBITED"]),
  factRefs: z.array(refSchema),
  sourceEvidenceVersionRefs: z.array(refSchema),
  conflictRefs: z.array(refSchema),
  frozenActionCandidates: z.array(refSchema),
  requiredReviewerType: refSchema,
  reasonCodes: z.array(canonicalReasonCodeSchema).min(1)
}).strict();

export const skillRunRequestSchema = z.object({
  skillRunVersion: z.literal("1"),
  skillRunId: refSchema,
  skillRef: skillRefSchema,
  workflowId: skillWorkflowIdSchema,
  taskId: refSchema,
  attemptId: refSchema,
  routeDecisionRef: refSchema,
  requestContext: requestContextSchema,
  capabilityRequests: z.array(capabilityGatewayRequestSchema).max(8),
  practiceHandoffSignal: practiceHandoffSignalSchema.optional(),
  createdAt: dateTimeSchema,
  expiresAt: dateTimeSchema
}).strict();

export const skillStepResultSchema = z.object({
  stepId: refSchema,
  capabilityRef: capabilityRefSchema,
  gatewayResult: capabilityGatewayResultSchema,
  executionOutcome: capabilityExecutionOutcomeSchema.optional(),
  completed: z.boolean(),
  reasonCodes: z.array(canonicalReasonCodeSchema)
}).strict();

export const practiceHandoffResultSchema = practiceHandoffSignalSchema.extend({
  originSkillId: skillIdSchema,
  originSkillVersion: semanticVersionSchema,
  taskRef: refSchema,
  handoffStatus: z.literal("CANDIDATE_ONLY"),
  formalReviewCreated: z.literal(false),
  professionalDecisionMade: z.literal(false)
}).strict();

export const skillRunResultSchema = z.object({
  skillRunId: refSchema,
  skillRef: skillRefSchema,
  workflowId: skillWorkflowIdSchema,
  taskId: refSchema,
  attemptId: refSchema,
  routeDecisionRef: refSchema,
  status: z.enum([
    "COMPLETED",
    "DENIED",
    "WAITING",
    "REVIEW_REQUIRED",
    "FAILED",
    "PRACTICE_HANDOFF"
  ]),
  stepResults: z.array(skillStepResultSchema),
  practiceHandoff: practiceHandoffResultSchema.optional(),
  reasonCodes: z.array(canonicalReasonCodeSchema),
  capabilityRequestCount: z.number().int().nonnegative(),
  implementationCallCount: z.number().int().nonnegative(),
  independentCapabilityAudit: z.literal(true),
  formalStateChanged: z.literal(false),
  externalSideEffect: z.literal(false),
  outboundMessageSent: z.literal(false),
  realCustomerDataProcessed: z.literal(false),
  unsafeToolFallbackCount: z.literal(0),
  domainCompletionClaimed: z.literal(false),
  auditRef: refSchema.nullable(),
  startedAt: dateTimeSchema,
  completedAt: dateTimeSchema
}).strict().superRefine((value, context) => {
  if (value.status === "PRACTICE_HANDOFF" && value.practiceHandoff === undefined) {
    context.addIssue({ code: "custom", message: "practice handoff status requires a handoff candidate" });
  }
  if (value.status !== "PRACTICE_HANDOFF" && value.practiceHandoff !== undefined) {
    context.addIssue({ code: "custom", message: "handoff candidates belong only to practice handoff results" });
  }
  if (value.implementationCallCount > value.capabilityRequestCount) {
    context.addIssue({ code: "custom", message: "implementation calls cannot exceed capability requests" });
  }
});

export type SkillWorkflowId = z.infer<typeof skillWorkflowIdSchema>;
export type SkillRunRequest = z.infer<typeof skillRunRequestSchema>;
export type SkillStepResult = z.infer<typeof skillStepResultSchema>;
export type SkillRunResult = z.infer<typeof skillRunResultSchema>;
export type PracticeHandoffSignal = z.infer<typeof practiceHandoffSignalSchema>;
