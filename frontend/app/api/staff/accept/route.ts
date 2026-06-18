import { NextResponse } from "next/server";

import { getServiceClient, normalizeEmail, resolveCaller } from "@/lib/server/membership";

type InviteRow = {
  id: number;
  church_id: number;
  email: string;
  role: string;
  status: string;
  expires_at: string | null;
};

// Accept a pending invitation. Enforces, in order:
//   1. email-match  — signed-in user's email must equal the invited email
//   2. expiry       — past expires_at is rejected
//   3. single-use   — only status='pending' is acceptable; once accepted the
//                     token can never be reused (status flips + claimed atomically)
//   4. one-church   — migration 010: a user already in a church cannot join another
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

  const lookup = service.from("church_invitations").select("id, church_id, email, role, status, expires_at");
  const { data, error } = token
    ? await lookup.eq("token", token).limit(1)
    : await lookup.eq("id", invitationId!).limit(1);

  if (error) {
    console.error("[staff/accept] Lookup failed:", error);
    return NextResponse.json({ success: false, error: "Could not load this invitation." }, { status: 500 });
  }

  const invite = (data as InviteRow[] | null)?.[0];
  if (!invite) {
    return NextResponse.json({ success: false, error: "This invitation is not valid." }, { status: 404 });
  }

  // (1) email-match — a leaked/forwarded link cannot let a different person in.
  if (normalizeEmail(caller.email) !== invite.email) {
    return NextResponse.json(
      { success: false, error: "This invitation was issued for a different email address." },
      { status: 403 },
    );
  }

  // (2) expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: "This invitation has expired." }, { status: 410 });
  }

  // (3) single-use — anything other than pending is spent.
  if (invite.status !== "pending") {
    // If THIS user already joined this church via this invite, treat as success.
    if (invite.status === "accepted" && caller.churchId === invite.church_id) {
      return NextResponse.json({ success: true, church_id: invite.church_id, already_member: true });
    }
    return NextResponse.json({ success: false, error: "This invitation is no longer available." }, { status: 409 });
  }

  // (4) one-church rule (migration 010).
  if (caller.churchId != null) {
    if (caller.churchId === invite.church_id) {
      // Already a member of the target church — mark accepted, no-op join.
      await service
        .from("church_invitations")
        .update({ status: "accepted", invited_user_id: caller.userId, accepted_at: new Date().toISOString() } as never)
        .eq("id", invite.id)
        .eq("status", "pending");
      return NextResponse.json({ success: true, church_id: invite.church_id, already_member: true });
    }
    return NextResponse.json(
      { success: false, error: "You already belong to a church. Leave it before joining another." },
      { status: 409 },
    );
  }

  // Insert the membership. The unique index on church_users(user_id) (migration
  // 010) is the atomic backstop against races and double-joins.
  const { error: insertError } = await service
    .from("church_users")
    .insert({ user_id: caller.userId, church_id: invite.church_id, role: invite.role } as never);

  if (insertError) {
    if (insertError.code === "23505") {
      // A concurrent request already created a membership for this user. Resolve
      // it: same church → success; different church → one-church violation.
      const { data: nowRows } = await service
        .from("church_users")
        .select("church_id")
        .eq("user_id", caller.userId)
        .limit(1);
      const nowChurch = (nowRows as Array<{ church_id: number }> | null)?.[0]?.church_id;
      if (nowChurch === invite.church_id) {
        return NextResponse.json({ success: true, church_id: invite.church_id, already_member: true });
      }
      return NextResponse.json(
        { success: false, error: "You already belong to a church. Leave it before joining another." },
        { status: 409 },
      );
    }
    console.error("[staff/accept] Membership insert failed:", insertError);
    return NextResponse.json({ success: false, error: "Could not join the church." }, { status: 500 });
  }

  // Claim the invite atomically (only if still pending), so the token is single-use.
  await service
    .from("church_invitations")
    .update({ status: "accepted", invited_user_id: caller.userId, accepted_at: new Date().toISOString() } as never)
    .eq("id", invite.id)
    .eq("status", "pending");

  return NextResponse.json({ success: true, church_id: invite.church_id, role: invite.role });
}
