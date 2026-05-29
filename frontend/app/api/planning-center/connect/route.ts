import { NextResponse } from "next/server";

const PLANNING_CENTER_AUTH_URL = "https://api.planningcenteronline.com/oauth/authorize";

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.PLANNING_CENTER_CLIENT_ID;
  const redirectUri = process.env.PLANNING_CENTER_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Planning Center OAuth is not configured. Set PLANNING_CENTER_CLIENT_ID and PLANNING_CENTER_REDIRECT_URI." },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "people check_ins",
  });

  return NextResponse.redirect(`${PLANNING_CENTER_AUTH_URL}?${params.toString()}`);
}
