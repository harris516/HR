# E0/E1 Local Synthetic Candidate — Review Pack

Prepared: 2026-09-22. Status: **DRAFT / NOT APPROVED / NOT EXECUTED**. Scope confirmed by the project owner: first E1 candidate targets the **local synthetic primitive package**, not the cloud OpenClaw Agent or a customer deployment.

## Candidate artifacts

| Artifact | Purpose | File SHA-256 at preparation |
|---|---|---|
| `config/e1-local-subject-candidate.draft.json` | 72-file local source/test/config/dependency candidate; base Git commit `61f6e92`, dirty working tree disclosed | `7d64279453ac1e0db90128f10181df170aee1045411466914203b06a56f3857f` |
| `config/e0-static-candidate.draft.json` | 00—23 design-document and test-config candidate, including nine files in 10 | `39163ec990e1a9ec7d50deef2d06455d83db4e6231e9a00e760ebcd99a30230f` |
| `config/e1-suite-candidate.draft.json` | E1 Suite proposal, status `DRAFT`; no Case snapshots yet | `8f727827727a4914329432cdaad9cad2c6467fecb07e0e368ebb11a4887aa847` |
| `config/e1-dataset-candidate.draft.json` | Independent synthetic Dataset proposal, status `DRAFT`; no Holdout cases yet | `7c4d159d89ffaba48da0cd6499d6465151a5a8026864f75ddc04d72a65aa683d` |
| `config/e1-case-handoff.draft.json` | 31 synthetic Case proposals across 12 primitive families and seven boundary classes; `EVAL_CANDIDATE_HANDOFF`, not Holdout | `6f6f27388aa650f2036370c07e783cb7b04099d3e77b08703faf384d435f5f43` |
| `docs/E1_ORACLE_REVIEW_DRAFT.md` | Separate author-proposed expectations for the 31 Case proposals; independent review pending | `e2456caff2f7c316c003f8cc8a8104fbb6f7a203aa8358b1150f87867cff6558` |

These hashes are review aids, **not** an independently pinned approval. Before execution, the owner must verify the exact files and retain the approved manifest digests outside the mutable candidate files. Any source, test, dependency, design document or configuration change requires a new candidate/digest and impact review. The working tree is currently dirty; no Git commit or release tag is implied.

The E0, Suite and Dataset draft JSON objects pass their respective structural schemas and their candidate content-digest checks. Structural validity is not reference resolution, contamination clearance, approval or an Eval Run. No draft was added to the empty Eval Registry.

## Existing development evidence — not Holdout

`tests/e1-primitive-harness.test.ts` holds 36 **development** vectors. They verify the local harness but must not be copied, translated or lightly rewritten into the independent E1 Holdout. The exact expected structures remain visible in that test file; this index supports scope review, not Oracle approval.

| E1 primitive family | Development vector IDs | Count |
|---|---|---:|
| Tenant/DataSpace/Scope | `e1-context-nominal`, `e1-tenant-missing`, `e1-context-expired` | 3 |
| Subject/Identity | `e1-subject-conflict`, `e1-subject-nominal`, `e1-subject-unknown` | 3 |
| Freshness/Evidence/Ready/Revalidation | `e1-freshness-ready-nominal`, `e1-freshness-ready-unconfigured`, `e1-freshness-stale`, `e1-evidence-required-flag-absent` | 4 |
| PHC classification | `e1-phc-nominal`, `e1-phc-unknown`, `e1-phc4-prohibited`, `e1-phc-hard-block`, `e1-phc-unknown-prohibition` | 5 |
| Prohibition/Review routing | `e1-route-nominal`, `e1-formal-prohibition` | 2 |
| Authorization | `e1-auth-deny`, `e1-auth-allow` | 2 |
| Authority/SoD/Assurance | `e1-authority-nominal`, `e1-authority-sod-deny`, `e1-authority-unconfigured`, `e1-authority-step-up` | 4 |
| Redaction/Field Projection | `e1-redaction-nominal`, `e1-redaction-policy-missing` | 2 |
| Digest | `e1-digest-order`, `e1-digest-boundary` | 2 |
| Idempotency | `e1-idempotency-nominal`, `e1-idempotency-scope-boundary`, `e1-idempotency-replay` | 3 |
| State Transition | `e1-valid-transition`, `e1-invalid-transition` | 2 |
| Growth/Training/Eval Governance | `e1-isolation-nominal`, `e1-isolation-contamination`, `e1-isolation-scan-unknown`, `e1-isolation-scan-missing` | 4 |

## Proposed formal E1 evidence, still missing

1. Review the 31 new synthetic Case proposals by Scenario Family and Generator Lineage. They remain `EVAL_CANDIDATE_HANDOFF`: a separate Eval Owner must verify lineage, materialize exact fixtures and promote only eligible cases into access-controlled Holdout. Keep all variants of one base case in one partition. Do not put existing development vectors into Holdout.
2. Freeze independent Case inputs and expected structured outputs. A reviewer who did not author the implementation must check the proposed Oracle results against documents 03, 09, 16—19; unresolved professional, privacy or authority judgments remain blocked. Expected-result changes create new Case versions.
3. Populate Suite `caseSnapshotRefs`, Oracle/Acceptance/Environment/Repeat policy references and review decisions. Populate Dataset lineage, distribution, Holdout partitions, retention and Privacy/Security review references. Current empty fields and `pending-*` references intentionally block activation.
4. Record all seven named contamination checks and reviewer-access separation. `FAIL`, `INDETERMINATE`, missing scan or Expected Answer leakage blocks the Suite. The empty Training Registry digest in the draft is a candidate observation, not durable attestation.
5. Review and independently pin the E0 00—23 manifest; complete static secret/PII/endpoint scanning, Growth/Training registry attestation and an approved subject/environment snapshot. Then separately authorize an audited E0 run before E1.
6. Only after those gates, authorize an E1 Eval Run. Preserve every attempt and immutable result, require exact structured outputs and stable Reason Codes, and treat any blocking failure, flaky result, Oracle conflict or infrastructure-invalid result according to document 19. No best-attempt selection.

The owner confirmed the field mapping: `EvalCaseV1.expectedReasonCodes` contains only evaluator `EVAL_*` diagnostics. Exact navigation/policy/business reason codes belong in versioned Oracle assertions referenced by `requiredOutputAssertions`. A correctly observed domain denial may pass evaluation with `expectedReasonCodes: []`; domain reasons must not be relabeled as Eval failures. The assertion references and exact expectations remain to be materialized and independently reviewed before Case registration.

## Owner review points

| Decision | Current state |
|---|---|
| Local synthetic primitive package is the first scoped Subject | CONFIRMED in conversation |
| Evaluator-versus-domain Reason Code field mapping | CONFIRMED in conversation; assertion references and independent Oracle review pending |
| Exact 72-file source snapshot and 00—23 E0 document set | PENDING owner review and independent digest pin |
| Synthetic Case proposals and author Oracle draft | 31 proposals prepared; NOT independently reviewed or promoted to Holdout |
| Independent synthetic Holdout and access separation | NOT ESTABLISHED |
| Suite/Dataset/Oracle/Privacy-Security approvals | PENDING |
| Permission to execute E0 and E1 | NOT GRANTED |

This pack authorizes no Agent route, Capability, external side effect, real customer data, server change, Eval Registry registration, formal Ready action or Acceptance Decision. Passing a future E1 run for this local package would not establish E1 for the deployed Agent; that would require a separately frozen Agent Subject and applicable end-to-end evidence.
