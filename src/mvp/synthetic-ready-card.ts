import { createHash } from "node:crypto";
import type { RequestContext } from "../contracts/navigation.js";
import {
  SyntheticCaseStore,
  SyntheticCaseStoreError,
  type SyntheticRequirementSnapshot
} from "./synthetic-case-store.js";

export type SyntheticReadyResult = "ELIGIBLE" | "NOT_ELIGIBLE" | "INDETERMINATE";

export interface SyntheticReadyCardDraft {
  schemaVersion: "synthetic-ready-card.v1";
  synthetic: true;
  artifactStatus: "DRAFT";
  sendStatus: "NOT_SENT";
  formalStateChanged: false;
  externalSideEffect: false;
  caseRef: string;
  caseVersion: number;
  plannedStartAt: string | null;
  evaluationSnapshotDigest: string;
  evaluationAuditRef: string;
  readyEvaluationResult: SyntheticReadyResult;
  suggestedReadinessStatus: "READY_CANDIDATE" | "AT_RISK" | "UNKNOWN";
  formalReadinessStatus: null;
  confirmationStatus: "not_confirmed";
  requirementItems: Array<{
    kind: SyntheticRequirementSnapshot["kind"];
    status: SyntheticRequirementSnapshot["status"];
    ownerRef: string;
    deadlineAt: string | null;
    completionCriteriaRef: string;
    freshness: SyntheticRequirementSnapshot["freshness"];
    evidenceRefs: string[];
    evidenceValidationRef: string | null;
    sourceType: SyntheticRequirementSnapshot["sourceType"];
    sourceActorId: string | null;
    conflictRefs: string[];
    sourceVersionRef: string;
    ruleVersionRef: string;
  }>;
  reasonCodes: string[];
  ownerActionItems: Array<{ kind: SyntheticRequirementSnapshot["kind"]; ownerRef: string; action: string }>;
  sourceVersionRefs: string[];
  ruleVersionRefs: string[];
  reviewRequired: true;
}

function issueFor(item: SyntheticRequirementSnapshot): string | null {
  if (item.conflictRefs.length > 0) return "FACT_CONFLICT";
  if (item.freshness !== "fresh") return "SOURCE_NOT_FRESH";
  if (item.status === "blocked") return "REQUIREMENT_BLOCKED";
  const hasTrustedManualStatement = item.sourceType === "SYNTHETIC_HR_MANUAL_STATEMENT" &&
    item.sourceActorId !== null;
  if (item.status !== "completed" || item.evidenceRefs.length === 0 ||
    (!item.evidenceValidationRef && !hasTrustedManualStatement)) {
    return "REQUIREMENT_INCOMPLETE";
  }
  return null;
}

export function createSyntheticReadyCard(
  store: SyntheticCaseStore,
  context: RequestContext,
  caseRef: string
): SyntheticReadyCardDraft {
  const snapshot = store.getCase(context, caseRef);
  if (snapshot === null) throw new SyntheticCaseStoreError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
  const issues = snapshot.requirements.map((item) => ({ item, reason: issueFor(item) }));
  const hasUnknown = issues.some(({ reason }) => reason === "FACT_CONFLICT" || reason === "SOURCE_NOT_FRESH");
  const hasIncomplete = issues.some(({ reason }) => reason !== null);
  const readyEvaluationResult: SyntheticReadyResult = hasUnknown
    ? "INDETERMINATE" : hasIncomplete ? "NOT_ELIGIBLE" : "ELIGIBLE";
  const auditRef = store.recordReadinessEvaluation(context, caseRef, snapshot.caseVersion);
  return {
    schemaVersion: "synthetic-ready-card.v1",
    synthetic: true,
    artifactStatus: "DRAFT",
    sendStatus: "NOT_SENT",
    formalStateChanged: false,
    externalSideEffect: false,
    caseRef: snapshot.caseRef,
    caseVersion: snapshot.caseVersion,
    plannedStartAt: snapshot.plannedStartAt,
    evaluationSnapshotDigest: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    evaluationAuditRef: auditRef,
    readyEvaluationResult,
    suggestedReadinessStatus: readyEvaluationResult === "ELIGIBLE"
      ? "READY_CANDIDATE" : readyEvaluationResult === "INDETERMINATE" ? "UNKNOWN" : "AT_RISK",
    formalReadinessStatus: null,
    confirmationStatus: "not_confirmed",
    requirementItems: snapshot.requirements.map((item) => ({
      kind: item.kind,
      status: item.status,
      ownerRef: item.ownerRef,
      deadlineAt: item.deadlineAt,
      completionCriteriaRef: item.completionCriteriaRef,
      freshness: item.freshness,
      evidenceRefs: item.evidenceRefs,
      evidenceValidationRef: item.evidenceValidationRef,
      sourceType: item.sourceType,
      sourceActorId: item.sourceActorId,
      conflictRefs: item.conflictRefs,
      sourceVersionRef: item.sourceVersionRef,
      ruleVersionRef: item.ruleVersionRef
    })),
    reasonCodes: [...new Set(issues.flatMap(({ reason }) => reason === null ? [] : [reason]))],
    ownerActionItems: issues.flatMap(({ item, reason }) => reason === null ? [] : [{
      kind: item.kind,
      ownerRef: item.ownerRef,
      action: reason === "FACT_CONFLICT" ? "人工核对冲突来源"
        : reason === "SOURCE_NOT_FRESH" ? "刷新或核验来源"
          : reason === "REQUIREMENT_BLOCKED" ? "处理阻塞并复核"
            : "补齐完成状态与已验证证据"
    }]),
    sourceVersionRefs: [...new Set([snapshot.sourceVersionRef,
      ...snapshot.requirements.map((item) => item.sourceVersionRef)])],
    ruleVersionRefs: [...new Set(snapshot.requirements.map((item) => item.ruleVersionRef))],
    reviewRequired: true
  };
}
