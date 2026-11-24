import { describe, expect, it } from "bun:test";
import { transcribeAudio, AudioTranscriptionUnavailableError } from "./audio";

describe("Audio Transcription Error Integrity (Q4)", () => {
  it("rejects empty audio buffers cleanly", async () => {
    await expect(transcribeAudio(new Uint8Array(0))).rejects.toThrow("Empty audio payload");
  });

  it("throws AudioTranscriptionUnavailableError (503) instead of fake placeholder text when Whisper is offline", async () => {
    const offlineFetch = (async () => {
      throw new Error("ECONNREFUSED 127.0.0.1:8080");
    }) as unknown as typeof fetch;

    let caught: unknown;
    try {
      await transcribeAudio(new Uint8Array([1, 2, 3, 4]), "audio/webm", { fetchFn: offlineFetch });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AudioTranscriptionUnavailableError);
    expect((caught as AudioTranscriptionUnavailableError).statusCode).toBe(503);
    expect((caught as Error).message).not.toContain("Voice memo captured");
  });

  it("returns transcribed text when Whisper responds with speech", async () => {
    const okFetch = (async () =>
      new Response(JSON.stringify({ text: "  Mimar Granada  ", language: "es", duration: 2.4 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;

    const res = await transcribeAudio(new Uint8Array([82, 73, 70, 70]), "audio/wav", {
      fetchFn: okFetch,
    });
    expect(res.text).toBe("Mimar Granada");
    expect(res.language).toBe("es");
  });
});
