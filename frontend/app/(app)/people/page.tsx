"use client";

import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

type Review = { index: number; person: { full_name?: string; email?: string; phone?: string }; duplicates: Array<{ person_id: string; full_name: string; email: string | null; phone: string | null }> };

export default function PeoplePage() {
  const [csv, setCsv] = useState("full_name,email,phone\n");
  const [review, setReview] = useState<Review[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(confirmDuplicates = false) {
    const accessToken = (await supabase?.auth.getSession())?.data.session?.access_token;
    const response = await fetch("/api/people", { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ action: "import_csv", csv, confirm_duplicates: confirmDuplicates }) });
    const result = await response.json().catch(() => ({}));
    if (result.requires_review) { setReview(result.review ?? []); setMessage("Possible duplicates found. Review before importing."); return; }
    setReview([]); setMessage(result.success ? `Imported ${result.people?.length ?? 0} people.` : result.error ?? "Import failed.");
  }

  return <PageShell><div><h1 className="text-2xl font-semibold">People</h1><p className="text-sm text-muted-foreground">Create people or import CSV contacts without relying on Planning Center IDs.</p></div>
    <div className="space-y-4 max-w-3xl">
      <textarea className="min-h-56 w-full rounded-md border bg-background p-3 font-mono text-sm" value={csv} onChange={(event) => setCsv(event.target.value)} aria-label="CSV import" />
      <p className="text-sm text-muted-foreground">CSV columns: <code>full_name,email,phone</code>. Phone numbers must use E.164, e.g. +14155550100.</p>
      <Button onClick={() => void submit()}>Review import</Button>
      {message && <p className="text-sm">{message}</p>}
      {review.length > 0 && <div className="rounded-md border p-4 space-y-3"><h2 className="font-semibold">Possible duplicates</h2>{review.map((item) => <div key={item.index} className="text-sm"><p>{item.person.full_name} — {item.person.email || item.person.phone}</p><ul className="ml-4 list-disc text-muted-foreground">{item.duplicates.map((duplicate) => <li key={duplicate.person_id}>{duplicate.full_name} — {duplicate.email || duplicate.phone}</li>)}</ul></div>)}<Button onClick={() => void submit(true)}>Import anyway</Button></div>}
    </div>
  </PageShell>;
}
