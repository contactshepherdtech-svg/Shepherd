import type { Database } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

type ChurchRow = Database["public"]["Tables"]["churches"]["Row"];
type ChurchUserRow = Database["public"]["Tables"]["church_users"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];
type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
type RiskScoreRow = Database["public"]["Tables"]["risk_scores"]["Row"];
type ChurchSettingsRow = Database["public"]["Tables"]["church_settings"]["Row"];
type ChurchSettingsUpdate = Database["public"]["Tables"]["church_settings"]["Update"];
type IntegrationTokenRow = Database["public"]["Tables"]["integration_tokens"]["Row"];
type IntegrationStatusRow = Database["public"]["Tables"]["integration_status"]["Row"];
type OutreachStatusRow = Database["public"]["Tables"]["outreach_status"]["Row"];
type SyncHistoryRow = Database["public"]["Tables"]["sync_history"]["Row"];

export type ChurchRecord = ChurchRow;
export type ChurchUserRecord = ChurchUserRow;
export type MemberRecord = MemberRow;
export type AttendanceRecord = AttendanceRow;
export type RiskScoreRecord = RiskScoreRow;
export type ChurchSettingsRecord = ChurchSettingsRow;
export type OutreachStatusRecord = OutreachStatusRow;
export type SyncHistoryRecord = SyncHistoryRow;
export type EditableChurchSettings = Pick<
  ChurchSettingsRow,
  | "church_name"
  | "main_service_frequency"
  | "watch_missed_services"
  | "at_risk_missed_services"
  | "critical_missed_services"
  | "preferred_followup_style"
>;
export type IntegrationTokenRecord = IntegrationTokenRow;

export type RiskTier = "Healthy" | "Watch" | "At Risk" | "Critical";
export type VisitorFollowUpLifecycle =
  | "first_time_visitor"
  | "returned_visitor"
  | "needs_first_followup";

const visitorFollowUpLifecycles = new Set<string>([
  "first_time_visitor",
  "returned_visitor",
  "needs_first_followup",
]);

const followUpStaleAfterMs = 5 * 24 * 60 * 60 * 1000;

// First-time visitors are held for 24h after their first visit before the
// follow-up draft unlocks. Compared as absolute instants (epoch ms) against
// first_visit_date (a UTC TIMESTAMPTZ), so it is timezone-independent.
const FIRST_VISIT_FOLLOWUP_DELAY_MS = 24 * 60 * 60 * 1000;

// Presentation state for a first-time visitor's follow-up in the queue.
export type FirstVisitFollowUpState = "holding" | "due_now" | "draft_created";

export type MemberDirectoryRow = {
  member: {
    id: string;
    pco_id: string | null;
    name: string;
    email: string;
    status: string;
    household: string;
    ministry: string;
    member_lifecycle: string | null;
    first_visit_date: Date | null;
    last_followup_at: Date | null;
  };
  risk: {
    member_id: string;
    score: number | null;
    tier: RiskTier | null;
    reasons: string[];
    updated_at: string | null;
  };
  attendance_history: Date[];
  attendance_count: number;
  last_attended: Date | null;
  days_since_last_attendance: number | null;
};

export type AttendanceTrendPoint = {
  label: string;
  records: number;
  unique_members: number;
};

export type RiskDistributionItem = {
  tier: RiskTier;
  count: number;
  percent: number;
};

export type EngagementOverview = {
  active: number;
  slipping: number;
  disengaged: number;
};

// Client connection objects now come from the token-free `integration_status`
// view — never the raw integration_tokens table (which clients can no longer read).
export type PlanningCenterConnection = IntegrationStatusRow;
export type GmailConnection = IntegrationStatusRow;

export type OnboardingWorkspaceInput = {
  church_name: string;
  main_service_frequency: string;
  watch_missed_services: number;
  at_risk_missed_services: number;
  critical_missed_services: number;
  preferred_followup_style: string;
};

function hasClient() {
  return Boolean(supabase);
}

function requireSupabaseClient() {
  if (!hasClient()) {
    throw new Error("Supabase client is not configured. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return supabase!;
}

function logQueryError(tableName: string, error: unknown) {
  console.error("Supabase query failed:", tableName, error);
}

function normalizeTier(value: string | null | undefined): RiskTier {
  if (!value) return "Watch";

  const normalized = value.trim().toLowerCase();
  if (normalized === "healthy") return "Healthy";
  if (normalized === "watch") return "Watch";
  if (normalized === "at risk" || normalized === "at_risk") return "At Risk";
  if (normalized === "critical") return "Critical";

  return "Watch";
}

function parseReasons(reasons: string | null | undefined): string[] {
  if (!reasons) return [];

  return reasons
    .split(",")
    .map((reason) => reason.trim())
    .filter(Boolean);
}

function getSafeDate(value: string | null): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function getDaysSince(date: Date | null): number | null {
  if (!date) return null;

  return Math.max(Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)), 0);
}

export function isVisitorFollowUpLifecycle(
  lifecycle: string | null | undefined,
): lifecycle is VisitorFollowUpLifecycle {
  return Boolean(lifecycle && visitorFollowUpLifecycles.has(lifecycle));
}

export function isVisitorFollowUpDue(
  lifecycle: string | null | undefined,
  lastFollowUpAt: Date | string | null | undefined,
): boolean {
  if (!isVisitorFollowUpLifecycle(lifecycle)) return false;
  if (!lastFollowUpAt) return true;

  const parsed = lastFollowUpAt instanceof Date ? lastFollowUpAt : getSafeDate(lastFollowUpAt);
  if (!parsed) return true;

  return parsed.getTime() < Date.now() - followUpStaleAfterMs;
}

// When a held first-time visitor's follow-up draft unlocks (first_visit + 24h).
export function getFirstVisitFollowUpUnlocksAt(firstVisitDate: Date | null): Date | null {
  if (!firstVisitDate) return null;
  return new Date(firstVisitDate.getTime() + FIRST_VISIT_FOLLOWUP_DELAY_MS);
}

// Computes the queue presentation state for a FIRST-TIME visitor's follow-up.
// Returns null for any other lifecycle (those keep the existing follow-up rules).
//   draft_created — a Gmail draft has been prepared (outreach_status.draft_created_at)
//   holding       — synced < 24h ago; draft intentionally held, not missing
//   due_now       — 24h elapsed, no draft yet → offer "Generate Follow-up Draft"
// A first_time_visitor with a missing first_visit_date is treated as due_now so
// an inconsistent record never hides a real visitor.
export function getFirstVisitFollowUpState(
  member: { member_lifecycle: string | null; first_visit_date: Date | null },
  status: OutreachStatusRecord | null,
): FirstVisitFollowUpState | null {
  if (member.member_lifecycle !== "first_time_visitor") return null;
  if (status?.draft_created_at) return "draft_created";

  const firstVisit = member.first_visit_date;
  if (firstVisit && Date.now() < firstVisit.getTime() + FIRST_VISIT_FOLLOWUP_DELAY_MS) {
    return "holding";
  }
  return "due_now";
}

export function getVisitorLifecycleLabel(lifecycle: string | null | undefined): string {
  if (lifecycle === "first_time_visitor") return "First-time visitor";
  if (lifecycle === "returned_visitor") return "Returned visitor";
  if (lifecycle === "needs_first_followup") return "Needs first follow-up";
  if (lifecycle === "new_no_attendance") return "New, no attendance";
  if (lifecycle === "established_member") return "Established member";
  return "Lifecycle unknown";
}

export async function getChurch(churchId: number): Promise<ChurchRow | null> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("churches")
    .select("*")
    .eq("id", churchId)
    .limit(1);

  if (error) {
    logQueryError("churches", error);
    throw error;
  }

  return data?.[0] ?? null;
}

export async function getChurchUserForUser(userId: string): Promise<ChurchUserRow | null> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("church_users")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (error) {
    logQueryError("church_users", error);
    throw error;
  }

  return data?.[0] ?? null;
}

export async function getChurchForUser(
  userId: string,
): Promise<{ churchUser: ChurchUserRow; church: ChurchRow } | null> {
  const churchUser = await getChurchUserForUser(userId);
  if (!churchUser) return null;

  const church = await getChurch(churchUser.church_id);
  if (!church) return null;

  return { churchUser, church };
}

export async function getMembers(churchId: number): Promise<MemberRow[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("members")
    .select("*")
    .eq("church_id", churchId)
    .order("name", { ascending: true });

  if (error) {
    logQueryError("members", error);
    throw error;
  }

  return data ?? [];
}

export async function getAttendance(churchId: number): Promise<AttendanceRow[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("attendance")
    .select("*")
    .eq("church_id", churchId)
    .order("attended_at", { ascending: false });

  if (error) {
    logQueryError("attendance", error);
    throw error;
  }

  return data ?? [];
}

export async function getRiskScores(churchId: number): Promise<RiskScoreRow[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("risk_scores")
    .select("*")
    .eq("church_id", churchId)
    .order("score", { ascending: false });

  if (error) {
    logQueryError("risk_scores", error);
    throw error;
  }

  return data ?? [];
}

export async function getChurchSettings(churchId: number): Promise<ChurchSettingsRow | null> {
  const client = requireSupabaseClient();

  const scopedQuery = await client
    .from("church_settings")
    .select("*")
    .eq("church_id", churchId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (scopedQuery.error) {
    logQueryError("church_settings", scopedQuery.error);
    throw scopedQuery.error;
  }

  return scopedQuery.data?.[0] ?? null;
}

export async function updateChurchSettings(
  churchId: number,
  values: EditableChurchSettings,
): Promise<ChurchSettingsRow> {
  const client = requireSupabaseClient();
  const payload: ChurchSettingsUpdate = {
    church_name: values.church_name,
    main_service_frequency: values.main_service_frequency,
    watch_missed_services: values.watch_missed_services,
    at_risk_missed_services: values.at_risk_missed_services,
    critical_missed_services: values.critical_missed_services,
    preferred_followup_style: values.preferred_followup_style,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("church_settings")
    .update(payload as never)
    .eq("church_id", churchId)
    .select("*")
    .single();

  if (error) {
    logQueryError("church_settings", error);
    throw error;
  }

  return data;
}

export async function getPlanningCenterConnection(
  churchId: number,
): Promise<PlanningCenterConnection | null> {
  const client = requireSupabaseClient();

  const scopedQuery = await client
    .from("integration_status")
    .select("*")
    .eq("church_id", churchId)
    .eq("provider", "planning_center")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (scopedQuery.error) {
    logQueryError("integration_status", scopedQuery.error);
    throw scopedQuery.error;
  }

  return scopedQuery.data?.[0] ?? null;
}

export async function getSyncHistory(
  churchId: number,
  limit = 5,
): Promise<SyncHistoryRecord[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("sync_history")
    .select("*")
    .eq("church_id", churchId)
    .order("finished_at", { ascending: false })
    .limit(limit);

  if (error) {
    logQueryError("sync_history", error);
    return [];
  }

  return data ?? [];
}

export async function getGmailConnection(churchId: number): Promise<GmailConnection | null> {
  const client = requireSupabaseClient();

  const scopedQuery = await client
    .from("integration_status")
    .select("*")
    .eq("church_id", churchId)
    .eq("provider", "gmail")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (scopedQuery.error) {
    logQueryError("integration_status (gmail)", scopedQuery.error);
    throw scopedQuery.error;
  }

  return scopedQuery.data?.[0] ?? null;
}

export function isGmailConnected(connection: GmailConnection | null): boolean {
  return Boolean(
    connection &&
      connection.connection_status === "connected" &&
      connection.provider === "gmail" &&
      connection.has_access_token,
  );
}

export function isPlanningCenterConnected(connection: PlanningCenterConnection | null): boolean {
  return Boolean(
    connection &&
      connection.connection_status === "connected" &&
      connection.provider === "planning_center" &&
      connection.has_access_token,
  );
}

export function buildMemberDirectoryRows(
  members: MemberRow[],
  riskScores: RiskScoreRow[],
  attendance: AttendanceRow[],
): MemberDirectoryRow[] {
  const riskByMemberPcoId = new Map(
    riskScores
      .filter((risk) => risk.member_pco_id)
      .map((risk) => [risk.member_pco_id as string, risk]),
  );

  const attendanceByMemberPcoId = attendance.reduce<Map<string, Date[]>>((map, row) => {
    if (!row.member_pco_id) return map;
    const existing = map.get(row.member_pco_id) ?? [];
    const parsedDate = getSafeDate(row.attended_at);
    if (parsedDate) {
      existing.push(parsedDate);
      map.set(row.member_pco_id, existing);
    }
    return map;
  }, new Map());

  const rows = members.reduce<MemberDirectoryRow[]>((acc, member) => {
    const memberId = member.pco_id || String(member.id);
    const memberRisk = member.pco_id ? riskByMemberPcoId.get(member.pco_id) : undefined;

    const attendanceHistory = [...(member.pco_id ? attendanceByMemberPcoId.get(member.pco_id) ?? [] : [])].sort(
      (left, right) => right.getTime() - left.getTime(),
    );

    const lastAttended = attendanceHistory[0] ?? null;

    acc.push({
      member: {
        id: memberId,
        pco_id: member.pco_id,
        name: member.name?.trim() || "Unknown member",
        email: member.email?.trim() || "",
        status: member.status?.trim() || "Active",
        household: "Congregation",
        ministry: "General Ministry",
        member_lifecycle: member.member_lifecycle ?? null,
        first_visit_date: getSafeDate(member.first_visit_date),
        last_followup_at: getSafeDate(member.last_followup_at),
      },
      risk: {
        member_id: memberRisk?.member_pco_id || memberId,
        score: memberRisk?.score ?? null,
        tier: memberRisk ? normalizeTier(memberRisk.tier) : null,
        reasons: parseReasons(memberRisk?.reasons),
        updated_at: memberRisk?.updated_at ?? null,
      },
      attendance_history: attendanceHistory,
      attendance_count: attendanceHistory.length,
      last_attended: lastAttended,
      days_since_last_attendance: getDaysSince(lastAttended),
    });

    return acc;
  }, []);

  return rows.sort((left, right) => (right.risk.score ?? -1) - (left.risk.score ?? -1));
}

export function getRiskDistribution(riskScores: RiskScoreRow[]): RiskDistributionItem[] {
  const distribution: Record<RiskTier, number> = {
    Healthy: 0,
    Watch: 0,
    "At Risk": 0,
    Critical: 0,
  };

  for (const risk of riskScores) {
    distribution[normalizeTier(risk.tier)] += 1;
  }

  const total = riskScores.length;

  return (["Healthy", "Watch", "At Risk", "Critical"] as RiskTier[]).map((tier) => ({
    tier,
    count: distribution[tier],
    percent: total ? Math.round((distribution[tier] / total) * 100) : 0,
  }));
}

export function getChurchHealthScore(riskScores: RiskScoreRow[]): number {
  const totalRiskScore = riskScores.reduce((sum, risk) => sum + (risk.score ?? 0), 0);
  const avgRiskScore = riskScores.length ? totalRiskScore / riskScores.length : 0;
  return Math.max(0, Math.min(100, Math.round(100 - avgRiskScore)));
}

export function getAtRiskCount(riskScores: RiskScoreRow[]): number {
  return riskScores.filter((risk) => {
    const tier = normalizeTier(risk.tier);
    return tier === "At Risk" || tier === "Critical";
  }).length;
}

export function getAttendanceTrend(attendance: AttendanceRow[], weeks = 12): AttendanceTrendPoint[] {
  const trend: AttendanceTrendPoint[] = [];

  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1);

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - offset * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekRows = attendance.filter((row) => {
      const attendedAt = getSafeDate(row.attended_at);
      return attendedAt ? attendedAt >= weekStart && attendedAt < weekEnd : false;
    });

    trend.push({
      label: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      records: weekRows.length,
      unique_members: new Set(weekRows.map((row) => row.member_pco_id)).size,
    });
  }

  return trend;
}

export function getEngagementOverview(memberRows: MemberDirectoryRow[]): EngagementOverview {
  const active = memberRows.filter((row) => (row.days_since_last_attendance ?? 999) <= 14).length;
  const slipping = memberRows.filter((row) => {
    const days = row.days_since_last_attendance ?? 999;
    return days > 14 && days <= 35;
  }).length;
  const disengaged = memberRows.filter((row) => (row.days_since_last_attendance ?? 999) > 35).length;

  return {
    active,
    slipping,
    disengaged,
  };
}

export function getPriorityOutreachRows(memberRows: MemberDirectoryRow[]): MemberDirectoryRow[] {
  return memberRows
    .filter((row) => {
      if (isVisitorFollowUpLifecycle(row.member.member_lifecycle)) {
        return isVisitorFollowUpDue(row.member.member_lifecycle, row.member.last_followup_at);
      }

      return row.risk.tier === "Watch" || row.risk.tier === "At Risk" || row.risk.tier === "Critical";
    })
    .sort((left, right) => (right.risk.score ?? -1) - (left.risk.score ?? -1));
}

export async function getOutreachStatuses(churchId: number): Promise<OutreachStatusRecord[]> {
  const client = requireSupabaseClient();

  const { data, error } = await client
    .from("outreach_status")
    .select("*")
    .eq("church_id", churchId);

  if (error) {
    logQueryError("outreach_status", error);
    return [];
  }

  return data ?? [];
}

export async function upsertOutreachStatus(
  churchId: number,
  memberPcoId: string,
  update: {
    status: "active" | "contacted" | "snoozed";
    contacted_at?: string | null;
    snoozed_until?: string | null;
  },
): Promise<void> {
  const client = requireSupabaseClient();
  const now = new Date().toISOString();

  const payload = {
    church_id: churchId,
    member_pco_id: memberPcoId,
    status: update.status,
    contacted_at: update.contacted_at ?? null,
    snoozed_until: update.snoozed_until ?? null,
    updated_at: now,
  };

  const { data: existingRaw } = await client
    .from("outreach_status")
    .select("*")
    .eq("church_id", churchId)
    .eq("member_pco_id", memberPcoId)
    .limit(1);

  const existing = existingRaw as Array<{ id: number }> | null;

  if (existing && existing.length > 0) {
    const { error } = await client
      .from("outreach_status")
      .update(payload as never)
      .eq("id", existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await client
      .from("outreach_status")
      .insert({ ...payload, created_at: now } as never);
    if (error) throw error;
  }
}

export async function markVisitorFollowedUp(
  memberPcoId: string,
): Promise<{ member_pco_id: string; last_followup_at: string }> {
  const client = requireSupabaseClient();
  const accessToken = (await client.auth.getSession()).data.session?.access_token;

  const response = await fetch("/api/visitors/mark-followed-up", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ member_pco_id: memberPcoId }),
  });

  const result = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    member_pco_id?: string;
    last_followup_at?: string;
    error?: string;
  };

  if (!response.ok || !result.success || !result.member_pco_id || !result.last_followup_at) {
    throw new Error(result.error ?? "Could not mark this visitor followed up.");
  }

  return {
    member_pco_id: result.member_pco_id,
    last_followup_at: result.last_followup_at,
  };
}

// Generates a follow-up email (existing /api/outreach/generate) and creates a
// Gmail draft from it (existing /api/gmail/create-draft) — reusing both routes,
// never sending. Passing member_pco_id lets create-draft record "Draft Created"
// on outreach_status. Throws a clear error (e.g. Gmail not connected) for the UI.
export async function createVisitorFollowUpDraft(input: {
  memberPcoId: string;
  to: string;
}): Promise<{ draftId: string; persisted: boolean }> {
  const client = requireSupabaseClient();
  const accessToken = (await client.auth.getSession()).data.session?.access_token;
  if (!accessToken) throw new Error("Your session expired. Please sign in again.");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const generateRes = await fetch("/api/outreach/generate", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ member_pco_id: input.memberPcoId, type: "email" }),
  });
  const generated = (await generateRes.json().catch(() => ({}))) as {
    success?: boolean;
    subject?: string;
    body?: string;
    error?: string;
  };
  if (!generateRes.ok || !generated.success || !generated.body) {
    throw new Error(generated.error ?? "Could not generate the follow-up draft.");
  }

  const draftRes = await fetch("/api/gmail/create-draft", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      to: input.to,
      subject: generated.subject ?? "We're so glad you visited",
      body: generated.body,
      member_pco_id: input.memberPcoId,
    }),
  });
  const draft = (await draftRes.json().catch(() => ({}))) as {
    success?: boolean;
    draftId?: string;
    persisted?: boolean;
    error?: string;
  };
  if (!draftRes.ok || !draft.success || !draft.draftId) {
    throw new Error(draft.error ?? "Could not create the Gmail draft.");
  }

  return { draftId: draft.draftId, persisted: Boolean(draft.persisted) };
}

export function isVisibleInQueue(memberPcoId: string | null, statuses: OutreachStatusRecord[]): boolean {
  if (!memberPcoId) return true;
  const status = statuses.find((s) => s.member_pco_id === memberPcoId);
  if (!status) return true;
  if (status.status === "contacted") return false;
  if (status.status === "snoozed" && status.snoozed_until) {
    return new Date(status.snoozed_until) <= new Date();
  }
  return true;
}

export function getOutreachStatusForMember(
  memberPcoId: string | null,
  statuses: OutreachStatusRecord[],
): OutreachStatusRecord | null {
  if (!memberPcoId) return null;
  return statuses.find((s) => s.member_pco_id === memberPcoId) ?? null;
}
