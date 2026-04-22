import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, currentUserId } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { name?: string; ultimate_goal?: string };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("projects")
    .insert({
      user_id: currentUserId(),
      name,
      ultimate_goal: body.ultimate_goal?.trim() || null,
    })
    .select("id, name, ultimate_goal, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ project: data });
}
