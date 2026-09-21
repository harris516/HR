import type { RequestContext, SubjectClue } from "../contracts/navigation.js";

export interface SyntheticCaseRecord {
  synthetic: true;
  tenantId: string;
  dataSpaceId: string;
  caseId: string;
  offerRef: string;
  candidateRef: string;
  employeeRef?: string;
  displayName: string;
  accessible: boolean;
  version: string;
  sourceAvailability?: "fresh" | "stale" | "unavailable";
}

export type SubjectResolutionResult =
  | { status: "resolved"; caseRecord: SyntheticCaseRecord }
  | { status: "not_found" }
  | { status: "multiple_candidates"; candidateRefs: string[] }
  | { status: "access_denied" }
  | { status: "context_mismatch" };

function clueMatches(record: SyntheticCaseRecord, clue: SubjectClue): boolean {
  const value = clue.value.toLowerCase();
  if (clue.type === "case_id") return record.caseId.toLowerCase() === value;
  if (clue.type === "offer_id") return record.offerRef.toLowerCase() === value;
  if (clue.type === "candidate_id") return record.candidateRef.toLowerCase() === value;
  if (clue.type === "employee_id") return record.employeeRef?.toLowerCase() === value;
  return record.displayName.toLowerCase() === value;
}

export function resolveSubject(
  context: RequestContext,
  clues: SubjectClue[],
  cases: SyntheticCaseRecord[]
): SubjectResolutionResult {
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
