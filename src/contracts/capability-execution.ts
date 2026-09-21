import { z } from "zod";
import { capabilityResultEnvelopeSchema } from "../capabilities/schema-registry.js";

export const capabilityExecutionOutcomeSchema = z.object({
  envelope: capabilityResultEnvelopeSchema,
  outputPayload: z.unknown().optional(),
  implementationInvoked: z.boolean(),
  externalSideEffect: z.literal(false)
}).strict().superRefine((value, context) => {
  if (["SUCCESS", "PARTIAL"].includes(value.envelope.resultStatus) && value.outputPayload === undefined) {
    context.addIssue({ code: "custom", message: "successful execution must publish a validated output payload" });
  }
  if (
    !["SUCCESS", "PARTIAL", "INDETERMINATE"].includes(value.envelope.resultStatus) &&
    value.outputPayload !== undefined
  ) {
    context.addIssue({ code: "custom", message: "failed or waiting execution must not publish an output payload" });
  }
});

export type CapabilityExecutionOutcome = z.infer<typeof capabilityExecutionOutcomeSchema>;
