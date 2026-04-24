import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserFromRequest } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
const MAX_PER_HOUR = 30;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB (30s webm is ~300 KB)

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!checkRateLimit(user.id, HOUR, MAX_PER_HOUR)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many transcriptions this hour." },
      { status: 429 }
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "missing audio file" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "audio too large" },
      { status: 413 }
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await client.audio.transcriptions.create({
    file: audio,
    model: "whisper-1",
  });

  return NextResponse.json({ transcript: result.text });
}
