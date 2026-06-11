import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Terms of Service | Shepherd",
  description: "Terms of Service for Shepherd church engagement software.",
};

const sections = [
  {
    title: "Agreement to These Terms",
    body: [
      "These Terms of Service govern access to and use of Shepherd, a church engagement software platform for member engagement, visitor follow-up, analytics, outreach drafts, and related communication workflows.",
      "By accessing or using Shepherd, you agree to these Terms on behalf of yourself and, if applicable, the church, ministry, organization, or entity you represent.",
    ],
  },
  {
    title: "Service Provided As-Is",
    body: [
      "Shepherd is provided as-is and as available. Shepherd is an MVP software platform and may contain errors, interruptions, incomplete features, or limitations.",
      "Shepherd does not warrant that the service will be uninterrupted, error-free, secure, or that every engagement signal, imported record, generated draft, or workflow recommendation will be accurate or complete.",
    ],
  },
  {
    title: "Church Responsibilities",
    body: [
      "Churches are responsible for obtaining all necessary consent, authorization, and permission to collect, import, store, analyze, and use member, visitor, staff, volunteer, attendance, and communication information in Shepherd.",
      "Churches are responsible for determining whether and how they may communicate with members and visitors through email or other outreach channels. Churches must comply with applicable privacy, data protection, electronic communication, anti-spam, and consent laws.",
    ],
  },
  {
    title: "Planning Center Data",
    body: [
      "Shepherd may import or reference Planning Center data when an authorized user connects a church's Planning Center account. Users are responsible for the accuracy, completeness, permission status, and lawful use of imported Planning Center data.",
      "Shepherd is not responsible for errors, outdated records, duplicate profiles, missing attendance history, incorrect lifecycle classifications, or other issues caused by inaccurate or incomplete data in Planning Center or other connected systems.",
    ],
  },
  {
    title: "Gmail and Outreach Drafts",
    body: [
      "Shepherd may connect to Gmail when an authorized user grants permission through Google's OAuth consent flow. Gmail access is used for Shepherd outreach workflows, including creating and managing outreach drafts.",
      "Shepherd may generate draft outreach messages, summaries, and suggested language. These drafts are provided for review and editing only. Shepherd does not guarantee that generated messages are accurate, appropriate, complete, pastoral, legally compliant, or suitable for any specific recipient.",
      "Users are solely responsible for reviewing, editing, approving, and deciding whether to send any outreach message. Shepherd is not responsible for communication errors, omissions, tone, deliverability, recipient reactions, or consequences of messages sent by users.",
    ],
  },
  {
    title: "Acceptable Use",
    body: [
      "You agree to use Shepherd only for lawful church engagement, follow-up, analytics, and communication purposes. You may not use Shepherd to harass, mislead, discriminate, surveil, spam, or otherwise misuse personal information.",
      "You may not attempt to bypass security controls, access data from another church or account, interfere with the service, reverse engineer the application, or use Shepherd in a way that violates applicable laws, third-party terms, or these Terms.",
    ],
  },
  {
    title: "Feature Changes",
    body: [
      "Shepherd may modify, add, limit, suspend, or discontinue features, integrations, workflows, models, analytics, or other parts of the service over time.",
      "Shepherd may update these Terms as the service evolves. Continued use of Shepherd after updated Terms are posted means you accept the revised Terms.",
    ],
  },
  {
    title: "Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, Shepherd and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, lost goodwill, service interruption, communication errors, or reliance on generated content.",
      "Shepherd's total liability for any claim related to the service will be limited to the amount paid to Shepherd for the service during the three months before the event giving rise to the claim, or one hundred U.S. dollars if no amounts were paid.",
    ],
  },
  {
    title: "No Professional Advice",
    body: [
      "Shepherd provides software tools and workflow support. Shepherd does not provide legal, pastoral, counseling, financial, compliance, or professional advice.",
      "Churches and users should consult qualified professionals when making decisions involving legal compliance, pastoral care, crisis response, data protection, or sensitive communications.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions about these Terms of Service may be sent to shreeshkumar.lillyprabhu@gmail.com.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground md:px-8 md:py-14">
      <div className="mx-auto max-w-[800px] space-y-6">
        <header className="space-y-4">
          <Link href="https://www.shepherdtech.app" className="shepherd-kicker inline-block hover:text-primary">
            Shepherd
          </Link>
          <div className="space-y-3">
            <p className="shepherd-kicker">Last Updated: June 2026</p>
            <h1 className="font-heading text-4xl font-semibold tracking-[-0.02em] text-foreground md:text-5xl">
              Terms of Service
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              These terms describe the responsibilities, limitations, and conditions that apply when
              churches and authorized users access Shepherd.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            <Link
              href="/privacy"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Privacy Policy
            </Link>
            <Link
              href="https://www.shepherdtech.app"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Back to Shepherd
            </Link>
          </nav>
        </header>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-xl">Shepherd Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="font-heading text-xl font-semibold tracking-[-0.01em] text-foreground">
                  {section.title}
                </h2>
                <div className="space-y-3 text-sm leading-7 text-muted-foreground md:text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>

        <footer className="flex flex-col gap-2 border-t border-border pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Shepherd church engagement software</span>
          <div className="flex flex-wrap gap-3">
            <Link href="/privacy" className="font-medium text-foreground hover:text-primary">
              Privacy Policy
            </Link>
            <Link href="https://www.shepherdtech.app" className="font-medium text-foreground hover:text-primary">
              shepherdtech.app
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
