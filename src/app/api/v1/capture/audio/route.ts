import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/ingest/audio";

export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: err.message || "Failed to transcribe audio" }, { status: 500 });
  }
}
