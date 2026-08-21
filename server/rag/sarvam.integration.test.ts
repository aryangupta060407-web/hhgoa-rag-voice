import { describe, expect, it } from "vitest";

function silentWav() {
  const sampleRate = 16000;
  const samples = sampleRate / 10;
  const bytesPerSample = 2;
  const dataSize = samples * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

describe("Sarvam speech-to-text credential", () => {
  it.skipIf(!process.env.SARVAM_API_KEY)("authenticates to the Sarvam STT endpoint", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(silentWav())], { type: "audio/wav" }), "credential-check.wav");
    form.append("model", "saaras:v3");
    form.append("mode", "transcribe");
    form.append("language_code", "en-IN");

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": process.env.SARVAM_API_KEY! },
      body: form,
    });

    expect(response.status, `Sarvam returned ${response.status}; authentication must not be rejected`).not.toBe(401);
    expect(response.status, `Sarvam returned ${response.status}; authentication must not be rejected`).not.toBe(403);
  }, 15000);
});
