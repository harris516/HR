import type { z } from "zod";
import {
  acceptanceAggregateV1Schema, acceptanceDecisionV1Schema, acceptanceProfileV1Schema,
  evalCaseResultV1Schema, evalCaseV1Schema, evalDatasetManifestV1Schema,
  evalRunV1Schema, evalSuiteManifestV1Schema
} from "../contracts/eval.js";

/** EVS1 has no approved records or executable registration API. */
export const emptyEvalRegistry = Object.freeze({
  suites: Object.freeze([]) as readonly z.infer<typeof evalSuiteManifestV1Schema>[],
  cases: Object.freeze([]) as readonly z.infer<typeof evalCaseV1Schema>[],
  datasets: Object.freeze([]) as readonly z.infer<typeof evalDatasetManifestV1Schema>[],
  profiles: Object.freeze([]) as readonly z.infer<typeof acceptanceProfileV1Schema>[],
  runs: Object.freeze([]) as readonly z.infer<typeof evalRunV1Schema>[],
  caseResults: Object.freeze([]) as readonly z.infer<typeof evalCaseResultV1Schema>[],
  aggregates: Object.freeze([]) as readonly z.infer<typeof acceptanceAggregateV1Schema>[],
  decisions: Object.freeze([]) as readonly z.infer<typeof acceptanceDecisionV1Schema>[]
});
