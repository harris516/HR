import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateE0StaticManifestFromDirectory } from "../validation/validate-e0-static-manifest.js";

const [manifestPath, expectedDigest, documentsRoot] = process.argv.slice(2);
if (!manifestPath || !expectedDigest || !documentsRoot || !/^[a-f0-9]{64}$/.test(expectedDigest)) {
  process.stderr.write("Usage: validate-e0-static-manifest <manifest.json> <externally-pinned-sha256> <documents-root>\n");
  process.exitCode = 2;
} else {
  try {
    const input = JSON.parse(await readFile(resolve(manifestPath), "utf8")) as unknown;
    const manifest = await validateE0StaticManifestFromDirectory(input, expectedDigest, resolve(documentsRoot));
    process.stdout.write(JSON.stringify({
      status: "static_inputs_verified_not_e0_run",
      manifestId: manifest.manifestId,
      documentCount: manifest.documents.length,
      evalRunCreated: false,
      acceptanceDecisionCreated: false
    }, null, 2) + "\n");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "STATIC_INPUT_UNAVAILABLE";
    process.stderr.write(`E0 static input validation failed: ${code}\n`);
    process.exitCode = 1;
  }
}
