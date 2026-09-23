import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { InMemoryNavigationAuditSink } from "../audit/navigation-audit.js";
import type { RequestContext } from "../contracts/navigation.js";
import { NavigationEngine } from "../navigation/navigation-engine.js";
import { validateRuntimeConfig } from "../validation/validate-runtime-config.js";

const config = validateRuntimeConfig(
  JSON.parse(readFileSync(resolve("config/runtime.test.json"), "utf8"))
);
const fixture = JSON.parse(
  readFileSync(resolve("fixtures/synthetic/onboarding-case.json"), "utf8")
) as Record<string, any>;

const context: RequestContext = {
  requestId: "req-smoke-001",
  tenantId: fixture.tenantId,
  dataSpaceId: fixture.dataSpaceId,
  activeTeamId: "hr-onboarding-team-demo",
  teamMembershipRef: "membership-demo-team",
  actorType: "user",
  actorId: fixture.actor.actorId,
  authenticationLevel: "test-verified",
  roles: fixture.actor.roles,
  scopeGrantRefs: ["scope-smoke-a2"],
  authorityGrantRefs: [],
  channel: "test_harness",
  sessionId: "session-smoke-001",
  correlationId: "corr-smoke-001",
  receivedAt: "2026-09-21T01:59:00.000Z",
  expiresAt: "2030-09-21T02:00:00.000Z",
  dataAccessPurpose: "onboarding_operation",
  environment: "test",
  contextVersion: "2",
  integrityRef: "test-smoke-integrity",
  synthetic: true
};

const audit = new InMemoryNavigationAuditSink();
const engine = new NavigationEngine({
  cases: [{
    synthetic: true,
    tenantId: fixture.tenantId,
    dataSpaceId: fixture.dataSpaceId,
    caseId: fixture.onboardingCase.caseId,
    offerRef: fixture.onboardingCase.offerRef,
    candidateRef: fixture.onboardingCase.candidateRef,
    displayName: "Synthetic Employee",
    accessible: true,
    version: "fixture-v1",
    sourceAvailability: "fresh"
  }],
  grants: [{
    grantRef: "scope-smoke-a2",
    tenantId: fixture.tenantId,
    dataSpaceId: fixture.dataSpaceId,
    actions: ["read", "analyze", "draft"],
    resourceIds: ["*"],
    result: "allow"
  }],
  capabilities: new Set(config.capabilities),
  auditSink: audit,
  now: () => new Date("2026-09-21T02:00:00.000Z")
});

const response = engine.navigate({
  context,
  input: {
    text: "查询 case-demo-001 状态",
    subjectClues: [{ type: "case_id", value: fixture.onboardingCase.caseId }]
  }
});

if (response.aggregateStatus !== "all_completed" || response.childResults[0]?.routeType !== "READ") {
  throw new Error(`Navigation smoke test failed: ${JSON.stringify(response)}`);
}

console.log(JSON.stringify({
  status: "navigation_smoke_passed",
  agentId: config.agent.id,
  aggregateStatus: response.aggregateStatus,
  routeType: response.childResults[0].routeType,
  auditEventCount: response.auditEventCount,
  capabilityCallCount: engine.capabilityCallCount,
  externalSideEffect: response.childResults[0].resultPayload?.externalSideEffect
}, null, 2));
