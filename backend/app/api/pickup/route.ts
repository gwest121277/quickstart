import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

function gapType(createdAt: string): "short" | "overnight" | "long" {
  const diffHours = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  if (diffHours < 2) return "short";
  if (diffHours < 18) return "overnight";
  return "long";
}

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { db } = auth;

  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("capsules")
    .select("*, projects(name, ultimate_goal)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ capsule: null });
  }

  return NextResponse.json({
    capsule: {
      id: data.id,
      project_id: data.project_id,
      project_name: data.projects?.name ?? null,
      ultimate_goal: data.projects?.ultimate_goal ?? null,
      tabs: data.tabs ?? [],
      synthesis: data.synthesis,
      next_move: data.next_move,
      key_noun: data.key_noun,
      loose_threads: data.loose_threads ?? [],
      raw_transcript: data.raw_transcript,
      created_at: data.created_at,
      gap_type: gapType(data.created_at),
    },
  });
}
