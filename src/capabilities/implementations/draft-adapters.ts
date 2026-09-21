import { digestCapabilityPayload } from "../gateway.js";
import type { CapabilityId } from "../../contracts/capability.js";
import type {
  SyntheticAdapterContext,
  SyntheticAdapterResult,
  SyntheticCapabilityAdapter
} from "./types.js";
import { SyntheticAdapterError } from "./types.js";

function assertStoreBoundary(context: SyntheticAdapterContext): void {
  if (
    !context.store.synthetic ||
    context.store.tenantId !== context.requestContext.tenantId ||
    context.store.dataSpaceId !== context.requestContext.dataSpaceId
  ) {
    throw new SyntheticAdapterError("FAILED", "SOURCE_UNAVAILABLE");
  }
}

function findVisibleCase(context: SyntheticAdapterContext, caseRef: string) {
  const record = context.store.cases.find((candidate) =>
    candidate.caseRef === caseRef &&
    candidate.tenantId === context.requestContext.tenantId &&
    candidate.dataSpaceId === context.requestContext.dataSpaceId &&
    candidate.authorizedActorIds.includes(context.requestContext.actorId)
  );
  if (record === undefined) {
    throw new SyntheticAdapterError("WAITING", "SOURCE_UNAVAILABLE");
  }
  return record;
}

function assertKnownRefs(actual: string[], allowed: string[]): void {
  if (actual.some((reference) => !allowed.includes(reference))) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
}

function assertTemplate(context: SyntheticAdapterContext, templateRef: string): void {
  if (!context.store.draftControls.templateRefs.includes(templateRef)) {
    throw new SyntheticAdapterError("FAILED", "SOURCE_POLICY_MISSING");
  }
}

function draftResult(
  context: SyntheticAdapterContext,
  artifactType: string,
  sourceReferences: string[],
  policyVersionRefs: string[],
  objectVersionRefs: string[],
  reviewRequired: boolean,
  redactionSummary: string
): SyntheticAdapterResult {
  return {
    resultStatus: "SUCCESS",
    outputPayload: {
      artifactRef: context.idFactory(),
      artifactVersion: 1,
      artifactType,
      artifactStatus: "DRAFT",
      sendStatus: "NOT_SENT",
      formalStateChanged: false,
      externalSideEffect: false,
      sourceReferences,
      redactionSummary,
      reviewRequired,
      contentDigest: digestCapabilityPayload({
        capabilityRef: context.request.capabilityRef,
        input: context.input,
        sourceReferences
      })
    },
    reasonCodes: [],
    sourceReferences,
    freshnessResults: ["fresh"],
    policyVersionRefs,
    objectVersionRefs
  };
}

const intakeDraft: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    handoffRef: string;
    completenessEvaluationRef: string;
    expectedSourceVersion: string;
    approvedFactRefs: string[];
    templateRef: string;
  };
  if (
    input.handoffRef !== context.store.handoff.handoffRef ||
    input.expectedSourceVersion !== context.store.handoff.sourceVersion
  ) {
    throw new SyntheticAdapterError("FAILED", "OBJECT_VERSION_CONFLICT");
  }
  if (input.completenessEvaluationRef !== context.store.draftControls.intakeCompletenessEvaluationRef) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  assertKnownRefs(input.approvedFactRefs, context.store.draftControls.approvedFactRefs);
  assertTemplate(context, input.templateRef);
  return draftResult(
    context,
    "ONBOARDING_INTAKE_DRAFT",
    [...context.store.handoff.sourceRecordRefs, ...input.approvedFactRefs],
    [context.store.policies.intakePolicyVersion, context.store.policies.sourcePolicyVersion],
    [context.store.handoff.sourceVersion, input.completenessEvaluationRef],
    false,
    "Synthetic minimum-disclosure intake draft; direct identifiers omitted."
  );
};

function coordinationDraft(context: SyntheticAdapterContext, expectedType: "REMINDER" | "ESCALATION") {
  assertStoreBoundary(context);
  const input = context.input as {
    onboardingCaseRef: string;
    draftType: "REMINDER" | "ESCALATION";
    audienceRoleCandidate: string;
    approvedFactRefs: string[];
    missingItemRefs: string[];
    templateRef: string;
    expectedCaseVersion: number;
  };
  if (input.draftType !== expectedType) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  const record = findVisibleCase(context, input.onboardingCaseRef);
  if (record.caseVersion !== input.expectedCaseVersion) {
    throw new SyntheticAdapterError("FAILED", "OBJECT_VERSION_CONFLICT");
  }
  if (!context.store.draftControls.audienceRoleRefs.includes(input.audienceRoleCandidate)) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  assertKnownRefs(input.approvedFactRefs, context.store.draftControls.approvedFactRefs);
  assertKnownRefs(
    input.missingItemRefs,
    context.store.requirements.map((requirement) => requirement.requirementRef)
  );
  assertTemplate(context, input.templateRef);
  return draftResult(
    context,
    expectedType === "REMINDER" ? "ONBOARDING_REMINDER_DRAFT" : "ONBOARDING_ESCALATION_DRAFT",
    [...record.sourceRefs, ...input.approvedFactRefs],
    record.policyVersionRefs,
    [`${record.caseRef}@${record.caseVersion}`, ...input.missingItemRefs],
    expectedType === "ESCALATION",
    expectedType === "REMINDER"
      ? "Synthetic minimum-disclosure reminder; audience is a role candidate; no message sent."
      : "Synthetic escalation draft; PHC and review markers retained; no message sent."
  );
}

const reminderDraft: SyntheticCapabilityAdapter = (context) => coordinationDraft(context, "REMINDER");
const escalationDraft: SyntheticCapabilityAdapter = (context) => coordinationDraft(context, "ESCALATION");

const readyCardDraft: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    onboardingCaseRef: string;
    expectedCaseVersion: number;
    readinessEvaluationRef: string;
    templateRef: string;
  };
  const record = findVisibleCase(context, input.onboardingCaseRef);
  if (record.caseVersion !== input.expectedCaseVersion) {
    throw new SyntheticAdapterError("FAILED", "OBJECT_VERSION_CONFLICT");
  }
  if (input.readinessEvaluationRef !== context.store.draftControls.readinessEvaluationRef) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  assertTemplate(context, input.templateRef);
  return draftResult(
    context,
    "DAY1_READY_CARD_DRAFT",
    record.sourceRefs,
    [context.store.policies.readinessRuleSetVersion, ...record.policyVersionRefs],
    [`${record.caseRef}@${record.caseVersion}`, input.readinessEvaluationRef],
    true,
    "Synthetic Day-1 Ready card draft; suggested state only; formal READY unchanged."
  );
};

const reviewRequestDraft: SyntheticCapabilityAdapter = (context) => {
  assertStoreBoundary(context);
  const input = context.input as {
    onboardingCaseRef: string;
    affectedObjectRefs: string[];
    candidatePHC: "PHC_2" | "PHC_3" | "PHC_4";
    prohibitionClass: "NONE" | "AGENT_PROHIBITED";
    approvedFactRefs: string[];
    sourceEvidenceRefs: string[];
    conflictRefs: string[];
    impactScopeRefs: string[];
    requiredReviewerType: string;
    expectedCaseVersion: number;
    templateRef: string;
  };
  const record = findVisibleCase(context, input.onboardingCaseRef);
  if (record.caseVersion !== input.expectedCaseVersion) {
    throw new SyntheticAdapterError("FAILED", "OBJECT_VERSION_CONFLICT");
  }
  if (
    input.candidatePHC !== context.request.risk.phc ||
    !context.store.draftControls.reviewerTypeRefs.includes(input.requiredReviewerType)
  ) {
    throw new SyntheticAdapterError("FAILED", "CAPABILITY_INPUT_INVALID");
  }
  assertKnownRefs(input.approvedFactRefs, context.store.draftControls.approvedFactRefs);
  assertKnownRefs(input.sourceEvidenceRefs, context.store.draftControls.sourceEvidenceRefs);
  assertTemplate(context, input.templateRef);
  return draftResult(
    context,
    "PROFESSIONAL_REVIEW_REQUEST_DRAFT",
    [...input.approvedFactRefs, ...input.sourceEvidenceRefs],
    [context.store.policies.sourcePolicyVersion],
    [`${record.caseRef}@${record.caseVersion}`, ...input.affectedObjectRefs],
    true,
    "Facts-only synthetic review request; no recommendation, employment decision, waiver or formal review created."
  );
};

export const syntheticDraftAdapters: ReadonlyMap<CapabilityId, SyntheticCapabilityAdapter> = new Map([
  ["hr.onboarding.intake.draft", intakeDraft],
  ["hr.onboarding.reminder.draft", reminderDraft],
  ["hr.onboarding.escalation.draft", escalationDraft],
  ["hr.onboarding.ready_card.draft", readyCardDraft],
  ["hr.onboarding.review_request.draft", reviewRequestDraft]
]);

