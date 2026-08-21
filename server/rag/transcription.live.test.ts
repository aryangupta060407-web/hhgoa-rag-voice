import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { transcribeWithFallback } from "./transcription";

describe("live transcription route", () => {
  it.runIf(process.env.RUN_LIVE_STT_TEST === "1")("transcribes a real WAV recording through the production provider route", async () => {
    const wav = readFileSync("/home/ubuntu/hhgoa-source/jfk.wav");
    const result = await transcribeWithFallback({
      audioBase64: `data:audio/wav;base64,${wav.toString("base64")}`,
      mimeType: "audio/wav",
      fileName: "jfk.wav",
      language: "en",
    });

    expect(result.transcript.length).toBeGreaterThan(12);
    expect(["sarvam", "whisper_fallback"]).toContain(result.provider);
  }, 30000);

  it.runIf(process.env.RUN_LIVE_STT_TEST === "1")("completes the real rag.voiceQuery procedure for a recorded speech payload", async () => {
    const wav = readFileSync("/home/ubuntu/hhgoa-source/jfk.wav");
    const ctx = { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const caller = appRouter.createCaller(ctx);

    const response = await caller.rag.voiceQuery({
      audioBase64: `data:audio/wav;base64,${wav.toString("base64")}`,
      mimeType: "audio/wav",
      fileName: "jfk.wav",
      language: "en",
    });

    expect(response.transcription.transcript.length).toBeGreaterThan(12);
    expect(response.result.transcript).toBe(response.transcription.transcript);
    expect(response.result.latency.transcriptionMs).toBeGreaterThan(0);
  }, 30000);
});
