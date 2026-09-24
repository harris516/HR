import { randomUUID } from "node:crypto";
import { InMemoryCapabilityGatewayAuditSink } from "../audit/capability-audit.js";
import { InMemoryCapabilityExecutionAuditSink } from "../audit/capability-execution-audit.js";
import { InMemorySkillAuditSink } from "../audit/skill-audit.js";
import { CapabilityGateway } from "../capabilities/gateway.js";
import { SyntheticCapabilityExecutor } from "../capabilities/implementations/executor.js";
import { SyntheticSkillImplementationRegistry } from "../capabilities/implementations/skill-implementation-registry.js";
import {
  syntheticCapabilityStore,
  type SyntheticCapabilityStore
} from "../capabilities/implementations/synthetic-store.js";
import { capabilityRegistry } from "../capabilities/registry.js";
import type { RequestContext } from "../contracts/navigation.js";
import type { SkillRunResult } from "../contracts/skill-orchestration.js";
import { SyntheticSkillOrchestrator } from "./orchestrator.js";
import { step2RuntimeInvocationSchema } from "./runtime-inputs.js";
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
}

export interface Step2SkillRuntimeResult {
  activationProfileId: string;
  result: SkillRunResult;
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
  }

  run(input: unknown): Step2SkillRuntimeResult {
    const invocation = step2RuntimeInvocationSchema.parse(input);
    if (invocation.requestContext.environment !== this.#profile.environment ||
      invocation.requestContext.synthetic !== this.#profile.syntheticOnly) {
      throw new Error("Step 2 runtime accepts only synthetic test RequestContext v2");
    }
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
    const executor = new SyntheticCapabilityExecutor({
      implementationRegistry: implementations,
      auditSink: executionAudit,
      store: scopeStoreToPrincipal(invocation.requestContext),
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
      businessInput: invocation.businessInput
    });
    const result = orchestrator.run(request);
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
  }
}
