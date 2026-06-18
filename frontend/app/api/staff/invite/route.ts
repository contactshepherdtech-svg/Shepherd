import { NextResponse } from "next/server";

import {
  getOrigin,
  getServiceClient,
  isRole,
  normalizeEmail,
  resolveCaller,
} from "@/lib/server/membership";

// Admin creates (or refreshes) a pending invitation for their own church and gets
// back a shareable link carrying the token. No email is sent — delivery is the
// admin's choice (in-app banner for existing accounts, copied link for new users).
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
    return NextResponse.json({ success: false, error: "Only an admin can invite staff." }, { status: 403 });
  }

  let email: string;
  let role: string;
  try {
    const body = (await request.json()) as { email?: string; role?: string };
    email = normalizeEmail(body.email ?? "");
    role = (body.role ?? "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "A valid email address is required." }, { status: 400 });
  }
  if (!isRole(role)) {
    return NextResponse.json({ success: false, error: "Role must be admin, pastor, or viewer." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  // Reuse an existing pending invite for this church+email (the partial unique
  // index guarantees at most one), updating the role if it changed. Otherwise
  // create a fresh one. Keeps the action idempotent.
  const { data: existingRows, error: existingError } = await service
    .from("church_invitations")
    .select("*")
    .eq("church_id", caller.churchId)
    .eq("email", email)
    .eq("status", "pending")
    .limit(1);

  if (existingError) {
    console.error("[staff/invite] Existing invite lookup failed:", existingError);
    return NextResponse.json({ success: false, error: "Could not check existing invitations." }, { status: 500 });
  }

  const existing = (existingRows as Array<{ id: number; role: string; token: string }> | null)?.[0];
  let token: string;

  if (existing) {
    token = existing.token;
    if (existing.role !== role) {
      const { error: updErr } = await service
        .from("church_invitations")
        .update({ role } as never)
        .eq("id", existing.id);
      if (updErr) {
        console.error("[staff/invite] Role update failed:", updErr);
        return NextResponse.json({ success: false, error: "Could not update the invitation." }, { status: 500 });
      }
    }
  } else {
    const { data: inserted, error: insertError } = await service
      .from("church_invitations")
      .insert({
        church_id: caller.churchId,
        email,
        role,
        invited_by: caller.userId,
      } as never)
      .select("token")
      .single();

    if (insertError || !inserted) {
      console.error("[staff/invite] Insert failed:", insertError);
      return NextResponse.json({ success: false, error: "Could not create the invitation." }, { status: 500 });
    }
    token = (inserted as { token: string }).token;
  }

  return NextResponse.json({
    success: true,
    email,
    role,
    invite_link: `${getOrigin(request)}/invite/${token}`,
  });
}
