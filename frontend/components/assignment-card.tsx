"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ListChecks, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  assignmentOwnerLabel,
  fetchAssignments,
  formatDueDate,
  ownerLabel,
  postAssignment,
  type AssignmentItem,
  type AssignmentOwner,
} from "@/lib/assignments-client";

type AssignmentCardProps = {
  memberDbId: number;
  memberName: string;
  churchId: number | null;
};

const selectClass =
  "h-9 w-full rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50";
const inputClass =
  "h-9 w-full rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50";

export function AssignmentCard({ memberDbId, memberName, churchId }: AssignmentCardProps) {
  const { churchUser, user } = useAuth();
  const role = churchUser?.role ?? null;
  const isAdmin = role === "admin";
  const canWriteAssign = role === "admin" || role === "pastor";

  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<AssignmentOwner[]>([]);
  const [assignment, setAssignment] = useState<AssignmentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create-form fields (used when there is no open assignment).
  const [newOwner, setNewOwner] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newNote, setNewNote] = useState("");
  // Note editor (used when an open assignment exists).
  const [noteDraft, setNoteDraft] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchAssignments();
    if (!res.success) {
      setError(res.error ?? "Could not load assignment.");
      setLoading(false);
      return;
    }
    setOwners(res.owners);
    const open = res.teamBoard.find((a) => a.member_id === memberDbId && !a.done) ?? null;
    setAssignment(open);
    setNoteDraft(open?.note ?? "");
    setLoading(false);
  }, [memberDbId]);

  useEffect(() => {
    setLoading(true);
    setAssignment(null);
    setNewOwner("");
    setNewDue("");
    setNewNote("");
    void load();
  }, [load]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const { ok, error: err } = await fn();
    if (!ok) {
      setError(err ?? "Action failed. Please try again.");
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  };

  const onCreate = () => {
    if (!newOwner) {
      setError("Choose a staff member to own this assignment.");
      return;
    }
    void run(() =>
      postAssignment({
        action: "create",
        member_id: memberDbId,
        owner_user_id: newOwner,
        due_date: newDue || null,
        note: newNote.trim() || null,
      }),
    );
  };

  const onToggleDone = (done: boolean) => {
    if (!assignment) return;
    void run(() => postAssignment({ action: "set_done", assignment_id: assignment.id, done }));
  };

  const onReassign = (ownerUserId: string) => {
    if (!assignment) return;
    void run(() =>
      postAssignment({
        action: "reassign",
        assignment_id: assignment.id,
        owner_user_id: ownerUserId || null,
      }),
    );
  };

  const onUpdateDue = (due: string) => {
    if (!assignment) return;
    void run(() =>
      postAssignment({ action: "update", assignment_id: assignment.id, due_date: due || null }),
    );
  };

  const onSaveNote = () => {
    if (!assignment) return;
    void run(() =>
      postAssignment({ action: "update", assignment_id: assignment.id, note: noteDraft.trim() || null }),
    );
  };

  // Ownership-derived gates (mirror the server rules so we never show a control
  // that would only 403).
  const ownsIt = Boolean(assignment && user && assignment.owner_user_id === user.id);
  const canToggleDone = Boolean(assignment) && (isAdmin || ownsIt);
  const canEditDue = Boolean(assignment) && (isAdmin || ownsIt);

  if (!churchId) return null;

  return (
    <Card>
      <CardHeader>
        <p className="shepherd-kicker">Assignment</p>
        <CardTitle className="inline-flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          Follow-up owner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading assignment…</p>
        ) : !canWriteAssign ? (
          // Viewer — read-only line, never a note.
          assignment ? (
            <div className="rounded-lg border border-border/80 bg-[#FAFBFA] p-3 text-sm">
              <p className="text-foreground">
                <span className="font-semibold">{assignmentOwnerLabel(assignment)}</span>
                {" · Due "}
                {formatDueDate(assignment.due_date)}
                {" · "}
                <span className="text-muted-foreground">Open</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open assignment.</p>
          )
        ) : assignment ? (
          // Open assignment exists — admin/pastor controls.
          <div className="space-y-3">
            <div className="rounded-lg border border-border/80 bg-[#FAFBFA] p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Current
              </p>
              <p className="mt-1 text-foreground">
                Owner: <span className="font-semibold">{assignmentOwnerLabel(assignment)}</span>
              </p>
            </div>

            {/* Reassign — admin only (pastors can't change owner). */}
            {isAdmin ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Owner
                </label>
                <select
                  className={selectClass}
                  value={assignment.owner_user_id ?? ""}
                  disabled={busy}
                  onChange={(e) => onReassign(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {owners.map((o) => (
                    <option key={o.user_id} value={o.user_id}>
                      {ownerLabel(o)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Due date — admin or the owning pastor. */}
            {canEditDue ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Due date
                </label>
                <input
                  type="date"
                  className={inputClass}
                  value={assignment.due_date ?? ""}
                  disabled={busy}
                  onChange={(e) => onUpdateDue(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Due: {formatDueDate(assignment.due_date)}</p>
            )}

            {/* Note (T2) — any admin/pastor in the church. */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Note
              </label>
              <textarea
                className="min-h-[64px] w-full rounded-lg border border-border/90 bg-card px-2 py-1.5 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50"
                placeholder="Shared note for the care team"
                value={noteDraft}
                disabled={busy}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <Button size="sm" variant="secondary" disabled={busy} onClick={onSaveNote} className="gap-1.5">
                Save note
              </Button>
            </div>

            {canToggleDone ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => onToggleDone(true)}
                className="w-full justify-center gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                Mark done
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only the owner or an admin can mark this done.
              </p>
            )}
          </div>
        ) : (
          // No open assignment — create form (admin/pastor).
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Assign to
              </label>
              <select
                className={selectClass}
                value={newOwner}
                disabled={busy}
                onChange={(e) => setNewOwner(e.target.value)}
              >
                <option value="">Select a staff member…</option>
                {owners.map((o) => (
                  <option key={o.user_id} value={o.user_id}>
                    {ownerLabel(o)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Due date (optional)
              </label>
              <input
                type="date"
                className={inputClass}
                value={newDue}
                disabled={busy}
                onChange={(e) => setNewDue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Note (optional)
              </label>
              <textarea
                className="min-h-[64px] w-full rounded-lg border border-border/90 bg-card px-2 py-1.5 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50"
                placeholder={`Why is ${memberName} being assigned?`}
                value={newNote}
                disabled={busy}
                onChange={(e) => setNewNote(e.target.value)}
              />
            </div>
            <Button disabled={busy} onClick={onCreate} className="w-full justify-center gap-1.5">
              <UserPlus className="size-4" />
              Assign
            </Button>
          </div>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
