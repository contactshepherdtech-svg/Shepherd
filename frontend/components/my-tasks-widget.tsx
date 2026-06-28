"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Circle, ListChecks, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAssignments,
  formatDueDate,
  postAssignment,
  type AssignmentItem,
} from "@/lib/assignments-client";

// Floating "My Tasks" widget (desktop, top-right, every page except Settings). Shows
// the signed-in user's OWN open assignments and lets them tick (done) or edit the note.
// PURE PRESENTATION over already-secured routes: the tick is the /api/assignments
// set_done path (pastor-own / admin-all) and the pencil is the assignment_notes (T2)
// update path — both enforced server-side. The widget only ever shows myChecklist
// (the caller's own), so it adds no new write surface and no new endpoint.
export function MyTasksWidget() {
  const { churchUser } = useAuth();
  const pathname = usePathname();
  const role = churchUser?.role ?? null;
  const canHaveTasks = role === "admin" || role === "pastor";

  const [open, setOpen] = useState<AssignmentItem[]>([]);
  const [expanded, setExpanded] = useState(true); // expanded by default on desktop
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<AssignmentItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canHaveTasks) {
      setOpen([]);
      return;
    }
    const res = await fetchAssignments();
    if (!res.success) {
      setError(res.error ?? "Could not load your tasks.");
      return;
    }
    setError(null);
    setOpen(res.myChecklist.filter((a) => !a.done));
  }, [canHaveTasks]);

  // Refetch on mount + each route change (a newly-assigned task shows on the next
  // page the user visits). No polling for v1.
  useEffect(() => {
    void load();
  }, [load, pathname]);

  const onTick = async (item: AssignmentItem) => {
    setBusyId(item.id);
    setError(null);
    const { ok, error: err } = await postAssignment({
      action: "set_done",
      assignment_id: item.id,
      done: true,
    });
    if (ok) {
      setOpen((cur) => cur.filter((a) => a.id !== item.id)); // done → drops out
    } else {
      setError(err ?? "Could not update the task.");
    }
    setBusyId(null);
  };

  const openNote = (item: AssignmentItem) => {
    setNoteFor(item);
    setNoteDraft(item.note ?? "");
  };

  const saveNote = async () => {
    if (!noteFor) return;
    setNoteSaving(true);
    const next = noteDraft.trim() || null;
    const { ok, error: err } = await postAssignment({
      action: "update",
      assignment_id: noteFor.id,
      note: next,
    });
    setNoteSaving(false);
    if (!ok) {
      setError(err ?? "Could not save the note.");
      return;
    }
    // Reflect locally so reopening the pencil shows the latest note.
    setOpen((cur) => cur.map((a) => (a.id === noteFor.id ? { ...a, note: next } : a)));
    setNoteFor(null);
  };

  // Gate stack (after hooks): role → settings route → zero open tasks all render nothing.
  if (!canHaveTasks) return null;
  if (pathname.startsWith("/settings")) return null;
  if (open.length === 0) return null;

  return (
    <>
      {/* Desktop-only (matches the sidebar's lg breakpoint); mobile uses /assignments.
          Anchored bottom-right so it never collides with the member page's sticky
          top-right action pane; the expanded card grows upward from the pill. */}
      <div className="fixed bottom-4 right-4 z-30 hidden w-[320px] lg:block">
        {expanded ? (
          <div className="rounded-2xl border border-border/70 bg-card shadow-[0_18px_44px_rgba(17,24,39,0.12)]">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListChecks className="size-4 text-primary" />
                My Tasks
                <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
                  {open.length}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Collapse my tasks"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
            <div className="shepherd-scrollbar max-h-[60vh] space-y-1.5 overflow-y-auto p-2">
              {open.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg border border-border/60 bg-[#FAFBFA] p-2.5"
                >
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onTick(item)}
                    className="mt-0.5 text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
                    aria-label={`Mark ${item.member_name} done`}
                  >
                    <Circle className="size-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.member_name}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDueDate(item.due_date)}</p>
                    {item.note ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">📝 {item.note}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openNote(item)}
                    className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`Edit note for ${item.member_name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {error ? <p className="px-4 pb-3 text-xs text-red-600">{error}</p> : null}
          </div>
        ) : (
          <button
            type="button"
            aria-label="Expand my tasks"
            onClick={() => setExpanded(true)}
            className="ml-auto flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-[0_10px_28px_rgba(17,24,39,0.12)] transition-colors hover:border-primary/40"
          >
            <ListChecks className="size-4 text-primary" />
            My Tasks
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
              {open.length}
            </span>
          </button>
        )}
      </div>

      {/* Note modal — lightest clean overlay (no dialog primitive exists). */}
      {noteFor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setNoteFor(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Note · {noteFor.member_name}</p>
              <button
                type="button"
                onClick={() => setNoteFor(null)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <textarea
              className="mt-3 min-h-[120px] w-full rounded-lg border border-border/90 bg-card px-3 py-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none"
              placeholder="Add a note for the care team"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNoteFor(null)} disabled={noteSaving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void saveNote()} disabled={noteSaving}>
                {noteSaving ? "Saving…" : "Save note"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
