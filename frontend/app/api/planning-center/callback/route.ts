import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const PLANNING_CENTER_TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service role key for server-side writes; fall back to anon key
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const settingsUrl = `${origin}/settings`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError || !code) {
    console.error("[planning-center/callback] OAuth error or missing code:", oauthError);
    return NextResponse.redirect(settingsUrl);
  }

  const clientId = process.env.PLANNING_CENTER_CLIENT_ID;
  const clientSecret = process.env.PLANNING_CENTER_CLIENT_SECRET;
  const redirectUri = process.env.PLANNING_CENTER_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[planning-center/callback] Missing Planning Center env vars.");
    return NextResponse.redirect(settingsUrl);
  }

  // Exchange authorization code for tokens
  type TokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };

  let tokenData: TokenResponse;

  try {
    const response = await fetch(PLANNING_CENTER_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[planning-center/callback] Token exchange failed:", response.status, text.slice(0, 300));
      return NextResponse.redirect(settingsUrl);
    }

    tokenData = (await response.json()) as TokenResponse;
  } catch (err) {
    console.error("[planning-center/callback] Token exchange error:", err);
    return NextResponse.redirect(settingsUrl);
  }

  // Persist token to Supabase
  const db = getSupabase();
  if (!db) {
    console.error("[planning-center/callback] Supabase not configured.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const { data: churches } = await db.from("churches").select("*").limit(1);
    const churchId = churches?.[0]?.id ?? null;

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const now = new Date().toISOString();
    const payload = {
      church_id: churchId,
      provider: "planning_center",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tokenData.scope ?? null,
      connection_status: "connected",
      updated_at: now,
    };

    // Check if a record already exists for this church + provider
    const { data: existing } = await db
      .from("integration_tokens")
      .select("*")
      .eq("church_id", churchId as number)
      .eq("provider", "planning_center")
      .limit(1);

    if (existing && existing.length > 0) {
      const { error: updateError } = await db
        .from("integration_tokens")
        .update(payload)
        .eq("id", existing[0].id);

      if (updateError) {
        console.error("[planning-center/callback] Token update failed:", updateError);
      } else {
        console.log("[planning-center/callback] Token updated for church", churchId);
      }
    } else {
      const { error: insertError } = await db
        .from("integration_tokens")
        .insert({ ...payload, created_at: now });

      if (insertError) {
        console.error("[planning-center/callback] Token insert failed:", insertError);
      } else {
        console.log("[planning-center/callback] Token inserted for church", churchId);
      }
    }
  } catch (err) {
    console.error("[planning-center/callback] DB error:", err);
  }

  return NextResponse.redirect(settingsUrl);
}
