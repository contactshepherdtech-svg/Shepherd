import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveMembership(
  authorization: string,
): Promise<{ churchId: number; role: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return null;

  const db = getServiceRoleClient();
  if (!db) return null;

  const { data: churchUsers, error } = await db
    .from("church_users")
    .select("church_id, role")
    .eq("user_id", userData.user.id)
    .limit(1);

  if (error || !churchUsers?.length) return null;

  const row = churchUsers[0] as { church_id: number; role: string };
  return Number.isInteger(row.church_id) && row.church_id > 0
    ? { churchId: row.church_id, role: row.role }
    : null;
}

type GmailTokenRow = {
  id: number;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  connection_status: string | null;
};

async function getValidAccessToken(token: GmailTokenRow): Promise<string> {
  const accessToken = token.access_token;
  if (!accessToken) throw new Error("No Gmail access token stored.");

  const isExpired =
    token.expires_at
      ? new Date(token.expires_at).getTime() - Date.now() < 60_000
      : false;

  if (!isExpired) return accessToken;

  if (!token.refresh_token) throw new Error("Gmail token expired and no refresh token is stored.");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    // A revoked/expired refresh token won't recover on retry — flag the row as
    // disconnected so the UI prompts the user to reconnect Gmail.
    const db = getServiceRoleClient();
    if (db) {
      await db
        .from("integration_tokens")
        .update({ connection_status: "disconnected", updated_at: new Date().toISOString() } as never)
        .eq("id", token.id);
    }
    throw new Error(`Token refresh failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  const newExpiry = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  const db = getServiceRoleClient();
  if (db) {
    await db
      .from("integration_tokens")
      .update({ access_token: data.access_token, expires_at: newExpiry, updated_at: new Date().toISOString() } as never)
      .eq("id", token.id);
  }

  return data.access_token;
}

function buildRawMessage(to: string, subject: string, body: string): string {
  const mime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    body,
  ].join("\r\n");

  return Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Best-effort: record on the member's outreach_status row that a Gmail draft was
// prepared (so the queue can show "Draft Created"). One row per
// church_id + member_pco_id — we update only the draft fields so an existing
// status (contacted/snoozed) is preserved, and insert as 'active' if none exists.
// Scoped to the resolved church, so it can never write across tenants. The draft
// already exists in Gmail regardless, so a failure here is logged, not fatal.
async function persistDraftCreated(
  db: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  churchId: number,
  memberPcoId: string,
  draftId: string,
): Promise<boolean> {
  const now = new Date().toISOString();

  try {
    const { data: existing, error: selectError } = await db
      .from("outreach_status")
      .select("id")
      .eq("church_id", churchId)
      .eq("member_pco_id", memberPcoId)
      .limit(1);

    if (selectError) throw selectError;

    if (existing && existing.length > 0) {
      const { error } = await db
        .from("outreach_status")
        .update({ draft_created_at: now, gmail_draft_id: draftId, updated_at: now } as never)
        .eq("id", (existing[0] as { id: number }).id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("outreach_status")
        .insert({
          church_id: churchId,
          member_pco_id: memberPcoId,
          status: "active",
          draft_created_at: now,
          gmail_draft_id: draftId,
          created_at: now,
          updated_at: now,
        } as never);
      if (error) throw error;
    }

    return true;
  } catch (err) {
    console.error("[gmail/create-draft] Could not persist draft state:", err);
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  }

  const membership = await resolveMembership(authorization);
  if (!membership) {
    return NextResponse.json({ success: false, error: "No church workspace found for this user." }, { status: 403 });
  }
  // Creating outreach drafts is a write action — Viewers are blocked.
  if (membership.role !== "admin" && membership.role !== "pastor") {
    return NextResponse.json(
      { success: false, error: "Your role does not allow creating outreach drafts." },
      { status: 403 },
    );
  }
  const churchId = membership.churchId;

  const db = getServiceRoleClient();
  if (!db) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data: tokens, error: tokenError } = await db
    .from("integration_tokens")
    .select("id, access_token, refresh_token, expires_at, connection_status")
    .eq("church_id", churchId)
    .eq("provider", "gmail")
    .limit(1);

  if (tokenError || !tokens?.length) {
    console.error("[gmail/create-draft] No Gmail token for church_id:", churchId, tokenError);
    return NextResponse.json(
      { success: false, error: "Gmail is not connected. Connect Gmail in Settings first." },
      { status: 400 },
    );
  }

  const token = tokens[0] as GmailTokenRow;
  if (token.connection_status === "disconnected") {
    return NextResponse.json(
      { success: false, error: "Gmail is not connected. Connect Gmail in Settings first." },
      { status: 400 },
    );
  }

  let to: string | undefined;
  let subject: string | undefined;
  let body: string | undefined;
  let memberPcoId: string | undefined;

  try {
    const parsed = (await request.json()) as {
      to?: string;
      subject?: string;
      body?: string;
      member_pco_id?: string;
    };
    to = parsed.to;
    subject = parsed.subject;
    body = parsed.body;
    memberPcoId = parsed.member_pco_id?.trim() || undefined;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!to) {
    return NextResponse.json({ success: false, error: "Recipient email (to) is required." }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ success: false, error: "Email body is required." }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gmail/create-draft] Auth error:", message);
    return NextResponse.json({ success: false, error: `Gmail auth error: ${message}` }, { status: 500 });
  }

  const raw = buildRawMessage(to, subject ?? "Shepherd Outreach", body);

  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw } }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[gmail/create-draft] Draft creation failed:", response.status, text.slice(0, 300));
      return NextResponse.json({ success: false, error: `Gmail API error ${response.status}.` }, { status: 500 });
    }

    const draft = (await response.json()) as { id: string };
    console.log("[gmail/create-draft] Draft created for church_id:", churchId, "draft_id:", draft.id);

    // Record "Draft Created" state for the follow-up queue when a member is given.
    let persisted = false;
    if (memberPcoId) {
      persisted = await persistDraftCreated(db, churchId, memberPcoId, draft.id);
    }

    return NextResponse.json({ success: true, draftId: draft.id, persisted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gmail/create-draft] Fetch error:", message);
    return NextResponse.json({ success: false, error: "Could not reach Gmail API." }, { status: 500 });
  }
}
