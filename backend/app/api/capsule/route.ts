import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromRequest } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a re-entry assistant for an ADHD entrepreneur named Greg. He just stopped working on a project. Your job is to produce a capsule he can read tomorrow morning in 20 seconds and be back in his headspace.

Input you receive:
- Project name
- Ultimate goal for the project
- Transcript of what Greg said at shutdown
- List of tabs he had open

Return valid JSON only, no markdown, no preamble, with these exact fields:
- synthesis: ONE paragraph, max 3 sentences, written in plain language. Start with the most specific noun Greg mentioned. This is what he reads first when he comes back.
- next_move: ONE sentence describing what Greg said he'd do next. If he didn't say, infer from the transcript and tabs, and flag it with 'likely:' at the start.
- key_noun: The single most specific term, file, function, or concept Greg named. This gets bolded at the top of the card. One to four words max.
- loose_threads: Array of zero to three strings. Things that were unresolved, things Greg said he didn't want to forget, open questions. Empty array is fine.

Rules:
- Use Greg's exact words when possible, not paraphrases
- No corporate jargon, no 'leveraging,' no 'synergy,' no 'bandwidth'
- Never use em-dashes, Greg hates them
- Lead with the specific, not the general
- If Greg rambled, extract the signal and drop the noise
- Do not flatter or add commentary, just return the JSON`;

const CAPSULE_SCHEMA = {
  type: "object",
  properties: {
    synthesis: { type: "string" },
    next_move: { type: "string" },
    key_noun: { type: "string" },
    loose_threads: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
  },
  required: ["synthesis", "next_move", "key_noun", "loose_threads"],
  additionalProperties: false,
};

type Tab = {
  url: string;
  title: string;
  active?: boolean;
};

type Body = {
  transcript: string;
  tabs: Tab[];
  project_id?: string;
  project_name?: string;
  ultimate_goal?: string;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (auth instanceof NextResponse) return auth;
  const { db } = auth;

  const body = (await req.json()) as Body;

  if (!body.transcript?.trim()) {
    return NextResponse.json({ error: "missing transcript" }, { status: 400 });
  }

  let projectName = body.project_name ?? "Quickstart.life";
  let ultimateGoal =
    body.ultimate_goal ??
    "Ship v1 of Quickstart.life, a re-entry tool for Greg himself.";

  if (body.project_id) {
    const { data } = await db
      .from("projects")
      .select("name, ultimate_goal")
      .eq("id", body.project_id)
      .maybeSingle();
    if (data) {
      projectName = data.name ?? projectName;
      if (data.ultimate_goal) ultimateGoal = data.ultimate_goal;
    }
  }

  const tabsCompact = (body.tabs ?? [])
    .slice(0, 40)
    .map((t) => `- ${t.active ? "[active] " : ""}${t.title || "(no title)"} | ${t.url}`)
    .join("\n");

  const userPayload = [
    `Project name: ${projectName}`,
    `Ultimate goal: ${ultimateGoal}`,
    ``,
    `Transcript:`,
    body.transcript.trim(),
    ``,
    `Tabs (${(body.tabs ?? []).length} total):`,
    tabsCompact || "(none)",
  ].join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPayload }],
    });
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error("Claude call failed:", message);
    return NextResponse.json(
      { error: "claude_failed", status, message },
      { status: 502 }
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "no text in response", stop_reason: response.stop_reason },
      { status: 502 }
    );
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) raw = raw.slice(first, last + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "model returned invalid JSON", raw: textBlock.text },
      { status: 502 }
    );
  }

  return NextResponse.json({
    capsule: parsed,
    usage: response.usage,
  });
}
