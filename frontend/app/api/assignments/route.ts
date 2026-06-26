import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase";
import { getServiceClient, resolveCaller } from "@/lib/server/membership";

// Service-role write route for the Assignment System.
//
// The service client BYPASSES RLS, so every query below is scoped to the
// caller's church in TS — that scoping IS the tenant boundary here; the RLS
// policies on assignments / assignment_notes are the backstop. Role rules
// enforced in TS (and mirrored by RLS):
//   create      → admin + pastor (owner may be any staff)
//   set_done    → admin any row;  pastor only rows they own   (pastor-own)
//   update      → due_date: admin any / pastor own;  note: admin + pastor (T2, church-wide)
//   reassign    → admin only                                  (reassign-admin)
//   delete      → admin only                                  (delete-admin)

type Service = SupabaseClient<Database>;
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type AssignmentInsert = Database["public"]["Tables"]["assignments"]["Insert"];
type AssignmentUpdate = Database["public"]["Tables"]["assignments"]["Update"];
type AssignmentNoteInsert = Database["public"]["Tables"]["assignment_notes"]["Insert"];

type RequestBody = {
  action?: string;
  assignment_id?: number;
  member_id?: number;
  owner_user_id?: string | null;
  due_date?: string | null;
  note?: string | null;
  done?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

function nowIso(): string {
  return new Date().toISOString();
}

// DATE column: accept "YYYY-MM-DD" or empty/null (no due date). Anything else is rejected.
function parseDueDate(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value === "string" && DATE_RE.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return { ok: true, value };
  }
  return { ok: false };
}

// Tenant scope: the member must belong to the caller's church.
async function memberInChurch(service: Service, churchId: number, memberId: number): Promise<boolean> {
  const { data, error } = await service
    .from("members")
    .select("id")
    .eq("church_id", churchId)
    .eq("id", memberId)
    .limit(1);
  if (error) throw error;
  return Boolean((data as Array<{ id: number }> | null)?.[0]);
}

// An assignment owner must be active staff (admin/pastor) in the caller's church.
// Viewers can never own an assignment (they are read-only).
async function ownerIsStaff(service: Service, churchId: number, ownerUserId: string): Promise<boolean> {
  const { data, error } = await service
    .from("church_users")
    .select("role")
    .eq("church_id", churchId)
    .eq("user_id", ownerUserId)
    .limit(1);
  if (error) throw error;
  const role = (data as Array<{ role: string }> | null)?.[0]?.role;
  return role === "admin" || role === "pastor";
}

// Loads an assignment scoped to the caller's church (null if it isn't theirs).
async function loadAssignment(
  service: Service,
  churchId: number,
  assignmentId: number,
): Promise<AssignmentRow | null> {
  const { data, error } = await service
    .from("assignments")
    .select("*")
    .eq("church_id", churchId)
    .eq("id", assignmentId)
    .limit(1);
  if (error) throw error;
  return (data as AssignmentRow[] | null)?.[0] ?? null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get("authorization");

  let caller;
  try {
    caller = await resolveCaller(authorization);
  } catch {
    return jsonError("Could not verify your account.", 500);
  }
  if (!caller) {
    return jsonError("Authentication is required.", 401);
  }
  if (caller.churchId === null || caller.role === null) {
    return jsonError("You don't belong to a church yet.", 403);
  }
  const churchId = caller.churchId;
  const isAdmin = caller.role === "admin";
  const canWrite = caller.role === "admin" || caller.role === "pastor";

  const service = getServiceClient();
  if (!service) {
    return jsonError("Server configuration error.", 500);
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const action = (body.action ?? "").trim();

  try {
    // ---- create: assign a member to a staff owner (admin + pastor) ----
    if (action === "create") {
      if (!canWrite) return jsonError("Only an admin or pastor can create assignments.", 403);

      const memberId = body.member_id;
      if (typeof memberId !== "number" || !Number.isInteger(memberId)) {
        return jsonError("A valid member is required.", 400);
      }
      const ownerUserId = (body.owner_user_id ?? "").trim();
      if (!ownerUserId) return jsonError("Choose a staff member to own this assignment.", 400);

      const due = parseDueDate(body.due_date);
      if (!due.ok) return jsonError("Due date must be a valid date.", 400);

      if (!(await memberInChurch(service, churchId, memberId))) {
        return jsonError("That member isn't part of your church.", 404);
      }
      if (!(await ownerIsStaff(service, churchId, ownerUserId))) {
        return jsonError("The selected owner isn't an active staff member.", 400);
      }

      const insertPayload: AssignmentInsert = {
        church_id: churchId,
        member_id: memberId,
        owner_user_id: ownerUserId,
        due_date: due.value,
        created_by: caller.userId,
      };
      const { data: created, error: insertError } = await service
        .from("assignments")
        .insert(insertPayload as never)
        .select("id")
        .limit(1);

      if (insertError) {
        // Partial unique index: one OPEN assignment per member.
        if (insertError.code === "23505") {
          return jsonError("This member already has an open assignment — reassign instead.", 409);
        }
        console.error("[assignments/create] insert failed:", insertError);
        return jsonError("Could not create the assignment.", 500);
      }
      const newId = (created as Array<{ id: number }> | null)?.[0]?.id;
      if (!newId) {
        console.error("[assignments/create] insert returned no id");
        return jsonError("Could not create the assignment.", 500);
      }

      // Optional T2 note — its own row so RLS hides it from viewers. Written
      // all-or-nothing: if the note fails, roll back the assignment.
      const note = (body.note ?? "").trim();
      if (note) {
        const notePayload: AssignmentNoteInsert = {
          assignment_id: newId,
          church_id: churchId,
          note,
        };
        const { error: noteError } = await service
          .from("assignment_notes")
          .insert(notePayload as never);
        if (noteError) {
          await service.from("assignments").delete().eq("church_id", churchId).eq("id", newId);
          console.error("[assignments/create] note insert failed (rolled back):", noteError);
          return jsonError("Could not save the assignment note.", 500);
        }
      }

      return NextResponse.json({ success: true, id: newId });
    }

    // ---- set_done: toggle done/not-done (admin any row; pastor only own) ----
    if (action === "set_done") {
      if (!canWrite) return jsonError("Only an admin or pastor can update assignments.", 403);

      const assignmentId = body.assignment_id;
      if (typeof assignmentId !== "number") return jsonError("A valid assignment is required.", 400);
      if (typeof body.done !== "boolean") return jsonError("done must be true or false.", 400);

      const assignment = await loadAssignment(service, churchId, assignmentId);
      if (!assignment) return jsonError("That assignment doesn't exist in your church.", 404);

      // pastor-own: a pastor may only act on rows they own.
      if (!isAdmin && assignment.owner_user_id !== caller.userId) {
        return jsonError("You can only update assignments you own.", 403);
      }

      const done = body.done;
      const updatePayload: AssignmentUpdate = {
        done,
        done_at: done ? nowIso() : null,
        updated_at: nowIso(),
      };
      const { error } = await service
        .from("assignments")
        .update(updatePayload as never)
        .eq("church_id", churchId)
        .eq("id", assignmentId);

      if (error) {
        // Re-opening (done -> false) can collide with a newer open row for the member.
        if (error.code === "23505") {
          return jsonError("This member already has another open assignment — reassign instead.", 409);
        }
        console.error("[assignments/set_done] update failed:", error);
        return jsonError("Could not update the assignment.", 500);
      }

      return NextResponse.json({ success: true, id: assignmentId, done });
    }

    // ---- update: edit due_date and/or note ----
    //   due_date is on the assignment row  → admin-any / pastor-own
    //   note is in assignment_notes (T2)   → admin + pastor, church-wide (not owner-scoped)
    if (action === "update") {
      if (!canWrite) return jsonError("Only an admin or pastor can update assignments.", 403);

      const assignmentId = body.assignment_id;
      if (typeof assignmentId !== "number") return jsonError("A valid assignment is required.", 400);

      const hasDue = Object.prototype.hasOwnProperty.call(body, "due_date");
      const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
      if (!hasDue && !hasNote) return jsonError("Nothing to update.", 400);

      const assignment = await loadAssignment(service, churchId, assignmentId);
      if (!assignment) return jsonError("That assignment doesn't exist in your church.", 404);

      if (hasDue) {
        // due_date is assignment-level: pastor-own.
        if (!isAdmin && assignment.owner_user_id !== caller.userId) {
          return jsonError("You can only edit the due date on assignments you own.", 403);
        }
        const due = parseDueDate(body.due_date);
        if (!due.ok) return jsonError("Due date must be a valid date.", 400);

        const duePayload: AssignmentUpdate = { due_date: due.value, updated_at: nowIso() };
        const { error } = await service
          .from("assignments")
          .update(duePayload as never)
          .eq("church_id", churchId)
          .eq("id", assignmentId);
        if (error) {
          console.error("[assignments/update] due_date failed:", error);
          return jsonError("Could not update the due date.", 500);
        }
      }

      if (hasNote) {
        // Note is shared collaborative care (T2): any admin/pastor in the church may edit.
        const note = body.note === null ? null : String(body.note).trim() || null;
        const notePayload: AssignmentNoteInsert = {
          assignment_id: assignmentId,
          church_id: churchId,
          note,
          updated_at: nowIso(),
        };
        const { error } = await service
          .from("assignment_notes")
          .upsert(notePayload as never, { onConflict: "assignment_id" });
        if (error) {
          console.error("[assignments/update] note upsert failed:", error);
          return jsonError("Could not update the note.", 500);
        }
      }

      return NextResponse.json({ success: true, id: assignmentId });
    }

    // ---- reassign: change the owner (admin only) ----
    if (action === "reassign") {
      if (!isAdmin) return jsonError("Only an admin can reassign an assignment.", 403);

      const assignmentId = body.assignment_id;
      if (typeof assignmentId !== "number") return jsonError("A valid assignment is required.", 400);

      const assignment = await loadAssignment(service, churchId, assignmentId);
      if (!assignment) return jsonError("That assignment doesn't exist in your church.", 404);

      // Allow explicit unassign (null) or a validated staff owner.
      let newOwner: string | null = null;
      const raw = body.owner_user_id;
      if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
        newOwner = String(raw).trim();
        if (!(await ownerIsStaff(service, churchId, newOwner))) {
          return jsonError("The selected owner isn't an active staff member.", 400);
        }
      }

      const reassignPayload: AssignmentUpdate = { owner_user_id: newOwner, updated_at: nowIso() };
      const { error } = await service
        .from("assignments")
        .update(reassignPayload as never)
        .eq("church_id", churchId)
        .eq("id", assignmentId);
      if (error) {
        console.error("[assignments/reassign] update failed:", error);
        return jsonError("Could not reassign the assignment.", 500);
      }

      return NextResponse.json({ success: true, id: assignmentId, owner_user_id: newOwner });
    }

    // ---- delete: remove an assignment (admin only); cascade drops the note ----
    if (action === "delete") {
      if (!isAdmin) return jsonError("Only an admin can delete an assignment.", 403);

      const assignmentId = body.assignment_id;
      if (typeof assignmentId !== "number") return jsonError("A valid assignment is required.", 400);

      const assignment = await loadAssignment(service, churchId, assignmentId);
      if (!assignment) return jsonError("That assignment doesn't exist in your church.", 404);

      const { error } = await service
        .from("assignments")
        .delete()
        .eq("church_id", churchId)
        .eq("id", assignmentId);
      if (error) {
        console.error("[assignments/delete] delete failed:", error);
        return jsonError("Could not delete the assignment.", 500);
      }

      return NextResponse.json({ success: true });
    }

    return jsonError("Unknown action.", 400);
  } catch (err) {
    console.error("[assignments] unexpected error:", err);
    return jsonError("Something went wrong handling the assignment.", 500);
  }
}

type Identity = { name: string | null; email: string | null };

// Pull a human name out of auth user_metadata (full_name / name / display_name).
function readName(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  const value = meta.full_name ?? meta.name ?? meta.display_name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// GET /api/assignments → { owners, myChecklist, teamBoard }.
// owner_user_id is resolved to name/email server-side (auth.users isn't browser
// readable). Notes (T2) are ONLY read and attached for admin/pastor — a viewer's
// payload literally never contains a note string, because we never query the
// assignment_notes table for them.
export async function GET(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get("authorization");

  let caller;
  try {
    caller = await resolveCaller(authorization);
  } catch {
    return jsonError("Could not verify your account.", 500);
  }
  if (!caller) {
    return jsonError("Authentication is required.", 401);
  }
  if (caller.churchId === null || caller.role === null) {
    return jsonError("You don't belong to a church yet.", 403);
  }
  const churchId = caller.churchId;
  const callerUserId = caller.userId;
  const callerRole = caller.role;
  const canSeeNotes = callerRole === "admin" || callerRole === "pastor";

  const service = getServiceClient();
  if (!service) {
    return jsonError("Server configuration error.", 500);
  }

  try {
    // All assignments for the church (the team board; My Checklist is a subset).
    const { data: aRows, error: aErr } = await service
      .from("assignments")
      .select("*")
      .eq("church_id", churchId);
    if (aErr) throw aErr;
    const assignments = (aRows as AssignmentRow[] | null) ?? [];

    // members.id -> display name
    const { data: mRows, error: mErr } = await service
      .from("members")
      .select("id, name")
      .eq("church_id", churchId);
    if (mErr) throw mErr;
    const memberName = new Map<number, string>();
    for (const m of (mRows as Array<{ id: number; name: string | null }> | null) ?? []) {
      memberName.set(m.id, (m.name ?? "").trim() || "Unknown member");
    }

    // Staff eligible to own (admin + pastor) — the owners picker.
    const { data: sRows, error: sErr } = await service
      .from("church_users")
      .select("user_id, role")
      .eq("church_id", churchId);
    if (sErr) throw sErr;
    const staff = (sRows as Array<{ user_id: string; role: string }> | null) ?? [];
    const eligible = staff.filter((s) => s.role === "admin" || s.role === "pastor");

    // Resolve identities for owners we need to render (eligible staff + any owner
    // currently on a row, so names render for ALL roles even on edge cases).
    const identity = new Map<string, Identity>();
    const toResolve = new Set<string>(eligible.map((s) => s.user_id));
    for (const a of assignments) if (a.owner_user_id) toResolve.add(a.owner_user_id);
    await Promise.all(
      [...toResolve].map(async (uid) => {
        try {
          const { data } = await service.auth.admin.getUserById(uid);
          identity.set(uid, {
            name: readName(data.user?.user_metadata),
            email: data.user?.email ?? null,
          });
        } catch (e) {
          console.error("[assignments GET] getUserById failed:", uid, e);
          identity.set(uid, { name: null, email: null });
        }
      }),
    );

    const owners = eligible
      .map((s) => {
        const id = identity.get(s.user_id);
        return { user_id: s.user_id, name: id?.name ?? null, email: id?.email ?? null };
      })
      .sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""));

    // Notes — ONLY for admin/pastor. We don't even touch the table for viewers.
    const noteByAssignment = new Map<number, string | null>();
    if (canSeeNotes) {
      const { data: nRows, error: nErr } = await service
        .from("assignment_notes")
        .select("assignment_id, note")
        .eq("church_id", churchId);
      if (nErr) throw nErr;
      for (const n of (nRows as Array<{ assignment_id: number; note: string | null }> | null) ?? []) {
        noteByAssignment.set(n.assignment_id, n.note ?? null);
      }
    }

    const items = assignments.map((a) => {
      const ownerId = a.owner_user_id;
      const ownerIdentity = ownerId ? identity.get(ownerId) : undefined;
      const base = {
        id: a.id,
        member_id: a.member_id,
        member_name: memberName.get(a.member_id) ?? "Unknown member",
        owner_user_id: ownerId,
        owner_name: ownerId ? ownerIdentity?.name ?? null : null,
        owner_email: ownerId ? ownerIdentity?.email ?? null : null,
        due_date: a.due_date,
        done: a.done,
        done_at: a.done_at,
        created_at: a.created_at,
        updated_at: a.updated_at,
      };
      // Note key is attached ONLY for admin/pastor — never for viewers.
      return canSeeNotes ? { ...base, note: noteByAssignment.get(a.id) ?? null } : base;
    });

    // Open first, then by due date (nulls last), then newest created.
    items.sort((x, y) => {
      if (x.done !== y.done) return x.done ? 1 : -1;
      const dx = x.due_date ?? "9999-12-31";
      const dy = y.due_date ?? "9999-12-31";
      if (dx !== dy) return dx < dy ? -1 : 1;
      return (y.created_at ?? "").localeCompare(x.created_at ?? "");
    });

    const myChecklist = items.filter((i) => i.owner_user_id === callerUserId);

    return NextResponse.json({
      success: true,
      caller_role: callerRole,
      caller_user_id: callerUserId,
      owners,
      myChecklist,
      teamBoard: items,
    });
  } catch (err) {
    console.error("[assignments GET] failed:", err);
    return jsonError("Could not load assignments.", 500);
  }
}
