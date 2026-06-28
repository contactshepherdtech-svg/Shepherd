"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  assignmentOwnerLabel,
  fetchAssignments,
  ownerLabel,
  postAssignment,
  type AssignmentItem,
  type AssignmentOwner,
} from "@/lib/assignments-client";

// Header presentation of the assignment flow: a read-only "Assigned to" pill (all
// roles) + an admin/pastor-only Assign/Reassign button that opens a modal. This is a
// NEW PRESENTATION of the existing AssignmentCard logic — it reuses fetchAssignments
// and the /api/assignments write path (create / reassign / update). No new endpoint,
// no new write path. The button + modal render ONLY for admin/pastor; viewers get the
// read-only pill and nothing else.
const fieldClass =
  "h-9 w-full rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50";

type MemberAssignProps = {
  memberDbId: number;
  memberName: string;
  churchId: number | null;
};

export function MemberAssign({ memberDbId, memberName, churchId }: MemberAssignProps) {
  const { churchUser, user } = useAuth();
  const role = churchUser?.role ?? null;
  const isAdmin = role === "admin";
  const canAssign = role === "admin" || role === "pastor";

  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState<AssignmentOwner[]>([]);
  const [assignment, setAssignment] = useState<AssignmentItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetchAssignments();
    if (!res.success) {
      setError(res.error ?? "Could not load assignment.");
      setLoading(false);
      return;
    }
    setError(null);
    setOwners(res.owners);
    setAssignment(res.teamBoard.find((a) => a.member_id === memberDbId && !a.done) ?? null);
    setLoading(false);
  }, [memberDbId]);

  useEffect(() => {
    setLoading(true);
    setAssignment(null);
    setModalOpen(false);
    void load();
  }, [load]);

  const ownsIt = Boolean(assignment && user && assignment.owner_user_id === user.id);

  const openModal = () => {
    // Prefill from the current open assignment (reassign) or blank (create).
    setOwner(assignment?.owner_user_id ?? "");
    setDue(assignment?.due_date ?? "");
    setNote(assignment?.note ?? "");
    setError(null);
    setModalOpen(true);
  };

  // Mirrors AssignmentCard's per-role server rules so we never fire a call that 403s:
  //   create (no open) → admin/pastor; reassign owner → admin only;
  //   due → admin or owner; note → admin/pastor (T2). due/note go as separate updates.
  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!assignment) {
        if (!owner) {
          setError("Choose a staff member to own this follow-up.");
          setBusy(false);
          return;
        }
        const r = await postAssignment({
          action: "create",
          member_id: memberDbId,
          owner_user_id: owner,
          due_date: due || null,
          note: note.trim() || null,
        });
        if (!r.ok) throw new Error(r.error ?? "Could not assign.");
      } else {
        if (isAdmin && owner !== (assignment.owner_user_id ?? "")) {
          const r = await postAssignment({ action: "reassign", assignment_id: assignment.id, owner_user_id: owner || null });
          if (!r.ok) throw new Error(r.error ?? "Could not reassign.");
        }
        if ((isAdmin || ownsIt) && (due || "") !== (assignment.due_date ?? "")) {
          const r = await postAssignment({ action: "update", assignment_id: assignment.id, due_date: due || null });
          if (!r.ok) throw new Error(r.error ?? "Could not update the due date.");
        }
        if ((note.trim() || "") !== (assignment.note ?? "")) {
          const r = await postAssignment({ action: "update", assignment_id: assignment.id, note: note.trim() || null });
          if (!r.ok) throw new Error(r.error ?? "Could not update the note.");
        }
      }
      await load();
      setModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!churchId) return null;

  const ownerText = loading ? "…" : assignment ? assignmentOwnerLabel(assignment) : "No owner";
  const ownerLocked = Boolean(assignment) && !isAdmin; // pastors can't reassign
  const dueLocked = Boolean(assignment) && !(isAdmin || ownsIt);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Assigned to:&nbsp;<span className="font-semibold text-foreground">{ownerText}</span>
        </span>
        {canAssign && !loading ? (
          <Button size="sm" onClick={openModal} className="gap-1.5">
            <UserPlus className="size-3.5" />
            {assignment ? "Reassign" : "Assign"}
          </Button>
        ) : null}
      </div>

      {modalOpen && canAssign ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !busy && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl glass-overlay p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {assignment ? "Reassign" : "Assign"} · {memberName}
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy}
                className="text-foreground/70 transition-colors hover:text-foreground disabled:opacity-50"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Assign to
                </label>
                <select
                  className={fieldClass}
                  value={owner}
                  disabled={busy || ownerLocked}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  <option value="">Select a staff member…</option>
                  {owners.map((o) => (
                    <option key={o.user_id} value={o.user_id}>
                      {ownerLabel(o)}
                    </option>
                  ))}
                </select>
                {ownerLocked ? (
                  <p className="text-xs text-muted-foreground">Only an admin can change the owner.</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Due date (optional)
                </label>
                <input
                  type="date"
                  className={fieldClass}
                  value={due}
                  disabled={busy || dueLocked}
                  onChange={(e) => setDue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Note (optional)
                </label>
                <textarea
                  className="min-h-[80px] w-full rounded-lg border border-border/90 bg-card px-3 py-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50"
                  placeholder={`Why is ${memberName} being assigned?`}
                  value={note}
                  disabled={busy}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {error ? <p className="text-xs text-red-600">{error}</p> : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void onSubmit()} disabled={busy}>
                  {busy ? "Saving…" : assignment ? "Save" : "Assign"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
