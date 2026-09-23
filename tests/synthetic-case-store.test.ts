import { mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RequestContext } from "../src/contracts/navigation.js";
import {
  createFeishuTestContext,
  syntheticTrustedFeishuPrincipals
} from "../src/mvp/feishu-test-context.js";
import { SyntheticCaseStore, SyntheticCaseStoreError } from "../src/mvp/synthetic-case-store.js";
import { createSyntheticReadyCard } from "../src/mvp/synthetic-ready-card.js";

const now = new Date("2026-09-22T03:00:00.000Z");
const context: RequestContext = {
  requestId: "request-mvp-001", tenantId: "tenant-demo-001", dataSpaceId: "dataspace-demo-hr",
  activeTeamId: "hr-onboarding-team-demo",
  teamMembershipRef: "membership-demo-team",
  actorType: "user", actorId: "hr-user-demo-001", authenticationLevel: "test-verified",
  roles: ["onboarding_hr_operations"], scopeGrantRefs: ["scope-mvp-synthetic"],
  authorityGrantRefs: [], channel: "test_harness", sessionId: "session-mvp-001",
  correlationId: "correlation-mvp-001", receivedAt: "2026-09-22T02:59:00.000Z",
  expiresAt: "2026-09-22T04:00:00.000Z", dataAccessPurpose: "onboarding_operation",
  environment: "test", contextVersion: "2", integrityRef: "test-integrity-mvp-001",
  synthetic: true
};
const offer = {
  schemaVersion: "synthetic-offer.v1", synthetic: true,
  scopeType: "TENANT_PRIVATE",
  tenantId: context.tenantId, dataSpaceId: context.dataSpaceId,
  offerRef: "offer-mvp-001", candidateRef: "candidate-mvp-001",
  plannedStartAt: "2026-10-01T01:00:00.000Z", sourceVersionRef: "offer-source-v1",
  requirements: ["DOCUMENTS", "IT_ACCOUNT", "DEVICE"].map((kind) => ({
    kind, ownerRef: `owner-${kind.toLowerCase()}`,
    deadlineAt: "2026-09-30T09:00:00.000Z",
    completionCriteriaRef: `criteria-${kind.toLowerCase()}-v1`,
    ruleVersionRef: "synthetic-mvp-rule-v1", sourceVersionRef: "offer-source-v1",
    freshness: "fresh"
  }))
};

const opened: SyntheticCaseStore[] = [];
const paths: Array<{ directory: string; databasePath: string }> = [];

function openStore(
  databasePath?: string,
  trustedTeamMemberships = syntheticTrustedFeishuPrincipals
): SyntheticCaseStore {
  const path = databasePath ?? (() => {
    const directory = mkdtempSync(join(tmpdir(), "hr-onboarding-mvp-"));
    const file = join(directory, "synthetic-cases.sqlite");
    paths.push({ directory, databasePath: file });
    return file;
  })();
  const store = new SyntheticCaseStore({
    databasePath: path,
    repositoryRoot: resolve("."),
    allowSyntheticTestStorage: true,
    trustedTeamMemberships,
    now: () => now
  });
  opened.push(store);
  return store;
}

afterEach(() => {
  for (const store of opened.splice(0)) store.close();
  for (const { directory, databasePath } of paths.splice(0)) {
    unlinkSync(databasePath);
    rmdirSync(directory);
  }
});

describe("synthetic MVP Case store", () => {
  it("shares an explicitly Team-scoped Case across two trusted HR tenants with actor provenance", () => {
    const hr1 = createFeishuTestContext({
      agentAccountId: "hr-bot-01",
      requesterSenderId: "ou_hr1synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now
    });
    const hr2 = createFeishuTestContext({
      agentAccountId: "hr-bot-02",
      requesterSenderId: "ou_hr2synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now
    });
    const teamOffer = {
      ...offer,
      scopeType: "TEAM_SHARED" as const,
      teamId: hr1.activeTeamId,
      dataSpaceId: hr1.dataSpaceId
    };
    const { tenantId: _privateTenant, ...sharedInput } = teamOffer;
    const store = openStore();
    const created = store.ingestOffer(hr1, sharedInput).case;
    store.updateRequirement(hr1, {
      schemaVersion: "synthetic-requirement-update.v1",
      caseRef: created.caseRef,
      kind: "DEVICE",
      expectedCaseVersion: created.caseVersion,
      status: "blocked",
      evidenceRefs: [],
      freshness: "fresh",
      sourceVersionRef: "itsm-team-synthetic-v2"
    });
    const observedByHr2 = store.getCase(hr2, created.caseRef);
    expect(observedByHr2).toMatchObject({
      scopeType: "TEAM_SHARED",
      teamId: "hr-onboarding-team-001",
      createdByTenantId: "tenant-hr-001",
      createdByActorId: "hr-user-001"
    });
    expect(observedByHr2?.requirements).toHaveLength(3);
    expect(observedByHr2?.requirements.find((item) => item.kind === "DEVICE")?.status).toBe("blocked");
    store.recordReadinessEvaluation(hr2, created.caseRef, observedByHr2?.caseVersion ?? 0);
    expect(store.listAuditEvents(hr2, created.caseRef).map((event) => event.actorId))
      .toEqual(["hr-user-001", "hr-user-001", "hr-user-002"]);
  });

  it("denies other-Team, missing, and forged membership without disclosing the shared Case", () => {
    const hr1 = createFeishuTestContext({
      agentAccountId: "hr-bot-01",
      requesterSenderId: "ou_hr1synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now
    });
    const hr2 = createFeishuTestContext({
      agentAccountId: "hr-bot-02",
      requesterSenderId: "ou_hr2synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now
    });
    const hr3 = createFeishuTestContext({
      agentAccountId: "hr-bot-03",
      requesterSenderId: "ou_hr3synthetic", trustedPrincipals: syntheticTrustedFeishuPrincipals, now
    });
    const { tenantId: _privateTenant, ...teamOffer } = {
      ...offer, scopeType: "TEAM_SHARED" as const, teamId: hr1.activeTeamId, dataSpaceId: hr1.dataSpaceId
    };
    const store = openStore();
    const caseRef = store.ingestOffer(hr1, teamOffer).case.caseRef;
    const missing = { ...hr2, teamMembershipRef: "membership-missing" };
    const forged = { ...hr2, teamMembershipRef: hr1.teamMembershipRef };
    const forgedWriter = {
      ...hr2,
      scopeGrantRefs: [...hr2.scopeGrantRefs, "scope-mvp-synthetic-team-write"]
    };
    expect(store.getCase(hr3, caseRef)).toBeNull();
    expect(store.getCase(missing, caseRef)).toBeNull();
    expect(store.getCase(forged, caseRef)).toBeNull();
    expect(() => store.updateRequirement(forgedWriter, {
      schemaVersion: "synthetic-requirement-update.v1",
      caseRef,
      kind: "DEVICE",
      expectedCaseVersion: 1,
      status: "blocked",
      evidenceRefs: [],
      freshness: "fresh",
      sourceVersionRef: "forged-source-v1"
    })).toThrowError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
    expect(store.listAuditEvents(hr3, caseRef)).toEqual([]);
    expect(store.countAuditEvents(missing, caseRef)).toBe(0);
  });

  it("creates exactly one Case and three Requirement records for an accepted Offer", () => {
    const store = openStore();
    const first = store.ingestOffer(context, offer);
    const replay = store.ingestOffer({ ...context, requestId: "request-mvp-replay" }, offer);
    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.case.caseRef).toBe(first.case.caseRef);
    expect(first.case.requirements.map((item) => item.kind)).toEqual(["DEVICE", "DOCUMENTS", "IT_ACCOUNT"]);
    expect(first.case.requirements.every((item) => item.status === "not_started")).toBe(true);
    expect(first.case.formalReadinessStatus).toBeNull();
    expect(store.countAuditEvents(context, first.case.caseRef)).toBe(1);
  });

  it("persists scoped Case state and versioned Requirement updates across reopen", () => {
    const firstStore = openStore();
    const caseRef = firstStore.ingestOffer(context, offer).case.caseRef;
    const updated = firstStore.updateRequirement(context, {
      schemaVersion: "synthetic-requirement-update.v1", caseRef, kind: "DEVICE",
      expectedCaseVersion: 1, status: "completed", evidenceRefs: ["evidence-device-synthetic-001"],
      evidenceValidationRef: "validation-device-synthetic-001", freshness: "fresh",
      sourceVersionRef: "itsm-synthetic-v2"
    });
    expect(updated.caseVersion).toBe(2);
    expect(updated.requirements.find((item) => item.kind === "DEVICE")).toMatchObject({
      version: 2, status: "completed", evidenceRefs: ["evidence-device-synthetic-001"]
    });
    firstStore.close();
    opened.splice(opened.indexOf(firstStore), 1);
    const reopened = openStore(paths[0]?.databasePath);
    expect(reopened.getCase(context, caseRef)).toEqual(updated);
    expect(reopened.countAuditEvents(context, caseRef)).toBe(2);
  });

  it("rejects unverified completion and stale writes without changing the Case", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    const update = {
      schemaVersion: "synthetic-requirement-update.v1", caseRef, kind: "DOCUMENTS",
      expectedCaseVersion: 1, status: "completed", evidenceRefs: [],
      freshness: "fresh", sourceVersionRef: "document-source-v1"
    };
    expect(() => store.updateRequirement(context, update)).toThrowError("INPUT_INVALID");
    const changed = store.updateRequirement(context, {
      ...update, status: "evidence_pending"
    });
    expect(changed.caseVersion).toBe(2);
    expect(() => store.updateRequirement(context, {
      ...update, status: "blocked"
    })).toThrowError("OBJECT_VERSION_CONFLICT");
    expect(store.getCase(context, caseRef)?.caseVersion).toBe(2);
    expect(store.countAuditEvents(context, caseRef)).toBe(2);
  });

  it("does not reveal cross-tenant Cases or accept mismatched Offer input", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    const foreignContext = { ...context, tenantId: "tenant-other", dataSpaceId: "dataspace-other" };
    expect(store.getCase(foreignContext, caseRef)).toBeNull();
    expect(store.countAuditEvents(foreignContext, caseRef)).toBe(0);
    expect(() => store.updateRequirement(foreignContext, {
      schemaVersion: "synthetic-requirement-update.v1", caseRef, kind: "DEVICE",
      expectedCaseVersion: 1, status: "blocked", evidenceRefs: [], freshness: "fresh",
      sourceVersionRef: "itsm-synthetic-v1"
    })).toThrowError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
    expect(() => store.ingestOffer(foreignContext, offer)).toThrowError("SCOPE_MISMATCH");
    expect(store.countAuditEvents(context, caseRef)).toBe(1);
  });

  it("does not expose the Case to another synthetic HR in the same Tenant and DataSpace", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    const otherActor = { ...context, actorId: "hr-user-other", requestId: "request-other-actor" };
    expect(store.getCase(otherActor, caseRef)).toBeNull();
    expect(store.countAuditEvents(otherActor, caseRef)).toBe(0);
    expect(() => store.ingestOffer(otherActor, offer))
      .toThrowError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
    expect(store.countAuditEvents(context, caseRef)).toBe(1);
  });

  it("rejects changed Offer replays and non-test or non-synthetic input", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    expect(() => store.ingestOffer(context, { ...offer, candidateRef: "candidate-other" }))
      .toThrowError("OFFER_REPLAY_CONFLICT");
    expect(() => store.ingestOffer({ ...context, channel: "feishu" }, offer))
      .toThrowError("TEST_CONTEXT_REQUIRED");
    expect(() => store.ingestOffer(context, { ...offer, synthetic: false }))
      .toThrowError("INPUT_INVALID");
    expect(store.getCase(context, caseRef)?.caseVersion).toBe(1);
  });

  it("rejects database files inside the source repository", () => {
    expect(() => new SyntheticCaseStore({
      databasePath: resolve("synthetic-mvp.sqlite"),
      repositoryRoot: resolve("."),
      allowSyntheticTestStorage: true
    })).toThrowError(SyntheticCaseStoreError);
  });

  it("generates an auditable Ready candidate only after all three synthetic requirements are completed", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    let version = 1;
    for (const kind of ["DOCUMENTS", "IT_ACCOUNT", "DEVICE"] as const) {
      store.updateRequirement(context, {
        schemaVersion: "synthetic-requirement-update.v1", caseRef, kind,
        expectedCaseVersion: version++, status: "completed",
        evidenceRefs: [`evidence-${kind.toLowerCase()}-synthetic-001`],
        evidenceValidationRef: `validation-${kind.toLowerCase()}-synthetic-001`,
        conflictRefs: [], freshness: "fresh", sourceVersionRef: `source-${kind.toLowerCase()}-v2`
      });
    }
    const card = createSyntheticReadyCard(store, context, caseRef);
    expect(card).toMatchObject({
      artifactStatus: "DRAFT", sendStatus: "NOT_SENT", formalStateChanged: false,
      externalSideEffect: false, readyEvaluationResult: "ELIGIBLE",
      suggestedReadinessStatus: "READY_CANDIDATE", formalReadinessStatus: null,
      confirmationStatus: "not_confirmed", reviewRequired: true, reasonCodes: []
    });
    expect(card.requirementItems).toHaveLength(3);
    expect(card.evaluationSnapshotDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(store.countAuditEvents(context, caseRef)).toBe(5);
  });

  it("shows missing Requirements and owner actions instead of a Ready suggestion", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    const card = createSyntheticReadyCard(store, context, caseRef);
    expect(card.readyEvaluationResult).toBe("NOT_ELIGIBLE");
    expect(card.suggestedReadinessStatus).toBe("AT_RISK");
    expect(card.reasonCodes).toEqual(["REQUIREMENT_INCOMPLETE"]);
    expect(card.ownerActionItems).toHaveLength(3);
    expect(store.countAuditEvents(context, caseRef)).toBe(2);
  });

  it("keeps stale source and fact conflict indeterminate", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    store.updateRequirement(context, {
      schemaVersion: "synthetic-requirement-update.v1", caseRef, kind: "DOCUMENTS",
      expectedCaseVersion: 1, status: "completed", evidenceRefs: ["evidence-documents-synthetic-001"],
      evidenceValidationRef: "validation-documents-synthetic-001", conflictRefs: [],
      freshness: "stale", sourceVersionRef: "document-source-v2"
    });
    store.updateRequirement(context, {
      schemaVersion: "synthetic-requirement-update.v1", caseRef, kind: "IT_ACCOUNT",
      expectedCaseVersion: 2, status: "completed", evidenceRefs: ["evidence-account-synthetic-001"],
      evidenceValidationRef: "validation-account-synthetic-001",
      conflictRefs: ["conflict-account-synthetic-001"], freshness: "fresh",
      sourceVersionRef: "account-source-v2"
    });
    const card = createSyntheticReadyCard(store, context, caseRef);
    expect(card.readyEvaluationResult).toBe("INDETERMINATE");
    expect(card.suggestedReadinessStatus).toBe("UNKNOWN");
    expect(card.reasonCodes).toEqual(expect.arrayContaining(["SOURCE_NOT_FRESH", "FACT_CONFLICT"]));
    expect(card.formalReadinessStatus).toBeNull();
  });

  it("does not issue a Ready card for a different synthetic Actor", () => {
    const store = openStore();
    const caseRef = store.ingestOffer(context, offer).case.caseRef;
    const otherActor: RequestContext = { ...context, actorId: "hr-user-other" };
    expect(() => createSyntheticReadyCard(store, otherActor, caseRef))
      .toThrowError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
    expect(store.countAuditEvents(context, caseRef)).toBe(1);
  });
});
