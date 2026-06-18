import { NextResponse } from "next/server";

import { getServiceClient, isRole, resolveCaller } from "@/lib/server/membership";

// Admin changes a staff member's role within their own church.
// Guards: tenant scope (target must be in caller's church) + never demote the
// last remaining admin (a church must always keep at least one admin).
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
    return NextResponse.json({ success: false, error: "Only an admin can change roles." }, { status: 403 });
  }

  let targetUserId: string | undefined;
  let role: string;
  try {
    const body = (await request.json()) as { target_user_id?: string; role?: string };
    targetUserId = body.target_user_id?.trim();
    role = (body.role ?? "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: "target_user_id is required." }, { status: 400 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ success: false, error: "Role must be admin, pastor, or viewer." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  // Target must be a member of the caller's church (tenant scope).
  const { data: targetRows, error: targetError } = await service
    .from("church_users")
    .select("user_id, role")
    .eq("church_id", caller.churchId)
    .eq("user_id", targetUserId)
    .limit(1);

  if (targetError) {
    console.error("[staff/update-role] Target lookup failed:", targetError);
    return NextResponse.json({ success: false, error: "Could not load the staff member." }, { status: 500 });
  }
  const target = (targetRows as Array<{ user_id: string; role: string }> | null)?.[0];
  if (!target) {
    return NextResponse.json({ success: false, error: "That person is not a staff member of your church." }, { status: 404 });
  }

  if (target.role === role) {
    return NextResponse.json({ success: true, role });
  }

  // Last-admin guard: block demoting the only admin.
  if (target.role === "admin" && role !== "admin") {
    const { count, error: countError } = await service
      .from("church_users")
      .select("user_id", { count: "exact", head: true })
      .eq("church_id", caller.churchId)
      .eq("role", "admin");
    if (countError) {
      console.error("[staff/update-role] Admin count failed:", countError);
      return NextResponse.json({ success: false, error: "Could not verify admin count." }, { status: 500 });
    }
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: "You can't change the role of the only admin. Promote another admin first." },
        { status: 409 },
      );
    }
  }

  const { error: updateError } = await service
    .from("church_users")
    .update({ role } as never)
    .eq("church_id", caller.churchId)
    .eq("user_id", targetUserId);

  if (updateError) {
    console.error("[staff/update-role] Update failed:", updateError);
    return NextResponse.json({ success: false, error: "Could not update the role." }, { status: 500 });
  }

  return NextResponse.json({ success: true, role });
}
