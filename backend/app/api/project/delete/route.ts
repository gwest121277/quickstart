import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, currentUserId } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id?: string };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const user = currentUserId();

  const { count, error: countErr } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "Create another project first." },
      { status: 409 }
    );
  }

  const { error } = await db
    .from("projects")
    .delete()
    .eq("id", body.id)
    .eq("user_id", user);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
