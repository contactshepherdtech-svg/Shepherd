import { createHmac, timingSafeEqual } from "crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const PLANNING_CENTER_TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";
const OAUTH_STATE_MAX_AGE_MS = 30 * 60 * 1000;

type PlanningCenterState = {
  church_id: number;
  user_id: string;
  issued_at: number;
};

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

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf-8");
}

function verifyState(state: string | null, secret: string): PlanningCenterState | null {
  if (!state) return null;

  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = signState(payload, secret);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as PlanningCenterState;
    if (!Number.isInteger(decoded.church_id) || decoded.church_id <= 0) return null;
    if (!decoded.user_id || typeof decoded.user_id !== "string") return null;
    if (!Number.isFinite(decoded.issued_at)) return null;
    if (Date.now() - decoded.issued_at > OAUTH_STATE_MAX_AGE_MS) return null;
    return decoded;
  } catch {
    return null;
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function errorPage(title: string, message: string, status = 400): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
    h1 { font-size: 1.25rem; color: #b91c1c; margin-bottom: 8px; }
    p { font-size: 0.95rem; color: #555; line-height: 1.6; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
  <p><a href="/settings">Return to Settings</a></p>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function resolveChurchIdForUser(
  db: NonNullable<ReturnType<typeof getSupabase>>,
  userId: string,
  stateChurchId: number,
): Promise<number | null> {
  const { data, error } = await db
    .from("church_users")
    .select("church_id")
    .eq("user_id", userId)
    .eq("church_id", stateChurchId)
    .limit(1);

  if (error) {
    console.error("[planning-center/callback] Church membership lookup failed:", error);
    return null;
  }

  const rows = data as Array<{ church_id: number }> | null;
  const churchId = rows?.[0]?.church_id;
  if (!Number.isInteger(churchId) || churchId == null || churchId <= 0) {
    return null;
  }

  return churchId;
}

export async function GET(request: Request): Promise<NextResponse> {
  console.log("[planning-center/callback] Callback route hit");

  const origin = new URL(request.url).origin;
  const settingsUrl = `${origin}/settings`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  console.log("[planning-center/callback] Received code:", !!code);

  if (oauthError) {
    console.error("[planning-center/callback] OAuth error from Planning Center:", oauthError);
    return errorPage(
      "Planning Center OAuth Error",
      `Planning Center returned an error: <strong>${oauthError}</strong>. Please try connecting again.`,
    );
  }

  if (!code) {
    console.error("[planning-center/callback] Missing authorization code");
    return errorPage(
      "Missing Authorization Code",
      "No authorization code was received from Planning Center. Please try connecting again.",
    );
  }

  const clientId = process.env.PLANNING_CENTER_CLIENT_ID;
  const clientSecret = process.env.PLANNING_CENTER_CLIENT_SECRET;
  const redirectUri = process.env.PLANNING_CENTER_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[planning-center/callback] Missing Planning Center env vars.");
    return errorPage(
      "Server Configuration Error",
      "Planning Center OAuth credentials are not configured on the server. Contact your administrator.",
      500,
    );
  }

  const verifiedState = verifyState(state, process.env.OAUTH_STATE_SECRET ?? clientSecret);
  if (!verifiedState) {
    console.error("[planning-center/callback] Invalid or expired OAuth state");
    return errorPage(
      "No authenticated Shepherd user found during OAuth callback.",
      "The OAuth session state was invalid or expired. Please return to Settings and try connecting again.",
      401,
    );
  }

  console.log("[planning-center/callback] Auth user_id from state:", verifiedState.user_id);

  const db = getSupabase();
  if (!db) {
    console.error("[planning-center/callback] Supabase not configured.");
    return errorPage(
      "Server Configuration Error",
      "Database connection is not configured. Contact your administrator.",
      500,
    );
  }

  const churchId = await resolveChurchIdForUser(db, verifiedState.user_id, verifiedState.church_id);
  console.log("[planning-center/callback] church_id resolved from church_users:", churchId);

  if (!churchId) {
    console.error("[planning-center/callback] No church_users row found for user", verifiedState.user_id, "church", verifiedState.church_id);
    return errorPage(
      "No church workspace found for this user.",
      "Your account is not associated with a church workspace. Please contact your church administrator.",
      403,
    );
  }

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

    console.log("[planning-center/callback] Token exchange response status:", response.status);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[planning-center/callback] Token exchange failed:", response.status, text.slice(0, 300));
      return errorPage(
        "Token Exchange Failed",
        `Planning Center returned HTTP ${response.status} when exchanging the authorization code. Please try connecting again.`,
      );
    }

    tokenData = (await response.json()) as TokenResponse;
  } catch (err) {
    console.error("[planning-center/callback] Token exchange error:", err);
    return errorPage(
      "Token Exchange Error",
      "An unexpected error occurred while contacting Planning Center. Please try connecting again.",
    );
  }

  try {
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

    const { data: existing } = await db
      .from("integration_tokens")
      .select("*")
      .eq("church_id", churchId)
      .eq("provider", "planning_center")
      .limit(1);

    if (existing && existing.length > 0) {
      const { error: updateError } = await db
        .from("integration_tokens")
        .update(payload)
        .eq("id", existing[0].id);

      if (updateError) {
        console.error("[planning-center/callback] Supabase update result — error:", updateError);
        return errorPage(
          "Database Write Failed",
          `Could not update the integration token: ${updateError.message}`,
          500,
        );
      } else {
        console.log("[planning-center/callback] Supabase update result — success, church_id:", churchId);
      }
    } else {
      const { error: insertError } = await db
        .from("integration_tokens")
        .insert({ ...payload, created_at: now });

      if (insertError) {
        console.error("[planning-center/callback] Supabase insert result — error:", insertError);
        return errorPage(
          "Database Write Failed",
          `Could not save the integration token: ${insertError.message}`,
          500,
        );
      } else {
        console.log("[planning-center/callback] Supabase insert result — success, church_id:", churchId);
      }
    }
  } catch (err) {
    console.error("[planning-center/callback] DB error:", err);
    return errorPage(
      "Database Error",
      "An unexpected error occurred while saving the connection. Please try connecting again.",
      500,
    );
  }

  return NextResponse.redirect(settingsUrl);
}
