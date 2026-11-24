import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio, AudioTranscriptionUnavailableError } from "@/lib/ingest/audio";
import { requireAuth, AuthError } from "@/lib/auth/service";

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const formData = await req.formData();
    const audioFile = (formData.get("audio") || formData.get("file")) as File | null;

    if (!audioFile || typeof audioFile !== "object") {
      return NextResponse.json({ error: "Missing audio file in form data" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await transcribeAudio(buffer, audioFile.type || "audio/wav");

    return NextResponse.json({
      success: true,
      text: result.text,
      language: result.language,
      duration: result.durationSeconds,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof AudioTranscriptionUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json({ error: err.message || "Failed to transcribe audio" }, { status: 500 });
  }
}
