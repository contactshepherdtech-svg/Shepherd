"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Search } from "lucide-react";

import { MemberCard } from "@/components/member-card";
import { MemberDetailPanel } from "@/components/member-detail-panel";
import { PageShell } from "@/components/page-shell";
import { RiskBadge } from "@/components/risk-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildMemberDirectoryRows,
  getAttendance,
  getMembers,
  getRiskScores,
  type MemberDirectoryRow,
  type RiskTier,
} from "@/lib/data";
import { useAuth } from "@/lib/auth-context";

const tierOptions: Array<"All" | RiskTier> = ["All", "Healthy", "Watch", "At Risk", "Critical"];

function MembersContent() {
  const { churchId } = useAuth();
  const searchParams = useSearchParams();
  const memberParam = searchParams.get("member");
  const actionParam = searchParams.get("action");
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<(typeof tierOptions)[number]>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [allMembersCount, setAllMembersCount] = useState(0);
  const [memberRows, setMemberRows] = useState<MemberDirectoryRow[]>([]);
  const [pendingAction, setPendingAction] = useState<"email" | null>(
    actionParam === "email" ? "email" : null,
  );

  useEffect(() => {
    let active = true;

    const loadMembers = async () => {
      setLoading(true);

      if (!churchId) {
        if (active) {
          setAllMembersCount(0);
          setMemberRows([]);
          setLoading(false);
        }
        return;
      }

      const [members, attendance, riskScores] = await Promise.all([
        getMembers(churchId),
        getAttendance(churchId),
        getRiskScores(churchId),
      ]);

      if (active) {
        setAllMembersCount(members.length);
        setMemberRows(buildMemberDirectoryRows(members, riskScores, attendance));
        setLoading(false);
      }
    };

    void loadMembers();

    return () => {
      active = false;
    };
  }, [churchId]);

  useEffect(() => {
    if (!memberRows.length || selectedId) {
      return;
    }

    const matchingMember = memberParam
      ? memberRows.find((row) => row.member.pco_id === memberParam || row.member.id === memberParam)
      : null;

    setSelectedId((matchingMember ?? memberRows[0]).member.id);
  }, [memberParam, memberRows, selectedId]);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return memberRows.filter((row) => {
      const matchesSearch =
        !search ||
        row.member.name.toLowerCase().includes(search) ||
        row.member.email.toLowerCase().includes(search);
      const matchesTier = tierFilter === "All" || row.risk.tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [memberRows, query, tierFilter]);

  const selectedMember = useMemo(() => {
    const fallback = filteredRows[0] ?? null;
    if (!selectedId) return fallback;
    return filteredRows.find((row) => row.member.id === selectedId) ?? fallback;
  }, [filteredRows, selectedId]);

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
      <section className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Card className="xl:h-[calc(100vh-178px)] xl:overflow-hidden">
          <CardHeader className="border-b border-border bg-white/92 backdrop-blur">
            <p className="shepherd-kicker">Members</p>
            <CardTitle>Searchable congregation list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 xl:h-[calc(100%-88px)] xl:overflow-hidden">
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or email"
                  className="pl-9 transition-all focus-visible:shadow-[0_0_0_4px_rgba(0,107,85,0.08)]"
                />
              </div>

              <div>
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Filter className="size-3.5" />
                  Risk Tier
                </p>
                <div className="flex flex-wrap gap-2">
                  {tierOptions.map((tier) => {
                    const active = tier === tierFilter;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setTierFilter(tier)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          active
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(0,107,85,0.16)]"
                            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-[#FAFBFA]"
                        }`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="shepherd-scrollbar space-y-2.5 pr-1 xl:max-h-[calc(100%-118px)] xl:overflow-y-auto">
              {!allMembersCount ? (
                <div className="rounded-lg border border-dashed border-border bg-[#FAFBFA] p-6 text-center">
                  <p className="text-sm font-medium text-foreground">No members found.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Sync your directory to populate this list.</p>
                </div>
              ) : (
                filteredRows.map((row) => (
                  <MemberCard
                    key={row.member.id}
                    row={row}
                    selected={selectedMember?.member.id === row.member.id}
                    onSelect={setSelectedId}
                  />
                ))
              )}

              {allMembersCount > 0 && !filteredRows.length ? (
                <div className="rounded-lg border border-dashed border-border bg-[#FAFBFA] p-6 text-center">
                  <p className="text-sm font-medium text-foreground">No members match your search.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try a different keyword or tier filter.</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedMember ? (
            <MemberDetailPanel
              row={selectedMember}
              churchId={churchId}
              autoGenerateEmail={pendingAction === "email"}
              onAutoEmailTriggered={() => setPendingAction(null)}
            />
          ) : null}
          {!selectedMember ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Select a member to open their 360 profile.</p>
              </CardContent>
            </Card>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Visible members:</span>
            <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-semibold text-foreground">
              {filteredRows.length}
            </span>
            {selectedMember?.risk.tier ? <RiskBadge tier={selectedMember.risk.tier} /> : null}
            {selectedMember && !selectedMember.risk.tier ? (
              <span className="rounded-full border border-border/80 bg-[#F3F5F4] px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                No risk score available
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export default function MembersPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading data...</CardContent>
          </Card>
        </PageShell>
      }
    >
      <MembersContent />
    </Suspense>
  );
}
