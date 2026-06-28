"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { PriorityOutreachCard } from "@/components/priority-outreach-card";
import { RiskBadge } from "@/components/risk-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildMemberDirectoryRows,
  getAttendance,
  getGmailConnection,
  getMembers,
  getFirstVisitFollowUpState,
  getOutreachStatuses,
  getOutreachStatusForMember,
  getPriorityOutreachRows,
  getRiskScores,
  isGmailConnected,
  isVisibleInQueue,
  type MemberDirectoryRow,
  type OutreachStatusRecord,
  type RiskTier,
} from "@/lib/data";
import { useAuth } from "@/lib/auth-context";

const tiers: Array<"All" | RiskTier> = ["All", "Watch", "At Risk", "Critical"];

export default function PriorityPage() {
  const { churchId } = useAuth();
  const [tier, setTier] = useState<(typeof tiers)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [riskScoreCount, setRiskScoreCount] = useState(0);
  const [queueRows, setQueueRows] = useState<MemberDirectoryRow[]>([]);
  const [statuses, setStatuses] = useState<OutreachStatusRecord[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadStatuses = useCallback(async (id: number) => {
    const fresh = await getOutreachStatuses(id);
    setStatuses(fresh);
  }, []);

  const onStatusChange = useCallback(() => {
    if (churchId) void loadStatuses(churchId);
  }, [churchId, loadStatuses]);

  const onVisitorFollowedUp = useCallback((memberPcoId: string, followedUpAt: string) => {
    const matchedMember = queueRows.find((row) => row.member.pco_id === memberPcoId);
    const followedUpDate = new Date(followedUpAt);

    setQueueRows((current) =>
      current.map((row) =>
        row.member.pco_id === memberPcoId
          ? {
              ...row,
              member: {
                ...row.member,
                last_followup_at: Number.isNaN(followedUpDate.getTime()) ? new Date() : followedUpDate,
              },
            }
          : row,
      ),
    );
    setSuccessMessage(`${matchedMember?.member.name ?? "Visitor"} marked followed up.`);
    window.setTimeout(() => setSuccessMessage(null), 3000);
  }, [queueRows]);

  useEffect(() => {
    let active = true;

    const loadQueue = async () => {
      setLoading(true);

      if (!churchId) {
        if (active) {
          setRiskScoreCount(0);
          setQueueRows([]);
          setStatuses([]);
          setGmailConnected(false);
          setLoading(false);
        }
        return;
      }

      const [members, attendance, riskScores, outreachStatuses, gmailConnection] = await Promise.all([
        getMembers(churchId),
        getAttendance(churchId),
        getRiskScores(churchId),
        getOutreachStatuses(churchId),
        getGmailConnection(churchId),
      ]);

      if (active) {
        const memberRows = buildMemberDirectoryRows(members, riskScores, attendance);
        setRiskScoreCount(riskScores.length);
        setQueueRows(getPriorityOutreachRows(memberRows));
        setStatuses(outreachStatuses);
        setGmailConnected(isGmailConnected(gmailConnection));
        setLoading(false);
      }
    };

    void loadQueue();

    return () => {
      active = false;
    };
  }, [churchId]);

  const filteredQueue = useMemo(() => {
    const byStatus = queueRows.filter((row) => isVisibleInQueue(row.member.pco_id, statuses));
    if (tier === "All") return byStatus;
    return byStatus.filter((row) => row.risk.tier === tier);
  }, [queueRows, statuses, tier]);

  const urgentCount = filteredQueue.filter((row) => row.risk.tier === "Critical").length;

  const firstVisitCounts = useMemo(() => {
    let dueNow = 0;
    let comingUp = 0;
    for (const row of filteredQueue) {
      const state = getFirstVisitFollowUpState(
        row.member,
        getOutreachStatusForMember(row.member.pco_id, statuses),
      );
      if (state === "due_now") dueNow += 1;
      else if (state === "holding") comingUp += 1;
    }
    return { dueNow, comingUp };
  }, [filteredQueue, statuses]);

  if (loading) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading data...</CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Queue Summary</p>
            <CardTitle>Operational follow-up queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-[var(--surface-2)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Open</p>
                <p className="mt-1 text-2xl font-semibold">{filteredQueue.length}</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-[var(--surface-2)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Critical</p>
                <p className="mt-1 text-2xl font-semibold">{urgentCount}</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-[var(--surface-2)] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Ready</p>
                <p className="mt-1 text-2xl font-semibold">{filteredQueue.length - urgentCount}</p>
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/8 p-3 text-sm text-muted-foreground">
              {riskScoreCount
                ? "Focus first on critical members and visitors awaiting personal follow-up."
                : "Visitor follow-up still appears here even before risk scoring is available."}
            </div>
            {firstVisitCounts.dueNow || firstVisitCounts.comingUp ? (
              <div className="rounded-lg border border-border/80 bg-[var(--surface-2)] p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">First-visit follow-ups</span> · Due now{" "}
                <span className="font-semibold text-primary">{firstVisitCounts.dueNow}</span> · Coming up{" "}
                <span className="font-semibold text-foreground">{firstVisitCounts.comingUp}</span>
              </div>
            ) : null}
            {successMessage ? (
              <div className="rounded-lg border border-primary/25 bg-primary/8 p-3 text-sm font-medium text-primary">
                {successMessage}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Queue Filters</p>
            <CardTitle>Filter by urgency tier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Filter className="size-3.5" />
              Tier selection
            </p>
            <div className="flex flex-wrap gap-2">
              {tiers.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTier(item)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    tier === item
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredQueue.slice(0, 3).map((row) => (
                <div
                  key={row.member.id}
                  className="flex items-center justify-between rounded-lg border border-border/80 bg-[var(--surface-2)] p-2"
                >
                  <span className="text-sm font-medium text-foreground">{row.member.name}</span>
                  {row.risk.tier ? <RiskBadge tier={row.risk.tier} /> : null}
                </div>
              ))}
              {!filteredQueue.length ? (
                <div className="rounded-lg border border-dashed border-border bg-[var(--surface-2)] p-4 text-sm text-muted-foreground">
                  {queueRows.length ? "No queue items match this filter." : "No active follow-up queue items."}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {filteredQueue.map((row) => (
          <PriorityOutreachCard
            key={row.member.id}
            row={row}
            churchId={churchId!}
            gmailConnected={gmailConnected}
            outreachStatus={getOutreachStatusForMember(row.member.pco_id, statuses)}
            onStatusChange={onStatusChange}
            onVisitorFollowedUp={onVisitorFollowedUp}
          />
        ))}
        {!filteredQueue.length ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {queueRows.length
                ? "No queue items match this filter."
                : "No active follow-up queue items."}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </PageShell>
  );
}
