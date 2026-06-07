import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "@/lib/supabase";

type OutreachType = "email" | "sms" | "call_script";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Extract the first balanced JSON object from arbitrary model output
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseModelResponse(
  content: string,
  type: OutreachType,
): { subject?: string; body: string } {
  // Strip markdown code fences
  const stripped = content
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  // Try JSON parse on stripped content
  try {
    const parsed = JSON.parse(stripped) as { subject?: string; body?: string };
    if (parsed.body) return { subject: parsed.subject, body: parsed.body };
  } catch {
    // fall through
  }

  // Try extracting a JSON object embedded in prose
  const jsonStr = extractJsonObject(content);
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr) as { subject?: string; body?: string };
      if (parsed.body) return { subject: parsed.subject, body: parsed.body };
    } catch {
      // fall through
    }
  }

  // Email: accept "Subject: …" plain-text format
  if (type === "email") {
    const subjectMatch = content.match(/^Subject:\s*(.+)$/im);
    if (subjectMatch) {
      return {
        subject: subjectMatch[1].trim(),
        body: content.replace(/^Subject:\s*.+\n?/im, "").trim(),
      };
    }
  }

  return { body: content.trim() };
}

function buildSystemPrompt(type: OutreachType): string {
  const jsonFormat =
    type === "email"
      ? '{"subject": "...", "body": "..."}'
      : '{"body": "..."}';

  const typeHint =
    type === "sms"
      ? "The message body must be under 320 characters — keep it short, warm, and conversational."
      : type === "call_script"
        ? "The body must be a warm, numbered call script with exactly 4–5 steps."
        : "";

  return `You are a compassionate church care coordinator helping pastoral staff reach out to members.

Write messages that are:
- Warm, brief, and deeply human
- Pastoral and non-judgmental
- Natural and conversational — never stiff or corporate
- Hopeful and encouraging — never guilt-based or manipulative

Always use natural, caring language such as:
- "we've missed seeing you"
- "just wanted to check in"
- "hope you're doing well"
- "we'd love to reconnect"
- "thinking of you"

Never reference: data, scores, analytics, tracking, algorithms, patterns, or anything clinical.
${typeHint}

Respond ONLY with valid JSON in this exact format: ${jsonFormat}`;
}

function buildUserMessage(
  type: OutreachType,
  firstName: string,
  daysSince: number | null,
  recentCount: number,
): string {
  const when =
    daysSince != null
      ? `their last visit was about ${daysSince} day${daysSince !== 1 ? "s" : ""} ago`
      : "it has been a while since we've seen them";
  const recentNote =
    recentCount > 0
      ? ` They attended ${recentCount} time${recentCount !== 1 ? "s" : ""} in the last 30 days.`
      : "";
  const typeName = type === "call_script" ? "call script" : type;

  return `Write a warm, short, pastoral ${typeName} for ${firstName}, a church member — ${when}.${recentNote}`;
}

async function callOpenRouter(
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Shepherd",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[outreach] OpenRouter failed", `HTTP ${response.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[outreach] OpenRouter request error", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Rule-based fallbacks — always produce something sensible
function fallbackEmail(firstName: string) {
  console.warn("Using fallback template");
  return {
    success: true as const,
    source: "fallback" as const,
    model: null,
    type: "email" as const,
    subject: `We've been thinking of you, ${firstName}`,
    body: [
      `Hi ${firstName},`,
      "",
      "I just wanted to reach out and let you know we've been thinking of you.",
      "We've missed seeing you lately and hope you're doing well.",
      "",
      "If there's anything our church family can pray for or support, we'd love to hear from you.",
      "You're always welcome — please don't hesitate to reach out.",
      "",
      "Grace and peace,",
      "Shepherd Care Team",
    ].join("\n"),
  };
}

function fallbackSms(firstName: string) {
  console.warn("Using fallback template");
  return {
    success: true as const,
    source: "fallback" as const,
    model: null,
    type: "sms" as const,
    body: `Hi ${firstName} — we've missed seeing you and just wanted to check in. Hope you're doing well! We'd love to reconnect soon.`,
  };
}

function fallbackCallScript(firstName: string) {
  console.warn("Using fallback template");
  return {
    success: true as const,
    source: "fallback" as const,
    model: null,
    type: "call_script" as const,
    body: [
      `Call Script — ${firstName}`,
      "",
      "1. Open warmly — introduce yourself and thank them for picking up.",
      "2. Let them know you've been thinking about them and just wanted to check in.",
      "3. Ask how they've been doing and genuinely listen.",
      "4. Share that the church family has missed them and cares about them.",
      "5. Offer prayer, ask if there's any way to support them, and close with warmth.",
    ].join("\n"),
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let member_pco_id: string | null | undefined;
  let type: string | undefined;

  try {
    const body = (await request.json()) as { member_pco_id?: string | null; type?: string };
    member_pco_id = body.member_pco_id;
    type = body.type;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!type || !["email", "sms", "call_script"].includes(type)) {
    return NextResponse.json(
      { success: false, error: 'type must be "email", "sms", or "call_script".' },
      { status: 400 },
    );
  }

  const outreachType = type as OutreachType;
  console.log(`[outreach] Generating ${outreachType} for pco_id=${member_pco_id ?? "none"}`);

  // Load member context from Supabase
  let firstName = "Friend";
  let daysSince: number | null = null;
  let recentCount = 0;

  if (member_pco_id) {
    try {
      const db = getSupabase();
      if (db) {
        const [memberRes, attendanceRes] = await Promise.all([
          db.from("members").select("*").eq("pco_id", member_pco_id).limit(1),
          db
            .from("attendance")
            .select("*")
            .eq("member_pco_id", member_pco_id)
            .order("attended_at", { ascending: false })
            .limit(20),
        ]);

        const memberRows = memberRes.data as Array<{ name: string | null }> | null;
        if (memberRows?.[0]?.name) {
          firstName = memberRows[0].name!.trim().split(" ")[0] || "Friend";
        }

        const attendanceRows = attendanceRes.data as Array<{ attended_at: string | null }> | null;
        if (attendanceRows && attendanceRows.length > 0) {
          const lastAt = attendanceRows[0].attended_at;
          if (lastAt) {
            const last = new Date(lastAt);
            if (!Number.isNaN(last.getTime())) {
              daysSince = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
            }
          }

          const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
          recentCount = attendanceRows.filter((row) => {
            if (!row.attended_at) return false;
            const d = new Date(row.attended_at);
            return !Number.isNaN(d.getTime()) && d.getTime() >= cutoff;
          }).length;
        }

        console.log(
          `[outreach] Context: firstName=${firstName}, daysSince=${daysSince}, recentCount=${recentCount}`,
        );
      }
    } catch (err) {
      console.warn("[outreach] Supabase lookup failed — using defaults:", err);
    }
  }

  // Try OpenRouter (primary then fallback model)
  const apiKey = process.env.OPENROUTER_API_KEY;
  const primaryModel = process.env.OPENROUTER_MODEL ?? "openai/gpt-oss-120b:free";
  const fallbackModel = "z-ai/glm-4.5-air:free";

  if (apiKey && apiKey !== "your_openrouter_key") {
    const systemPrompt = buildSystemPrompt(outreachType);
    const userMessage = buildUserMessage(outreachType, firstName, daysSince, recentCount);

    let content: string | null = null;
    let usedModel = primaryModel;

    try {
      console.log(`[outreach] Calling primary model: ${primaryModel}`);
      content = await callOpenRouter(primaryModel, apiKey, systemPrompt, userMessage);
    } catch (err) {
      console.error("OpenRouter failed", err);
    }

    if (!content && primaryModel !== fallbackModel) {
      usedModel = fallbackModel;
      try {
        console.log(`[outreach] Trying fallback model: ${fallbackModel}`);
        content = await callOpenRouter(fallbackModel, apiKey, systemPrompt, userMessage);
      } catch (err) {
        console.error("OpenRouter failed", err);
      }
    }

    if (content) {
      const parsed = parseModelResponse(content, outreachType);

      if (outreachType === "email") {
        return NextResponse.json({
          success: true,
          source: "openrouter",
          model: usedModel,
          type: "email",
          subject: parsed.subject ?? `We've been thinking of you, ${firstName}`,
          body: parsed.body,
        });
      }
      return NextResponse.json({
        success: true,
        source: "openrouter",
        model: usedModel,
        type: outreachType,
        body: parsed.body,
      });
    }
  } else {
    console.log("[outreach] OPENROUTER_API_KEY not configured — using rule-based fallback");
  }

  // Rule-based fallback
  if (outreachType === "email") return NextResponse.json(fallbackEmail(firstName));
  if (outreachType === "sms") return NextResponse.json(fallbackSms(firstName));
  return NextResponse.json(fallbackCallScript(firstName));
}
