import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { e0DocumentIds, type E0StaticManifestV1 } from "../src/contracts/e0-static-manifest.js";
import { emptyEvalRegistry } from "../src/eval/registry.js";
import {
  computeE0ManifestDigest, E0StaticValidationError, sha256, validateE0StaticManifest
} from "../src/validation/validate-e0-static-manifest.js";

type ManifestBody = Omit<E0StaticManifestV1, "contentDigest">;
function redigest(manifest: E0StaticManifestV1): void {
  const { contentDigest: _oldDigest, ...body } = manifest;
  manifest.contentDigest = computeE0ManifestDigest(body);
}

function fixture() {
  const files = new Map<string, string>();
  const baseline = JSON.parse(readFileSync("config/engineering-baseline.test.json", "utf8"));
  const runtime = JSON.parse(readFileSync("config/runtime.test.json", "utf8"));
  const componentById = new Map<string, typeof baseline.components[number]>(
    baseline.components.map((component: typeof baseline.components[number]) => [component.componentId.slice(0, 2), component])
  );
  const documents: ManifestBody["documents"] = [];

  for (const id of e0DocumentIds) {
    const component = componentById.get(id);
    const version = component?.documentVersion ?? "v0.3";
    const paths: string[] = component?.sourcePaths ?? [`${id}_SYNTHETIC.md`];
    for (const path of paths) {
      const content = `---\nversion: ${version}\npack_version: ${version}\nstatus: reviewed\n---\n# synthetic ${id} ${path}\n`;
      files.set(path, content);
    }
    if (component) {
      const chunks = [...paths].sort().map((path) => component.digestMode === "ORDERED_FILE_SET"
        ? `FILE:${path.split("/").at(-1)}\n${files.get(path)}` : files.get(path));
      component.documentDigestSha256 = sha256(chunks.join("\n"));
    }
    documents.push({ documentId: id, version, status: "reviewed",
      sourceFiles: paths.map((path) => ({ path, sha256: sha256(files.get(path)!) })) });
  }

  files.set("config/runtime.test.json", JSON.stringify(runtime));
  files.set("config/engineering-baseline.test.json", JSON.stringify(baseline));
  const body: ManifestBody = {
    schemaVersion: "e0-static-manifest.v1", manifestId: "synthetic-e0-manifest-001",
    manifestVersion: "1.0.0", subjectSnapshotRef: "synthetic-subject-001", synthetic: true,
    documents, runtimeConfig: { path: "config/runtime.test.json", sha256: sha256(files.get("config/runtime.test.json")!) },
    engineeringBaseline: { path: "config/engineering-baseline.test.json", sha256: sha256(files.get("config/engineering-baseline.test.json")!) }
  };
  const manifest: E0StaticManifestV1 = { ...body, contentDigest: computeE0ManifestDigest(body) };
  const readText = async (path: string) => {
    const content = files.get(path);
    if (content === undefined) throw new Error("missing");
    return content;
  };
  return { files, manifest, readText };
}

describe("EVS2 E0 static validator (synthetic inputs, no E0 run)", () => {
  it("validates a pinned 00–23 synthetic manifest and leaves Eval registries empty", async () => {
    const { manifest, readText } = fixture();
    await expect(validateE0StaticManifest(manifest, manifest.contentDigest, readText)).resolves.toEqual(manifest);
    expect(Object.values(emptyEvalRegistry).every((entries) => entries.length === 0)).toBe(true);
  });

  it("rejects unknown schema versions, fields and unsafe paths", async () => {
    const { manifest, readText } = fixture();
    for (const invalid of [
      { ...manifest, schemaVersion: "e0-static-manifest.v2" },
      { ...manifest, extra: true },
      { ...manifest, documents: manifest.documents.map((document, index) => index === 0
        ? { ...document, sourceFiles: [{ path: "../secret", sha256: "a".repeat(64) }] } : document) }
    ]) {
      await expect(validateE0StaticManifest(invalid, manifest.contentDigest, readText))
        .rejects.toMatchObject({ code: "SCHEMA_INVALID" });
    }
  });

  it("rejects duplicate and missing document references", async () => {
    const { manifest, readText } = fixture();
    const duplicate = structuredClone(manifest);
    duplicate.documents[1]!.documentId = "00";
    redigest(duplicate);
    await expect(validateE0StaticManifest(duplicate, duplicate.contentDigest, readText))
      .rejects.toMatchObject({ code: "DUPLICATE_REFERENCE" });

    const missing = structuredClone(manifest);
    missing.documents[0]!.sourceFiles[0]!.path = "00_MISSING.md";
    redigest(missing);
    await expect(validateE0StaticManifest(missing, missing.contentDigest, readText))
      .rejects.toMatchObject({ code: "REFERENCE_MISSING" });
  });

  it("rejects manifest and source digest drift", async () => {
    const { manifest, files, readText } = fixture();
    await expect(validateE0StaticManifest(manifest, "b".repeat(64), readText))
      .rejects.toMatchObject({ code: "MANIFEST_DIGEST_MISMATCH" });
    files.set("00_SYNTHETIC.md", "tampered");
    await expect(validateE0StaticManifest(manifest, manifest.contentDigest, readText))
      .rejects.toMatchObject({ code: "FILE_DIGEST_MISMATCH" });
  });

  it("rejects unsafe runtime configuration even when hashes are recomputed", async () => {
    const { manifest, files, readText } = fixture();
    const runtime = JSON.parse(files.get(manifest.runtimeConfig.path)!);
    runtime.featureFlags.externalSideEffects = true;
    files.set(manifest.runtimeConfig.path, JSON.stringify(runtime));
    manifest.runtimeConfig.sha256 = sha256(files.get(manifest.runtimeConfig.path)!);
    redigest(manifest);
    await expect(validateE0StaticManifest(manifest, manifest.contentDigest, readText))
      .rejects.toMatchObject({ code: "CONFIG_UNSAFE" });
  });

  it("rejects baseline document reference drift", async () => {
    const { manifest, files, readText } = fixture();
    const baseline = JSON.parse(files.get(manifest.engineeringBaseline.path)!);
    baseline.components[1].sourcePaths = ["11_OTHER.md"];
    files.set(manifest.engineeringBaseline.path, JSON.stringify(baseline));
    manifest.engineeringBaseline.sha256 = sha256(files.get(manifest.engineeringBaseline.path)!);
    redigest(manifest);
    await expect(validateE0StaticManifest(manifest, manifest.contentDigest, readText))
      .rejects.toMatchObject({ code: "CONFIG_UNSAFE" });
  });
});
