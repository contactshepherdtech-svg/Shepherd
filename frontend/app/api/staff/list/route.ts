import { NextResponse } from "next/server";

import { getServiceClient, resolveCaller } from "@/lib/server/membership";

// Lists the caller's church team (staff + pending invitations). Readable by any
// member of the church; the page gates management actions on caller_role. Emails
// live in auth.users (not reachable via RLS), so this resolves them with the
// service client. Always scoped to the caller's own church_id.
export async function GET(request: Request): Promise<NextResponse> {
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
  if (!caller.churchId) {
    return NextResponse.json({ success: false, error: "No active church found for this user." }, { status: 403 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data: memberRows, error: membersError } = await service
    .from("church_users")
    .select("user_id, role, created_at")
    .eq("church_id", caller.churchId)
    .order("created_at", { ascending: true });

  if (membersError) {
    console.error("[staff/list] Members lookup failed:", membersError);
    return NextResponse.json({ success: false, error: "Could not load staff." }, { status: 500 });
  }

  const rows = (memberRows as Array<{ user_id: string; role: string; created_at: string | null }> | null) ?? [];

  const staff = await Promise.all(
    rows.map(async (row) => {
      let email: string | null = null;
      try {
        const { data } = await service.auth.admin.getUserById(row.user_id);
        email = data.user?.email ?? null;
      } catch (err) {
        console.error("[staff/list] getUserById failed for", row.user_id, err);
      }
      return {
        user_id: row.user_id,
        email,
        role: row.role,
        created_at: row.created_at,
        is_self: row.user_id === caller!.userId,
      };
    }),
  );

  const { data: inviteRows, error: invitesError } = await service
    .from("church_invitations")
    .select("id, email, role, token, created_at, expires_at")
    .eq("church_id", caller.churchId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (invitesError) {
    console.error("[staff/list] Invitations lookup failed:", invitesError);
    return NextResponse.json({ success: false, error: "Could not load invitations." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    caller_role: caller.role,
    caller_user_id: caller.userId,
    staff,
    invitations: inviteRows ?? [],
  });
}
