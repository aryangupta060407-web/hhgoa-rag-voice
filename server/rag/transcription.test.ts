import { describe, expect, it } from "vitest";
import { decodeAudioPayload, transcribeWithFallback } from "./transcription";

describe("voice payload decoding", () => {
  it("removes codec-qualified MediaRecorder data URL metadata before base64 decoding", () => {
    const decoded = decodeAudioPayload("data:audio/webm;codecs=opus;base64,QUJDRA==");

    expect(decoded.toString("utf8")).toBe("ABCD");
  });

  it("decodes a plain base64 audio payload without requiring a data URL prefix", () => {
    const decoded = decodeAudioPayload("QUJDRA==");

    expect(decoded.toString("utf8")).toBe("ABCD");
  });

  it("passes an intact codec-qualified recorded WebM payload to Whisper when Sarvam fails", async () => {
    const result = await transcribeWithFallback(
      {
        audioBase64: "data:audio/webm;codecs=opus;base64,GkXfo59D",
        mimeType: "audio/webm",
        fileName: "voice-question.webm",
        language: "en",
      },
      {
        sarvam: async () => { throw new Error("forced Sarvam outage"); },
        whisper: async (buffer, input) => {
          expect(buffer.subarray(0, 4).toString("hex")).toBe("1a45dfa3");
          expect(input.mimeType).toBe("audio/webm");
          return { text: "How fast does an eagle travel?", language: "en" };
        },
      },
    );

    expect(result).toMatchObject({
      transcript: "How fast does an eagle travel?",
      provider: "whisper_fallback",
      language: "en",
      primaryFailure: "forced Sarvam outage",
    });
  });
});
