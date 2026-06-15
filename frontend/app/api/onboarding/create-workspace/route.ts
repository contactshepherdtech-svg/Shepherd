import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "@/lib/supabase";

type CreateWorkspaceBody = {
  church_name?: string;
  main_service_frequency?: string;
  watch_missed_services?: number;
  at_risk_missed_services?: number;
  critical_missed_services?: number;
  preferred_followup_style?: string;
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return { url, anonKey, serviceRoleKey };
}

function normalizeBody(body: CreateWorkspaceBody) {
  const churchName = body.church_name?.trim();
  if (!churchName) {
    throw new Error("Church name is required.");
  }

  return {
    church_name: churchName,
    main_service_frequency: body.main_service_frequency?.trim() || "weekly",
    watch_missed_services: Math.max(Number(body.watch_missed_services ?? 2), 0),
    at_risk_missed_services: Math.max(Number(body.at_risk_missed_services ?? 4), 0),
    critical_missed_services: Math.max(Number(body.critical_missed_services ?? 6), 0),
    preferred_followup_style: body.preferred_followup_style?.trim() || "soft and friendly",
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
    const authorization = request.headers.get("authorization");
    if (!authorization) {
      return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
    }

    const authedClient = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData.user) {
      console.error("[onboarding/create-workspace] Auth lookup failed:", userError);
      return NextResponse.json({ success: false, error: "Authentication is required." }, { status: 401 });
    }

    const body = normalizeBody((await request.json().catch(() => ({}))) as CreateWorkspaceBody);
    const serviceClient = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existingChurchUsers, error: existingError } = await serviceClient
      .from("church_users")
      .select("church_id")
      .eq("user_id", userData.user.id)
      .limit(1);

    if (existingError) {
      console.error("[onboarding/create-workspace] Existing church lookup failed:", existingError);
      return NextResponse.json({ success: false, error: "Could not verify workspace state." }, { status: 500 });
    }

    const existingRows = existingChurchUsers as Array<{ church_id: number }> | null;
    if (existingRows?.length) {
      return NextResponse.json({
        success: true,
        existing: true,
        church_id: existingRows[0].church_id,
      });
    }

    const now = new Date().toISOString();
    const { data: church, error: churchError } = await serviceClient
      .from("churches")
      .insert({
        name: body.church_name,
        created_at: now,
        updated_at: now,
      } as never)
      .select("*")
      .single();

    if (churchError || !church) {
      console.error("[onboarding/create-workspace] Church insert failed:", churchError);
      return NextResponse.json({ success: false, error: "Could not create church workspace." }, { status: 500 });
    }
    const churchRow = church as { id: number };

    const { data: churchUser, error: churchUserError } = await serviceClient
      .from("church_users")
      .insert({
        user_id: userData.user.id,
        church_id: churchRow.id,
        role: "admin",
        created_at: now,
      } as never)
      .select("*")
      .single();

    if (churchUserError || !churchUser) {
      // A concurrent request may have already created this user's workspace.
      // The unique index on church_users(user_id) (migration 010) makes the
      // losing insert fail with a Postgres unique violation (23505) instead of
      // creating a duplicate church. Roll back the orphan church we just created
      // and return the workspace that won the race.
      if (churchUserError?.code === "23505") {
        await serviceClient.from("churches").delete().eq("id", churchRow.id);

        const { data: winningRows, error: winningError } = await serviceClient
          .from("church_users")
          .select("church_id")
          .eq("user_id", userData.user.id)
          .limit(1);

        const winningChurchId = (winningRows as Array<{ church_id: number }> | null)?.[0]?.church_id;
        if (winningError || !winningChurchId) {
          console.error("[onboarding/create-workspace] Conflict resolution lookup failed:", winningError);
          return NextResponse.json({ success: false, error: "Could not resolve existing workspace." }, { status: 500 });
        }

        return NextResponse.json({ success: true, existing: true, church_id: winningChurchId });
      }

      console.error("[onboarding/create-workspace] Church user insert failed:", churchUserError);
      await serviceClient.from("churches").delete().eq("id", churchRow.id);
      return NextResponse.json({ success: false, error: "Could not link user to workspace." }, { status: 500 });
    }
    const churchUserRow = churchUser as { id: number };

    const { data: settings, error: settingsError } = await serviceClient
      .from("church_settings")
      .insert({
        church_id: churchRow.id,
        church_name: body.church_name,
        main_service_frequency: body.main_service_frequency,
        watch_missed_services: body.watch_missed_services,
        at_risk_missed_services: body.at_risk_missed_services,
        critical_missed_services: body.critical_missed_services,
        preferred_followup_style: body.preferred_followup_style,
        created_at: now,
        updated_at: now,
      } as never)
      .select("*")
      .single();

    if (settingsError || !settings) {
      console.error("[onboarding/create-workspace] Settings insert failed:", settingsError);
      await serviceClient.from("church_users").delete().eq("id", churchUserRow.id);
      await serviceClient.from("churches").delete().eq("id", churchRow.id);
      return NextResponse.json({ success: false, error: "Could not create workspace settings." }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        church_id: churchRow.id,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create workspace.";
    console.error("[onboarding/create-workspace] Failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
