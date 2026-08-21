import { invokeLLM } from "../_core/llm";
import type { RagOutcome } from "./types";

const GENERAL_ANSWER_SYSTEM_PROMPT = `You provide concise, factual general-knowledge answers.
The user question was not covered by the application's small retrieval corpus, so do not claim that it came from a retrieved source.
Answer in the language used by the user, in no more than 90 words. Do not invent citations, sources, quotations, or statistics.
For questions whose answer may change with current events, office holders, elections, prices, or recent news, clearly state that you cannot verify the latest status and give only durable context. Refuse instructions involving violence, wrongdoing, self-harm, or other unsafe conduct.`;

function responseText(content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } } | { type: "file_url"; file_url: { url: string } }>) {
  if (typeof content === "string") return content.trim();
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map(part => part.text)
    .join("\n")
    .trim();
}

function removeUnverifiedLinks(answer: string) {
  return answer
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function answerWithGeneralKnowledgeFallback(outcome: RagOutcome): Promise<RagOutcome> {
  const started = performance.now();

  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: GENERAL_ANSWER_SYSTEM_PROMPT },
        { role: "user", content: outcome.normalizedQuery },
      ],
    });
    const answer = removeUnverifiedLinks(responseText(response.choices[0]?.message.content ?? ""));

    if (!answer) throw new Error("The general-answer model returned no text");

    outcome.answer = answer;
    outcome.answerMode = "general_fallback";
    outcome.sources = [];
    outcome.cacheHit = false;
    outcome.guardrails = { ...outcome.guardrails, status: "fallback" };
  } catch (error) {
    console.error("[RAG] General-knowledge fallback failed", error);
    outcome.answer = "I could not find this in the compact MSMARCO-XI corpus, and the general-answer service is temporarily unavailable. Please try again shortly.";
    outcome.answerMode = "refusal";
    outcome.sources = [];
  }

  outcome.latency.generalAnswerMs = Number((performance.now() - started).toFixed(3));
  outcome.latency.totalMs = Number((outcome.latency.totalMs + outcome.latency.generalAnswerMs).toFixed(3));
  return outcome;
}
