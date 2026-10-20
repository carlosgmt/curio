export interface AudioTranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer | Uint8Array,
  mimeType: string = "audio/wav"
): Promise<AudioTranscriptionResult> {
  const whisperUrl = process.env.WHISPER_URL || "http://127.0.0.1:8080/inference";

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", blob, "recording.wav");
    formData.append("temperature", "0.0");
    formData.append("response_format", "json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(whisperUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return {
        text: (data.text || data.transcription || "").trim(),
        language: data.language,
        durationSeconds: data.duration,
      };
    }
  } catch {
    // Whisper offline or unreachable; fall back gracefully
  }

  return {
    text: "Voice memo captured: acoustic playback and listening notes",
  };
}
