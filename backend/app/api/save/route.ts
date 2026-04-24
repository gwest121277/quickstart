import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  project_id: string;
  tabs?: unknown;
  raw_transcript?: string;
  synthesis?: string;
  next_move?: string;
  key_noun?: string;
  loose_threads?: string[];
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

const MAX_TRANSCRIPT_CHARS = 10_000;
const MAX_TABS = 200;

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { user, db } = auth;

  const body = (await req.json()) as Body;
  if (!body.project_id) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }
  if (body.raw_transcript && body.raw_transcript.length > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: "transcript too long" }, { status: 413 });
  }
  if (Array.isArray(body.tabs) && body.tabs.length > MAX_TABS) {
    return NextResponse.json({ error: "too many tabs" }, { status: 413 });
  }

  const { data: project, error: projectErr } = await db
    .from("projects")
    .select("id")
    .eq("id", body.project_id)
    .maybeSingle();
  if (projectErr) {
    return NextResponse.json({ error: projectErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const { data, error } = await db
    .from("capsules")
    .insert({
      user_id: user.id,
      project_id: body.project_id,
      tabs: body.tabs ?? [],
      raw_transcript: body.raw_transcript ?? null,
      synthesis: body.synthesis ?? null,
      next_move: body.next_move ?? null,
      key_noun: body.key_noun ?? null,
      loose_threads: body.loose_threads ?? [],
    })
    .select("id, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ capsule_id: data.id, created_at: data.created_at });
}
