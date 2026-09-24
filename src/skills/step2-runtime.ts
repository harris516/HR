import { createHash, randomUUID } from "node:crypto";
import { InMemoryCapabilityGatewayAuditSink } from "../audit/capability-audit.js";
import { InMemoryCapabilityExecutionAuditSink } from "../audit/capability-execution-audit.js";
import { InMemorySkillAuditSink } from "../audit/skill-audit.js";
import { CapabilityGateway } from "../capabilities/gateway.js";
import { SyntheticCapabilityExecutor } from "../capabilities/implementations/executor.js";
import { SyntheticSkillImplementationRegistry } from "../capabilities/implementations/skill-implementation-registry.js";
import {
  createPersistentCapabilityView,
  syntheticCapabilityStore,
  type SyntheticCapabilityStore
} from "../capabilities/implementations/synthetic-store.js";
import { capabilityRegistry } from "../capabilities/registry.js";
import type { RequestContext } from "../contracts/navigation.js";
import type { SkillRunResult } from "../contracts/skill-orchestration.js";
import { SyntheticCaseStore, type TrustedTeamMembership } from "../mvp/synthetic-case-store.js";
import { SyntheticMutationGateway, type SyntheticMutationResult } from "../mvp/synthetic-mutation-gateway.js";
import { SyntheticSkillOrchestrator } from "./orchestrator.js";
import { parseStep2WorkflowInput, step2RuntimeInvocationSchema } from "./runtime-inputs.js";
import { Step2SkillRequestCompiler } from "./runtime-request-compiler.js";
import {
  step2SyntheticActivationProfile,
  validateStep2SyntheticActivationProfile,
  type Step2SyntheticActivationProfile
} from "./step2-activation-profile.js";

export interface Step2SkillRuntimeOptions {
  activationProfile?: Step2SyntheticActivationProfile;
  allowSyntheticTestExecution: true;
  now?: () => Date;
  idFactory?: () => string;
  auditAvailability?: {
    skill?: boolean;
    gateway?: boolean;
    execution?: boolean;
  };
  databasePath?: string;
  repositoryRoot?: string;
  trustedTeamMemberships?: readonly TrustedTeamMembership[];
}

export interface Step2SkillRuntimeResult {
  activationProfileId: string;
  result: SkillRunResult;
  mutationOutput?: SyntheticMutationResult;
  auditRefs: {
    skill: string[];
    gateway: string[];
    execution: string[];
  };
  implementationCallCount: number;
  formalStateChanged: false;
  outboundMessageSent: false;
  externalSideEffect: false;
  realCustomerDataProcessed: false;
  unsafeToolFallbackCount: 0;
}

function scopeStoreToPrincipal(context: RequestContext): SyntheticCapabilityStore {
  const store = structuredClone(syntheticCapabilityStore) as SyntheticCapabilityStore;
  store.tenantId = context.tenantId;
  store.dataSpaceId = context.dataSpaceId;
  const scope = <T extends {
    tenantId: string;
    dataSpaceId: string;
    authorizedActorIds: string[];
  }>(record: T): T => ({
    ...record,
    tenantId: context.tenantId,
    dataSpaceId: context.dataSpaceId,
    authorizedActorIds: [context.actorId]
  });
  store.cases = store.cases.map(scope);
  store.requirements = store.requirements.map(scope);
  store.risks = store.risks.map(scope);
  store.observations = store.observations.map(scope);
  store.evidenceLinks = store.evidenceLinks.map(scope);
  store.responsibilities = store.responsibilities.map((record) => ({
    ...scope(record),
    responsibilityScopeRef: `workbox-${context.actorId}`
  }));
  store.artifacts = store.artifacts.map(scope);
  store.auditEvents = store.auditEvents.map(scope);
  return store;
}

export class Step2SyntheticSkillRuntime {
  readonly #profile: Step2SyntheticActivationProfile;
  readonly #now: () => Date;
  readonly #idFactory: () => string;
  readonly #auditAvailability: NonNullable<Step2SkillRuntimeOptions["auditAvailability"]>;
  readonly #databaseOptions?: {
    databasePath: string;
    repositoryRoot: string;
    trustedTeamMemberships?: readonly TrustedTeamMembership[];
  };

  constructor(options: Step2SkillRuntimeOptions) {
    if (!options.allowSyntheticTestExecution) {
      throw new Error("Step 2 runtime requires explicit synthetic test-only opt-in");
    }
    this.#profile = validateStep2SyntheticActivationProfile(
      options.activationProfile ?? step2SyntheticActivationProfile
    );
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#auditAvailability = options.auditAvailability ?? {};
    if (options.databasePath !== undefined && options.repositoryRoot !== undefined) {
      this.#databaseOptions = {
        databasePath: options.databasePath,
        repositoryRoot: options.repositoryRoot,
        ...(options.trustedTeamMemberships === undefined ? {} : {
          trustedTeamMemberships: options.trustedTeamMemberships
        })
      };
    }
  }

  run(input: unknown): Step2SkillRuntimeResult {
    const invocation = step2RuntimeInvocationSchema.parse(input);
    if (invocation.requestContext.environment !== this.#profile.environment ||
      invocation.requestContext.synthetic !== this.#profile.syntheticOnly) {
      throw new Error("Step 2 runtime accepts only synthetic test RequestContext v2");
    }
    const mutationWorkflow = invocation.workflowId === "synthetic_case_create_from_accepted_offer" ||
      invocation.workflowId === "synthetic_requirement_completion_update";
    if (mutationWorkflow) return this.#runMutation(invocation);
    const implementations = new SyntheticSkillImplementationRegistry(
      capabilityRegistry.capabilities.filter((entry) =>
        this.#profile.capabilityIds.includes(entry.capabilityId))
    );
    const gatewayAudit = new InMemoryCapabilityGatewayAuditSink(
      this.#auditAvailability.gateway ?? true
    );
    const executionAudit = new InMemoryCapabilityExecutionAuditSink(
      this.#auditAvailability.execution ?? true
    );
    const skillAudit = new InMemorySkillAuditSink(this.#auditAvailability.skill ?? true);
    const gateway = new CapabilityGateway({
      auditSink: gatewayAudit,
      runtimeStateResolver: implementations.runtimeStateResolver(),
      allowSyntheticTestRuntimeOverrides: true,
      now: this.#now,
      idFactory: this.#idFactory
    });
    let persistentStore: SyntheticCaseStore | undefined;
    let adapterStore = scopeStoreToPrincipal(invocation.requestContext);
    let effectiveBusinessInput = invocation.businessInput;
    if (this.#databaseOptions !== undefined) {
      persistentStore = new SyntheticCaseStore({
        databasePath: this.#databaseOptions.databasePath!,
        repositoryRoot: this.#databaseOptions.repositoryRoot!,
        allowSyntheticTestStorage: true,
        ...(this.#databaseOptions.trustedTeamMemberships === undefined ? {} : {
          trustedTeamMemberships: this.#databaseOptions.trustedTeamMemberships
        }),
        now: this.#now,
        auditAvailable: () => this.#auditAvailability.execution ?? true
      });
      if (invocation.workflowId === "case_status_inspection") {
        const statusInput = parseStep2WorkflowInput(
          invocation.workflowId,
          invocation.businessInput
        );
        const resolution = persistentStore.resolveCase(invocation.requestContext, {
          ...(statusInput.caseRef === undefined ? {} : { caseRef: statusInput.caseRef as string }),
          ...(statusInput.candidateDisplayName === undefined ? {} : {
            candidateDisplayName: statusInput.candidateDisplayName as string
          })
        });
        if (resolution.status !== "MATCHED" || resolution.case === null) {
          const reason = resolution.status === "AMBIGUOUS"
            ? "CASE_REFERENCE_AMBIGUOUS" : "CASE_NOT_FOUND";
          persistentStore.close();
          persistentStore = undefined;
          throw new Error(reason);
        }
        effectiveBusinessInput = { caseRef: resolution.case.caseRef };
      }
      const cases = persistentStore.listCases(invocation.requestContext);
      const audits = cases.flatMap((item) => persistentStore!.listAuditEvents(
        invocation.requestContext, item.caseRef));
      adapterStore = createPersistentCapabilityView(
        syntheticCapabilityStore,
        invocation.requestContext,
        cases,
        audits
      );
    }
    try {
      const executor = new SyntheticCapabilityExecutor({
      implementationRegistry: implementations,
      auditSink: executionAudit,
      store: adapterStore,
      allowSyntheticTestExecution: true,
      now: this.#now,
      idFactory: this.#idFactory
    });
    const orchestrator = new SyntheticSkillOrchestrator({
      gateway,
      executor,
      auditSink: skillAudit,
      allowSyntheticTestExecution: true,
      now: this.#now,
      idFactory: this.#idFactory
    });
    const compiler = new Step2SkillRequestCompiler({
      activationProfile: this.#profile,
      now: this.#now,
      idFactory: this.#idFactory
    });
    const request = compiler.compile({
      skillId: invocation.skillId,
      workflowId: invocation.workflowId,
      requestContext: invocation.requestContext,
      businessInput: effectiveBusinessInput
    });
    const result = orchestrator.run(request);
    if (persistentStore !== undefined && result.status === "COMPLETED") {
      const parsedInput = effectiveBusinessInput as Record<string, unknown>;
      const caseRef = parsedInput.caseRef;
      if (typeof caseRef === "string") {
        persistentStore.recordWorkflowEvent(invocation.requestContext, caseRef, invocation.workflowId);
      }
    }
      return {
        activationProfileId: this.#profile.profileId,
        result,
        auditRefs: {
          skill: skillAudit.events().map((event) => event.auditRef),
          gateway: gatewayAudit.events().map((event) => event.auditRef),
          execution: executionAudit.events().map((event) => event.auditRef)
        },
        implementationCallCount: executor.implementationCallCount,
        formalStateChanged: false,
        outboundMessageSent: false,
        externalSideEffect: false,
        realCustomerDataProcessed: false,
        unsafeToolFallbackCount: 0
      };
    } finally {
      persistentStore?.close();
    }
  }

  #runMutation(invocation: ReturnType<typeof step2RuntimeInvocationSchema.parse>): Step2SkillRuntimeResult {
    if (this.#databaseOptions === undefined || invocation.trustedInvocationId === undefined) {
      throw new Error("Synthetic mutation requires configured persistent storage and trusted invocation ID");
    }
    const businessInput = parseStep2WorkflowInput(invocation.workflowId, invocation.businessInput);
    const skillAudit = new InMemorySkillAuditSink(this.#auditAvailability.skill ?? true);
    const gatewayAudit = new InMemoryCapabilityGatewayAuditSink(this.#auditAvailability.gateway ?? true);
    if (!skillAudit.isAvailable()) throw new Error("SKILL_AUDIT_UNAVAILABLE");
    const skillRunId = `step25-skill-${this.#idFactory()}`;
    if (!skillAudit.append({
      auditRef: `step25-skill-audit-${this.#idFactory()}`,
      eventType: "skill_run_ingress",
      skillRunId,
      skillId: invocation.skillId,
      skillVersion: "1.0.0",
      workflowId: invocation.workflowId,
      taskId: invocation.requestContext.requestId,
      attemptId: invocation.trustedInvocationId,
      tenantId: invocation.requestContext.tenantId,
      dataSpaceId: invocation.requestContext.dataSpaceId,
      actorId: invocation.requestContext.actorId,
      activeTeamId: invocation.requestContext.activeTeamId,
      teamMembershipRef: invocation.requestContext.teamMembershipRef,
      reasonCodes: [],
      occurredAt: this.#now().toISOString()
    })) throw new Error("SKILL_AUDIT_UNAVAILABLE");
    const store = new SyntheticCaseStore({
      databasePath: this.#databaseOptions.databasePath!,
      repositoryRoot: this.#databaseOptions.repositoryRoot!,
      allowSyntheticTestStorage: true,
      ...(this.#databaseOptions.trustedTeamMemberships === undefined ? {} : {
        trustedTeamMemberships: this.#databaseOptions.trustedTeamMemberships
      }),
      now: this.#now,
      auditAvailable: () => this.#auditAvailability.execution ?? true
    });
    try {
      let payload;
      if (invocation.workflowId === "synthetic_case_create_from_accepted_offer") {
        const plannedStartAt = businessInput.plannedStartAt as string | null | undefined;
        const trustedRefParts = [invocation.requestContext.tenantId, invocation.requestContext.actorId,
          invocation.trustedInvocationId];
        payload = {
          mutationId: invocation.trustedInvocationId,
          offerRef: opaqueRuntimeRef("synthetic-offer", ...trustedRefParts),
          candidateRef: opaqueRuntimeRef("synthetic-candidate", ...trustedRefParts),
          candidateDisplayName: businessInput.candidateDisplayName as string,
          ...(plannedStartAt === undefined ? {} : { plannedStartAt }),
          sourceVersionRef: opaqueRuntimeRef("synthetic-hr-manual-statement", ...trustedRefParts),
          scopeType: "TEAM_SHARED" as const,
          teamId: invocation.requestContext.activeTeamId
        };
      } else {
        const caseRef = businessInput.caseRef as string | undefined;
        const candidateDisplayName = businessInput.candidateDisplayName as string | undefined;
        const resolution = store.resolveCase(invocation.requestContext, {
          ...(caseRef === undefined ? {} : { caseRef }),
          ...(candidateDisplayName === undefined ? {} : { candidateDisplayName })
        });
        if (resolution.status !== "MATCHED" || resolution.case === null) {
          throw new Error(resolution.status === "AMBIGUOUS"
            ? "CASE_REFERENCE_AMBIGUOUS" : "CASE_NOT_FOUND");
        }
        const kind = businessInput.requirementKind as "DOCUMENTS" | "IT_ACCOUNT" | "DEVICE";
        const targetRequirement = resolution.case.requirements.find((item) => item.kind === kind);
        if (targetRequirement === undefined) throw new Error("REQUIREMENT_NOT_FOUND");
        const trustedRefParts = [invocation.requestContext.tenantId, invocation.requestContext.actorId,
          invocation.trustedInvocationId, resolution.case.caseRef, kind];
        payload = {
          mutationId: invocation.trustedInvocationId,
          caseRef: resolution.case.caseRef,
          kind,
          expectedCaseVersion: resolution.case.caseVersion,
          expectedRequirementVersion: targetRequirement.version,
          evidenceRef: opaqueRuntimeRef("synthetic-hr-manual-evidence", ...trustedRefParts),
          evidenceValidationRef: null,
          sourceVersionRef: opaqueRuntimeRef("synthetic-hr-manual-statement", ...trustedRefParts),
          sourceType: "SYNTHETIC_HR_MANUAL_STATEMENT" as const,
          sourceActorId: invocation.requestContext.actorId
        };
      }
      const gateway = new SyntheticMutationGateway(store, gatewayAudit, this.#now, this.#idFactory);
      const mutationWorkflowId = invocation.workflowId as
        "synthetic_case_create_from_accepted_offer" | "synthetic_requirement_completion_update";
      const output = gateway.execute({
        profileId: "STEP2.5-SYNTHETIC-MUTATION-V1",
        skillId: invocation.skillId as "onboarding_case_intake_pack" | "onboarding_requirement_tracking_pack",
        workflowId: mutationWorkflowId,
        capabilityId: mutationWorkflowId === "synthetic_case_create_from_accepted_offer"
          ? "hr.onboarding.synthetic.case.create"
          : "hr.onboarding.synthetic.requirement.update",
        mutationId: invocation.trustedInvocationId,
        requestContext: invocation.requestContext,
        payload
      });
      if (output.decision !== "ALLOW" || output.receipt === undefined) {
        throw new Error(output.reasonCode);
      }
      if (!skillAudit.append({
        auditRef: `step25-skill-audit-${this.#idFactory()}`,
        eventType: "skill_run_finalized",
        skillRunId,
        skillId: invocation.skillId,
        skillVersion: "1.0.0",
        workflowId: invocation.workflowId,
        taskId: invocation.requestContext.requestId,
        attemptId: invocation.trustedInvocationId,
        capabilityRequestId: invocation.trustedInvocationId,
        capabilityId: mutationWorkflowId === "synthetic_case_create_from_accepted_offer"
          ? "hr.onboarding.synthetic.case.create" : "hr.onboarding.synthetic.requirement.update",
        tenantId: invocation.requestContext.tenantId,
        dataSpaceId: invocation.requestContext.dataSpaceId,
        actorId: invocation.requestContext.actorId,
        activeTeamId: invocation.requestContext.activeTeamId,
        teamMembershipRef: invocation.requestContext.teamMembershipRef,
        status: "COMPLETED",
        reasonCodes: [],
        occurredAt: this.#now().toISOString()
      })) throw new Error("SKILL_AUDIT_UNAVAILABLE");
      return this.#mutationRuntimeResult(invocation, output, skillRunId,
        skillAudit.events().map((event) => event.auditRef),
        gatewayAudit.events().map((event) => event.auditRef));
    } finally {
      store.close();
    }
  }

  #mutationRuntimeResult(
    invocation: ReturnType<typeof step2RuntimeInvocationSchema.parse>,
    output: SyntheticMutationResult,
    skillRunId: string,
    skillAuditRefs: string[],
    gatewayAuditRefs: string[]
  ): Step2SkillRuntimeResult {
    const workflowId = invocation.workflowId as
      "synthetic_case_create_from_accepted_offer" | "synthetic_requirement_completion_update";
    const now = this.#now().toISOString();
    const result = {
      skillRunId,
      skillRef: { skillId: invocation.skillId, skillVersion: "1.0.0" },
      workflowId,
      taskId: `step25-task-${this.#idFactory()}`,
      attemptId: `step25-attempt-${this.#idFactory()}`,
      routeDecisionRef: `step25-route-${this.#idFactory()}`,
      status: output.decision === "ALLOW" ? "COMPLETED" : "DENIED",
      stepResults: [],
      reasonCodes: [],
      capabilityRequestCount: 1,
      implementationCallCount: output.implementationCallCount,
      independentCapabilityAudit: true,
      formalStateChanged: false,
      externalSideEffect: false,
      outboundMessageSent: false,
      realCustomerDataProcessed: false,
      unsafeToolFallbackCount: 0,
      domainCompletionClaimed: false,
      auditRef: skillAuditRefs.at(-1) ?? null,
      startedAt: now,
      completedAt: now
    } as SkillRunResult;
    return {
      activationProfileId: "STEP2.5-SYNTHETIC-MUTATION-V1",
      result,
      mutationOutput: output,
      auditRefs: { skill: skillAuditRefs, gateway: gatewayAuditRefs,
        execution: output.receipt ? [output.receipt.eventRef] : [] },
      implementationCallCount: output.implementationCallCount,
      formalStateChanged: false,
      outboundMessageSent: false,
      externalSideEffect: false,
      realCustomerDataProcessed: false,
      unsafeToolFallbackCount: 0
    };
  }
}

function opaqueRuntimeRef(prefix: string, ...trustedParts: string[]): string {
  const value = createHash("sha256").update(trustedParts.join("\u001f")).digest("hex").slice(0, 24);
  return `${prefix}-${value}`;
}
