import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, currentUserId } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id?: string; name?: string; ultimate_goal?: string | null };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("projects")
    .update({
      name,
      ultimate_goal: body.ultimate_goal?.toString().trim() || null,
    })
    .eq("id", body.id)
    .eq("user_id", currentUserId())
    .select("id, name, ultimate_goal, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ project: data });
}
