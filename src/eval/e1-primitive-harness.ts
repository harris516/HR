import { isDeepStrictEqual } from "node:util";
import type { EvalReasonCode } from "../contracts/eval.js";

/** E1 coverage contract from 19 §7. This is test-only; it is not an Eval Suite registry. */
export const e1PrimitiveFamilies = [
  "TENANT_DATA_SPACE_SCOPE",
  "SUBJECT_IDENTITY",
  "FRESHNESS_EVIDENCE_READY_REVALIDATION",
  "PHC_RISK_CLASSIFICATION",
  "PROHIBITION_REVIEW_ROUTING",
  "AUTHORIZATION",
  "AUTHORITY_SOD_ASSURANCE",
  "REDACTION_FIELD_PROJECTION",
  "DIGEST",
  "IDEMPOTENCY",
  "STATE_TRANSITION",
  "GROWTH_TRAINING_EVAL_GOVERNANCE"
] as const;

export const e1BoundaryClasses = [
  "NOMINAL", "BOUNDARY", "UNKNOWN", "MISSING", "CONFLICT", "EXPIRED", "UNSUPPORTED"
] as const;

export type E1PrimitiveFamily = typeof e1PrimitiveFamilies[number];
export type E1BoundaryClass = typeof e1BoundaryClasses[number];

export interface E1PrimitiveVector {
  readonly caseId: string;
  readonly family: E1PrimitiveFamily;
  readonly boundaryClass: E1BoundaryClass;
  readonly synthetic: true;
  readonly expected: unknown;
  readonly execute: () => unknown;
}

export interface E1VectorResult {
  readonly caseId: string;
  readonly family: E1PrimitiveFamily;
  readonly boundaryClass: E1BoundaryClass;
  readonly status: "PASS" | "FAIL";
  readonly reasonCode: EvalReasonCode | null;
}

export interface E1HarnessReport {
  readonly status: "BLOCKED" | "FAIL";
  readonly vectorResults: readonly E1VectorResult[];
  readonly missingFamilies: readonly E1PrimitiveFamily[];
  readonly missingBoundaryClasses: readonly E1BoundaryClass[];
  readonly evalRunCreated: false;
  readonly acceptanceDecisionCreated: false;
}

/** Repeats synthetic vectors; callers must construct fresh local state inside execute(). */
export function runE1PrimitiveHarness(vectors: readonly E1PrimitiveVector[]): E1HarnessReport {
  if (new Set(vectors.map((vector) => vector.caseId)).size !== vectors.length ||
      vectors.some((vector) => !vector.caseId || vector.synthetic !== true ||
        !e1PrimitiveFamilies.includes(vector.family) || !e1BoundaryClasses.includes(vector.boundaryClass))) {
    throw new Error("invalid E1 synthetic vector catalog");
  }

  let expectedSnapshots: unknown[];
  try {
    expectedSnapshots = vectors.map((vector) => structuredClone(vector.expected));
  } catch {
    throw new Error("invalid E1 expected result catalog");
  }

  const vectorResults: E1VectorResult[] = vectors.map((vector, index) => {
    const expected = expectedSnapshots[index];
    const observations: unknown[] = [];
    const success: boolean[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = structuredClone(vector.execute());
        observations.push(result);
        success.push(isDeepStrictEqual(result, expected) && isDeepStrictEqual(vector.expected, expected));
      } catch {
        observations.push(null);
        success.push(false);
      }
    }
    const unstable = observations.some((result) => !isDeepStrictEqual(result, observations[0])) ||
      success.some((value) => value !== success[0]);
    return {
      caseId: vector.caseId,
      family: vector.family,
      boundaryClass: vector.boundaryClass,
      status: success.every(Boolean) && !unstable ? "PASS" : "FAIL",
      reasonCode: unstable ? "EVAL_CASE_FLAKY" : success.every(Boolean) ? null : "EVAL_HARD_ASSERTION_FAILED"
    };
  });

  const coveredFamilies = new Set(e1PrimitiveFamilies.filter((family) =>
    vectors.some((vector) => vector.family === family && vector.boundaryClass === "NOMINAL") &&
    vectors.some((vector) => vector.family === family && vector.boundaryClass !== "NOMINAL")
  ));
  const coveredBoundaries = new Set(vectors.map((vector) => vector.boundaryClass));
  const missingFamilies = e1PrimitiveFamilies.filter((family) => !coveredFamilies.has(family));
  const missingBoundaryClasses = e1BoundaryClasses.filter((boundary) => !coveredBoundaries.has(boundary));
  // Self-declared vectors cannot establish approved E1 coverage or an Eval Run.
  const status = vectorResults.some((result) => result.status === "FAIL") ? "FAIL" : "BLOCKED";
  return { status, vectorResults, missingFamilies, missingBoundaryClasses,
    evalRunCreated: false, acceptanceDecisionCreated: false };
}
