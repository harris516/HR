import { randomUUID } from "node:crypto";
import { digestCapabilityPayload } from "../capabilities/gateway.js";
import { getPlannedCapability } from "../capabilities/registry.js";
import type { CapabilityId, SkillId } from "../contracts/capability.js";
import type { RequestContext } from "../contracts/navigation.js";
import type { SkillRunRequest, SkillWorkflowId } from "../contracts/skill-orchestration.js";
import { getSkillDefinition, getSkillWorkflow } from "./registry.js";
import { parseStep2WorkflowInput } from "./runtime-inputs.js";
import type { Step2SyntheticActivationProfile } from "./step2-activation-profile.js";

const collectionCapabilityIds = new Set<CapabilityId>([
  "hr.onboarding.case.list",
  "hr.onboarding.risk.list",
  "hr.onboarding.responsibility.workbox.read",
  "hr.onboarding.artifact.list",
  "hr.onboarding.audit.timeline.read"
]);

export interface Step2SkillCompileInput {
  skillId: SkillId;
  workflowId: SkillWorkflowId;
  requestContext: RequestContext;
  businessInput: unknown;
}

export interface Step2SkillRequestCompilerOptions {
  activationProfile: Step2SyntheticActivationProfile;
  now?: () => Date;
  idFactory?: () => string;
}

function stringValue(input: Record<string, unknown>, key: string): string {
  return input[key] as string;
}

function numberValue(input: Record<string, unknown>, key: string): number {
  return input[key] as number;
}

function capabilityPayload(
  capabilityId: CapabilityId,
  input: Record<string, unknown>,
  context: RequestContext
): Record<string, unknown> {
  const caseRef = input.caseRef as string | undefined;
  const caseVersion = input.expectedCaseVersion as number | undefined;
  switch (capabilityId) {
    case "hr.onboarding.intake.handoff.read":
      return { handoffRef: stringValue(input, "handoffRef"), expectedSourceVersion: stringValue(input, "expectedSourceVersion"), fieldSetRef: "field-set-intake-minimum" };
    case "hr.onboarding.intake.completeness.evaluate":
      return { handoffRef: stringValue(input, "handoffRef"), expectedSourceVersion: stringValue(input, "expectedSourceVersion"), intakePolicyRef: "intake-policy-001", intakePolicyVersion: "intake-policy-v1" };
    case "hr.onboarding.intake.draft":
      return { handoffRef: stringValue(input, "handoffRef"), completenessEvaluationRef: "evaluation-intake-complete-001", expectedSourceVersion: stringValue(input, "expectedSourceVersion"), approvedFactRefs: ["fact-offer-accepted-001", "fact-start-date-001"], language: stringValue(input, "language"), templateRef: "template-intake-v1" };
    case "hr.onboarding.case.list":
      return { filterSpecRef: "filter-approved", pageSize: numberValue(input, "pageSize"), snapshotAt: "2026-09-21T01:59:30.000Z" };
    case "hr.onboarding.case.status.read":
      return { onboardingCaseRef: caseRef, expectedCaseVersion: caseVersion, fieldSetRef: "field-set-case-status" };
    case "hr.onboarding.requirement.status.read":
      return { onboardingCaseRef: caseRef, requirementRef: stringValue(input, "requirementRef"), expectedCaseVersion: caseVersion };
    case "hr.onboarding.requirement.completion.evaluate":
      return { onboardingCaseRef: caseRef, requirementRef: stringValue(input, "requirementRef"), expectedCaseVersion: caseVersion, expectedRequirementVersion: numberValue(input, "expectedRequirementVersion") };
    case "hr.onboarding.risk.list":
      return { caseScopeRef: caseRef, riskPolicyRef: "risk-policy-001", riskPolicyVersion: "risk-policy-v1", snapshotAt: "2026-09-21T01:59:30.000Z", pageSize: numberValue(input, "pageSize") };
    case "hr.onboarding.source_evidence.inspect":
      return { objectRef: caseRef, fieldOrPropositionRefs: ["planned_start_date"], expectedObjectVersion: caseVersion, fieldSetRef: "field-set-evidence-redacted" };
    case "hr.onboarding.responsibility.workbox.read":
      return { responsibilityScopeRef: `workbox-${context.actorId}`, pageSize: 20, snapshotAt: "2026-09-21T01:59:30.000Z" };
    case "hr.onboarding.reminder.draft":
    case "hr.onboarding.escalation.draft":
      return { onboardingCaseRef: caseRef, draftType: capabilityId.endsWith("reminder.draft") ? "REMINDER" : "ESCALATION", audienceRoleCandidate: capabilityId.endsWith("reminder.draft") ? "it_onboarding_owner" : "onboarding_hr_operations", approvedFactRefs: ["fact-equipment-pending-001"], missingItemRefs: ["requirement-equipment-001"], deadlineRef: "deadline-equipment-001", language: stringValue(input, "language"), templateRef: capabilityId.endsWith("reminder.draft") ? "template-reminder-v1" : "template-escalation-v1", expectedCaseVersion: caseVersion };
    case "hr.onboarding.readiness.evaluate":
      return { onboardingCaseRef: caseRef, expectedCaseVersion: caseVersion, evaluationPurpose: "DAY1_READY_CHECK" };
    case "hr.onboarding.readiness.revalidate":
      return { onboardingCaseRef: caseRef, expectedCaseVersion: caseVersion, previousEvaluationRef: stringValue(input, "previousEvaluationRef"), invalidationTriggerRef: stringValue(input, "invalidationTriggerRef"), causationId: context.correlationId, deduplicationKey: `${context.tenantId}:${context.actorId}:${stringValue(input, "invalidationTriggerRef")}` };
    case "hr.onboarding.ready_card.draft":
      return { onboardingCaseRef: caseRef, expectedCaseVersion: caseVersion, readinessEvaluationRef: "evaluation-readiness-001", templateRef: "template-ready-card-v1", language: stringValue(input, "language"), fieldSetRef: "field-set-ready-card-minimum" };
    case "hr.onboarding.artifact.list":
      return { onboardingCaseRef: caseRef, pageSize: numberValue(input, "pageSize"), snapshotAt: "2026-09-21T01:59:30.000Z" };
    case "hr.onboarding.audit.timeline.read":
      return { resourceRef: caseRef, pageSize: 20, redactionPolicyRef: "audit-redaction-policy-001" };
    case "hr.onboarding.review_request.draft":
      return { onboardingCaseRef: caseRef, affectedObjectRefs: ["requirement-equipment-001"], candidatePHC: "PHC_4", prohibitionClass: "AGENT_PROHIBITED", approvedFactRefs: ["fact-equipment-pending-001"], sourceEvidenceRefs: ["evidence-equipment-001"], conflictRefs: [], impactScopeRefs: ["day1-readiness"], requiredReviewerType: "professional_practice_reviewer", expectedCaseVersion: caseVersion, templateRef: "template-review-request-v1", language: stringValue(input, "language") };
  }
}

export class Step2SkillRequestCompiler {
  readonly #profile: Step2SyntheticActivationProfile;
  readonly #now: () => Date;
  readonly #idFactory: () => string;

  constructor(options: Step2SkillRequestCompilerOptions) {
    this.#profile = options.activationProfile;
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  compile(input: Step2SkillCompileInput): SkillRunRequest {
    if (!this.#profile.skillIds.includes(input.skillId) ||
      !this.#profile.workflowIds.includes(input.workflowId)) {
      throw new Error("Skill or workflow is not active in Step 2");
    }
    const definition = getSkillDefinition(input.skillId);
    const workflow = getSkillWorkflow(input.skillId, input.workflowId);
    if (workflow === undefined || definition.requiredRequestContextVersion !== input.requestContext.contextVersion) {
      throw new Error("Skill workflow is unavailable for this RequestContext");
    }
    const businessInput = parseStep2WorkflowInput(input.workflowId, input.businessInput);
    const now = this.#now();
    const taskId = `step2-task-${this.#idFactory()}`;
    const attemptId = `step2-attempt-${this.#idFactory()}`;
    const routeDecisionRef = `step2-route-${this.#idFactory()}`;
    const capabilityRequests = workflow.capabilityRefs.map((capabilityRef) => {
      if (!this.#profile.capabilityIds.includes(capabilityRef.capabilityId)) {
        throw new Error("Workflow contains a Capability outside the Step 2 activation profile");
      }
      const entry = getPlannedCapability(capabilityRef.capabilityId);
      const payload = capabilityPayload(entry.capabilityId, businessInput, input.requestContext);
      const capabilityRequestId = `step2-capability-${this.#idFactory()}`;
      const caseRef = (businessInput.caseRef as string | undefined) ??
        (businessInput.handoffRef as string | undefined) ?? "synthetic-navigation";
      const reviewRequired = ["HUMAN_REVIEW_REQUIRED", "PHC_4_FACTS_ONLY"].includes(entry.reviewRequirement);
      const collectionAdmission = collectionCapabilityIds.has(entry.capabilityId) ? {
        predicateRef: "predicate://step2/synthetic/actor-scope/v1",
        fieldProjectionRef: "projection://step2/synthetic/minimum/v1",
        grantVersion: "grant-step2-synthetic-v1",
        queryDigest: digestCapabilityPayload(payload),
        sortSpecRef: "sort://step2/synthetic/stable/v1",
        snapshotAt: "2026-09-21T01:59:30.000Z",
        countDisclosureAllowed: false
      } : undefined;
      return {
        gatewayRequestVersion: "1" as const,
        capabilityRequestId,
        taskId,
        attemptId,
        routeDecisionRef,
        requestContext: input.requestContext,
        capabilityRef,
        resourceRefs: [{
          resourceType: entry.capabilityId.includes("intake") ? "OfferHandoff" : "OnboardingCase",
          resourceId: caseRef,
          tenantId: input.requestContext.tenantId,
          dataSpaceId: input.requestContext.dataSpaceId,
          sensitivity: "SYNTHETIC_INTERNAL" as const
        }],
        actionClass: entry.actionClass,
        purpose: "onboarding_operation" as const,
        inputEnvelope: {
          schemaVersion: "1" as const,
          capabilityRequestRef: capabilityRequestId,
          inputPayloadSchemaRef: entry.inputSchemaRef,
          inputPayloadDigest: digestCapabilityPayload(payload),
          payload
        },
        authorizationDecision: {
          decisionId: `step2-authorization-${this.#idFactory()}`,
          result: "allow" as const,
          policyVersion: "step2-synthetic-authorization-v1",
          grantVersion: "grant-step2-synthetic-v1",
          enforcementPoint: "capability_gateway" as const,
          capabilityRef,
          tenantId: input.requestContext.tenantId,
          dataSpaceId: input.requestContext.dataSpaceId,
          actorId: input.requestContext.actorId,
          actionClass: entry.actionClass,
          purpose: "onboarding_operation" as const
        },
        risk: {
          phc: entry.capabilityId === "hr.onboarding.review_request.draft" ? "PHC_4" as const : "PHC_1" as const,
          prohibition: "NONE" as const
        },
        review: reviewRequired
          ? { status: "SATISFIED" as const, reviewRef: `step2-review-${this.#idFactory()}` }
          : { status: "NOT_REQUIRED" as const },
        ...(collectionAdmission === undefined ? {} : { collectionAdmission }),
        createdAt: now.toISOString(),
        expiresAt: input.requestContext.expiresAt
      };
    });
    return {
      skillRunVersion: "1",
      skillRunId: `step2-skill-${this.#idFactory()}`,
      skillRef: { skillId: definition.skillId, skillVersion: definition.skillVersion },
      workflowId: input.workflowId,
      taskId,
      attemptId,
      routeDecisionRef,
      requestContext: input.requestContext,
      capabilityRequests,
      createdAt: now.toISOString(),
      expiresAt: input.requestContext.expiresAt
    };
  }
}
