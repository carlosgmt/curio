"use client";

export interface DeviceAiCapabilities {
  geminiNano: "available" | "readily" | "downloading" | "not-supported";
  speechRecognition: boolean;
  isPixelOrAndroid: boolean;
}

export async function detectDeviceCapabilities(): Promise<DeviceAiCapabilities> {
  let geminiNano: "available" | "readily" | "downloading" | "not-supported" = "not-supported";

  if (typeof window !== "undefined") {
    const anyWin = window as any;
    // Check Chrome Built-in AI / Prompt API (Gemini Nano on Pixel & Chrome)
    if (anyWin.ai?.languageModel) {
      try {
        const caps = await anyWin.ai.languageModel.capabilities();
        geminiNano = caps.available === "readily" ? "readily" : caps.available === "after-download" ? "downloading" : "available";
      } catch {
        geminiNano = "not-supported";
      }
    }
  }

  const speechRecognition =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const isPixelOrAndroid =
    typeof navigator !== "undefined" &&
    /Android|Pixel/i.test(navigator.userAgent);

  return {
    geminiNano,
    speechRecognition,
    isPixelOrAndroid,
  };
}

/**
 * Starts on-device speech-to-text dictation.
 */
export function startVoiceDictation(
  onTranscript: (text: string) => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): { stop: () => void } | null {
  if (typeof window === "undefined") return null;
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) return null;

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) onTranscript(finalTranscript);
    };

    recognition.onerror = (event: any) => {
      onError?.(event.error);
    };

    recognition.onend = () => {
      onEnd?.();
    };

    recognition.start();
    return {
      stop: () => {
        try { recognition.stop(); } catch {}
      }
    };
  } catch (e) {
    onError?.(e);
    return null;
  }
}