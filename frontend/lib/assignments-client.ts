import { formatDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";

// Shared client types + helpers for the Assignment System, consumed by both the
// /assignments page and the assign card in the member detail panel. The note
// field is OPTIONAL on purpose: the GET route omits it entirely for viewers, so
// `note` is simply absent (never an empty string) in a viewer's payload.

export type AssignmentOwner = {
  user_id: string;
  name: string | null;
  email: string | null;
};

export type AssignmentItem = {
  id: number;
  member_id: number;
  member_name: string;
  owner_user_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  note?: string | null; // present ONLY for admin/pastor
};

export type AssignmentsResponse = {
  success: boolean;
  caller_role: "admin" | "pastor" | "viewer" | null;
  caller_user_id: string;
  owners: AssignmentOwner[];
  myChecklist: AssignmentItem[];
  teamBoard: AssignmentItem[];
  error?: string;
};

export type AssignmentAction = "create" | "set_done" | "update" | "reassign" | "delete";

export type AssignmentActionBody = {
  action: AssignmentAction;
  assignment_id?: number;
  member_id?: number;
  owner_user_id?: string | null;
  due_date?: string | null;
  note?: string | null;
  done?: boolean;
};

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null;
}

// Human label for an owner: real name, else email, else a sensible fallback.
export function ownerLabel(owner: Pick<AssignmentOwner, "name" | "email"> | null | undefined): string {
  if (!owner) return "Unknown";
  return owner.name || owner.email || "Unknown";
}

// How an assignment's owner should render — "Unassigned" for a null owner.
export function assignmentOwnerLabel(item: AssignmentItem): string {
  if (!item.owner_user_id) return "Unassigned";
  return item.owner_name || item.owner_email || "Unknown";
}

// Format a date-only due value. Parsed as LOCAL midnight so it doesn't shift a
// day backwards in negative-UTC timezones (plain new Date("YYYY-MM-DD") is UTC).
export function formatDueDate(due: string | null): string {
  if (!due) return "No date";
  return formatDate(`${due}T00:00:00`);
}

export async function fetchAssignments(): Promise<AssignmentsResponse> {
  const headers = await authHeaders();
  if (!headers) {
    return {
      success: false,
      caller_role: null,
      caller_user_id: "",
      owners: [],
      myChecklist: [],
      teamBoard: [],
      error: "Your session expired. Please sign in again.",
    };
  }
  const res = await fetch("/api/assignments", { headers });
  const json = (await res.json().catch(() => null)) as AssignmentsResponse | null;
  if (!res.ok || !json?.success) {
    return {
      success: false,
      caller_role: null,
      caller_user_id: "",
      owners: [],
      myChecklist: [],
      teamBoard: [],
      error: json?.error ?? "Could not load assignments.",
    };
  }
  return json;
}

export async function postAssignment(
  body: AssignmentActionBody,
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: "Your session expired. Please sign in again." };
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || json.success !== true) {
    return { ok: false, error: json.error ?? "Action failed. Please try again." };
  }
  return { ok: true };
}
