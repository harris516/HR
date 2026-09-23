import { z } from "zod";

export const intentClassSchema = z.enum([
  "supported_p0",
  "controlled_request",
  "forbidden_request",
  "out_of_scope",
  "unknown"
]);

export const intentIdSchema = z.enum([
  "LIST_ONBOARDING_CASES",
  "LIST_RISK_CASES",
  "GET_CASE_STATUS",
  "CHECK_REQUIREMENT_STATUS",
  "DAY1_READY_CHECK",
  "CREATE_REMINDER_DRAFT",
  "CREATE_ESCALATION_DRAFT",
  "CREATE_REVIEW_DRAFT",
  "REVALIDATE_READY",
  "FORMAL_READY_COMMIT_REQUEST",
  "REQUIREMENT_COMMIT_REQUEST",
  "EXTERNAL_SEND_REQUEST",
  "REVIEW_DECISION_REQUEST",
  "WAIVER_REQUEST",
  "EMPLOYMENT_DECISION_REQUEST",
  "SENSITIVE_EXPORT_REQUEST",
  "CROSS_SCOPE_REQUEST",
  "UNSUPPORTED_HR_DOMAIN",
  "PROMPT_OVERRIDE_REQUEST",
  "UNKNOWN_INTENT"
]);

export const actionClassSchema = z.enum([
  "none",
  "read",
  "analyze",
  "draft",
  "commit",
  "decide",
  "execute",
  "export"
]);

export const subjectRequirementSchema = z.enum([
  "none",
  "collection",
  "unique_case",
  "related_object"
]);

export const navigationStatusSchema = z.enum([
  "created",
  "validated",
  "in_progress",
  "waiting_for_source",
  "waiting_for_human",
  "blocked",
  "completed",
  "failed",
  "cancelled"
]);

export const routeTypeSchema = z.enum([
  "CLARIFY",
  "RESOLVE_SUBJECT",
  "READ",
  "ANALYZE",
  "DRAFT",
  "HUMAN_HANDOFF",
  "DENY",
  "SYSTEM_HARD_BLOCK"
]);

export const requestContextSchema = z.object({
  requestId: z.string().min(1),
  tenantId: z.string().min(1),
  dataSpaceId: z.string().min(1),
  activeTeamId: z.string().min(1),
  teamMembershipRef: z.string().min(1),
  actorType: z.enum(["user", "service_principal", "system_event"]),
  actorId: z.string().min(1),
  authenticationLevel: z.string().min(1),
  roles: z.array(z.string().min(1)),
  scopeGrantRefs: z.array(z.string().min(1)),
  authorityGrantRefs: z.array(z.string().min(1)).default([]),
  channel: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  correlationId: z.string().min(1),
  causationId: z.string().min(1).optional(),
  receivedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  dataAccessPurpose: z.enum(["onboarding_operation", "review", "audit"]),
  environment: z.enum(["design", "test"]),
  clientContext: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()])
  ).optional(),
  riskSignals: z.array(z.string().min(1)).optional(),
  contextVersion: z.literal("2"),
  integrityRef: z.string().min(1),
  synthetic: z.literal(true)
}).strict();

export const subjectClueSchema = z.object({
  type: z.enum(["case_id", "offer_id", "candidate_id", "employee_id", "email", "name"]),
  value: z.string().min(1)
}).strict();

export const selectedCaseRefSchema = z.object({
  tenantId: z.string().min(1),
  dataSpaceId: z.string().min(1),
  caseId: z.string().min(1),
  resolutionResultId: z.string().min(1),
  actorId: z.string().min(1),
  purpose: z.enum(["onboarding_operation", "review", "audit"]),
  sessionId: z.string().min(1),
  selectedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  caseVersionHint: z.string().min(1)
}).strict();

export const navigationRequestSchema = z.object({
  context: z.unknown(),
  input: z.object({
    text: z.string().min(1),
    subjectClues: z.array(subjectClueSchema).default([]),
    selectedCaseRef: selectedCaseRefSchema.optional()
  }).strict()
}).strict();

export type RequestContext = z.infer<typeof requestContextSchema>;
export type IntentId = z.infer<typeof intentIdSchema>;
export type IntentClass = z.infer<typeof intentClassSchema>;
export type ActionClass = z.infer<typeof actionClassSchema>;
export type SubjectRequirement = z.infer<typeof subjectRequirementSchema>;
export type NavigationStatus = z.infer<typeof navigationStatusSchema>;
export type RouteType = z.infer<typeof routeTypeSchema>;
export type SubjectClue = z.infer<typeof subjectClueSchema>;
export type SelectedCaseRef = z.infer<typeof selectedCaseRefSchema>;
export type NavigationRequest = z.infer<typeof navigationRequestSchema>;

export interface IntentCandidate {
  intentCandidateId: string;
  requestContextRef: string;
  correlationId: string;
  intentId: IntentId;
  intentClass: IntentClass;
  taskType: string;
  subjectRequirement: SubjectRequirement;
  requestedActionClass: ActionClass;
  capabilityCandidate?: "read_stub" | "analyze_stub" | "draft_stub";
  reasonCodes: string[];
}

export interface NavigationTask {
  taskId: string;
  attemptId: string;
  requestPlanRef?: string;
  taskEnvelopeVersion: "1";
  requestContextRef: string;
  tenantId: string;
  dataSpaceId: string;
  correlationId: string;
  intent: IntentCandidate;
  onboardingCaseId?: string;
  status: NavigationStatus;
  reasonCodes: string[];
  transitionRecordRefs: string[];
}

export interface NavigationTransitionRecord {
  transitionId: string;
  taskId: string;
  attemptId: string;
  fromStatus: NavigationStatus;
  toStatus: NavigationStatus;
  triggerType: string;
  reasonCodes: string[];
  occurredAt: string;
}

export interface ChildNavigationResult {
  taskId: string;
  intentId: IntentId;
  routeType: RouteType;
  status: NavigationStatus;
  reasonCodes: string[];
  capabilityCalled: boolean;
  resultPayload?: Record<string, unknown>;
}

export interface NavigationResponse {
  requestId: string;
  correlationId: string;
  requestPlanId?: string;
  aggregateStatus:
    | "all_completed"
    | "partially_completed"
    | "waiting"
    | "all_denied"
    | "failed"
    | "hard_blocked";
  childResults: ChildNavigationResult[];
  auditEventCount: number;
}
