import { createHmac } from "crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const PLANNING_CENTER_AUTH_URL = "https://api.planningcenteronline.com/oauth/authorize";

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
  console.log("[planning-center/connect] Route hit");

  const clientId = process.env.PLANNING_CENTER_CLIENT_ID;
  const clientSecret = process.env.PLANNING_CENTER_CLIENT_SECRET;
  const redirectUri = process.env.PLANNING_CENTER_REDIRECT_URI;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { searchParams } = new URL(request.url);
  const requestedChurchId = Number(searchParams.get("church_id"));

  console.log("[planning-center/connect] client_id exists:", !!clientId);
  console.log("[planning-center/connect] redirect_uri:", redirectUri ?? "(not set)");

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Planning Center OAuth is not configured." },
      { status: 500 },
    );
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
    console.error("[planning-center/connect] Auth lookup failed:", userError);
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  console.log("[planning-center/connect] Authenticated user_id:", userData.user.id);

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
    console.error("[planning-center/connect] Church membership lookup failed:", churchUserError);
    return NextResponse.json({ error: "Could not verify church access." }, { status: 500 });
  }

  if (!churchUsers?.length) {
    return NextResponse.json({ error: "Church access was not found." }, { status: 403 });
  }

  const activeChurchId = churchUsers[0].church_id;
  console.log("[planning-center/connect] Resolved church_id:", activeChurchId);

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
    scope: "people check_ins",
    state,
  });

  const authorizeUrl = `${PLANNING_CENTER_AUTH_URL}?${params.toString()}`;
  console.log("[planning-center/connect] Generated authorize URL:", authorizeUrl);

  return NextResponse.json({ url: authorizeUrl });
}
