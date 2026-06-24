import { createHmac } from "crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signState(payload: string, secret: string): string {
  return base64Url(createHmac("sha256", secret).update(payload).digest());
}

export async function GET(request: Request): Promise<NextResponse> {
  console.log("[gmail/connect] Route hit");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Gmail OAuth is not configured." }, { status: 500 });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await db.auth.getUser();
  if (userError || !userData.user) {
    console.error("[gmail/connect] Auth lookup failed:", userError);
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  console.log("[gmail/connect] Authenticated user_id:", userData.user.id);

  const { searchParams } = new URL(request.url);
  const requestedChurchId = Number(searchParams.get("church_id"));

  let churchUserQuery = db
    .from("church_users")
    .select("*")
    .eq("user_id", userData.user.id)
    .limit(1);

  if (Number.isInteger(requestedChurchId) && requestedChurchId > 0) {
    churchUserQuery = churchUserQuery.eq("church_id", requestedChurchId);
  }

  const { data: churchUsers, error: churchUserError } = await churchUserQuery;
  if (churchUserError) {
    console.error("[gmail/connect] Church membership lookup failed:", churchUserError);
    return NextResponse.json({ error: "Could not verify church access." }, { status: 500 });
  }
  if (!churchUsers?.length) {
    return NextResponse.json({ error: "Church access was not found." }, { status: 403 });
  }

  const churchUserRow = churchUsers[0] as { church_id: number; role: string };
  // Connecting/reconnecting an integration changes it for the whole church — admin only.
  if (churchUserRow.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can manage integrations." }, { status: 403 });
  }
  const activeChurchId = churchUserRow.church_id;
  console.log("[gmail/connect] Resolved church_id:", activeChurchId);

  const statePayload = base64Url(JSON.stringify({
    church_id: activeChurchId,
    user_id: userData.user.id,
    issued_at: Date.now(),
  }));
  const state = `${statePayload}.${signState(statePayload, process.env.OAUTH_STATE_SECRET ?? clientSecret)}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.email",
    state,
    access_type: "offline",
    prompt: "consent",
  });

  const authorizeUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  console.log("[gmail/connect] Generated authorize URL");

  return NextResponse.json({ url: authorizeUrl });
}
