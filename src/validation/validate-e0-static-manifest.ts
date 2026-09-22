import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { e0DocumentIds, e0StaticManifestV1Schema, type E0StaticManifestV1 } from "../contracts/e0-static-manifest.js";
import { capabilityRegistry } from "../capabilities/registry.js";
import { validateCapabilityRegistry } from "./validate-capability-registry.js";
import { emptyEvalRegistry } from "../eval/registry.js";
import { validateRuntimeConfig } from "./validate-runtime-config.js";
import { validateEngineeringBaseline } from "./validate-engineering-baseline.js";

export class E0StaticValidationError extends Error {
  constructor(readonly code: "SCHEMA_INVALID" | "MANIFEST_DIGEST_MISMATCH" | "REFERENCE_MISSING" |
    "DUPLICATE_REFERENCE" | "DOCUMENT_METADATA_DRIFT" | "FILE_DIGEST_MISMATCH" |
    "CONFIG_UNSAFE" | "REGISTRY_NOT_EMPTY") {
    super(`E0 static validation failed: ${code}`);
    this.name = "E0StaticValidationError";
  }
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeE0ManifestDigest(manifest: Omit<E0StaticManifestV1, "contentDigest">): string {
  return sha256(canonical(manifest));
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function assertManifestShape(input: unknown, expectedDigest: string): E0StaticManifestV1 {
  const result = e0StaticManifestV1Schema.safeParse(input);
  if (!result.success) throw new E0StaticValidationError("SCHEMA_INVALID");
  const manifest = result.data;
  const { contentDigest, ...body } = manifest;
  if (contentDigest !== computeE0ManifestDigest(body) || contentDigest !== expectedDigest) {
    throw new E0StaticValidationError("MANIFEST_DIGEST_MISMATCH");
  }
  const ids = manifest.documents.map((document) => document.documentId);
  const paths = manifest.documents.flatMap((document) => document.sourceFiles.map((file) => file.path))
    .concat(manifest.runtimeConfig.path, manifest.engineeringBaseline.path);
  if (!unique(ids) || !unique(paths)) throw new E0StaticValidationError("DUPLICATE_REFERENCE");
  if (e0DocumentIds.some((id) => !ids.includes(id))) throw new E0StaticValidationError("REFERENCE_MISSING");
  for (const document of manifest.documents) {
    if (document.documentId !== "10" && document.sourceFiles.length !== 1) {
      throw new E0StaticValidationError("DUPLICATE_REFERENCE");
    }
    if (document.sourceFiles.some((file) => !file.path.startsWith(`${document.documentId}_`))) {
      throw new E0StaticValidationError("REFERENCE_MISSING");
    }
  }
  return manifest;
}

function metadata(content: string, key: "version" | "pack_version" | "status"): string | null {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return frontmatter?.[1]?.match(new RegExp(`^${key}:\\s*(\\S+)\\s*$`, "m"))?.[1] ?? null;
}

/** Validates only frozen static inputs; does not create an Eval Run or an E0 result. */
export async function validateE0StaticManifest(
  input: unknown,
  expectedDigest: string,
  readText: (safeRelativePath: string) => Promise<string>
): Promise<E0StaticManifestV1> {
  const manifest = assertManifestShape(input, expectedDigest);
  const pinnedContents = new Map<string, string>();
  const readPinned = async (file: { path: string; sha256: string }): Promise<string> => {
    let content: string;
    try { content = await readText(file.path); }
    catch { throw new E0StaticValidationError("REFERENCE_MISSING"); }
    if (sha256(content) !== file.sha256) throw new E0StaticValidationError("FILE_DIGEST_MISMATCH");
    pinnedContents.set(file.path, content);
    return content;
  };

  for (const document of manifest.documents) {
    const contents = await Promise.all(document.sourceFiles.map(readPinned));
    const index = document.documentId === "10"
      ? document.sourceFiles.findIndex((file) => file.path.endsWith("/README.md")) : 0;
    if (index < 0) throw new E0StaticValidationError("REFERENCE_MISSING");
    const source = contents[index];
    if (source === undefined || (metadata(source, document.documentId === "10" ? "pack_version" : "version") !== document.version) ||
      metadata(source, "status") !== document.status) {
      throw new E0StaticValidationError("DOCUMENT_METADATA_DRIFT");
    }
  }

  try {
    const runtime = validateRuntimeConfig(JSON.parse(await readPinned(manifest.runtimeConfig)) as unknown);
    const baseline = validateEngineeringBaseline(JSON.parse(await readPinned(manifest.engineeringBaseline)) as unknown);
    for (const component of baseline.components) {
      const document = manifest.documents.find((entry) => entry.documentId === component.componentId.slice(0, 2));
      if (document === undefined || document.version !== component.documentVersion ||
        !unique(component.sourcePaths) ||
        component.sourcePaths.length !== document.sourceFiles.length ||
        component.sourcePaths.some((path) => !document.sourceFiles.some((file) => file.path === path))) {
        throw new E0StaticValidationError("CONFIG_UNSAFE");
      }
      const sortedPaths = [...component.sourcePaths].sort();
      const chunks = sortedPaths.map((path) => {
        const content = pinnedContents.get(path);
        if (content === undefined) throw new E0StaticValidationError("REFERENCE_MISSING");
        return component.digestMode === "ORDERED_FILE_SET"
          ? `FILE:${path.split("/").at(-1)}\n${content}` : content;
      });
      if (component.digestMode === "SINGLE_FILE" && sortedPaths.length !== 1) {
        throw new E0StaticValidationError("CONFIG_UNSAFE");
      }
      if (sha256(chunks.join("\n")) !== component.documentDigestSha256) {
        throw new E0StaticValidationError("FILE_DIGEST_MISMATCH");
      }
    }
    validateCapabilityRegistry(capabilityRegistry);
    if (runtime.agent.id !== "aibang-hr-onboarding-agent" || runtime.enabledBusinessCapabilities.length !== 0 ||
      baseline.runtimeAssertions.enabledBusinessCapabilityCount !== 0 ||
      baseline.runtimeAssertions.physicalToolBindingCount !== 0 ||
      Object.values(emptyEvalRegistry).some((entries) => entries.length !== 0)) {
      throw new E0StaticValidationError("CONFIG_UNSAFE");
    }
  } catch (error) {
    if (error instanceof E0StaticValidationError) throw error;
    throw new E0StaticValidationError("CONFIG_UNSAFE");
  }
  return manifest;
}

export async function validateE0StaticManifestFromDirectory(
  input: unknown, expectedDigest: string, directory: string
): Promise<E0StaticManifestV1> {
  const root = await realpath(directory);
  return validateE0StaticManifest(input, expectedDigest, async (file) => {
    const target = await realpath(resolve(root, file));
    const relation = relative(root, target);
    if (relation.startsWith("..") || isAbsolute(relation) || relation === "") {
      throw new E0StaticValidationError("REFERENCE_MISSING");
    }
    return readFile(target, "utf8");
  });
}
