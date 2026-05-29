"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Filter, ListTodo, Phone, Sparkles } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { PriorityOutreachCard } from "@/components/priority-outreach-card";
import { RiskBadge } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildMemberDirectoryRows,
  getAttendance,
  getDefaultChurch,
  getMembers,
  getPriorityOutreachRows,
  getRiskScores,
  type MemberDirectoryRow,
  type RiskTier,
} from "@/lib/data";

const tiers: Array<"All" | RiskTier> = ["All", "Watch", "At Risk", "Critical"];

export default function PriorityPage() {
  const [tier, setTier] = useState<(typeof tiers)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [riskScoreCount, setRiskScoreCount] = useState(0);
  const [queueRows, setQueueRows] = useState<MemberDirectoryRow[]>([]);

  useEffect(() => {
    let active = true;

    const loadQueue = async () => {
      setLoading(true);

      const church = await getDefaultChurch();
      if (!church) {
        if (active) {
          setRiskScoreCount(0);
          setQueueRows([]);
          setLoading(false);
        }
        return;
      }

      const [members, attendance, riskScores] = await Promise.all([
        getMembers(church.id),
        getAttendance(church.id),
        getRiskScores(church.id),
      ]);

      if (active) {
        const memberRows = buildMemberDirectoryRows(members, riskScores, attendance);
        setRiskScoreCount(riskScores.length);
        setQueueRows(getPriorityOutreachRows(memberRows));
        setLoading(false);
      }
    };

    void loadQueue();

    return () => {
      active = false;
    };
  }, []);

  const filteredQueue = useMemo(() => {
    if (tier === "All") return queueRows;
    return queueRows.filter((row) => row.risk.tier === tier);
  }, [queueRows, tier]);

  const urgentCount = filteredQueue.filter((row) => row.risk.tier === "Critical").length;

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
      <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Queue Summary</p>
            <CardTitle>Operational follow-up queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total</p>
                <p className="mt-1 text-2xl font-semibold">{filteredQueue.length}</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Critical</p>
                <p className="mt-1 text-2xl font-semibold">{urgentCount}</p>
              </div>
              <div className="rounded-lg border border-border/80 bg-[#F8F2DA] p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Ready</p>
                <p className="mt-1 text-2xl font-semibold">{filteredQueue.length - urgentCount}</p>
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/8 p-3 text-sm text-muted-foreground">
              {riskScoreCount
                ? "Focus first on critical members where no attendance has been recorded in recent weeks."
                : "No risk scores found."}
            </div>
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
                  className="flex items-center justify-between rounded-lg border border-border/80 bg-[#F8F2DA] p-2"
                >
                  <span className="text-sm font-medium text-foreground">{row.member.name}</span>
                  {row.risk.tier ? <RiskBadge tier={row.risk.tier} /> : null}
                </div>
              ))}
              {!filteredQueue.length ? (
                <div className="rounded-lg border border-dashed border-border bg-[#F8F2DA] p-4 text-sm text-muted-foreground">
                  No risk scores found.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="shepherd-kicker">Team Actions</p>
            <CardTitle>Quick operational actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start gap-2">
              <ListTodo className="size-4" />
              Assign Follow-up Owner
            </Button>
            <Button variant="secondary" className="w-full justify-start gap-2">
              <Phone className="size-4" />
              Plan Call Block
            </Button>
            <Button variant="secondary" className="w-full justify-start gap-2">
              <AlertTriangle className="size-4" />
              Flag Urgent Care Cases
            </Button>
            <Button variant="secondary" className="w-full justify-start gap-2">
              <Sparkles className="size-4" />
              Draft Outreach Batch
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        {filteredQueue.map((row) => (
          <PriorityOutreachCard key={row.member.id} row={row} />
        ))}
        {!filteredQueue.length ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">No risk scores found.</CardContent>
          </Card>
        ) : null}
      </section>
    </PageShell>
  );
}
