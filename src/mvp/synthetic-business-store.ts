import type { RequestContext } from "../contracts/navigation.js";

export type SyntheticRequirementKind = "DOCUMENTS" | "IT_ACCOUNT" | "DEVICE";
export type SyntheticRequirementStatus =
  | "not_started"
  | "in_progress"
  | "evidence_pending"
  | "completed"
  | "blocked";

export interface SyntheticRequirementSnapshot {
  requirementRef: string;
  kind: SyntheticRequirementKind;
  version: number;
  status: SyntheticRequirementStatus;
  ownerRef: string;
  deadlineAt: string | null;
  completionCriteriaRef: string;
  ruleVersionRef: string;
  sourceVersionRef: string;
  freshness: "fresh" | "stale" | "unavailable" | "unknown";
  evidenceRefs: string[];
  evidenceValidationRef: string | null;
  sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT" | "LEGACY_SYNTHETIC_SOURCE";
  sourceActorId: string | null;
  conflictRefs: string[];
}

export interface SyntheticCaseSnapshot {
  synthetic: true;
  scopeType: "TENANT_PRIVATE" | "TEAM_SHARED";
  teamId: string | null;
  dataSpaceId: string;
  privateTenantId: string | null;
  privateActorId: string | null;
  createdByTenantId: string;
  createdByActorId: string;
  caseRef: string;
  offerRef: string;
  candidateRef: string;
  candidateDisplayName: string;
  offerStatus: "accepted";
  plannedStartAt: string | null;
  sourceVersionRef: string;
  caseVersion: number;
  formalReadinessStatus: null;
  suggestedReadiness: "NOT_READY" | "READY_CANDIDATE";
  confirmationStatus: "not_confirmed";
  createdAt: string;
  updatedAt: string;
  requirements: SyntheticRequirementSnapshot[];
}

export interface SyntheticCaseResolution {
  status: "MATCHED" | "NOT_FOUND" | "AMBIGUOUS";
  case: SyntheticCaseSnapshot | null;
  candidateCount: number;
}

export interface SyntheticMutationReceipt {
  mutationId: string;
  eventRef: string;
  idempotentReplay: boolean;
  case: SyntheticCaseSnapshot;
}

export interface CreateAcceptedOfferInput {
  mutationId: string;
  offerRef: string;
  candidateRef: string;
  candidateDisplayName: string;
  plannedStartAt?: string | null;
  sourceVersionRef: string;
  scopeType: "TEAM_SHARED" | "TENANT_PRIVATE";
  teamId?: string;
}

export interface CompleteRequirementInput {
  mutationId: string;
  caseRef: string;
  kind: SyntheticRequirementKind;
  expectedCaseVersion: number;
  expectedRequirementVersion: number;
  evidenceRef: string;
  evidenceValidationRef: null;
  sourceVersionRef: string;
  sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT";
  sourceActorId: string;
}

/** Canonical synthetic business truth used by every Step 2.5 workflow. */
export interface SyntheticBusinessStorePort {
  createAcceptedOfferCase(context: RequestContext, input: CreateAcceptedOfferInput): SyntheticMutationReceipt;
  completeRequirement(context: RequestContext, input: CompleteRequirementInput): SyntheticMutationReceipt;
  getCase(context: RequestContext, caseRef: string): SyntheticCaseSnapshot | null;
  listCases(context: RequestContext): SyntheticCaseSnapshot[];
  resolveCase(context: RequestContext, clue: { caseRef?: string; candidateDisplayName?: string }): SyntheticCaseResolution;
}
