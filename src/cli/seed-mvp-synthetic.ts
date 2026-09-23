import { resolve } from "node:path";
import {
  createFeishuTestContext,
  syntheticTrustedFeishuPrincipals
} from "../mvp/feishu-test-context.js";
import { SyntheticCaseStore } from "../mvp/synthetic-case-store.js";

const databasePath = process.argv[2];
if (!databasePath) {
  throw new Error("Usage: pnpm seed:mvp /absolute/path/to/synthetic-mvp.sqlite");
}

const now = new Date();
const context = createFeishuTestContext({
  requesterSenderId: "ou_hr1synthetic",
  trustedPrincipals: syntheticTrustedFeishuPrincipals,
  sessionRef: "test-seed-team-session",
  now
});

const store = new SyntheticCaseStore({
  databasePath,
  repositoryRoot: resolve("."),
  allowSyntheticTestStorage: true,
  trustedTeamMemberships: syntheticTrustedFeishuPrincipals
});

try {
  let snapshot = store.ingestOffer(context, {
    schemaVersion: "synthetic-offer.v1",
    synthetic: true,
    scopeType: "TEAM_SHARED",
    teamId: context.activeTeamId,
    dataSpaceId: context.dataSpaceId,
    offerRef: "offer-mvp-feishu-001",
    candidateRef: "candidate-synthetic-feishu-001",
    plannedStartAt: "2026-10-01T01:00:00.000Z",
    sourceVersionRef: "synthetic-offer-source-v1",
    requirements: ["DOCUMENTS", "IT_ACCOUNT", "DEVICE"].map((kind) => ({
      kind,
      ownerRef: `synthetic-owner-${kind.toLowerCase()}`,
      deadlineAt: "2026-09-30T09:00:00.000Z",
      completionCriteriaRef: `synthetic-criteria-${kind.toLowerCase()}-v1`,
      ruleVersionRef: "synthetic-mvp-rule-v1",
      sourceVersionRef: "synthetic-offer-source-v1",
      freshness: "fresh"
    }))
  }).case;

  for (const item of snapshot.requirements) {
    if (item.status === "completed" && item.freshness === "fresh" &&
      item.evidenceRefs.length > 0 && item.evidenceValidationRef) continue;
    if (item.status !== "not_started") throw new Error("Seed case has existing non-default requirement state");
    snapshot = store.updateRequirement(context, {
      schemaVersion: "synthetic-requirement-update.v1",
      caseRef: snapshot.caseRef,
      kind: item.kind,
      expectedCaseVersion: snapshot.caseVersion,
      status: "completed",
      evidenceRefs: [`synthetic-evidence-${item.kind.toLowerCase()}-v1`],
      evidenceValidationRef: `synthetic-validation-${item.kind.toLowerCase()}-v1`,
      conflictRefs: [],
      freshness: "fresh",
      sourceVersionRef: "synthetic-offer-source-v1"
    });
  }
  process.stdout.write(`${JSON.stringify({ synthetic: true, caseRef: snapshot.caseRef,
    caseVersion: snapshot.caseVersion, requirementCount: snapshot.requirements.length })}\n`);
} finally {
  store.close();
}
