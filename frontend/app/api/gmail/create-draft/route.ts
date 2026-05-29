import fs from "fs";
import path from "path";

import { NextResponse } from "next/server";

// Project root is one level above the Next.js app
const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const CREDENTIALS_PATH = path.join(PROJECT_ROOT, "credentials.json");
const TOKEN_PATH = path.join(PROJECT_ROOT, "gmail_token.json");

type GmailToken = {
  token: string;
  refresh_token: string;
  token_uri: string;
  client_id: string;
  client_secret: string;
  scopes: string[];
  expiry: string;
};

type CredentialsFile = {
  installed: {
    client_id: string;
    client_secret: string;
    token_uri: string;
  };
};

function readTokenFile(): GmailToken {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error("gmail_token.json not found. Authenticate Gmail in the Python app first.");
  }
  return JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8")) as GmailToken;
}

function readCredentials(): { clientId: string; clientSecret: string } {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error("credentials.json not found.");
  }
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8")) as CredentialsFile;
  return {
    clientId: creds.installed.client_id,
    clientSecret: creds.installed.client_secret,
  };
}

async function refreshAccessToken(token: GmailToken, clientId: string, clientSecret: string): Promise<string> {
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
    throw new Error(`Token refresh failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const updated: GmailToken = { ...token, token: data.access_token, expiry: newExpiry };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2), "utf-8");

  return data.access_token;
}

async function getValidAccessToken(): Promise<string> {
  const token = readTokenFile();
  const { clientId, clientSecret } = readCredentials();

  const expiry = new Date(token.expiry);
  const isExpired = expiry.getTime() - Date.now() < 60_000; // treat as expired if < 1 minute left

  if (isExpired) {
    console.log("[gmail] Access token expired — refreshing.");
    return refreshAccessToken(token, clientId, clientSecret);
  }

  return token.token;
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

export async function POST(request: Request): Promise<NextResponse> {
  let to: string | undefined;
  let subject: string | undefined;
  let body: string | undefined;

  try {
    const parsed = (await request.json()) as { to?: string; subject?: string; body?: string };
    to = parsed.to;
    subject = parsed.subject;
    body = parsed.body;
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
    accessToken = await getValidAccessToken();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gmail] Auth error:", message);
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
      console.error("[gmail] Draft creation failed:", response.status, text.slice(0, 300));
      return NextResponse.json(
        { success: false, error: `Gmail API error ${response.status}.` },
        { status: 500 },
      );
    }

    const draft = (await response.json()) as { id: string };
    console.log("[gmail] Draft created:", draft.id);
    return NextResponse.json({ success: true, draftId: draft.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gmail] Fetch error:", message);
    return NextResponse.json({ success: false, error: "Could not reach Gmail API." }, { status: 500 });
  }
}
