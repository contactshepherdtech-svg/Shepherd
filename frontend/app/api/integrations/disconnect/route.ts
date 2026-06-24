import { NextResponse } from "next/server";

import { getServiceClient, resolveCaller } from "@/lib/server/membership";

const PROVIDERS = ["gmail", "planning_center"] as const;
type Provider = (typeof PROVIDERS)[number];

// Admin-only, service-role. SOFT-disconnects an integration: nulls the credential
// + identity columns and clears the sync fields, leaving the row with
// connection_status='disconnected'. The OAuth callbacks upsert by (church_id,
// provider), so reconnect (incl. a different account) cleanly re-populates this
// same row. NON-DESTRUCTIVE: already-synced members/attendance/risk/outreach data
// is intentionally left untouched (an opt-in data clear is future scope).
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
  // Disconnecting affects the whole church — admins only, enforced server-side.
  if (caller.role !== "admin" || !caller.churchId) {
    return NextResponse.json({ success: false, error: "Only an admin can disconnect integrations." }, { status: 403 });
  }

  let provider: string;
  try {
    const body = (await request.json()) as { provider?: string };
    provider = (body.provider ?? "").trim();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }
  if (!PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json(
      { success: false, error: "provider must be 'gmail' or 'planning_center'." },
      { status: 400 },
    );
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ success: false, error: "Server configuration error." }, { status: 500 });
  }

  const { error } = await service
    .from("integration_tokens")
    .update({
      access_token: null,
      refresh_token: null,
      expires_at: null,
      scope: null,
      connected_email: null,
      connection_status: "disconnected",
      sync_status: null,
      sync_started_at: null,
      sync_error: null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("church_id", caller.churchId)
    .eq("provider", provider);

  // Idempotent: if no row matches (never connected / already disconnected), the
  // update affects zero rows without error — still a success from the caller's view.
  if (error) {
    console.error("[integrations/disconnect] Update failed:", error);
    return NextResponse.json({ success: false, error: "Could not disconnect the integration." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
