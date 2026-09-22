# EVS2 E0 Static Manifest/Digest/Config Validator — local implementation

Status: implemented and locally verified on 2026-09-22. This is a validator implementation, **not** an E0 evaluation run or E0 PASS.

## Contract and checks

- `e0-static-manifest.v1` is a closed, synthetic-only schema with exactly one entry for each 00—23 design document, pinned source-file SHA-256 values, pinned runtime and engineering-baseline JSON, and a self-digest.
- The caller must independently pin the manifest SHA-256; a self-consistent altered manifest is insufficient.
- The validator checks document IDs, unique references, safe relative paths, file presence and hashes, frontmatter version/status, runtime config and 10—16 engineering-baseline references/digests. It validates the existing Capability Registry and confirms the Eval Registry is empty.
- Unknown versions/fields, duplicate or dangling references, digest drift, document metadata drift and unsafe runtime configuration fail closed.
- The directory adapter resolves real paths and rejects paths or symlinks escaping the supplied document root. It only reads files; no Eval Run, Capability call, deployment or route change is possible.

## Use when a separate manifest is frozen

`corepack pnpm validate:e0-static <manifest.json> <externally-pinned-sha256> <documents-root>`

There is intentionally no project 00—23 manifest or pinned digest in this slice. Current documents and configurations are not silently promoted into a candidate. No actual E0 gate is claimed, and no Eval Dataset, Eval Run, Acceptance Aggregate or Decision is created.

The 12 document's v0.3 snapshot was reconstructed from recorded edits and matched its previous pinned SHA-256 exactly. The v0.4 diff affected governance/status wording, not Skill/Capability contracts. After that review, the 10—16 engineering baseline now pins the current v0.4 document and its verified SHA-256. The runtime Skill contract stays v0.3. An independently pinned 00—23 E0 candidate manifest and authorized Eval Run are still absent.

## Remaining E0 work

The full §6 E0 gate also needs an approved subject/package snapshot, static secret/PII/endpoint scanning, Growth/Training registry attestation, and an authorized Eval Run with audit evidence. EVS2 supplies only the manifest/digest/config validator and synthetic tests. Existing design-vs-code drift, if any, must be resolved through a new pinned manifest and review rather than auto-updating expected hashes.
