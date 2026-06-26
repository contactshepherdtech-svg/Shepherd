import { OUTREACH_WORKFLOW_LABELS, type OutreachWorkflowStatus } from "@/lib/data";

// Read-only pill for the outreach pipeline state. Shown to ALL roles (incl. viewer);
// the writer dropdown that *changes* it lives behind canWriteOutreach in the cards.
// Traffic-light scheme: grey=nothing yet, red=needs action (deeper than risk-Critical's
// lighter red, which also carries an icon), amber=in motion, lime=almost there, green=done.
const STYLES: Record<OutreachWorkflowStatus, string> = {
  new: "border-border/80 bg-muted text-muted-foreground",
  assigned: "border-red-300 bg-red-100 text-red-800",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  contacted: "border-lime-200 bg-lime-50 text-lime-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function OutreachStatusBadge({
  status,
  className = "",
}: {
  status: OutreachWorkflowStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STYLES[status]} ${className}`}
    >
      {OUTREACH_WORKFLOW_LABELS[status]}
    </span>
  );
}
