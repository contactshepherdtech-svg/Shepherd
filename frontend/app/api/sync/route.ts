import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const PLANNING_CENTER_BASE_URL = "https://api.planningcenteronline.com";
const PLANNING_CENTER_TOKEN_URL = "https://api.planningcenteronline.com/oauth/token";
const PCO_PAGE_SIZE = 100;
const DEFAULT_MAX_PCO_PAGES = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const VISITOR_STATUS_FIRST_TIME = "first_time";
const VISITOR_STATUS_RETURNED = "returned";
const VISITOR_STATUS_CONVERTED = "converted";
const VISITOR_STATUS_NONE = "none";

const MEMBER_LIFECYCLE_NEW_NO_ATTENDANCE = "new_no_attendance";
const MEMBER_LIFECYCLE_FIRST_TIME_VISITOR = "first_time_visitor";
const MEMBER_LIFECYCLE_RETURNED_VISITOR = "returned_visitor";
const MEMBER_LIFECYCLE_ESTABLISHED_MEMBER = "established_member";
const MEMBER_LIFECYCLE_NEEDS_FIRST_FOLLOWUP = "needs_first_followup";

type DbClient = SupabaseClient<Database>;
type SupabaseErrorLike = { message?: string; details?: string | null; hint?: string | null; code?: string | null };

type SyncRequestBody = {
  church_id?: number;
};

type PlanningCenterToken = Database["public"]["Tables"]["integration_tokens"]["Row"];
type MemberInsert = Database["public"]["Tables"]["members"]["Insert"];
type MemberUpdate = Database["public"]["Tables"]["members"]["Update"];
type AttendanceInsert = Database["public"]["Tables"]["attendance"]["Insert"];
type RiskScoreInsert = Database["public"]["Tables"]["risk_scores"]["Insert"];

type PcoResource = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id?: string; type?: string } | null }>;
};

type PcoResponse = {
  data?: PcoResource[];
  included?: PcoResource[];
  links?: {
    next?: string | null;
  };
};

type PcoPerson = {
  pco_id: string;
  name: string;
  email: string | null;
  status: string | null;
  pco_created_at: string | null;
};

type PcoCheckin = {
  pco_checkin_id: string;
  member_pco_id: string | null;
  attended_at: string | null;
};

type MemberForSync = {
  id: number;
  pco_id: string | null;
  name: string | null;
  email: string | null;
  status: string | null;
  pco_created_at: string | null;
  first_visit_date: string | null;
  visitor_status: string | null;
  member_lifecycle: string | null;
};

type AttendanceForSync = {
  member_pco_id: string | null;
  attended_at: string | null;
};

type ChurchSettingsForRisk = {
  main_service_frequency: string | null;
  watch_missed_services: number | null;
  at_risk_missed_services: number | null;
  critical_missed_services: number | null;
};

type LifecycleResult = {
  first_visit_date: string | null;
  visitor_status: string;
  member_lifecycle: string;
};

type RiskResult = {
  score: number;
  tier: "Healthy" | "Watch" | "At Risk" | "Critical";
  reasons: string[];
};

class SyncRouteError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function getAuthedClient(authorization: string): DbClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
}

function getServiceRoleClient(): DbClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assertNoSupabaseError(error: SupabaseErrorLike | null, message: string): void {
  if (!error) return;
  throw new SyncRouteError(`${message}: ${error.message ?? "Unknown database error."}`);
}

function getMaxPcoPages(): number {
  const configured = Number(process.env.PLANNING_CENTER_SYNC_MAX_PAGES);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_PCO_PAGES;
  return Math.min(Math.floor(configured), 100);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseIsoDate(value: unknown): string | null {
  const raw = getString(value);
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function getRelationshipId(resource: PcoResource, relationshipName: string): string | null {
  const data = resource.relationships?.[relationshipName]?.data;
  return data?.id ?? null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function resolveAuthenticatedChurch(
  request: Request,
): Promise<{ body: SyncRequestBody; userId: string; churchId: number }> {
  let body: SyncRequestBody;
  try {
    body = (await request.json()) as SyncRequestBody;
  } catch {
    body = {};
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    throw new SyncRouteError("Authentication is required.", 401);
  }

  const authedDb = getAuthedClient(authorization);
  if (!authedDb) {
    throw new SyncRouteError("Supabase is not configured.", 500);
  }

  const { data: userData, error: userError } = await authedDb.auth.getUser();
  if (userError || !userData.user) {
    console.error("[sync] Auth lookup failed:", userError);
    throw new SyncRouteError("Authentication is required.", 401);
  }

  const userId = userData.user.id;
  console.log("[sync] Authenticated user_id:", userId);

  const requestedChurchId = Number(body.church_id);
  let churchUserQuery = authedDb
    .from("church_users")
    .select("church_id")
    .eq("user_id", userId)
    .limit(1);

  if (Number.isInteger(requestedChurchId) && requestedChurchId > 0) {
    churchUserQuery = churchUserQuery.eq("church_id", requestedChurchId);
  }

  const { data: churchUsers, error: churchUserError } = await churchUserQuery;
  if (churchUserError) {
    console.error("[sync] Church membership lookup failed:", churchUserError);
    throw new SyncRouteError("Could not verify active church.", 500);
  }

  const churchUserRows = churchUsers as Array<{ church_id: number }> | null;
  const churchId = churchUserRows?.[0]?.church_id;
  if (!Number.isInteger(churchId) || churchId == null || churchId <= 0) {
    throw new SyncRouteError("No active church found for this user.", 403);
  }

  console.log("[sync] church_id:", churchId);
  return { body, userId, churchId };
}

async function loadPlanningCenterToken(db: DbClient, churchId: number): Promise<PlanningCenterToken> {
  const { data, error } = await db
    .from("integration_tokens")
    .select("*")
    .eq("church_id", churchId)
    .eq("provider", "planning_center")
    .limit(1);

  assertNoSupabaseError(error, "Could not load Planning Center token");

  const tokenRows = data as PlanningCenterToken[] | null;
  const token = tokenRows?.[0] ?? null;
  console.log("[sync] Planning Center token found:", Boolean(token?.access_token));

  if (!token?.access_token) {
    throw new SyncRouteError("Planning Center is not connected. Connect Planning Center in Settings first.", 400);
  }

  return token;
}

async function refreshPlanningCenterToken(db: DbClient, token: PlanningCenterToken): Promise<PlanningCenterToken> {
  if (!token.refresh_token) {
    throw new SyncRouteError("Planning Center token is expired. Reconnect Planning Center in Settings.", 400);
  }

  const clientId = process.env.PLANNING_CENTER_CLIENT_ID;
  const clientSecret = process.env.PLANNING_CENTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SyncRouteError("Planning Center OAuth credentials are not configured.", 500);
  }

  const response = await fetch(PLANNING_CENTER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("[sync] Planning Center token refresh failed:", response.status, text.slice(0, 300));
    throw new SyncRouteError("Planning Center token refresh failed. Reconnect Planning Center in Settings.", 400);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  if (!payload.access_token) {
    throw new SyncRouteError("Planning Center token refresh did not return an access token.", 500);
  }

  const expiresAt = payload.expires_in
    ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
    : null;
  const now = new Date().toISOString();

  const update = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? token.refresh_token,
    expires_at: expiresAt,
    scope: payload.scope ?? token.scope,
    connection_status: "connected",
    updated_at: now,
  };

  const { data, error } = await db
    .from("integration_tokens")
    .update(update as never)
    .eq("id", token.id)
    .select("*")
    .single();

  assertNoSupabaseError(error, "Could not save refreshed Planning Center token");
  if (!data) {
    throw new SyncRouteError("Could not reload refreshed Planning Center token.", 500);
  }
  console.log("[sync] Planning Center token refreshed");

  return data as PlanningCenterToken;
}

async function getValidPlanningCenterToken(db: DbClient, token: PlanningCenterToken): Promise<PlanningCenterToken> {
  const expiresAt = token.expires_at ? new Date(token.expires_at).getTime() : null;
  const expiresSoon = expiresAt != null && expiresAt - Date.now() < 2 * 60 * 1000;

  if (expiresSoon && token.refresh_token) {
    return refreshPlanningCenterToken(db, token);
  }

  return token;
}

async function createPlanningCenterRequester(db: DbClient, initialToken: PlanningCenterToken) {
  let token = await getValidPlanningCenterToken(db, initialToken);

  return async function planningCenterGet(url: string): Promise<PcoResponse> {
    let response = await fetch(url, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    if (response.status === 401 && token.refresh_token) {
      token = await refreshPlanningCenterToken(db, token);
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[sync] Planning Center request failed:", response.status, text.slice(0, 300));
      throw new SyncRouteError(`Planning Center API returned HTTP ${response.status}.`, 502);
    }

    return (await response.json()) as PcoResponse;
  };
}

async function fetchPlanningCenterPages(
  path: string,
  params: Record<string, string>,
  planningCenterGet: (url: string) => Promise<PcoResponse>,
): Promise<PcoResponse[]> {
  const firstUrl = new URL(path, PLANNING_CENTER_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    firstUrl.searchParams.set(key, value);
  }

  const pages: PcoResponse[] = [];
  let nextUrl: string | null = firstUrl.toString();
  const maxPages = getMaxPcoPages();

  while (nextUrl && pages.length < maxPages) {
    const page = await planningCenterGet(nextUrl);
    pages.push(page);

    const next = page.links?.next ?? null;
    nextUrl = next ? new URL(next, PLANNING_CENTER_BASE_URL).toString() : null;
  }

  if (nextUrl) {
    console.warn(`[sync] Planning Center pagination stopped at ${maxPages} pages for ${path}`);
  }

  return pages;
}

function extractPeopleEmails(page: PcoResponse): Map<string, string> {
  const emailsByPerson = new Map<string, Array<{ address: string; preferred: boolean; active: boolean }>>();

  for (const item of page.included ?? []) {
    if (item.type !== "Email") continue;

    const attrs = item.attributes ?? {};
    const address = getString(attrs.address);
    const personId = getRelationshipId(item, "person");
    if (!address || !personId) continue;

    const preferred = attrs.preferred === true || attrs.primary === true;
    const active = attrs.blocked !== true;
    emailsByPerson.set(personId, [
      ...(emailsByPerson.get(personId) ?? []),
      { address, preferred, active },
    ]);
  }

  const emailByPerson = new Map<string, string>();
  for (const [personId, emails] of emailsByPerson) {
    const selected =
      emails.find((email) => email.preferred)?.address ??
      emails.find((email) => email.active)?.address ??
      emails[0]?.address;

    if (selected) emailByPerson.set(personId, selected);
  }

  return emailByPerson;
}

async function fetchPlanningCenterPeople(
  planningCenterGet: (url: string) => Promise<PcoResponse>,
): Promise<PcoPerson[]> {
  const pages = await fetchPlanningCenterPages(
    "/people/v2/people",
    { per_page: String(PCO_PAGE_SIZE), include: "emails" },
    planningCenterGet,
  );

  const peopleById = new Map<string, PcoPerson>();

  for (const page of pages) {
    const emailByPerson = extractPeopleEmails(page);

    for (const item of page.data ?? []) {
      const personId = getString(item.id);
      if (!personId) continue;

      const attrs = item.attributes ?? {};
      const firstName = getString(attrs.first_name) ?? "";
      const lastName = getString(attrs.last_name) ?? "";
      const fallbackEmail = getString(attrs.login_identifier);
      const email =
        emailByPerson.get(personId) ??
        (fallbackEmail && fallbackEmail.includes("@") ? fallbackEmail : null);

      peopleById.set(personId, {
        pco_id: personId,
        name: `${firstName} ${lastName}`.trim() || "Unknown member",
        email,
        status: getString(attrs.status),
        pco_created_at: parseIsoDate(attrs.created_at),
      });
    }
  }

  return [...peopleById.values()];
}

async function fetchPlanningCenterCheckins(
  planningCenterGet: (url: string) => Promise<PcoResponse>,
): Promise<PcoCheckin[]> {
  const pages = await fetchPlanningCenterPages(
    "/check-ins/v2/check_ins",
    { per_page: String(PCO_PAGE_SIZE) },
    planningCenterGet,
  );

  const checkinsById = new Map<string, PcoCheckin>();

  for (const page of pages) {
    for (const item of page.data ?? []) {
      const checkinId = getString(item.id);
      if (!checkinId) continue;

      const attrs = item.attributes ?? {};
      const memberPcoId = getString(attrs.person_id) ?? getRelationshipId(item, "person");
      const attendedAt = parseIsoDate(attrs.checked_in_at) ?? parseIsoDate(attrs.created_at);

      checkinsById.set(checkinId, {
        pco_checkin_id: checkinId,
        member_pco_id: memberPcoId,
        attended_at: attendedAt,
      });
    }
  }

  return [...checkinsById.values()];
}

async function upsertMembers(
  db: DbClient,
  churchId: number,
  people: PcoPerson[],
  now: string,
): Promise<number> {
  const payloads: MemberInsert[] = people.map((person) => ({
    church_id: churchId,
    pco_id: person.pco_id,
    name: person.name,
    email: person.email,
    status: person.status,
    source: "planning_center",
    pco_created_at: person.pco_created_at,
    updated_at: now,
  }));

  for (const group of chunk(payloads, 500)) {
    const { error } = await db
      .from("members")
      .upsert(group as never, { onConflict: "church_id,pco_id" });

    assertNoSupabaseError(error, "Could not upsert Planning Center members");
  }

  return payloads.length;
}

async function upsertAttendance(
  db: DbClient,
  churchId: number,
  checkins: PcoCheckin[],
): Promise<number> {
  const payloads: AttendanceInsert[] = checkins.map((checkin) => ({
    church_id: churchId,
    pco_checkin_id: checkin.pco_checkin_id,
    member_pco_id: checkin.member_pco_id,
    attended_at: checkin.attended_at,
    source: "planning_center",
  }));

  for (const group of chunk(payloads, 500)) {
    const { error } = await db
      .from("attendance")
      .upsert(group as never, { onConflict: "church_id,pco_checkin_id" });

    assertNoSupabaseError(error, "Could not upsert Planning Center attendance");
  }

  return payloads.length;
}

async function fetchAllPages<T>(
  runPage: (from: number, to: number) => Promise<{ data: T[] | null; error: SupabaseErrorLike | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await runPage(from, to);
    assertNoSupabaseError(error, "Could not load synced rows");

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) break;
  }

  return rows;
}

function isRecentPcoPerson(pcoCreatedAt: string | null, now: Date): boolean {
  if (!pcoCreatedAt) return false;

  const created = new Date(pcoCreatedAt);
  if (Number.isNaN(created.getTime())) return false;

  return created.getTime() >= now.getTime() - 14 * DAY_MS;
}

function applyMemberLifecycle(
  member: MemberForSync,
  attendanceDates: Date[],
  now: Date,
): LifecycleResult {
  const attendanceCount = attendanceDates.length;

  if (attendanceCount <= 0) {
    return {
      first_visit_date: null,
      visitor_status: VISITOR_STATUS_NONE,
      member_lifecycle: isRecentPcoPerson(member.pco_created_at, now)
        ? MEMBER_LIFECYCLE_NEW_NO_ATTENDANCE
        : MEMBER_LIFECYCLE_NEEDS_FIRST_FOLLOWUP,
    };
  }

  const firstVisitDate = new Date(Math.min(...attendanceDates.map((date) => date.getTime()))).toISOString();

  if (attendanceCount === 1) {
    return {
      first_visit_date: firstVisitDate,
      visitor_status: VISITOR_STATUS_FIRST_TIME,
      member_lifecycle: MEMBER_LIFECYCLE_FIRST_TIME_VISITOR,
    };
  }

  if (attendanceCount === 2) {
    return {
      first_visit_date: firstVisitDate,
      visitor_status: VISITOR_STATUS_RETURNED,
      member_lifecycle: MEMBER_LIFECYCLE_RETURNED_VISITOR,
    };
  }

  return {
    first_visit_date: firstVisitDate,
    visitor_status: VISITOR_STATUS_CONVERTED,
    member_lifecycle: MEMBER_LIFECYCLE_ESTABLISHED_MEMBER,
  };
}

function buildAttendanceByMember(attendanceRows: AttendanceForSync[]): Map<string, Date[]> {
  const attendanceByMember = new Map<string, Date[]>();

  for (const row of attendanceRows) {
    if (!row.member_pco_id || !row.attended_at) continue;

    const attendedAt = new Date(row.attended_at);
    if (Number.isNaN(attendedAt.getTime())) continue;

    attendanceByMember.set(row.member_pco_id, [
      ...(attendanceByMember.get(row.member_pco_id) ?? []),
      attendedAt,
    ]);
  }

  return attendanceByMember;
}

function lifecycleChanged(member: MemberForSync, lifecycle: LifecycleResult): boolean {
  return (
    member.first_visit_date !== lifecycle.first_visit_date ||
    member.visitor_status !== lifecycle.visitor_status ||
    member.member_lifecycle !== lifecycle.member_lifecycle
  );
}

async function recalculateLifecycles(
  db: DbClient,
  churchId: number,
  members: MemberForSync[],
  attendanceByMember: Map<string, Date[]>,
  now: string,
): Promise<number> {
  const currentTime = new Date(now);
  let updated = 0;

  for (const member of members) {
    if (!member.pco_id) continue;

    const lifecycle = applyMemberLifecycle(member, attendanceByMember.get(member.pco_id) ?? [], currentTime);
    const changed = lifecycleChanged(member, lifecycle);
    member.first_visit_date = lifecycle.first_visit_date;
    member.visitor_status = lifecycle.visitor_status;
    member.member_lifecycle = lifecycle.member_lifecycle;

    if (!changed) {
      continue;
    }

    const update: MemberUpdate = {
      first_visit_date: lifecycle.first_visit_date,
      visitor_status: lifecycle.visitor_status,
      member_lifecycle: lifecycle.member_lifecycle,
      updated_at: now,
    };

    const { error } = await db
      .from("members")
      .update(update as never)
      .eq("church_id", churchId)
      .eq("pco_id", member.pco_id);

    assertNoSupabaseError(error, "Could not update member lifecycle");
    updated += 1;
  }

  return updated;
}

function getTier(score: number): RiskResult["tier"] {
  if (score <= 20) return "Healthy";
  if (score <= 40) return "Watch";
  if (score <= 60) return "At Risk";
  return "Critical";
}

function getSetting(
  settings: ChurchSettingsForRisk | null,
  key: keyof ChurchSettingsForRisk,
  fallback: number | string,
): number | string {
  const value = settings?.[key];
  return value ?? fallback;
}

function getServiceIntervalDays(mainServiceFrequency: string | null): number {
  if (mainServiceFrequency === "twice_weekly") return 3.5;
  if (mainServiceFrequency === "monthly") return 30;
  return 7;
}

function calculateAttendanceVelocity(attendanceDates: Date[], now: Date) {
  const recentStart = now.getTime() - 28 * DAY_MS;
  const previousStart = now.getTime() - 56 * DAY_MS;
  let recentCount = 0;
  let previousCount = 0;

  for (const attendedAt of attendanceDates) {
    const time = attendedAt.getTime();
    if (time >= recentStart) {
      recentCount += 1;
    } else if (time >= previousStart && time < recentStart) {
      previousCount += 1;
    }
  }

  return {
    recentCount,
    previousCount,
    dropPercentage: previousCount > 0 ? (previousCount - recentCount) / previousCount : null,
  };
}

function calculateAttendanceConsistency(attendanceDates: Date[], now: Date): number {
  const windowStart = now.getTime() - 56 * DAY_MS;
  const activeWeeks = new Set<number>();

  for (const attendedAt of attendanceDates) {
    const time = attendedAt.getTime();
    if (time < windowStart || time > now.getTime()) continue;

    const daysAgo = Math.floor((now.getTime() - time) / DAY_MS);
    if (daysAgo < 0 || daysAgo > 56) continue;

    activeWeeks.add(Math.min(Math.floor(daysAgo / 7), 7));
  }

  return activeWeeks.size;
}

function calculateRisk(
  member: MemberForSync,
  attendanceDates: Date[],
  settings: ChurchSettingsForRisk | null,
  now: Date,
): RiskResult {
  const breakdown = {
    attendanceRecency: 0,
    attendanceVelocity: 0,
    attendanceConsistency: 0,
    statusRisk: 0,
    dataConfidence: 0,
  };
  const reasons: string[] = [];
  const lifecycle = (member.member_lifecycle ?? "").trim().toLowerCase();

  if (lifecycle && lifecycle !== MEMBER_LIFECYCLE_ESTABLISHED_MEMBER) {
    return {
      score: 0,
      tier: "Healthy",
      reasons: ["Member lifecycle is not eligible for risk scoring"],
    };
  }

  const mainServiceFrequency = String(getSetting(settings, "main_service_frequency", "weekly"));
  const watchMissedServices = Number(getSetting(settings, "watch_missed_services", 2));
  const atRiskMissedServices = Number(getSetting(settings, "at_risk_missed_services", 4));
  const criticalMissedServices = Number(getSetting(settings, "critical_missed_services", 6));
  const serviceIntervalDays = getServiceIntervalDays(mainServiceFrequency);

  if (!attendanceDates.length) {
    breakdown.attendanceRecency = 30;
    reasons.push("No attendance history");
  } else {
    const lastAttended = new Date(Math.max(...attendanceDates.map((date) => date.getTime())));
    const daysSinceLastAttendance = Math.floor((now.getTime() - lastAttended.getTime()) / DAY_MS);
    const missedServices = daysSinceLastAttendance / serviceIntervalDays;

    if (missedServices >= criticalMissedServices) {
      breakdown.attendanceRecency = 30;
      reasons.push(`Missed about ${missedServices.toFixed(1)} services since last attendance`);
    } else if (missedServices >= atRiskMissedServices) {
      breakdown.attendanceRecency = 20;
      reasons.push(`Missed about ${missedServices.toFixed(1)} services since last attendance`);
    } else if (missedServices >= watchMissedServices) {
      breakdown.attendanceRecency = 10;
      reasons.push(`Missed about ${missedServices.toFixed(1)} services since last attendance`);
    }
  }

  const velocity = calculateAttendanceVelocity(attendanceDates, now);
  if (velocity.dropPercentage !== null) {
    const dropPercentValue = Math.round(velocity.dropPercentage * 100);
    if (velocity.dropPercentage >= 0.75) {
      breakdown.attendanceVelocity = 30;
      reasons.push(`Attendance dropped by ${dropPercentValue}% compared to previous 4 weeks`);
    } else if (velocity.dropPercentage >= 0.5) {
      breakdown.attendanceVelocity = 20;
      reasons.push(`Attendance dropped by ${dropPercentValue}% compared to previous 4 weeks`);
    } else if (velocity.dropPercentage >= 0.25) {
      breakdown.attendanceVelocity = 10;
      reasons.push(`Attendance dropped by ${dropPercentValue}% compared to previous 4 weeks`);
    }
  }

  const activeWeekCount = calculateAttendanceConsistency(attendanceDates, now);
  if (activeWeekCount <= 1) {
    breakdown.attendanceConsistency = 20;
    reasons.push(`Only active in ${activeWeekCount} of last 8 weeks`);
  } else if (activeWeekCount === 2) {
    breakdown.attendanceConsistency = 15;
    reasons.push("Only active in 2 of last 8 weeks");
  } else if (activeWeekCount === 3) {
    breakdown.attendanceConsistency = 10;
    reasons.push("Only active in 3 of last 8 weeks");
  } else if (activeWeekCount === 4) {
    breakdown.attendanceConsistency = 5;
    reasons.push("Only active in 4 of last 8 weeks");
  }

  if (member.status !== "active") {
    breakdown.statusRisk = 10;
    reasons.push("Member status is not active");
  }

  if (!member.email) {
    breakdown.dataConfidence += 5;
    reasons.push("Missing email");
  }

  if (attendanceDates.length < 2) {
    breakdown.dataConfidence += 5;
    reasons.push("Limited attendance history");
  }

  const score = Math.min(
    breakdown.attendanceRecency +
      breakdown.attendanceVelocity +
      breakdown.attendanceConsistency +
      breakdown.statusRisk +
      breakdown.dataConfidence,
    100,
  );

  return {
    score,
    tier: getTier(score),
    reasons,
  };
}

async function recalculateRiskScores(
  db: DbClient,
  churchId: number,
  members: MemberForSync[],
  attendanceByMember: Map<string, Date[]>,
  now: string,
): Promise<number> {
  const { data: settingsRows, error: settingsError } = await db
    .from("church_settings")
    .select("main_service_frequency, watch_missed_services, at_risk_missed_services, critical_missed_services")
    .eq("church_id", churchId)
    .limit(1);

  assertNoSupabaseError(settingsError, "Could not load church settings");
  const settings = settingsRows?.[0] ?? null;
  const riskPayloads: RiskScoreInsert[] = [];
  let changed = 0;

  for (const member of members) {
    if (!member.pco_id) continue;

    if (member.member_lifecycle !== MEMBER_LIFECYCLE_ESTABLISHED_MEMBER) {
      const { count, error } = await db
        .from("risk_scores")
        .delete({ count: "exact" })
        .eq("church_id", churchId)
        .eq("member_pco_id", member.pco_id);

      assertNoSupabaseError(error, "Could not remove visitor risk score");
      changed += count ?? 0;
      continue;
    }

    const risk = calculateRisk(member, attendanceByMember.get(member.pco_id) ?? [], settings, new Date(now));
    riskPayloads.push({
      church_id: churchId,
      member_pco_id: member.pco_id,
      score: risk.score,
      tier: risk.tier,
      reasons: risk.reasons.join(", "),
      updated_at: now,
    });
  }

  for (const group of chunk(riskPayloads, 500)) {
    const { error } = await db
      .from("risk_scores")
      .upsert(group as never, { onConflict: "church_id,member_pco_id" });

    assertNoSupabaseError(error, "Could not upsert risk scores");
    changed += group.length;
  }

  return changed;
}

async function updatePlanningCenterSyncStatus(
  db: DbClient,
  tokenId: number,
  lastSync: string,
  membersImported: number,
  attendanceImported: number,
): Promise<void> {
  const { error } = await db
    .from("integration_tokens")
    .update({
      connection_status: "connected",
      last_sync_at: lastSync,
      members_imported: membersImported,
      attendance_imported: attendanceImported,
      updated_at: lastSync,
    } as never)
    .eq("id", tokenId);

  assertNoSupabaseError(error, "Could not update Planning Center sync status");
}

async function markPlanningCenterSyncError(db: DbClient | null, churchId: number | null): Promise<void> {
  if (!db || !churchId) return;

  const { error } = await db
    .from("integration_tokens")
    .update({ connection_status: "error", updated_at: new Date().toISOString() } as never)
    .eq("church_id", churchId)
    .eq("provider", "planning_center");

  if (error) {
    console.error("[sync] Could not mark Planning Center sync error:", error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  console.log("[sync] Route hit");

  let serviceDb: DbClient | null = null;
  let churchId: number | null = null;

  try {
    const resolved = await resolveAuthenticatedChurch(request);
    churchId = resolved.churchId;

    serviceDb = getServiceRoleClient();
    if (!serviceDb) {
      throw new SyncRouteError("Supabase service role is not configured.", 500);
    }

    let token = await loadPlanningCenterToken(serviceDb, churchId);
    const planningCenterGet = await createPlanningCenterRequester(serviceDb, token);

    const [people, checkins] = await Promise.all([
      fetchPlanningCenterPeople(planningCenterGet),
      fetchPlanningCenterCheckins(planningCenterGet),
    ]);

    console.log("[sync] People fetched count:", people.length);
    console.log("[sync] Attendance fetched count:", checkins.length);

    const lastSync = new Date().toISOString();
    const membersImported = await upsertMembers(serviceDb, churchId, people, lastSync);
    const attendanceImported = await upsertAttendance(serviceDb, churchId, checkins);

    const [members, attendanceRows] = await Promise.all([
      fetchAllPages<MemberForSync>(async (from, to) => {
        const { data, error } = await serviceDb!
          .from("members")
          .select("id,pco_id,name,email,status,pco_created_at,first_visit_date,visitor_status,member_lifecycle")
          .eq("church_id", churchId!)
          .not("pco_id", "is", null)
          .order("id", { ascending: true })
          .range(from, to);

        return { data: data as MemberForSync[] | null, error };
      }),
      fetchAllPages<AttendanceForSync>(async (from, to) => {
        const { data, error } = await serviceDb!
          .from("attendance")
          .select("member_pco_id,attended_at")
          .eq("church_id", churchId!)
          .order("id", { ascending: true })
          .range(from, to);

        return { data: data as AttendanceForSync[] | null, error };
      }),
    ]);

    const attendanceByMember = buildAttendanceByMember(attendanceRows);
    const lifecycleUpdated = await recalculateLifecycles(
      serviceDb,
      churchId,
      members,
      attendanceByMember,
      lastSync,
    );
    console.log("[sync] Lifecycle updated count:", lifecycleUpdated);

    const riskScoresUpdated = await recalculateRiskScores(
      serviceDb,
      churchId,
      members,
      attendanceByMember,
      lastSync,
    );
    console.log("[sync] Risk scores updated count:", riskScoresUpdated);

    token = await loadPlanningCenterToken(serviceDb, churchId);
    await updatePlanningCenterSyncStatus(
      serviceDb,
      token.id,
      lastSync,
      membersImported,
      attendanceImported,
    );

    return NextResponse.json({
      success: true,
      membersImported,
      attendanceImported,
      lifecycleUpdated,
      riskScoresUpdated,
      lastSync,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof SyncRouteError ? err.status : 500;
    console.error("[sync] Sync failed:", message);
    await markPlanningCenterSyncError(serviceDb, churchId);

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
