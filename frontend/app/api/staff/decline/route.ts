import { NextResponse } from "next/server";

import { getServiceClient, normalizeEmail, resolveCaller } from "@/lib/server/membership";

// Invitee declines an invitation addressed to them. Distinct from admin "revoke"
// so the admin UI can tell the two apart. Requires status='declined' (migration 015).
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
  if (!caller.email) {
    return NextResponse.json({ success: false, error: "Your account has no email address." }, { status: 400 });
  }

  let token: string | undefined;
  let invitationId: number | undefined;
  try {
    const body = (await request.json()) as { token?: string; invitation_id?: number };
    token = body.token?.trim();
    invitationId = body.invitation_id;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!token && !invitationId) {
    return NextResponse.json({ success: false, error: "An invitation token is required." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const lookup = service.from("church_invitations").select("id, email, status");
  const { data, error } = token
    ? await lookup.eq("token", token).limit(1)
    : await lookup.eq("id", invitationId!).limit(1);

  if (error) {
    console.error("[staff/decline] Lookup failed:", error);
    return NextResponse.json({ success: false, error: "Could not load this invitation." }, { status: 500 });
  }

  const invite = (data as Array<{ id: number; email: string; status: string }> | null)?.[0];
  if (!invite) {
    return NextResponse.json({ success: false, error: "This invitation is not valid." }, { status: 404 });
  }

  // Only the addressed person may decline.
  if (normalizeEmail(caller.email) !== invite.email) {
    return NextResponse.json({ success: false, error: "This invitation was issued for a different email address." }, { status: 403 });
  }

  // Idempotent: already resolved → report success without changing it.
  if (invite.status !== "pending") {
    return NextResponse.json({ success: true, status: invite.status });
  }

  const { error: updateError } = await service
    .from("church_invitations")
    .update({ status: "declined" } as never)
    .eq("id", invite.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("[staff/decline] Update failed:", updateError);
    return NextResponse.json({ success: false, error: "Could not decline the invitation." }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: "declined" });
}
