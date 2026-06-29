"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Gauge,
  LayoutDashboard,
  Link2,
  ListChecks,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

// Public marketing landing page (route "/"). Apple-clean, brand-evergreen, no glass / no
// heavy effects — clarity + speed for pastors & elders on varied devices. Motion is
// limited to gentle scroll-reveals (Framer Motion), disabled under reduced-motion.

// Gentle scroll-reveal. Honors prefers-reduced-motion (renders final state, no transform).
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

const steps = [
  {
    icon: Link2,
    title: "Connect Planning Center",
    body: "Securely link the Planning Center account you already use. It takes a few clicks — no spreadsheets, no setup project.",
  },
  {
    icon: Gauge,
    title: "Shepherd scores engagement",
    body: "It reads attendance and activity, scores every member, and quietly flags the people who are starting to drift.",
  },
  {
    icon: ListChecks,
    title: "Your team gets a list",
    body: "A prioritized outreach list shows who to reach first — each with a ready-to-send email or text draft.",
  },
];

const features = [
  {
    icon: Gauge,
    title: "Risk scoring",
    body: "Every member scored on real attendance patterns, so quiet drift shows up early — not after they're gone.",
  },
  {
    icon: ListChecks,
    title: "Priority outreach queue",
    body: "A ranked list of exactly who needs a personal touch this week, so nobody slips through the cracks.",
  },
  {
    icon: UserRound,
    title: "Member 360 profiles",
    body: "Attendance history, risk, and pastoral context for each person — all in one clear view.",
  },
  {
    icon: Mail,
    title: "Email & SMS drafts",
    body: "Warm, personal outreach drafts written for you. Your team reviews and sends — nothing goes out on its own.",
  },
  {
    icon: Users,
    title: "Staff assignments",
    body: "Assign each follow-up to the right person and track what's been done, together.",
  },
  {
    icon: LayoutDashboard,
    title: "Operations dashboard",
    body: "Church health, attendance momentum, and at-risk counts — the whole picture at a glance.",
  },
];

const trustPoints = [
  {
    icon: Lock,
    title: "Private to your church",
    body: "Your data is isolated to your church and never shared with any other church on Shepherd.",
  },
  {
    icon: ShieldCheck,
    title: "You stay in control",
    body: "Disconnect Planning Center or Gmail and remove your church's data whenever you choose.",
  },
  {
    icon: Send,
    title: "Drafts, never auto-sent",
    body: "Shepherd prepares messages. Your team reads and sends every one — you're always the sender.",
  },
];

const faqs = [
  {
    q: "What church data does Shepherd access?",
    a: "Through Planning Center, Shepherd reads your member directory (People) and attendance (Check-ins). Through Gmail, it can create email drafts on your behalf — it never reads your inbox. That's the extent of it.",
  },
  {
    q: "Is our members' information safe?",
    a: "Yes. Your data is isolated to your church, never shared with other churches, and stored securely. You can disconnect Planning Center or Gmail and remove your data at any time.",
  },
  {
    q: "Does Shepherd send emails automatically?",
    a: "No. Shepherd prepares drafts in your own Gmail. Your team reviews and sends every message — nothing is ever sent without you.",
  },
  {
    q: "What does it cost?",
    a: "Shepherd is in early access. Request access below and we'll walk your church through pricing personally — no surprises.",
  },
  {
    q: "How do we get started?",
    a: "Request access below. We'll set up your workspace and help your team connect Planning Center, usually in one short call.",
  },
];

export function LandingPage() {
  const reduce = useReducedMotion();

  const scrollToRequest = () => {
    const el = document.getElementById("request");
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    const input = el.querySelector<HTMLInputElement>("input");
    // Focus the first field after the scroll settles (skip the wait under reduced motion).
    window.setTimeout(() => input?.focus(), reduce ? 0 : 450);
  };

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/95">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Shepherd home">
            <Image src="/shepherd-mark.svg" alt="" width={26} height={34} className="h-8 w-auto" priority />
            <span className="font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">Shepherd</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={scrollToRequest}
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#07866B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
            >
              Request access
            </button>
          </div>
        </nav>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          {/* very soft brand wash — no glass, just a calm backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(1100px 520px at 18% -10%, rgba(0,107,85,0.07), transparent 60%), radial-gradient(820px 480px at 100% 0%, rgba(255,210,31,0.06), transparent 55%)",
            }}
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
                For churches on Planning Center
              </p>
              <h1 className="font-heading text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground sm:text-6xl">
                Know who&apos;s slipping away — before they&apos;re gone.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Shepherd reads your Planning Center data and surfaces the members quietly disengaging — so your
                team can reach them in time.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={scrollToRequest}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(0,107,85,0.5)] transition-colors hover:bg-[#07866B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
                >
                  Request access
                  <ArrowRight className="size-4" />
                </button>
                <a
                  href="#how"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-black/10 bg-white px-6 text-base font-semibold text-foreground transition-colors hover:border-black/20 hover:bg-[#fcfcfb]"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Connects securely to Planning Center · Member data stays private to your church.
              </p>
            </div>

            {/* Product mockup (pure CSS — fast, no heavy image) */}
            <HeroMockup reduce={reduce} />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="scroll-mt-20 bg-[#fcfcfb] py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="shepherd-kicker">How it works</p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                From connection to outreach in three steps
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.08}>
                  <div className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-7 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_10px_30px_-18px_rgba(17,24,39,0.25)]">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <step.icon className="size-5" />
                      </span>
                      <span className="font-heading text-sm font-semibold text-muted-foreground">Step {i + 1}</span>
                    </div>
                    <h3 className="mt-5 font-heading text-xl font-semibold tracking-[-0.01em] text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="shepherd-kicker">What you get</p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                Everything your team needs to follow up well
              </h2>
            </Reveal>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 0.06}>
                  <div className="flex h-full flex-col rounded-2xl border border-black/5 bg-white p-7 transition-shadow hover:shadow-[0_1px_2px_rgba(17,24,39,0.04),0_16px_40px_-22px_rgba(17,24,39,0.3)]">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <f.icon className="size-5" />
                    </span>
                    <h3 className="mt-5 font-heading text-lg font-semibold tracking-[-0.01em] text-foreground">
                      {f.title}
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST / DATA HANDLING */}
        <section className="bg-[#0a5a47] py-20 text-white sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <Reveal>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffd21f]">
                  Built for a church&apos;s trust
                </p>
                <h2 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  Your members&apos; information stays yours.
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
                  Shepherd connects securely to Planning Center and Gmail and reads only what it needs — your
                  member directory and attendance — to find who&apos;s drifting. Member data stays private to your
                  church, isolated from every other church, and you can disconnect and remove it at any time.
                </p>
                <Link
                  href="/privacy"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#ffd21f] underline-offset-4 hover:underline"
                >
                  Read our privacy policy
                  <ArrowRight className="size-4" />
                </Link>
              </Reveal>
              <div className="grid gap-4">
                {trustPoints.map((t, i) => (
                  <Reveal key={t.title} delay={i * 0.08}>
                    <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#ffd21f]">
                        <t.icon className="size-5" />
                      </span>
                      <div>
                        <h3 className="font-heading text-base font-semibold">{t.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-white/75">{t.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <Reveal className="text-center">
              <p className="shepherd-kicker">Questions</p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                Answers for cautious leaders
              </h2>
            </Reveal>
            <div className="mt-12 divide-y divide-black/5 border-y border-black/5">
              {faqs.map((item) => (
                <details key={item.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-heading text-lg font-semibold text-foreground">
                    {item.q}
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-black/10 text-muted-foreground transition-transform group-open:rotate-45">
                      <span className="text-lg leading-none">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA + EMAIL CAPTURE */}
        <section id="request" className="scroll-mt-20 bg-[#fcfcfb] py-20 sm:py-28">
          <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
            <Reveal>
              <h2 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                Reach people before they drift away.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Request access for your church — we&apos;ll get you set up and walk your team through connecting
                Planning Center.
              </p>
              <AccessRequestForm />
            </Reveal>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row sm:px-8">
          <div className="flex items-center gap-2.5">
            <Image src="/shepherd-mark.svg" alt="" width={22} height={28} className="h-7 w-auto" />
            <span className="font-heading text-base font-semibold tracking-[-0.02em]">Shepherd</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Shepherd
          </p>
        </div>
      </footer>
    </div>
  );
}

// Product mockup — a calm representation of the priority-outreach queue, built with plain
// elements (no image payload). Sample data is illustrative product UI, not a testimonial.
function HeroMockup({ reduce }: { reduce: boolean | null }) {
  const rows = [
    { name: "Daniel Thomas", initials: "DT", tier: "Watch", tierClass: "bg-amber-50 text-amber-700 border-amber-200", reason: "Active only 1 of the last 8 weeks" },
    { name: "Amanda Harris", initials: "AH", tier: "New", tierClass: "bg-emerald-50 text-emerald-700 border-emerald-200", reason: "First-time visitor — no follow-up yet" },
    { name: "Michael Lee", initials: "ML", tier: "At risk", tierClass: "bg-orange-50 text-orange-700 border-orange-200", reason: "Last seen 6 weeks ago" },
  ];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="relative mx-auto w-full max-w-md"
    >
      <div className="rounded-3xl border border-black/[0.06] bg-white p-5 shadow-[0_30px_60px_-30px_rgba(0,107,85,0.35)] sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Priority outreach</p>
            <p className="mt-0.5 font-heading text-base font-semibold text-foreground">Reach these members first</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">3 to do</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-2xl border border-black/5 bg-[#fcfcfb] p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {r.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${r.tierClass}`}>{r.tier}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
              </div>
              <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-white sm:inline-flex">
                <Mail className="size-3" />
                Draft
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Email capture for "Request access" → inserts into the public, insert-only
// `access_requests` table (migration 018). The anon key can INSERT but not read leads back.
function AccessRequestForm() {
  const [church, setChurch] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!church.trim() || !email.trim()) return;
    setStatus("submitting");
    try {
      if (!supabase) throw new Error("unavailable");
      const { error } = await supabase
        .from("access_requests")
        .insert({ church_name: church.trim(), email: email.trim() } as never);
      if (error) throw error;
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="mx-auto mt-10 flex max-w-md items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 text-left">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Check className="size-4" />
        </span>
        <div>
          <p className="font-heading text-base font-semibold text-foreground">Thanks — request received</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll reach out to {church.trim()} at {email.trim()} to get you set up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-10 max-w-md text-left">
      <div className="space-y-3">
        <div>
          <label htmlFor="church" className="mb-1.5 block text-sm font-semibold text-foreground">
            Church name
          </label>
          <input
            id="church"
            type="text"
            required
            value={church}
            onChange={(e) => setChurch(e.target.value)}
            placeholder="Grace Community Church"
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pastor@yourchurch.org"
            className="h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-base text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
          />
        </div>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-white shadow-[0_10px_24px_-8px_rgba(0,107,85,0.5)] transition-colors hover:bg-[#07866B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : "Request access"}
          {status !== "submitting" && <ArrowRight className="size-4" />}
        </button>
      </div>
      {status === "error" ? (
        <p className="mt-3 text-center text-sm font-medium text-red-600">
          Something went wrong — please try again in a moment.
        </p>
      ) : null}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        No spam. We&apos;ll only use this to set up your church.
      </p>
    </form>
  );
}
