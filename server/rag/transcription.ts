import { storageGetSignedUrl, storagePut } from "../storage";
import { transcribeAudio } from "../_core/voiceTranscription";
import type { TranscriptionOutcome } from "./types";

type AudioInput = { audioBase64: string; mimeType: string; fileName: string; language?: string };

function stripDataUrl(value: string) {
  return value.replace(/^data:[^;]+;base64,/, "");
}

async function retry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Transcription failed");
}

async function sarvamTranscribe(buffer: Buffer, input: AudioInput) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error("Sarvam credential is not configured");
  const result = await retry(async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: input.mimeType }), input.fileName || "recording.webm");
    form.append("model", "saaras:v3");
    form.append("mode", "transcribe");
    form.append("language_code", "unknown");
    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: form,
    });
    if (!response.ok) throw new Error(`Sarvam returned ${response.status}`);
    return response.json() as Promise<{ transcript?: string; language_code?: string | null }>;
  });
  if (!result.transcript?.trim()) throw new Error("Sarvam returned an empty transcript");
  return { text: result.transcript.trim(), language: result.language_code ?? null };
}

async function whisperFallback(buffer: Buffer, input: AudioInput) {
  const stored = await storagePut(`voice-rag/${Date.now()}-${input.fileName || "recording.webm"}`, buffer, input.mimeType);
  const signedUrl = await storageGetSignedUrl(stored.key);
  const result = await transcribeAudio({ audioUrl: signedUrl, language: input.language, prompt: "Transcribe a short factual retrieval question exactly." });
  if ("error" in result) throw new Error(result.error);
  return { text: result.text.trim(), language: result.language ?? null };
}

export async function transcribeWithFallback(input: AudioInput): Promise<TranscriptionOutcome> {
  const started = performance.now();
  const buffer = Buffer.from(stripDataUrl(input.audioBase64), "base64");
  if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new Error("Audio must be between 1 byte and 8 MB");
  let primaryFailure: string | null = null;
  try {
    const result = await sarvamTranscribe(buffer, input);
    return { transcript: result.text, provider: "sarvam", language: result.language, latencyMs: Number((performance.now() - started).toFixed(3)), primaryFailure };
  } catch (error) {
    primaryFailure = error instanceof Error ? error.message : "Sarvam unavailable";
  }
  const fallback = await whisperFallback(buffer, input);
  return { transcript: fallback.text, provider: "whisper_fallback", language: fallback.language, latencyMs: Number((performance.now() - started).toFixed(3)), primaryFailure };
}
