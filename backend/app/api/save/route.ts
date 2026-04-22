import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, currentUserId } from "@/lib/supabase";

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

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body.project_id) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("capsules")
    .insert({
      user_id: currentUserId(),
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
