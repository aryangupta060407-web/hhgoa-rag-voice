import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getRecentRagQueries, insertRagQuery } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { summarizeLatency } from "./rag/pipeline";
import { runBenchmarkSuite } from "./rag/benchmark";
import { getGatewayIndexStatus, getRetrievalGatewayConfig } from "./rag/retrievalGateway";
import { runRagQuery } from "./rag/service";
import { transcribeWithFallback } from "./rag/transcription";
import type { RagOutcome } from "./rag/types";

async function persistOutcome(outcome: RagOutcome, transcriptionProvider?: string, transcriptionMs?: number, executionType: "live" | "benchmark" = "live") {
  const persistenceStarted = performance.now();
  try {
    await insertRagQuery({
      transcript: outcome.transcript,
      normalizedQuery: outcome.normalizedQuery,
      answer: outcome.answer,
      answerMode: outcome.answerMode,
      guardrailStatus: outcome.guardrails.status,
      guardrailReasons: outcome.guardrails.reasons,
      sourcePayload: outcome.sources,
      latencyPayload: outcome.latency,
      transcriptionProvider,
      executionType,
      retrievalToAnswerMs: Math.round(outcome.latency.retrievalToAnswerMs),
      transcriptionMs: transcriptionMs === undefined ? null : Math.round(transcriptionMs),
      totalMs: Math.round(outcome.latency.totalMs),
    });
  } catch (error) {
    console.error("[RAG] Query history persistence failed", error);
  }
  outcome.latency.persistenceMs = Number((performance.now() - persistenceStarted).toFixed(3));
  outcome.latency.totalMs = Number((outcome.latency.totalMs + outcome.latency.persistenceMs).toFixed(3));
  return outcome;
}

function queueOutcomePersistence(outcome: RagOutcome, transcriptionProvider?: string, transcriptionMs?: number) {
  // The user-facing answer has already been grounded and is ready. Query-history
  // telemetry is best-effort so remote database latency cannot consume the RAG
  // response budget. Controlled benchmarks keep the awaited path below.
  const snapshot = structuredClone(outcome);
  void persistOutcome(snapshot, transcriptionProvider, transcriptionMs).catch(error => {
    console.error("[RAG] Background query history persistence failed", error);
  });
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  rag: router({
    query: publicProcedure
      .input(z.object({ query: z.string().trim().min(2).max(600), language: z.enum(["auto", "hi", "en", "mr"]).default("auto") }))
      .mutation(async ({ input }) => {
        const outcome = await runRagQuery(input.query, { language: input.language });
        queueOutcomePersistence(outcome);
        return outcome;
      }),
    voiceQuery: publicProcedure
      .input(z.object({
        audioBase64: z.string().min(16).max(11_200_000),
        mimeType: z.enum(["audio/webm", "audio/mp3", "audio/mpeg", "audio/wav", "audio/ogg", "audio/m4a", "audio/mp4"]),
        fileName: z.string().min(1).max(120),
        language: z.enum(["auto", "hi", "en", "mr"]).default("auto"),
      }))
      .mutation(async ({ input }) => {
        const transcription = await transcribeWithFallback(input);
        const outcome = await runRagQuery(transcription.transcript, { language: input.language });
        outcome.transcript = transcription.transcript;
        outcome.latency.transcriptionMs = transcription.latencyMs;
        outcome.latency.totalMs = Number((outcome.latency.retrievalToAnswerMs + transcription.latencyMs).toFixed(3));
        queueOutcomePersistence(outcome, transcription.provider, transcription.latencyMs);
        return {
          transcription,
          result: outcome,
        };
      }),
    history: publicProcedure.query(async () => {
      const records = await getRecentRagQueries(40);
      return records.map(record => ({
        ...record,
        guardrailReasons: record.guardrailReasons as string[],
        sources: record.sourcePayload as unknown[],
        latency: record.latencyPayload as Record<string, number>,
      }));
    }),
    analytics: publicProcedure.query(async () => {
      const records = await getRecentRagQueries(300);
      const benchmarkRecords = records.filter(record => record.executionType === "benchmark");
      const selected = benchmarkRecords.length >= 10 ? benchmarkRecords : records;
      return {
        population: benchmarkRecords.length >= 10 ? "cold_benchmark" : "live_history",
        report: summarizeLatency(selected.map(record => record.latencyPayload as any)),
      };
    }),
    corpusStatus: publicProcedure.query(async () => {
      const config = getRetrievalGatewayConfig();
      if (config) {
        try {
          const index = await getGatewayIndexStatus(config);
          return {
            mode: "external_gateway" as const,
            configured: true,
            reachable: true,
            targetLatencyMs: 200,
            ...index,
          };
        } catch (error) {
          console.warn("[RAG] External corpus status unavailable", error);
          return {
            mode: "external_gateway" as const,
            configured: true,
            reachable: false,
            targetLatencyMs: 200,
            indexVersion: "unavailable",
            pointsCount: 0,
            vectorsCount: 0,
            status: "unreachable",
          };
        }
      }
      return {
        mode: "compact_local" as const,
        configured: false,
        reachable: true,
        targetLatencyMs: 200,
        indexVersion: "compact-validation-slice",
        pointsCount: 7,
        vectorsCount: 7,
        status: "ready",
      };
    }),
    benchmark: publicProcedure.mutation(async () => {
      return runBenchmarkSuite();
    }),
  }),
});

export type AppRouter = typeof appRouter;
