import { createHmac, timingSafeEqual } from "crypto";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const OAUTH_STATE_MAX_AGE_MS = 30 * 60 * 1000;

type GmailOAuthState = {
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

function verifyState(state: string | null, secret: string): GmailOAuthState | null {
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
    const decoded = JSON.parse(decodeBase64Url(payload)) as GmailOAuthState;
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

export async function GET(request: Request): Promise<NextResponse> {
  console.log("[gmail/callback] Callback route hit");

  const origin = new URL(request.url).origin;
  const settingsUrl = `${origin}/settings`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    console.error("[gmail/callback] OAuth error from Google:", oauthError);
    return errorPage(
      "Gmail OAuth Error",
      `Google returned an error: <strong>${oauthError}</strong>. Please try connecting again.`,
    );
  }

  if (!code) {
    return errorPage("Missing Authorization Code", "No authorization code was received from Google. Please try connecting again.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return errorPage("Server Configuration Error", "Gmail OAuth credentials are not configured.", 500);
  }

  const verifiedState = verifyState(state, process.env.OAUTH_STATE_SECRET ?? clientSecret);
  if (!verifiedState) {
    console.error("[gmail/callback] Invalid or expired OAuth state");
    return errorPage(
      "Session Expired",
      "The OAuth session state was invalid or expired. Please return to Settings and try connecting again.",
      401,
    );
  }

  console.log("[gmail/callback] Verified state for user_id:", verifiedState.user_id, "church_id:", verifiedState.church_id);

  const db = getSupabase();
  if (!db) {
    return errorPage("Server Configuration Error", "Database service credentials are not configured.", 500);
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
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[gmail/callback] Token exchange failed:", response.status, text.slice(0, 300));
      return errorPage("Token Exchange Failed", `Google returned HTTP ${response.status}. Please try connecting again.`);
    }

    tokenData = (await response.json()) as TokenResponse;
  } catch (err) {
    console.error("[gmail/callback] Token exchange error:", err);
    return errorPage("Token Exchange Error", "An unexpected error occurred while contacting Google. Please try connecting again.");
  }

  let connectedEmail: string | null = null;
  try {
    const userinfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userinfoResponse.ok) {
      const userinfo = (await userinfoResponse.json()) as { email?: string };
      connectedEmail = userinfo.email ?? null;
    }
  } catch (err) {
    console.warn("[gmail/callback] Could not fetch userinfo:", err);
  }

  console.log("[gmail/callback] Connected Gmail email:", connectedEmail);

  try {
    const churchId = verifiedState.church_id;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;
    const now = new Date().toISOString();

    const { data: existing } = await db
      .from("integration_tokens")
      .select("*")
      .eq("church_id", churchId)
      .eq("provider", "gmail")
      .limit(1);

    const existingRow = existing?.[0] as { id: number; refresh_token: string | null } | undefined;

    const payload = {
      church_id: churchId,
      provider: "gmail",
      access_token: tokenData.access_token,
      // Google only returns a refresh_token on the first grant; on reconnects it
      // is often omitted. Never clobber a previously stored one with null.
      refresh_token: tokenData.refresh_token ?? existingRow?.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tokenData.scope ?? null,
      connection_status: "connected",
      connected_email: connectedEmail,
      updated_at: now,
    };

    if (existingRow) {
      const { error: updateError } = await db
        .from("integration_tokens")
        .update(payload as never)
        .eq("id", existingRow.id);

      if (updateError) {
        console.error("[gmail/callback] Supabase update failed:", updateError);
        return errorPage("Database Write Failed", `Could not update the Gmail token: ${updateError.message}`, 500);
      }
      console.log("[gmail/callback] Updated Gmail token for church_id:", churchId);
    } else {
      const { error: insertError } = await db
        .from("integration_tokens")
        .insert({ ...payload, created_at: now } as never);

      if (insertError) {
        console.error("[gmail/callback] Supabase insert failed:", insertError);
        return errorPage("Database Write Failed", `Could not save the Gmail token: ${insertError.message}`, 500);
      }
      console.log("[gmail/callback] Inserted Gmail token for church_id:", churchId);
    }
  } catch (err) {
    console.error("[gmail/callback] DB error:", err);
    return errorPage("Database Error", "An unexpected error occurred while saving the Gmail connection.", 500);
  }

  return NextResponse.redirect(settingsUrl);
}
