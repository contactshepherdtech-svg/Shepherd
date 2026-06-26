"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  assignmentOwnerLabel,
  fetchAssignments,
  formatDueDate,
  ownerLabel,
  postAssignment,
  type AssignmentActionBody,
  type AssignmentsResponse,
} from "@/lib/assignments-client";

const cellSelect =
  "h-8 rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50";
const cellInput =
  "h-8 rounded-lg border border-border/90 bg-card px-2 text-sm text-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none disabled:opacity-50";

export default function AssignmentsPage() {
  const { churchUser } = useAuth();
  const [data, setData] = useState<AssignmentsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchAssignments();
    if (!res.success) {
      setLoadError(res.error ?? "Could not load assignments.");
      return;
    }
    setLoadError(null);
    setData(res);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const act = useCallback(
    async (body: AssignmentActionBody) => {
      if (busy) return;
      setBusy(true);
      setActionError(null);
      const { ok, error } = await postAssignment(body);
      if (!ok) setActionError(error ?? "Action failed. Please try again.");
      else await load();
      setBusy(false);
    },
    [busy, load],
  );

  const role = data?.caller_role ?? churchUser?.role ?? null;
  const isAdmin = role === "admin";
  const canSeeNotes = role === "admin" || role === "pastor";

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>
    );
  }

  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading assignments…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Assignments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow-ups assigned to staff. Your checklist plus the whole team’s board.
        </p>
      </div>

      {actionError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
      ) : null}

      {/* My Checklist */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">My checklist</h2>
        <div className="mt-3 space-y-2">
          {data.myChecklist.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nothing assigned to you right now.</p>
          ) : (
            data.myChecklist.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-[#FAFBFA] p-3"
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ action: "set_done", assignment_id: item.id, done: !item.done })}
                  className="mt-0.5 text-primary disabled:opacity-50"
                  aria-label={item.done ? "Mark not done" : "Mark done"}
                >
                  {item.done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {item.member_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDueDate(item.due_date)}
                    {item.done ? " · Done" : ""}
                  </p>
                  {canSeeNotes && item.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">📝 {item.note}</p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Team Board */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team board</h2>
        {data.teamBoard.length === 0 ? (
          <p className="mt-3 py-2 text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Member</th>
                  <th className="py-2 pr-3 font-semibold">Owner</th>
                  <th className="py-2 pr-3 font-semibold">Due</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  {canSeeNotes ? <th className="py-2 pr-3 font-semibold">Note</th> : null}
                  {isAdmin ? <th className="py-2 font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.teamBoard.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="py-2 pr-3 font-medium text-foreground">{item.member_name}</td>

                    {/* Owner — admin can reassign inline; everyone else sees the name. */}
                    <td className="py-2 pr-3">
                      {isAdmin ? (
                        <select
                          className={cellSelect}
                          value={item.owner_user_id ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            void act({
                              action: "reassign",
                              assignment_id: item.id,
                              owner_user_id: e.target.value || null,
                            })
                          }
                        >
                          <option value="">Unassigned</option>
                          {data.owners.map((o) => (
                            <option key={o.user_id} value={o.user_id}>
                              {ownerLabel(o)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={item.owner_user_id ? "text-foreground" : "text-muted-foreground"}>
                          {assignmentOwnerLabel(item)}
                        </span>
                      )}
                    </td>

                    {/* Due — admin can edit inline. */}
                    <td className="py-2 pr-3">
                      {isAdmin ? (
                        <input
                          type="date"
                          className={cellInput}
                          value={item.due_date ?? ""}
                          disabled={busy}
                          onChange={(e) =>
                            void act({
                              action: "update",
                              assignment_id: item.id,
                              due_date: e.target.value || null,
                            })
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">{formatDueDate(item.due_date)}</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.done ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.done ? "Done" : "Open"}
                      </span>
                    </td>

                    {/* Note — column rendered ONLY for admin/pastor. */}
                    {canSeeNotes ? (
                      <td className="py-2 pr-3 text-muted-foreground">
                        {isAdmin ? (
                          <input
                            type="text"
                            className={`${cellInput} w-44`}
                            placeholder="Add a note"
                            defaultValue={item.note ?? ""}
                            disabled={busy}
                            onBlur={(e) => {
                              const next = e.currentTarget.value.trim();
                              if (next === (item.note ?? "")) return;
                              void act({ action: "update", assignment_id: item.id, note: next || null });
                            }}
                          />
                        ) : (
                          <span>{item.note || "—"}</span>
                        )}
                      </td>
                    ) : null}

                    {/* Actions — admin only. */}
                    {isAdmin ? (
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void act({ action: "set_done", assignment_id: item.id, done: !item.done })
                            }
                          >
                            {item.done ? "Reopen" : "Mark done"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void act({ action: "delete", assignment_id: item.id })}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
