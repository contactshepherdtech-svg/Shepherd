import { NextResponse } from "next/server";

import { getServiceClient } from "@/lib/server/membership";

// Public lookup (the token is the bearer credential) that powers the
// /invite/[token] landing page BEFORE the recipient has signed in. Returns only
// non-sensitive display data — church name, role, and validity — never the full
// invited email or any church data. Email-match is still enforced later at accept.
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ success: false, error: "Missing invite token." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const { data, error } = await service
    .from("church_invitations")
    .select("role, status, expires_at, churches(name)")
    .eq("token", token)
    .limit(1);

  if (error) {
    console.error("[staff/invite-info] Lookup failed:", error);
    return NextResponse.json({ success: false, error: "Could not load this invitation." }, { status: 500 });
  }

  const row = (data as Array<{
    role: string;
    status: string;
    expires_at: string | null;
    churches: { name: string | null } | null;
  }> | null)?.[0];

  if (!row) {
    return NextResponse.json({ success: false, error: "This invitation link is not valid." }, { status: 404 });
  }

  const expired = row.expires_at ? new Date(row.expires_at) < new Date() : false;
  // Acceptable only if still pending and unexpired; the page uses this to decide
  // whether to show Accept or an "expired/already used" message.
  const valid = row.status === "pending" && !expired;

  return NextResponse.json({
    success: true,
    role: row.role,
    status: row.status,
    expired,
    valid,
    church_name: row.churches?.name?.trim() || "a church",
  });
}
