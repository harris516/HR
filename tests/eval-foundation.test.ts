import { describe, expect, it } from "vitest";
import {
  acceptanceAggregateV1Schema, acceptanceDecisionV1Schema, acceptanceProfileV1Schema,
  evalCaseResultV1Schema, evalCaseV1Schema, evalDatasetManifestV1Schema,
  evalReasonCodes, evalRunV1Schema, evalSuiteManifestV1Schema
} from "../src/contracts/eval.js";
import { denyEvalRequest } from "../src/eval/gateway.js";
import { emptyEvalRegistry } from "../src/eval/registry.js";

const request = {
  schemaVersion: "eval-request.v1", requestId: "synthetic-request-001",
  suiteId: "synthetic-suite-001", datasetId: "synthetic-dataset-001",
  subjectSnapshotRef: "synthetic-subject-001", synthetic: true
};
const digest = "a".repeat(64);
const suite = {
  schemaVersion: "eval-suite-manifest.v1", suiteId: "synthetic-suite-001", suiteVersion: "1.0.0",
  evaluationLevel: "E0", purpose: "synthetic contract check",
  subjectProfileRequirementRef: "synthetic-subject-profile-001", scenarioFamilyRefs: [],
  caseSnapshotRefs: [], oraclePolicyRef: "synthetic-oracle-policy-001",
  acceptanceProfileRef: "synthetic-acceptance-profile-001",
  requiredEnvironmentProfileRef: "synthetic-environment-profile-001",
  requiredRepeatPolicyRef: "synthetic-repeat-policy-001", dependencyVersionRefs: [],
  ownerRef: "synthetic-owner-001", reviewDecisionRefs: [],
  createdAt: "2026-09-22T00:00:00Z", contentDigest: digest, status: "DRAFT"
};
const dataset = {
  schemaVersion: "eval-dataset-manifest.v1", evalDatasetId: "synthetic-dataset-001",
  datasetVersion: "1.0.0", purpose: "INDEPENDENT_EVALUATION", coveredLevels: ["E0"],
  scopeRef: "synthetic-scope-001", synthetic: true, scenarioFamilyDistribution: {},
  generatorLineageRefs: [], holdoutPartitionRefs: [], acceptancePartitionRefs: [],
  trainingRegistryDigest: digest, contaminationCheckRef: "synthetic-contamination-001",
  privacySecurityReviewRefs: [], retentionClassRef: "synthetic-retention-001",
  contentDigest: digest, status: "DRAFT"
};

describe("EVS1 eval foundation", () => {
  it("keeps the reviewed reason registry closed and unique", () => {
    expect(evalReasonCodes).toHaveLength(21);
    expect(new Set(evalReasonCodes).size).toBe(evalReasonCodes.length);
  });

  it("provides strict schemas for all eight reviewed evaluation objects", () => {
    const schemas = [
      evalSuiteManifestV1Schema, evalCaseV1Schema, evalRunV1Schema,
      evalCaseResultV1Schema, evalDatasetManifestV1Schema, acceptanceProfileV1Schema,
      acceptanceAggregateV1Schema, acceptanceDecisionV1Schema
    ];
    for (const schema of schemas) {
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ schemaVersion: "unknown.v2" }).success).toBe(false);
    }
  });

  it("keeps evaluator reason codes separate from domain reason assertions", () => {
    const syntheticCase = {
      schemaVersion: "eval-case.v1", evalCaseId: "synthetic-case-domain-reason-001",
      caseVersion: "1.0.0", suiteRef: "synthetic-suite-001",
      scenarioFamily: "TENANT_ISOLATION", riskClass: "HIGH_RISK", synthetic: true,
      inputFixtureRef: "synthetic-fixture-001",
      requestContextSnapshot: { snapshotRef: "synthetic-context-001", contentDigest: digest, synthetic: true },
      subjectClues: [], expectedRoute: "DENY", expectedResultClass: "DENIED",
      expectedStateTransitions: [], expectedReasonCodes: [], expectedAuditEvents: [],
      requiredOutputAssertions: ["oracle:synthetic-domain-reason-data-space-mismatch:v1"],
      forbiddenEvents: ["external-side-effect"], sideEffectExpectation: "NONE",
      oracleRefs: ["oracle:synthetic-domain-reason-data-space-mismatch:v1"],
      repeatPolicyRef: "synthetic-repeat-policy-001", contentDigest: digest
    };
    expect(evalCaseV1Schema.safeParse(syntheticCase).success).toBe(true);
    expect(evalCaseV1Schema.safeParse({
      ...syntheticCase, expectedReasonCodes: ["DATA_SPACE_MISSING_OR_MISMATCH"]
    }).success).toBe(false);
    expect(evalCaseV1Schema.safeParse({
      ...syntheticCase, expectedReasonCodes: ["EVAL_HARD_ASSERTION_FAILED"]
    }).success).toBe(true);
  });

  it("accepts structural synthetic drafts but rejects drift and unsafe dataset state", () => {
    expect(evalSuiteManifestV1Schema.safeParse(suite).success).toBe(true);
    expect(evalDatasetManifestV1Schema.safeParse(dataset).success).toBe(true);
    expect(evalSuiteManifestV1Schema.safeParse({ ...suite, extra: "drift" }).success).toBe(false);
    expect(evalSuiteManifestV1Schema.safeParse({ ...suite, evaluationLevel: "E7" }).success).toBe(false);
    expect(evalDatasetManifestV1Schema.safeParse({ ...dataset, synthetic: false }).success).toBe(false);
    expect(evalDatasetManifestV1Schema.safeParse({ ...dataset, purpose: "TRAINING" }).success).toBe(false);
    expect(evalDatasetManifestV1Schema.safeParse({ ...dataset, contentDigest: "not-a-digest" }).success).toBe(false);
  });

  it("rejects unknown fields, real data and unsupported major versions", () => {
    expect(denyEvalRequest({ ...request, unexpected: true }).status).toBe("DENIED");
    expect(denyEvalRequest({ ...request, schemaVersion: "eval-request.v2" }).reasonCode)
      .toBe("EVAL_SCHEMA_VERSION_UNSUPPORTED");
    expect(denyEvalRequest({ ...request, synthetic: false }).reasonCode)
      .toBe("EVAL_REAL_DATA_NOT_ALLOWED");
  });

  it("holds every registry empty and immutable", () => {
    for (const records of Object.values(emptyEvalRegistry)) {
      expect(records).toHaveLength(0);
      expect(Object.isFrozen(records)).toBe(true);
    }
    expect(Object.isFrozen(emptyEvalRegistry)).toBe(true);
  });

  it("denies all requests without runs, capability calls or side effects", () => {
    for (const input of [request, {}, { ...request, datasetId: "other" }, { ...request, synthetic: false }]) {
      const result = denyEvalRequest(input);
      expect(result.status).toBe("DENIED");
      expect(result.audit.eventType).toBe("EVAL_REQUEST_DENIED");
      expect(result.audit.reasonCode).toBe(result.reasonCode);
      expect(result.evalRunCreated).toBe(false);
      expect(result.capabilityCalled).toBe(false);
      expect(result.externalSideEffect).toBe(false);
    }
    expect(denyEvalRequest(request).reasonCode).toBe("EVAL_REFERENCE_MISSING");
  });
});
