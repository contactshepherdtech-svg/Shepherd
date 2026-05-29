import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

// Root of the monorepo — one level above the Next.js app
const PROJECT_ROOT = path.resolve(process.cwd(), "..");

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveActiveChurchId(request: Request): Promise<number> {
  const db = getSupabase();
  if (!db) {
    throw new Error("Supabase is not configured.");
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw new Error("Authentication is required.");
  }

  const authedDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    },
  );

  const { data: userData, error: userError } = await authedDb.auth.getUser();
  if (userError || !userData.user) {
    console.error("[sync] Auth lookup failed:", userError);
    throw new Error("Authentication is required.");
  }

  const body = (await request.json().catch(() => ({}))) as { church_id?: number };
  const requestedChurchId = Number(body.church_id);

  let churchUserQuery = authedDb
    .from("church_users")
    .select("church_id")
    .eq("user_id", userData.user.id)
    .limit(1);

  if (Number.isInteger(requestedChurchId) && requestedChurchId > 0) {
    churchUserQuery = churchUserQuery.eq("church_id", requestedChurchId);
  }

  const { data: churchUsers, error: churchUserError } = await churchUserQuery;
  if (churchUserError) {
    console.error("[sync] Church membership lookup failed:", churchUserError);
    throw new Error("Could not verify active church.");
  }

  const rows = churchUsers as Array<{ church_id: number }> | null;
  const churchId = rows?.[0]?.church_id;
  if (!Number.isInteger(churchId) || churchId == null || churchId <= 0) {
    throw new Error("No active church found for this user.");
  }

  return churchId;
}

async function runPython(module: string, churchId: number): Promise<void> {
  const { stdout, stderr } = await execFileAsync("python", ["-m", module], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      SHEPHERD_ACTIVE_CHURCH_ID: String(churchId),
    },
  });
  if (stdout) console.log(`[sync] ${module} stdout:`, stdout.trim());
  if (stderr) console.warn(`[sync] ${module} stderr:`, stderr.trim());
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const churchId = await resolveActiveChurchId(request);
    console.log(`[sync] Starting sync for church_id=${churchId} — data.ingest then scoring.save_risk`);

    await runPython("data.ingest", churchId);
    console.log("[sync] data.ingest complete");

    await runPython("scoring.save_risk", churchId);
    console.log("[sync] scoring.save_risk complete");

    return NextResponse.json({ success: true, church_id: churchId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] Sync failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
