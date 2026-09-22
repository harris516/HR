import { z } from "zod";

export const e0DocumentIds = [
  "00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"
] as const;

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const safePath = z.string().min(1).max(256).regex(/^[A-Za-z0-9_./-]+$/)
  .refine((value) => !value.startsWith("/") && !value.includes("\\") &&
    value.split("/").every((segment) => segment !== "." && segment !== ".." && segment.length > 0));

const fileRef = z.object({ path: safePath, sha256: digest }).strict();
const document = z.object({
  documentId: z.enum(e0DocumentIds),
  version: z.string().regex(/^v\d+\.\d+$/),
  status: z.enum(["reviewed", "reviewed_ready", "reviewed_closure_passed"]),
  sourceFiles: z.array(fileRef.extend({ path: safePath.regex(/\.md$/) })).min(1)
}).strict();

export const e0StaticManifestV1Schema = z.object({
  schemaVersion: z.literal("e0-static-manifest.v1"),
  manifestId: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  manifestVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  subjectSnapshotRef: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  synthetic: z.literal(true),
  documents: z.array(document).length(e0DocumentIds.length),
  runtimeConfig: fileRef.extend({ path: safePath.regex(/\.json$/) }),
  engineeringBaseline: fileRef.extend({ path: safePath.regex(/\.json$/) }),
  contentDigest: digest
}).strict();

export type E0StaticManifestV1 = z.infer<typeof e0StaticManifestV1Schema>;
