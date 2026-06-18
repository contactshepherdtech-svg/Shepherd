import { NextResponse } from "next/server";

import { getServiceClient, resolveCaller } from "@/lib/server/membership";

// Admin revokes a pending invitation in THEIR OWN church. Scoped to the caller's
// church_id so an admin can never touch another church's invitations.
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
    return NextResponse.json({ success: false, error: "Only an admin can revoke invitations." }, { status: 403 });
  }

  let invitationId: number | undefined;
  try {
    const body = (await request.json()) as { invitation_id?: number };
    invitationId = body.invitation_id;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!Number.isInteger(invitationId)) {
    return NextResponse.json({ success: false, error: "invitation_id is required." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data, error } = await service
    .from("church_invitations")
    .select("id, church_id, status")
    .eq("id", invitationId!)
    .limit(1);

  if (error) {
    console.error("[staff/revoke] Lookup failed:", error);
    return NextResponse.json({ success: false, error: "Could not load the invitation." }, { status: 500 });
  }

  const invite = (data as Array<{ id: number; church_id: number; status: string }> | null)?.[0];
  // Tenant scope: must belong to the caller's church. Don't reveal cross-church rows.
  if (!invite || invite.church_id !== caller.churchId) {
    return NextResponse.json({ success: false, error: "Invitation not found." }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ success: true, status: invite.status });
  }

  const { error: updateError } = await service
    .from("church_invitations")
    .update({ status: "revoked" } as never)
    .eq("id", invite.id)
    .eq("church_id", caller.churchId)
    .eq("status", "pending");

  if (updateError) {
    console.error("[staff/revoke] Update failed:", updateError);
    return NextResponse.json({ success: false, error: "Could not revoke the invitation." }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: "revoked" });
}
