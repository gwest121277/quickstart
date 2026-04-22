import { NextResponse } from "next/server";
import { supabaseAdmin, currentUserId } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  const db = supabaseAdmin();
  const user = currentUserId();

  const { data: projects, error } = await db
    .from("projects")
    .select("id, name, ultimate_goal, created_at")
    .eq("user_id", user)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await db
    .from("capsules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user);

  return NextResponse.json({
    projects,
    has_any_capsules: (count ?? 0) > 0,
  });
}
