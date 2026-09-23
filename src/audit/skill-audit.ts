import type { SkillRunResult, SkillWorkflowId } from "../contracts/skill-orchestration.js";
import type { SkillId } from "../contracts/capability.js";

export type SkillAuditEventType =
  | "skill_run_ingress"
  | "skill_step_requested"
  | "skill_step_completed"
  | "skill_step_stopped"
  | "skill_practice_handoff"
  | "skill_run_finalized";

export interface SkillAuditEvent {
  auditRef: string;
  eventType: SkillAuditEventType;
  skillRunId: string;
  skillId?: SkillId;
  skillVersion?: string;
  workflowId?: SkillWorkflowId;
  taskId?: string;
  attemptId?: string;
  capabilityRequestId?: string;
  capabilityId?: string;
  tenantId?: string;
  dataSpaceId?: string;
  actorId?: string;
  activeTeamId?: string;
  teamMembershipRef?: string;
  status?: SkillRunResult["status"];
  reasonCodes: string[];
  occurredAt: string;
}

export interface SkillAuditSink {
  isAvailable(): boolean;
  append(event: SkillAuditEvent): boolean;
}

export class InMemorySkillAuditSink implements SkillAuditSink {
  readonly #events: SkillAuditEvent[] = [];

  constructor(private readonly available = true) {}

  isAvailable(): boolean {
    return this.available;
  }

  append(event: SkillAuditEvent): boolean {
    if (!this.available) return false;
    this.#events.push(structuredClone(event));
    return true;
  }

  events(): SkillAuditEvent[] {
    return structuredClone(this.#events);
  }
}
