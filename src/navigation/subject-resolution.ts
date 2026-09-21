import type {
  RequestContext,
  SelectedCaseRef,
  SubjectClue
} from "../contracts/navigation.js";

export interface SyntheticCaseRecord {
  synthetic: true;
  tenantId: string;
  dataSpaceId: string;
  caseId: string;
  offerRef: string;
  candidateRef: string;
  employeeRef?: string;
  emailRef?: string;
  displayName: string;
  accessible: boolean;
  version: string;
  sourceAvailability?: "fresh" | "stale" | "unavailable";
  resolutionState?: "identity_conflict" | "mapping_unknown" | "stale_mapping";
}

export type SubjectResolutionResult =
  | { status: "resolved"; caseRecord: SyntheticCaseRecord }
  | { status: "not_found" }
  | { status: "multiple_candidates"; candidateRefs: string[] }
  | { status: "identity_conflict" }
  | { status: "access_denied" }
  | { status: "mapping_unknown" }
  | { status: "stale_mapping" }
  | { status: "context_mismatch" };

function clueMatches(record: SyntheticCaseRecord, clue: SubjectClue): boolean {
  const value = clue.value.toLowerCase();
  if (clue.type === "case_id") return record.caseId.toLowerCase() === value;
  if (clue.type === "offer_id") return record.offerRef.toLowerCase() === value;
  if (clue.type === "candidate_id") return record.candidateRef.toLowerCase() === value;
  if (clue.type === "employee_id") return record.employeeRef?.toLowerCase() === value;
  if (clue.type === "email") return record.emailRef?.toLowerCase() === value;
  return record.displayName.toLowerCase() === value;
}

export function resolveSubject(
  context: RequestContext,
  clues: SubjectClue[],
  cases: SyntheticCaseRecord[],
  selectedCaseRef: SelectedCaseRef | undefined,
  now: Date
): SubjectResolutionResult {
  if (selectedCaseRef !== undefined) {
    const selected = resolveSelectedCaseRef(context, selectedCaseRef, cases, now);
    if (selected.status !== "resolved" || clues.length === 0) return selected;
    if (!clues.every((clue) => clueMatches(selected.caseRecord, clue))) {
      return { status: "identity_conflict" };
    }
    return selected;
  }
  if (clues.length === 0) return { status: "not_found" };
  const allMatches = cases.filter((record) => clues.every((clue) => clueMatches(record, clue)));
  const scoped = allMatches.filter(
    (record) => record.tenantId === context.tenantId && record.dataSpaceId === context.dataSpaceId
  );
  const hasStrongIdentifier = clues.some((clue) => clue.type !== "name");
  if (scoped.length === 0 && allMatches.length > 0 && hasStrongIdentifier) {
    return { status: "context_mismatch" };
  }
  if (scoped.length === 0) return { status: "not_found" };
  if (scoped.some((record) => record.resolutionState === "identity_conflict")) {
    return { status: "identity_conflict" };
  }
  if (scoped.some((record) => record.resolutionState === "mapping_unknown")) {
    return { status: "mapping_unknown" };
  }
  if (scoped.some((record) => record.resolutionState === "stale_mapping")) {
    return { status: "stale_mapping" };
  }
  const accessible = scoped.filter((record) => record.accessible);
  if (accessible.length === 0) return { status: "access_denied" };
  if (accessible.length > 1) {
    return {
      status: "multiple_candidates",
      candidateRefs: accessible.map((record) => record.caseId)
    };
  }
  const record = accessible[0];
  if (record === undefined) return { status: "not_found" };
  return { status: "resolved", caseRecord: record };
}

function resolveSelectedCaseRef(
  context: RequestContext,
  selectedCaseRef: SelectedCaseRef,
  cases: SyntheticCaseRecord[],
  now: Date
): SubjectResolutionResult {
  if (
    selectedCaseRef.tenantId !== context.tenantId ||
    selectedCaseRef.dataSpaceId !== context.dataSpaceId ||
    selectedCaseRef.actorId !== context.actorId ||
    selectedCaseRef.purpose !== context.dataAccessPurpose ||
    selectedCaseRef.sessionId !== context.sessionId
  ) {
    return { status: "context_mismatch" };
  }
  if (new Date(selectedCaseRef.expiresAt).getTime() <= now.getTime()) {
    return { status: "stale_mapping" };
  }
  const record = cases.find(
    (candidate) => candidate.caseId === selectedCaseRef.caseId &&
      candidate.tenantId === context.tenantId &&
      candidate.dataSpaceId === context.dataSpaceId
  );
  if (record === undefined) return { status: "not_found" };
  if (!record.accessible) return { status: "access_denied" };
  if (record.version !== selectedCaseRef.caseVersionHint) return { status: "stale_mapping" };
  if (record.resolutionState !== undefined) return { status: record.resolutionState };
  return { status: "resolved", caseRecord: record };
}
