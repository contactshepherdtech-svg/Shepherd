import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

// Shared clean shell for the public legal pages (/privacy, /terms). Server component —
// static prose, no client JS, fast + SEO-friendly. Matches the landing aesthetic.

export const SUPPORT_EMAIL = "shreeshkumar.lillyprabhu@gmail.com";
export const LEGAL_LAST_UPDATED = "June 28, 2026";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-foreground">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95">
        <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Shepherd home">
            <Image src="/shepherd-mark.svg" alt="" width={26} height={34} className="h-8 w-auto" />
            <span className="font-heading text-lg font-semibold tracking-[-0.02em]">Shepherd</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to home
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="shepherd-kicker">Legal</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated {LEGAL_LAST_UPDATED}</p>
        <p className="mt-6 text-lg leading-relaxed text-[#374151]">{intro}</p>
        <div className="mt-12 space-y-11">{children}</div>
      </main>

      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/shepherd-mark.svg" alt="" width={22} height={28} className="h-7 w-auto" />
            <span className="font-heading text-base font-semibold tracking-[-0.02em]">Shepherd</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// A titled section of legal prose.
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-semibold tracking-[-0.01em] text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-[#374151]">{children}</div>
    </section>
  );
}

// A reassuring "the short version" callout (evergreen tint), used at the top of Privacy.
export function KeyPoints({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">The short version</p>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3 leading-relaxed text-[#1f3d35]">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Bulleted list inside a section.
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[#9ca3af]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
