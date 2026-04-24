import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { db } = auth;

  const { data: projects, error } = await db
    .from("projects")
    .select("id, name, ultimate_goal, created_at")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await db
    .from("capsules")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    projects,
    has_any_capsules: (count ?? 0) > 0,
  });
}
