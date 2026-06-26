import { NextResponse } from "next/server";

import { getServiceClient, resolveCaller } from "@/lib/server/membership";

// Admin removes a staff member from their own church (deletes the church_users
// link; the auth account itself is untouched). Guards: tenant scope + never
// remove the last remaining admin. A removed user becomes church-less and will
// be routed to onboarding on next login (acceptable for MVP).
export async function POST(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get("authorization");

  let caller;
  try {
    caller = await resolveCaller(authorization);
  } catch {
    return NextResponse.json({ success: false, error: "Could not verify your account." }, { status: 500 });
  }
  if (!caller) {
    return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
  }
  if (caller.role !== "admin" || !caller.churchId) {
    return NextResponse.json({ success: false, error: "Only an admin can remove staff." }, { status: 403 });
  }

  let targetUserId: string | undefined;
  try {
    const body = (await request.json()) as { target_user_id?: string };
    targetUserId = body.target_user_id?.trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: "target_user_id is required." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data: targetRows, error: targetError } = await service
    .from("church_users")
    .select("user_id, role")
    .eq("church_id", caller.churchId)
    .eq("user_id", targetUserId)
    .limit(1);

  if (targetError) {
    console.error("[staff/remove] Target lookup failed:", targetError);
    return NextResponse.json({ success: false, error: "Could not load the staff member." }, { status: 500 });
  }
  const target = (targetRows as Array<{ user_id: string; role: string }> | null)?.[0];
  if (!target) {
    return NextResponse.json({ success: false, error: "That person is not a staff member of your church." }, { status: 404 });
  }

  // Last-admin guard.
  if (target.role === "admin") {
    const { count, error: countError } = await service
      .from("church_users")
      .select("user_id", { count: "exact", head: true })
      .eq("church_id", caller.churchId)
      .eq("role", "admin");
    if (countError) {
      console.error("[staff/remove] Admin count failed:", countError);
      return NextResponse.json({ success: false, error: "Could not verify admin count." }, { status: 500 });
    }
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: "You can't remove the only admin. Promote another admin first." },
        { status: 409 },
      );
    }
  }

  const { error: deleteError } = await service
    .from("church_users")
    .delete()
    .eq("church_id", caller.churchId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    console.error("[staff/remove] Delete failed:", deleteError);
    return NextResponse.json({ success: false, error: "Could not remove the staff member." }, { status: 500 });
  }

  // Don't let this person's OPEN assignments silently die — null their owner so
  // they resurface as "Unassigned" on the team board for an admin to re-home.
  // Completed rows keep their owner (the history of who did the follow-up).
  const { error: unassignError } = await service
    .from("assignments")
    .update({ owner_user_id: null, updated_at: new Date().toISOString() } as never)
    .eq("church_id", caller.churchId)
    .eq("owner_user_id", targetUserId)
    .eq("done", false);

  if (unassignError) {
    // The removal itself succeeded; log and continue rather than failing the request.
    console.error("[staff/remove] Failed to unassign open assignments:", unassignError);
  }

  return NextResponse.json({ success: true });
}
