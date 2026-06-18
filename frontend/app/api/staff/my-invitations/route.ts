import { NextResponse } from "next/server";

import { getServiceClient, resolveCaller } from "@/lib/server/membership";

// Returns the caller's pending, non-expired invitations matched by their auth
// email. Must run with the service client: an invitee has no church_users row
// yet, so the church-scoped RLS SELECT policy on church_invitations cannot serve
// it. `already_in_church` lets the banner explain why Accept may be blocked
// (one church per user, migration 010).
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
  if (!caller.email) {
    return NextResponse.json({ success: true, invitations: [], already_in_church: caller.churchId != null });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data, error } = await service
    .from("church_invitations")
    .select("id, role, token, expires_at, church_id, churches(name)")
    .eq("email", caller.email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff/my-invitations] Lookup failed:", error);
    return NextResponse.json({ success: false, error: "Could not load your invitations." }, { status: 500 });
  }

  const invitations = (data as Array<{
    id: number;
    role: string;
    token: string;
    expires_at: string | null;
    church_id: number;
    churches: { name: string | null } | null;
  }> | null ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    token: row.token,
    expires_at: row.expires_at,
    church_id: row.church_id,
    church_name: row.churches?.name?.trim() || "a church",
  }));

  return NextResponse.json({
    success: true,
    invitations,
    already_in_church: caller.churchId != null,
  });
}
