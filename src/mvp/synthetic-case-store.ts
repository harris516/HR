import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { RequestContext } from "../contracts/navigation.js";
import { validateRequestContext } from "../navigation/context-gate.js";

const ref = z.string().min(1).max(128);
const requirementKind = z.enum(["DOCUMENTS", "IT_ACCOUNT", "DEVICE"]);
const requirementStatus = z.enum(["not_started", "in_progress", "evidence_pending", "completed", "blocked"]);
const freshness = z.enum(["fresh", "stale", "unavailable", "unknown"]);

export const syntheticOfferSchema = z.object({
  schemaVersion: z.literal("synthetic-offer.v1"),
  synthetic: z.literal(true),
  tenantId: ref,
  dataSpaceId: ref,
  offerRef: ref,
  candidateRef: ref,
  plannedStartAt: z.iso.datetime({ offset: true }),
  sourceVersionRef: ref,
  requirements: z.array(z.object({
    kind: requirementKind,
    ownerRef: ref,
    deadlineAt: z.iso.datetime({ offset: true }),
    completionCriteriaRef: ref,
    ruleVersionRef: ref,
    sourceVersionRef: ref,
    freshness
  }).strict()).length(3).refine(
    (items) => new Set(items.map((item) => item.kind)).size === 3,
    "the three MVP requirement kinds must each occur exactly once"
  )
}).strict();

export const syntheticRequirementUpdateSchema = z.object({
  schemaVersion: z.literal("synthetic-requirement-update.v1"),
  caseRef: ref,
  kind: requirementKind,
  expectedCaseVersion: z.number().int().positive(),
  status: requirementStatus,
  evidenceRefs: z.array(ref),
  evidenceValidationRef: ref.optional(),
  conflictRefs: z.array(ref).default([]),
  freshness,
  sourceVersionRef: ref
}).strict().superRefine((value, context) => {
  if (value.status === "completed" && (value.evidenceRefs.length === 0 || !value.evidenceValidationRef)) {
    context.addIssue({ code: "custom", message: "completed requires synthetic evidence and validation references" });
  }
});

type SyntheticOffer = z.infer<typeof syntheticOfferSchema>;
type SyntheticRequirementUpdate = z.infer<typeof syntheticRequirementUpdateSchema>;
type RequirementKind = z.infer<typeof requirementKind>;
type RequirementStatus = z.infer<typeof requirementStatus>;
type Freshness = z.infer<typeof freshness>;

export interface SyntheticRequirementSnapshot {
  kind: RequirementKind;
  version: number;
  status: RequirementStatus;
  ownerRef: string;
  deadlineAt: string;
  completionCriteriaRef: string;
  ruleVersionRef: string;
  sourceVersionRef: string;
  freshness: Freshness;
  evidenceRefs: string[];
  evidenceValidationRef: string | null;
  conflictRefs: string[];
}

export interface SyntheticCaseSnapshot {
  synthetic: true;
  tenantId: string;
  dataSpaceId: string;
  caseRef: string;
  offerRef: string;
  candidateRef: string;
  plannedStartAt: string;
  sourceVersionRef: string;
  caseVersion: number;
  formalReadinessStatus: null;
  confirmationStatus: "not_confirmed";
  requirements: SyntheticRequirementSnapshot[];
}

export class SyntheticCaseStoreError extends Error {
  constructor(readonly code: "DATABASE_PATH_UNSAFE" | "TEST_CONTEXT_REQUIRED" | "SCOPE_MISMATCH" |
    "INPUT_INVALID" | "OFFER_REPLAY_CONFLICT" | "CASE_NOT_FOUND_OR_NOT_ACCESSIBLE" |
    "OBJECT_VERSION_CONFLICT") {
    super(code);
    this.name = "SyntheticCaseStoreError";
  }
}

function ensureOutsideRepository(databasePath: string, repositoryRoot: string): void {
  if (!isAbsolute(databasePath) || !isAbsolute(repositoryRoot)) {
    throw new SyntheticCaseStoreError("DATABASE_PATH_UNSAFE");
  }
  const root = realpathSync(repositoryRoot);
  const parent = realpathSync(dirname(databasePath));
  const target = existsSync(databasePath) ? realpathSync(databasePath) : databasePath;
  for (const path of [parent, target]) {
    const within = relative(root, path);
    if (within === "" || (within !== ".." && !within.startsWith(`..${sep}`) && !isAbsolute(within))) {
      throw new SyntheticCaseStoreError("DATABASE_PATH_UNSAFE");
    }
  }
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

type CaseRow = {
  tenant_id: string; data_space_id: string; case_ref: string; offer_ref: string;
  actor_ref: string; candidate_ref: string; planned_start_at: string; source_version_ref: string;
  input_digest: string; case_version: number;
};

type RequirementRow = {
  kind: RequirementKind; version: number; status: RequirementStatus; owner_ref: string;
  deadline_at: string; completion_criteria_ref: string; rule_version_ref: string;
  source_version_ref: string; freshness: Freshness; evidence_refs_json: string;
  evidence_validation_ref: string | null; conflict_refs_json: string;
};

/** Local synthetic state only; this is not an OpenClaw Tool or an authority decision. */
export class SyntheticCaseStore {
  readonly #db: DatabaseSync;
  readonly #now: () => Date;

  constructor(options: {
    databasePath: string;
    repositoryRoot: string;
    allowSyntheticTestStorage: true;
    now?: () => Date;
  }) {
    if (!options.allowSyntheticTestStorage) throw new SyntheticCaseStoreError("TEST_CONTEXT_REQUIRED");
    ensureOutsideRepository(options.databasePath, options.repositoryRoot);
    this.#now = options.now ?? (() => new Date());
    this.#db = new DatabaseSync(options.databasePath);
    this.#db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS synthetic_cases (
        case_ref TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        data_space_id TEXT NOT NULL,
        offer_ref TEXT NOT NULL,
        actor_ref TEXT NOT NULL,
        candidate_ref TEXT NOT NULL,
        planned_start_at TEXT NOT NULL,
        source_version_ref TEXT NOT NULL,
        input_digest TEXT NOT NULL,
        case_version INTEGER NOT NULL,
        UNIQUE (tenant_id, data_space_id, offer_ref)
      );
      CREATE TABLE IF NOT EXISTS synthetic_requirements (
        case_ref TEXT NOT NULL REFERENCES synthetic_cases(case_ref),
        kind TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        owner_ref TEXT NOT NULL,
        deadline_at TEXT NOT NULL,
        completion_criteria_ref TEXT NOT NULL,
        rule_version_ref TEXT NOT NULL,
        source_version_ref TEXT NOT NULL,
        freshness TEXT NOT NULL,
        evidence_refs_json TEXT NOT NULL,
        evidence_validation_ref TEXT,
        conflict_refs_json TEXT NOT NULL,
        PRIMARY KEY (case_ref, kind)
      );
      CREATE TABLE IF NOT EXISTS synthetic_case_audit (
        event_ref TEXT PRIMARY KEY,
        case_ref TEXT NOT NULL REFERENCES synthetic_cases(case_ref),
        tenant_id TEXT NOT NULL,
        data_space_id TEXT NOT NULL,
        actor_ref TEXT NOT NULL,
        request_ref TEXT NOT NULL,
        event_type TEXT NOT NULL,
        case_version INTEGER NOT NULL,
        occurred_at TEXT NOT NULL
      );
    `);
  }

  close(): void { this.#db.close(); }

  ingestOffer(contextInput: unknown, offerInput: unknown): { case: SyntheticCaseSnapshot; created: boolean } {
    const context = this.#context(contextInput);
    const parsed = syntheticOfferSchema.safeParse(offerInput);
    if (!parsed.success) throw new SyntheticCaseStoreError("INPUT_INVALID");
    const offer: SyntheticOffer = parsed.data;
    if (context.tenantId !== offer.tenantId || context.dataSpaceId !== offer.dataSpaceId) {
      throw new SyntheticCaseStoreError("SCOPE_MISMATCH");
    }
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const prior = this.#db.prepare(`SELECT * FROM synthetic_cases
        WHERE tenant_id = ? AND data_space_id = ? AND offer_ref = ?`)
        .get(offer.tenantId, offer.dataSpaceId, offer.offerRef) as CaseRow | undefined;
      if (prior !== undefined) {
        if (prior.actor_ref !== context.actorId) {
          throw new SyntheticCaseStoreError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
        }
        if (prior.input_digest !== digest(offer)) throw new SyntheticCaseStoreError("OFFER_REPLAY_CONFLICT");
        const snapshot = this.#snapshot(prior);
        this.#db.exec("COMMIT");
        return { case: snapshot, created: false };
      }
      const caseRef = `case-synthetic-${randomUUID()}`;
      this.#db.prepare(`INSERT INTO synthetic_cases
        (case_ref, tenant_id, data_space_id, offer_ref, actor_ref, candidate_ref, planned_start_at,
         source_version_ref, input_digest, case_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
        .run(caseRef, offer.tenantId, offer.dataSpaceId, offer.offerRef, context.actorId, offer.candidateRef,
          offer.plannedStartAt, offer.sourceVersionRef, digest(offer));
      const insertRequirement = this.#db.prepare(`INSERT INTO synthetic_requirements
        (case_ref, kind, version, status, owner_ref, deadline_at, completion_criteria_ref,
         rule_version_ref, source_version_ref, freshness, evidence_refs_json,
         evidence_validation_ref, conflict_refs_json)
         VALUES (?, ?, 1, 'not_started', ?, ?, ?, ?, ?, ?, '[]', NULL, '[]')`);
      for (const requirement of offer.requirements) {
        insertRequirement.run(caseRef, requirement.kind, requirement.ownerRef, requirement.deadlineAt,
          requirement.completionCriteriaRef, requirement.ruleVersionRef,
          requirement.sourceVersionRef, requirement.freshness);
      }
      this.#audit(context, caseRef, "synthetic_case_created", 1);
      const created = this.#snapshot(this.#caseRow(caseRef, context));
      this.#db.exec("COMMIT");
      return { case: created, created: true };
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  getCase(contextInput: unknown, caseRef: string): SyntheticCaseSnapshot | null {
    const context = this.#context(contextInput);
    const row = this.#db.prepare(`SELECT * FROM synthetic_cases
      WHERE case_ref = ? AND tenant_id = ? AND data_space_id = ? AND actor_ref = ?`)
      .get(caseRef, context.tenantId, context.dataSpaceId, context.actorId) as CaseRow | undefined;
    return row === undefined ? null : this.#snapshot(row);
  }

  updateRequirement(contextInput: unknown, updateInput: unknown): SyntheticCaseSnapshot {
    const context = this.#context(contextInput);
    const parsed = syntheticRequirementUpdateSchema.safeParse(updateInput);
    if (!parsed.success) throw new SyntheticCaseStoreError("INPUT_INVALID");
    const update: SyntheticRequirementUpdate = parsed.data;
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.#caseRow(update.caseRef, context);
      if (row.case_version !== update.expectedCaseVersion) {
        throw new SyntheticCaseStoreError("OBJECT_VERSION_CONFLICT");
      }
      const result = this.#db.prepare(`UPDATE synthetic_requirements SET
        version = version + 1, status = ?, evidence_refs_json = ?, evidence_validation_ref = ?,
        conflict_refs_json = ?, freshness = ?, source_version_ref = ? WHERE case_ref = ? AND kind = ?`)
        .run(update.status, JSON.stringify(update.evidenceRefs), update.evidenceValidationRef ?? null,
          JSON.stringify(update.conflictRefs), update.freshness, update.sourceVersionRef,
          update.caseRef, update.kind);
      if (result.changes !== 1) throw new SyntheticCaseStoreError("INPUT_INVALID");
      const nextVersion = row.case_version + 1;
      this.#db.prepare("UPDATE synthetic_cases SET case_version = ? WHERE case_ref = ?")
        .run(nextVersion, update.caseRef);
      this.#audit(context, update.caseRef, "synthetic_requirement_updated", nextVersion);
      const updated = this.#snapshot(this.#caseRow(update.caseRef, context));
      this.#db.exec("COMMIT");
      return updated;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  countAuditEvents(contextInput: unknown, caseRef: string): number {
    const context = this.#context(contextInput);
    if (this.getCase(context, caseRef) === null) return 0;
    const row = this.#db.prepare(`SELECT COUNT(*) AS count FROM synthetic_case_audit
      WHERE case_ref = ? AND tenant_id = ? AND data_space_id = ?`)
      .get(caseRef, context.tenantId, context.dataSpaceId) as { count: number };
    return row.count;
  }

  recordReadinessEvaluation(contextInput: unknown, caseRef: string, expectedCaseVersion: number): string {
    const context = this.#context(contextInput);
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.#caseRow(caseRef, context);
      if (row.case_version !== expectedCaseVersion) {
        throw new SyntheticCaseStoreError("OBJECT_VERSION_CONFLICT");
      }
      const eventRef = this.#audit(context, caseRef, "synthetic_readiness_evaluated", row.case_version);
      this.#db.exec("COMMIT");
      return eventRef;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  #context(input: unknown): RequestContext {
    const result = validateRequestContext(input, this.#now());
    if (!result.ok || result.context.environment !== "test" ||
      result.context.dataAccessPurpose !== "onboarding_operation" ||
      !result.context.roles.includes("onboarding_hr_operations")) {
      throw new SyntheticCaseStoreError("TEST_CONTEXT_REQUIRED");
    }
    return result.context;
  }

  #caseRow(caseRef: string, context: RequestContext): CaseRow {
    const row = this.#db.prepare(`SELECT * FROM synthetic_cases
      WHERE case_ref = ? AND tenant_id = ? AND data_space_id = ? AND actor_ref = ?`)
      .get(caseRef, context.tenantId, context.dataSpaceId, context.actorId) as CaseRow | undefined;
    if (row === undefined) throw new SyntheticCaseStoreError("CASE_NOT_FOUND_OR_NOT_ACCESSIBLE");
    return row;
  }

  #snapshot(row: CaseRow): SyntheticCaseSnapshot {
    const requirements = this.#db.prepare(`SELECT * FROM synthetic_requirements
      WHERE case_ref = ? ORDER BY kind`).all(row.case_ref) as RequirementRow[];
    return {
      synthetic: true,
      tenantId: row.tenant_id,
      dataSpaceId: row.data_space_id,
      caseRef: row.case_ref,
      offerRef: row.offer_ref,
      candidateRef: row.candidate_ref,
      plannedStartAt: row.planned_start_at,
      sourceVersionRef: row.source_version_ref,
      caseVersion: row.case_version,
      formalReadinessStatus: null,
      confirmationStatus: "not_confirmed",
      requirements: requirements.map((item) => ({
        kind: item.kind,
        version: item.version,
        status: item.status,
        ownerRef: item.owner_ref,
        deadlineAt: item.deadline_at,
        completionCriteriaRef: item.completion_criteria_ref,
        ruleVersionRef: item.rule_version_ref,
        sourceVersionRef: item.source_version_ref,
        freshness: item.freshness,
        evidenceRefs: JSON.parse(item.evidence_refs_json) as string[],
        evidenceValidationRef: item.evidence_validation_ref,
        conflictRefs: JSON.parse(item.conflict_refs_json) as string[]
      }))
    };
  }

  #audit(context: RequestContext, caseRef: string, eventType: string, caseVersion: number): string {
    const eventRef = randomUUID();
    this.#db.prepare(`INSERT INTO synthetic_case_audit
      (event_ref, case_ref, tenant_id, data_space_id, actor_ref, request_ref,
       event_type, case_version, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(eventRef, caseRef, context.tenantId, context.dataSpaceId, context.actorId,
        context.requestId, eventType, caseVersion, this.#now().toISOString());
    return eventRef;
  }
}
