export interface AudioTranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
}

export class AudioTranscriptionUnavailableError extends Error {
  statusCode: number;
  constructor(message = "Speech transcription service is offline. Use browser voice dictation instead.") {
    super(message);
    this.name = "AudioTranscriptionUnavailableError";
    this.statusCode = 503;
  }
}

export async function transcribeAudio(
  audioBuffer: Buffer | Uint8Array,
  mimeType: string = "audio/wav",
  options?: { fetchFn?: typeof fetch }
): Promise<AudioTranscriptionResult> {
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    throw new Error("Empty audio payload");
  }
  const fetchFn = options?.fetchFn ?? fetch;
  const whisperUrl = process.env.WHISPER_URL || "http://127.0.0.1:8080/inference";

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, "recording.wav");
    formData.append("temperature", "0.0");
    formData.append("response_format", "json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetchFn(whisperUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const text = (data.text || data.transcription || "").trim();
      if (!text) {
        throw new AudioTranscriptionUnavailableError("No speech detected in audio recording.");
      }
      return {
        text,
        language: data.language,
        durationSeconds: data.duration,
      };
    }
  } catch (err) {
    if (err instanceof AudioTranscriptionUnavailableError) {
      throw err;
    }
  }

  throw new AudioTranscriptionUnavailableError();
}
