import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveAuthenticatedUser(authorization: string): Promise<{ id: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;

  return { id: data.user.id };
}

async function resolveActiveMembership(
  userId: string,
): Promise<{ churchId: number; role: string } | null> {
  const db = getServiceRoleClient();
  if (!db) return null;

  const { data, error } = await db
    .from("church_users")
    .select("church_id, role")
    .eq("user_id", userId)
    .limit(1);

  if (error || !data?.length) return null;

  const row = data[0] as { church_id: number; role: string };
  return Number.isInteger(row.church_id) && row.church_id > 0
    ? { churchId: row.church_id, role: row.role }
    : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  }

  const user = await resolveAuthenticatedUser(authorization);
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  }

  const membership = await resolveActiveMembership(user.id);
  if (!membership) {
    return NextResponse.json({ success: false, error: "No active church found for this user." }, { status: 403 });
  }
  // Pastoral write action — Viewers may read but never mark follow-ups.
  if (membership.role !== "admin" && membership.role !== "pastor") {
    return NextResponse.json(
      { success: false, error: "Your role does not allow marking follow-ups." },
      { status: 403 },
    );
  }
  const churchId = membership.churchId;

  let memberPcoId: string | undefined;
  try {
    const body = (await request.json()) as { member_pco_id?: string };
    memberPcoId = body.member_pco_id?.trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!memberPcoId) {
    return NextResponse.json({ success: false, error: "member_pco_id is required." }, { status: 400 });
  }

  const db = getServiceRoleClient();
  if (!db) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const followedUpAt = new Date().toISOString();
  const { data, error } = await db
    .from("members")
    .update({ last_followup_at: followedUpAt })
    .eq("church_id", churchId)
    .eq("pco_id", memberPcoId)
    .select("pco_id,last_followup_at");

  if (error) {
    console.error("[visitors/mark-followed-up] Update failed:", error);
    return NextResponse.json({ success: false, error: "Could not mark visitor followed up." }, { status: 500 });
  }

  const updated = data?.[0] as { pco_id: string; last_followup_at: string } | undefined;
  if (!updated) {
    return NextResponse.json(
      { success: false, error: "Visitor was not found in the active church." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    member_pco_id: updated.pco_id,
    last_followup_at: updated.last_followup_at,
  });
}
