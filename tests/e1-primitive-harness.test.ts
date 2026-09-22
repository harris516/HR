import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { digestCapabilityPayload } from "../src/capabilities/gateway.js";
import { classifySyntheticIdempotencyReplay, deriveSyntheticCapabilityIdempotencyKey } from "../src/capabilities/implementations/idempotency-key.js";
import { capabilityRegistry } from "../src/capabilities/registry.js";
import { capabilityGatewayRequestSchema } from "../src/contracts/capability-gateway.js";
import type { IntentCandidate, NavigationTask, RequestContext } from "../src/contracts/navigation.js";
import { emptyEvalRegistry } from "../src/eval/registry.js";
import { runE1PrimitiveHarness, type E1PrimitiveVector } from "../src/eval/e1-primitive-harness.js";
import {
  assessSyntheticEvidence, assessSyntheticFreshness, assessSyntheticReadyCandidate,
  assessSyntheticRevalidation, checkSyntheticEvalIsolation, checkSyntheticHumanAuthority,
  projectSyntheticFields, resolveSyntheticProfessionalClass
} from "../src/eval/synthetic-policy-primitives.js";
import { authorizationPrecheck } from "../src/navigation/authorization.js";
import { validateRequestContext } from "../src/navigation/context-gate.js";
import { transitionTask } from "../src/navigation/lifecycle.js";
import { routeForbiddenIntent } from "../src/navigation/route-engine.js";
import { resolveSubject, type SyntheticCaseRecord } from "../src/navigation/subject-resolution.js";

const now = new Date("2026-09-22T02:00:00.000Z");
const context: RequestContext = {
  requestId: "e1-request-001", tenantId: "tenant-synthetic-001", dataSpaceId: "space-synthetic-001",
  actorType: "user", actorId: "actor-synthetic-001", authenticationLevel: "test-verified",
  roles: ["onboarding_hr_operations"], scopeGrantRefs: ["grant-synthetic-001"],
  authorityGrantRefs: [], channel: "test_harness", sessionId: "session-synthetic-001",
  correlationId: "correlation-synthetic-001", receivedAt: "2026-09-22T01:00:00.000Z",
  expiresAt: "2026-09-23T02:00:00.000Z", dataAccessPurpose: "onboarding_operation",
  environment: "test", contextVersion: "1", integrityRef: "test-integrity-001", synthetic: true
};
const record: SyntheticCaseRecord = {
  synthetic: true, tenantId: context.tenantId, dataSpaceId: context.dataSpaceId,
  caseId: "case-synthetic-001", offerRef: "offer-synthetic-001",
  candidateRef: "candidate-synthetic-001", displayName: "Synthetic Person",
  accessible: true, version: "case-v1"
};
const intent: IntentCandidate = {
  intentCandidateId: "intent-synthetic-001", requestContextRef: context.requestId,
  correlationId: context.correlationId, intentId: "GET_CASE_STATUS", intentClass: "supported_p0",
  taskType: "CASE_STATUS_CHECK", subjectRequirement: "unique_case",
  requestedActionClass: "read", capabilityCandidate: "read_stub", reasonCodes: []
};

const idempotencyCapability = capabilityRegistry.capabilities.find((entry) =>
  entry.capabilityId === "hr.onboarding.intake.handoff.read"
)!;
const idempotencyRequest = capabilityGatewayRequestSchema.parse({
  gatewayRequestVersion: "1", capabilityRequestId: "request-e1-idempotency",
  taskId: "task-e1-idempotency", attemptId: "attempt-e1-idempotency",
  routeDecisionRef: "route-e1-idempotency", requestContext: context,
  capabilityRef: { capabilityId: idempotencyCapability.capabilityId,
    capabilityVersion: idempotencyCapability.capabilityVersion },
  resourceRefs: [{ resourceType: "OnboardingCase", resourceId: record.caseId,
    tenantId: context.tenantId, dataSpaceId: context.dataSpaceId,
    sensitivity: "SYNTHETIC_INTERNAL" }],
  actionClass: idempotencyCapability.actionClass, purpose: "onboarding_operation",
  inputEnvelope: { synthetic: true },
  authorizationDecision: {
    decisionId: "decision-e1-idempotency", result: "allow",
    policyVersion: "policy-synthetic-v1", grantVersion: "grant-synthetic-v1",
    enforcementPoint: "capability_gateway",
    capabilityRef: { capabilityId: idempotencyCapability.capabilityId,
      capabilityVersion: idempotencyCapability.capabilityVersion },
    tenantId: context.tenantId, dataSpaceId: context.dataSpaceId,
    actorId: context.actorId, actionClass: idempotencyCapability.actionClass,
    purpose: "onboarding_operation"
  },
  risk: { phc: "PHC_0", prohibition: "NONE" }, review: { status: "NOT_REQUIRED" },
  createdAt: context.receivedAt, expiresAt: context.expiresAt
});

const evidenceInput = {
  propositionBound: true, sourcePolicyActive: true, provenanceComplete: true,
  fresh: true, qualityValid: true, identityResolved: true, blockingConflict: false,
  validatorAuthorized: true, purposePermitted: true, versionAndAuditReady: true
};
const authorityInput = {
  grantConfigured: true, grantActive: true, revisionMatched: true, tenantMatched: true,
  dataSpaceMatched: true, decisionMatched: true, resourceMatched: true,
  purposeMatched: true, withinEffectivePeriod: true, assurancePolicyConfigured: true,
  assuranceSatisfied: true, sodPolicyConfigured: true, relationshipFactsComplete: true,
  requesterRef: "requester-synthetic", reviewerRef: "reviewer-synthetic"
};
const isolationInput = {
  synthetic: true, scope: "SYNTHETIC_GLOBAL" as const,
  governanceNamespaceId: "governance-synthetic", trainPartition: "TRAIN_AUTHORING",
  evalPartition: "EVAL_HOLDOUT", sharedGeneratorLineage: false,
  expectedAnswerAccessibleToTrainingAuthor: false,
  scanResults: { exact: "PASS", normalized: "PASS", semantic: "PASS", template: "PASS",
    generatorSeed: "PASS", expectedAnswer: "PASS", reviewerAccess: "PASS" } as const
};

function vectors(): E1PrimitiveVector[] {
  return [
    { caseId: "e1-context-nominal", family: "TENANT_DATA_SPACE_SCOPE", boundaryClass: "NOMINAL",
      synthetic: true, expected: { ok: true }, execute: () => ({ ok: validateRequestContext(context, now).ok }) },
    { caseId: "e1-tenant-missing", family: "TENANT_DATA_SPACE_SCOPE", boundaryClass: "MISSING",
      synthetic: true, expected: { ok: false, hardBlock: true, reasonCode: "TENANT_MISSING_OR_MISMATCH" },
      execute: () => { const input: Record<string, unknown> = { ...context }; delete input.tenantId;
        return validateRequestContext(input, now); } },
    { caseId: "e1-context-expired", family: "TENANT_DATA_SPACE_SCOPE", boundaryClass: "EXPIRED",
      synthetic: true, expected: { ok: false, hardBlock: false, reasonCode: "REQUEST_CONTEXT_EXPIRED" },
      execute: () => validateRequestContext({ ...context, expiresAt: now.toISOString() }, now) },
    { caseId: "e1-subject-conflict", family: "SUBJECT_IDENTITY", boundaryClass: "CONFLICT",
      synthetic: true, expected: "context_mismatch",
      execute: () => resolveSubject(context, [{ type: "case_id", value: record.caseId }],
        [{ ...record, tenantId: "tenant-other" }], undefined, now).status },
    { caseId: "e1-subject-nominal", family: "SUBJECT_IDENTITY", boundaryClass: "NOMINAL",
      synthetic: true, expected: "resolved",
      execute: () => resolveSubject(context, [{ type: "case_id", value: record.caseId }],
        [record], undefined, now).status },
    { caseId: "e1-subject-unknown", family: "SUBJECT_IDENTITY", boundaryClass: "UNKNOWN",
      synthetic: true, expected: "not_found",
      execute: () => resolveSubject(context, [], [record], undefined, now).status },
    { caseId: "e1-auth-deny", family: "AUTHORIZATION", boundaryClass: "BOUNDARY",
      synthetic: true, expected: { result: "deny", reasonCode: "ACTION_NOT_ALLOWED" },
      execute: () => {
        const decision = authorizationPrecheck({ context, intent,
          resource: { resourceType: "OnboardingCase", resourceId: record.caseId, sensitivity: "synthetic" },
          capability: { capabilityId: "read_stub", capabilityVersion: "stub-v1" },
          risk: { phc: "PHC_1", prohibition: "none" },
          grants: [{ grantRef: context.scopeGrantRefs[0]!, tenantId: context.tenantId,
            dataSpaceId: context.dataSpaceId, actions: ["draft"], resourceIds: [record.caseId], result: "allow" }]
        }, () => "fixed");
        return { result: decision.result, reasonCode: decision.reasonCode };
      } },
    { caseId: "e1-auth-allow", family: "AUTHORIZATION", boundaryClass: "NOMINAL",
      synthetic: true, expected: { result: "allow", reasonCode: null },
      execute: () => {
        const decision = authorizationPrecheck({ context, intent,
          resource: { resourceType: "OnboardingCase", resourceId: record.caseId, sensitivity: "synthetic" },
          capability: { capabilityId: "read_stub", capabilityVersion: "stub-v1" },
          risk: { phc: "PHC_1", prohibition: "none" },
          grants: [{ grantRef: context.scopeGrantRefs[0]!, tenantId: context.tenantId,
            dataSpaceId: context.dataSpaceId, actions: ["read"], resourceIds: [record.caseId], result: "allow" }]
        }, () => "fixed");
        return { result: decision.result, reasonCode: decision.reasonCode ?? null };
      } },
    { caseId: "e1-route-nominal", family: "PROHIBITION_REVIEW_ROUTING", boundaryClass: "NOMINAL",
      synthetic: true, expected: null, execute: () => routeForbiddenIntent(intent) ?? null },
    { caseId: "e1-formal-prohibition", family: "PROHIBITION_REVIEW_ROUTING", boundaryClass: "UNSUPPORTED",
      synthetic: true, expected: { routeType: "DENY", reasonCodes: ["FORMAL_COMMIT_PROHIBITED"], mayCallCapability: false },
      execute: () => { const outcome = routeForbiddenIntent({ ...intent, intentId: "FORMAL_READY_COMMIT_REQUEST",
        intentClass: "forbidden_request", requestedActionClass: "commit" });
        return { routeType: outcome?.routeType, reasonCodes: outcome?.reasonCodes,
          mayCallCapability: outcome?.mayCallCapability }; } },
    { caseId: "e1-digest-order", family: "DIGEST", boundaryClass: "NOMINAL",
      synthetic: true,
      expected: `sha256:${createHash("sha256").update('{"a":1,"b":2}').digest("hex")}`,
      execute: () => digestCapabilityPayload({ b: 2, a: 1 }) },
    { caseId: "e1-digest-boundary", family: "DIGEST", boundaryClass: "BOUNDARY",
      synthetic: true, expected: false,
      execute: () => digestCapabilityPayload({ a: 1, b: 2 }) === digestCapabilityPayload({ a: 1, b: 3 }) },
    { caseId: "e1-idempotency-nominal", family: "IDEMPOTENCY", boundaryClass: "NOMINAL",
      synthetic: true, expected: { same: true, differentDeduplicationKey: true },
      execute: () => {
        const first = deriveSyntheticCapabilityIdempotencyKey(idempotencyRequest,
          idempotencyCapability, { deduplicationKey: "synthetic-dedupe-001" });
        const repeat = deriveSyntheticCapabilityIdempotencyKey(idempotencyRequest,
          idempotencyCapability, { deduplicationKey: "synthetic-dedupe-001" });
        const changed = deriveSyntheticCapabilityIdempotencyKey(idempotencyRequest,
          idempotencyCapability, { deduplicationKey: "synthetic-dedupe-002" });
        return { same: first === repeat, differentDeduplicationKey: first !== changed };
      } },
    { caseId: "e1-idempotency-scope-boundary", family: "IDEMPOTENCY", boundaryClass: "BOUNDARY",
      synthetic: true, expected: { differentTenant: true, differentGrantVersion: true },
      execute: () => {
        const input = { deduplicationKey: "synthetic-dedupe-001" };
        const first = deriveSyntheticCapabilityIdempotencyKey(idempotencyRequest,
          idempotencyCapability, input);
        const tenantChanged = deriveSyntheticCapabilityIdempotencyKey({ ...idempotencyRequest,
          requestContext: { ...context, tenantId: "tenant-synthetic-002" } }, idempotencyCapability, input);
        const grantChanged = deriveSyntheticCapabilityIdempotencyKey({ ...idempotencyRequest,
          authorizationDecision: { ...idempotencyRequest.authorizationDecision,
            grantVersion: "grant-synthetic-v2" } }, idempotencyCapability, input);
        return { differentTenant: first !== tenantChanged, differentGrantVersion: first !== grantChanged };
      } },
    { caseId: "e1-idempotency-replay", family: "IDEMPOTENCY", boundaryClass: "CONFLICT",
      synthetic: true, expected: { first: "NEW", same: "DUPLICATE", changed: "CONFLICT" },
      execute: () => ({
        first: classifySyntheticIdempotencyReplay(undefined, "digest-a"),
        same: classifySyntheticIdempotencyReplay("digest-a", "digest-a"),
        changed: classifySyntheticIdempotencyReplay("digest-a", "digest-b")
      }) },
    { caseId: "e1-freshness-ready-nominal", family: "FRESHNESS_EVIDENCE_READY_REVALIDATION",
      boundaryClass: "NOMINAL", synthetic: true,
      expected: { freshness: { status: "PASS", result: "FRESH" },
        evidence: { status: "PASS", result: "EVIDENCE_CANDIDATE_VALID" },
        ready: { status: "PASS", result: "ELIGIBLE_CANDIDATE" },
        revalidation: { status: "PASS", result: "RECALCULATE_REQUIRED" } },
      execute: () => ({
        freshness: assessSyntheticFreshness({ observedAt: "2026-09-22T01:00:00.000Z",
          sourceVersion: "source-v1", sourceAvailable: true, maxAgeMs: 7_200_000,
          now: now.toISOString() }),
        evidence: assessSyntheticEvidence(evidenceInput),
        ready: assessSyntheticReadyCandidate({ ruleVersion: "synthetic-rule-v1",
          sourceFreshness: "FRESH", evidenceValid: true, identityResolved: true,
          openConflict: false, blockingRequirements: 0, blockingRisks: 0 }),
        revalidation: assessSyntheticRevalidation("SOURCE_CORRECTED")
      }) },
    { caseId: "e1-freshness-ready-unconfigured", family: "FRESHNESS_EVIDENCE_READY_REVALIDATION",
      boundaryClass: "MISSING", synthetic: true,
      expected: { freshness: { status: "BLOCKED", reason: "FRESHNESS_POLICY_UNCONFIGURED" },
        evidence: { status: "BLOCKED", reason: "EVIDENCE_CONFLICT" },
        ready: { status: "BLOCKED", reason: "READY_INPUT_INDETERMINATE" },
        revalidation: { status: "BLOCKED", reason: "REVALIDATION_TRIGGER_UNKNOWN" } },
      execute: () => ({
        freshness: assessSyntheticFreshness({ observedAt: "2026-09-22T01:00:00.000Z",
          sourceVersion: "source-v1", sourceAvailable: true, maxAgeMs: null,
          now: now.toISOString() }),
        evidence: assessSyntheticEvidence({ ...evidenceInput, blockingConflict: true }),
        ready: assessSyntheticReadyCandidate({ ruleVersion: null, sourceFreshness: "UNKNOWN",
          evidenceValid: false, identityResolved: true, openConflict: true,
          blockingRequirements: 0, blockingRisks: 0 }),
        revalidation: assessSyntheticRevalidation("UNAPPROVED_TRIGGER")
      }) },
    { caseId: "e1-freshness-stale", family: "FRESHNESS_EVIDENCE_READY_REVALIDATION",
      boundaryClass: "EXPIRED", synthetic: true,
      expected: { status: "PASS", result: "STALE" },
      execute: () => assessSyntheticFreshness({ observedAt: "2026-09-22T01:00:00.000Z",
        sourceVersion: "source-v1", sourceAvailable: true, maxAgeMs: 1_000,
        now: now.toISOString() }) },
    { caseId: "e1-evidence-required-flag-absent", family: "FRESHNESS_EVIDENCE_READY_REVALIDATION",
      boundaryClass: "UNKNOWN", synthetic: true,
      expected: { status: "BLOCKED", reason: "EVIDENCE_PRECONDITION_MISSING" },
      execute: () => {
        const incomplete: Record<string, unknown> = { ...evidenceInput };
        delete incomplete.validatorAuthorized;
        return assessSyntheticEvidence(incomplete as unknown as typeof evidenceInput);
      } },
    { caseId: "e1-phc-nominal", family: "PHC_RISK_CLASSIFICATION", boundaryClass: "NOMINAL",
      synthetic: true, expected: { status: "PASS", result: {
        effectivePHC: "PHC_3", reviewRequired: true, agentActionBlocked: false } },
      execute: () => resolveSyntheticProfessionalClass({ ruleVersion: "phc-synthetic-v1",
        applicableClasses: ["PHC_1", "PHC_3", "PHC_2"], prohibition: "NONE" }) },
    { caseId: "e1-phc-unknown", family: "PHC_RISK_CLASSIFICATION", boundaryClass: "UNKNOWN",
      synthetic: true, expected: { status: "BLOCKED", reason: "PHC_CLASSIFICATION_UNCERTAIN" },
      execute: () => resolveSyntheticProfessionalClass({ ruleVersion: null,
        applicableClasses: ["PHC_1"], prohibition: "NONE" }) },
    { caseId: "e1-phc4-prohibited", family: "PHC_RISK_CLASSIFICATION", boundaryClass: "BOUNDARY",
      synthetic: true, expected: { status: "PASS", result: {
        effectivePHC: "PHC_4", reviewRequired: true, agentActionBlocked: true } },
      execute: () => resolveSyntheticProfessionalClass({ ruleVersion: "phc-synthetic-v1",
        applicableClasses: ["PHC_2", "PHC_4"], prohibition: "NONE" }) },
    { caseId: "e1-phc-hard-block", family: "PHC_RISK_CLASSIFICATION", boundaryClass: "UNSUPPORTED",
      synthetic: true, expected: { status: "BLOCKED", reason: "SYSTEM_HARD_BLOCK" },
      execute: () => resolveSyntheticProfessionalClass({ ruleVersion: "phc-synthetic-v1",
        applicableClasses: ["PHC_1"], prohibition: "SYSTEM_HARD_BLOCK" }) },
    { caseId: "e1-phc-unknown-prohibition", family: "PHC_RISK_CLASSIFICATION", boundaryClass: "CONFLICT",
      synthetic: true, expected: { status: "BLOCKED", reason: "PHC_CLASSIFICATION_UNCERTAIN" },
      execute: () => resolveSyntheticProfessionalClass({ ruleVersion: "phc-synthetic-v1",
        applicableClasses: ["PHC_1"], prohibition: "UNKNOWN" as "NONE" }) },
    { caseId: "e1-authority-nominal", family: "AUTHORITY_SOD_ASSURANCE", boundaryClass: "NOMINAL",
      synthetic: true, expected: { status: "PASS", result: "SYNTHETIC_GATE_CONDITIONS_MET" },
      execute: () => checkSyntheticHumanAuthority(authorityInput) },
    { caseId: "e1-authority-sod-deny", family: "AUTHORITY_SOD_ASSURANCE", boundaryClass: "CONFLICT",
      synthetic: true, expected: { status: "BLOCKED", reason: "SOD_SELF_REVIEW" },
      execute: () => checkSyntheticHumanAuthority({ ...authorityInput,
        reviewerRef: authorityInput.requesterRef }) },
    { caseId: "e1-authority-unconfigured", family: "AUTHORITY_SOD_ASSURANCE", boundaryClass: "MISSING",
      synthetic: true, expected: { status: "BLOCKED", reason: "AUTHORITY_POLICY_UNCONFIGURED" },
      execute: () => checkSyntheticHumanAuthority({ ...authorityInput, grantConfigured: false }) },
    { caseId: "e1-authority-step-up", family: "AUTHORITY_SOD_ASSURANCE", boundaryClass: "BOUNDARY",
      synthetic: true, expected: { status: "BLOCKED", reason: "ASSURANCE_STEP_UP_REQUIRED" },
      execute: () => checkSyntheticHumanAuthority({ ...authorityInput, assuranceSatisfied: false }) },
    { caseId: "e1-redaction-nominal", family: "REDACTION_FIELD_PROJECTION", boundaryClass: "NOMINAL",
      synthetic: true, expected: { status: "PASS", result: { status: "synthetic-ready" } },
      execute: () => projectSyntheticFields({ policyVersion: "projection-synthetic-v1",
        purposeAuthorized: true, permittedFieldNames: ["status", "secret", "salary"],
        permittedClasses: ["INTERNAL", "CREDENTIAL_SECRET", "SENSITIVE_PERSONAL"],
        fields: { status: { classification: "INTERNAL", value: "synthetic-ready" },
          secret: { classification: "CREDENTIAL_SECRET", value: "synthetic-secret" },
          salary: { classification: "SENSITIVE_PERSONAL", value: "synthetic-salary" } } }) },
    { caseId: "e1-redaction-policy-missing", family: "REDACTION_FIELD_PROJECTION", boundaryClass: "MISSING",
      synthetic: true, expected: { status: "BLOCKED", reason: "FIELD_PROJECTION_POLICY_UNCONFIGURED" },
      execute: () => projectSyntheticFields({ policyVersion: null, purposeAuthorized: true,
        permittedFieldNames: ["status"], permittedClasses: ["INTERNAL"],
        fields: { status: { classification: "INTERNAL", value: "synthetic-ready" } } }) },
    { caseId: "e1-isolation-nominal", family: "GROWTH_TRAINING_EVAL_GOVERNANCE",
      boundaryClass: "NOMINAL", synthetic: true,
      expected: { status: "PASS", result: "ISOLATED_FOR_SYNTHETIC_TEST" },
      execute: () => checkSyntheticEvalIsolation(isolationInput) },
    { caseId: "e1-isolation-contamination", family: "GROWTH_TRAINING_EVAL_GOVERNANCE",
      boundaryClass: "CONFLICT", synthetic: true,
      expected: { status: "BLOCKED", reason: "EVAL_CONTAMINATION_DETECTED" },
      execute: () => checkSyntheticEvalIsolation({ ...isolationInput, sharedGeneratorLineage: true }) },
    { caseId: "e1-isolation-scan-unknown", family: "GROWTH_TRAINING_EVAL_GOVERNANCE",
      boundaryClass: "UNKNOWN", synthetic: true,
      expected: { status: "BLOCKED", reason: "EVAL_CONTAMINATION_UNRESOLVED" },
      execute: () => checkSyntheticEvalIsolation({ ...isolationInput,
        scanResults: { ...isolationInput.scanResults, semantic: "INDETERMINATE" } }) },
    { caseId: "e1-isolation-scan-missing", family: "GROWTH_TRAINING_EVAL_GOVERNANCE",
      boundaryClass: "MISSING", synthetic: true,
      expected: { status: "BLOCKED", reason: "EVAL_CONTAMINATION_UNRESOLVED" },
      execute: () => {
        const incomplete: Record<string, unknown> = { ...isolationInput.scanResults };
        delete incomplete.reviewerAccess;
        return checkSyntheticEvalIsolation({ ...isolationInput,
          scanResults: incomplete as typeof isolationInput.scanResults });
      } },
    { caseId: "e1-valid-transition", family: "STATE_TRANSITION", boundaryClass: "NOMINAL",
      synthetic: true, expected: { from: "created", to: "validated", status: "validated", transitionCount: 1 },
      execute: () => {
        const task: NavigationTask = { taskId: "task-synthetic-001", attemptId: "attempt-synthetic-001",
          taskEnvelopeVersion: "1", requestContextRef: context.requestId, tenantId: context.tenantId,
          dataSpaceId: context.dataSpaceId, correlationId: context.correlationId,
          intent, status: "created", reasonCodes: [], transitionRecordRefs: [] };
        const transition = transitionTask(task, "validated", "validated", [], () => "fixed", now);
        return { from: transition.fromStatus, to: transition.toStatus,
          status: task.status, transitionCount: task.transitionRecordRefs.length };
      } },
    { caseId: "e1-invalid-transition", family: "STATE_TRANSITION", boundaryClass: "BOUNDARY",
      synthetic: true, expected: { rejected: true, status: "completed", transitionCount: 0 },
      execute: () => {
        const task: NavigationTask = { taskId: "task-synthetic-001", attemptId: "attempt-synthetic-001",
          taskEnvelopeVersion: "1", requestContextRef: context.requestId, tenantId: context.tenantId,
          dataSpaceId: context.dataSpaceId, correlationId: context.correlationId,
          intent, status: "completed", reasonCodes: [], transitionRecordRefs: [] };
        let rejected = false;
        try { transitionTask(task, "in_progress", "invalid", [], () => "fixed", now); }
        catch { rejected = true; }
        return { rejected, status: task.status, transitionCount: task.transitionRecordRefs.length };
      } }
  ];
}

describe("EVS3 deterministic primitive harness", () => {
  it("runs exact synthetic vectors three times and keeps formal E1 blocked", () => {
    const report = runE1PrimitiveHarness(vectors());
    expect(report.vectorResults).toHaveLength(36);
    expect(report.vectorResults.every((result) => result.status === "PASS")).toBe(true);
    expect(report.missingBoundaryClasses).toEqual([]);
    expect(report.missingFamilies).toEqual([]);
    expect(report.status).toBe("BLOCKED");
    expect(report.evalRunCreated).toBe(false);
    expect(report.acceptanceDecisionCreated).toBe(false);
    expect(Object.values(emptyEvalRegistry).every((entries) => entries.length === 0)).toBe(true);
  });

  it("fails incorrect exact output without laundering it as coverage", () => {
    const wrong = { ...vectors()[0]!, expected: { ok: false } };
    const report = runE1PrimitiveHarness([wrong]);
    expect(report.status).toBe("FAIL");
    expect(report.vectorResults[0]?.reasonCode).toBe("EVAL_HARD_ASSERTION_FAILED");
  });

  it("rejects a vector that rewrites its own expected result", () => {
    const expected = { allowed: false };
    const mutating: E1PrimitiveVector = { caseId: "e1-mutating-oracle", family: "AUTHORIZATION",
      boundaryClass: "BOUNDARY", synthetic: true, expected,
      execute: () => { expected.allowed = true; return { allowed: true }; } };
    const report = runE1PrimitiveHarness([mutating]);
    expect(report.vectorResults[0]).toMatchObject({
      status: "FAIL", reasonCode: "EVAL_HARD_ASSERTION_FAILED"
    });
  });

  it("rejects an uncloneable expected result before executing any vector", () => {
    let called = false;
    const valid = { ...vectors()[0]!, execute: () => { called = true; return { ok: true }; } };
    const invalid = { ...vectors()[1]!, expected: () => "not structured data" };
    expect(() => runE1PrimitiveHarness([valid, invalid])).toThrow("invalid E1 expected result catalog");
    expect(called).toBe(false);
  });

  it("detects nondeterministic repeated output", () => {
    let counter = 0;
    const unstable: E1PrimitiveVector = { caseId: "e1-flaky-synthetic", family: "DIGEST",
      boundaryClass: "NOMINAL", synthetic: true, expected: 1, execute: () => ++counter };
    const report = runE1PrimitiveHarness([unstable]);
    expect(report.status).toBe("FAIL");
    expect(report.vectorResults[0]?.reasonCode).toBe("EVAL_CASE_FLAKY");
  });

  it("rejects duplicate or non-synthetic vectors before any execution", () => {
    const duplicate = [vectors()[0]!, vectors()[0]!];
    expect(() => runE1PrimitiveHarness(duplicate)).toThrow();
    let called = false;
    const invalid = { ...vectors()[0]!, synthetic: false as true, execute: () => { called = true; } };
    expect(() => runE1PrimitiveHarness([invalid])).toThrow();
    expect(called).toBe(false);
  });
});
