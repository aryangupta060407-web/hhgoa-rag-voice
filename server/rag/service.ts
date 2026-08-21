import { answerWithGeneralKnowledgeFallback } from "./generalAnswer";
import { runDeterministicRag } from "./pipeline";
import type { RagOutcome } from "./types";

export async function runRagQuery(query: string): Promise<RagOutcome> {
  const outcome = runDeterministicRag(query);
  const isUnsafe = outcome.guardrails.reasons.includes("unsafe_input");

  if (outcome.guardrails.status === "refused" && !isUnsafe) {
    return answerWithGeneralKnowledgeFallback(outcome);
  }

  return outcome;
}
