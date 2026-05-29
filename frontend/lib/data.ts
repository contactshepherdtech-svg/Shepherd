import type { Database } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

type ChurchRow = Database["public"]["Tables"]["churches"]["Row"];
type MemberRow = Database["public"]["Tables"]["members"]["Row"];
type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];
type RiskScoreRow = Database["public"]["Tables"]["risk_scores"]["Row"];
type ChurchSettingsRow = Database["public"]["Tables"]["church_settings"]["Row"];
type ChurchSettingsUpdate = Database["public"]["Tables"]["church_settings"]["Update"];
type IntegrationTokenRow = Database["public"]["Tables"]["integration_tokens"]["Row"];

export type ChurchRecord = ChurchRow;
export type MemberRecord = MemberRow;
export type AttendanceRecord = AttendanceRow;
export type RiskScoreRecord = RiskScoreRow;
export type ChurchSettingsRecord = ChurchSettingsRow;
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

export type MemberDirectoryRow = {
  member: {
    id: string;
    pco_id: string | null;
    name: string;
    email: string;
    status: string;
    household: string;
    ministry: string;
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

export type PlanningCenterConnection = IntegrationTokenRecord;

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

export async function getDefaultChurch(): Promise<ChurchRow | null> {
  const client = requireSupabaseClient();

  const singleQuery = await client
    .from("churches")
    .select("*")
    .limit(1)
    .single();

  if (!singleQuery.error) {
    return singleQuery.data;
  }

  logQueryError("churches", singleQuery.error);

  const fallbackQuery = await client.from("churches").select("*").limit(1);

  if (fallbackQuery.error) {
    logQueryError("churches", fallbackQuery.error);
    throw fallbackQuery.error;
  }

  return fallbackQuery.data?.[0] ?? null;
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
    .from("integration_tokens")
    .select("*")
    .eq("church_id", churchId)
    .eq("provider", "planning_center")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (scopedQuery.error) {
    logQueryError("integration_tokens", scopedQuery.error);
    throw scopedQuery.error;
  }

  return scopedQuery.data?.[0] ?? null;
}

export function isPlanningCenterConnected(connection: PlanningCenterConnection | null): boolean {
  return Boolean(
    connection &&
      connection.connection_status === "connected" &&
      connection.provider === "planning_center",
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
    .filter((row) => row.risk.tier === "Watch" || row.risk.tier === "At Risk" || row.risk.tier === "Critical")
    .sort((left, right) => (right.risk.score ?? -1) - (left.risk.score ?? -1));
}

