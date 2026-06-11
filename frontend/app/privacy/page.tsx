import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy | Shepherd",
  description: "Privacy Policy for Shepherd church engagement software.",
};

const sections = [
  {
    title: "Overview",
    body: [
      "Shepherd is church engagement software that helps churches understand engagement patterns, coordinate visitor follow-up, prepare outreach, and support pastoral care workflows.",
      "This Privacy Policy explains how Shepherd collects, uses, stores, and protects information when a church or authorized user connects Shepherd to church systems such as Planning Center and Gmail.",
    ],
  },
  {
    title: "Information Shepherd Stores",
    body: [
      "Shepherd may store church member information, attendance history, visitor lifecycle information, follow-up activity, outreach status, analytics derived from engagement activity, and outreach drafts created through the application.",
      "Member information may include names, email addresses, Planning Center identifiers, attendance records, visitor status, lifecycle status, risk or engagement indicators, and timestamps related to follow-up workflows.",
    ],
  },
  {
    title: "Planning Center Data",
    body: [
      "Shepherd integrates with Planning Center only when a church explicitly authorizes the connection. Shepherd only accesses Planning Center data that the church authorizes and that is needed to provide church engagement, follow-up, analytics, and communication workflows.",
      "Churches are responsible for ensuring that their use of Planning Center and Shepherd is consistent with their internal policies and any permissions they have obtained from members, visitors, staff, and volunteers.",
    ],
  },
  {
    title: "Gmail Data",
    body: [
      "Shepherd integrates with Gmail only when an authorized church user explicitly connects a Gmail account through Google's OAuth consent flow.",
      "Gmail access is used only to create and manage outreach drafts related to Shepherd functionality. Shepherd does not read personal inbox content unrelated to Shepherd functionality, does not monitor personal email activity, and does not use Gmail data for advertising.",
      "Shepherd's use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
    ],
  },
  {
    title: "How Information Is Used",
    body: [
      "Shepherd uses data solely to provide church engagement, visitor follow-up, outreach, analytics, and communication workflows requested by the church or authorized users.",
      "Shepherd may use stored information to display member profiles, identify visitor follow-up needs, generate engagement summaries, prepare outreach drafts, support Gmail draft creation, and help churches organize care activity.",
    ],
  },
  {
    title: "Data Sharing and Sale",
    body: [
      "Shepherd does not sell user data, church data, member data, visitor data, Planning Center data, or Gmail data.",
      "Shepherd does not share customer data with third parties for advertising, surveillance, or unrelated marketing purposes. Data may be processed by infrastructure and service providers only as needed to operate, secure, and support the Shepherd application.",
    ],
  },
  {
    title: "Data Retention and Removal",
    body: [
      "Shepherd retains information for as long as needed to provide the application to the church, comply with legal obligations, resolve disputes, maintain security, and support ordinary business operations.",
      "Users or churches may request data removal by contacting support at shreeshkumar.lillyprabhu@gmail.com. Shepherd will review and process deletion requests subject to account ownership, technical feasibility, legal requirements, and legitimate operational needs.",
    ],
  },
  {
    title: "Security",
    body: [
      "Shepherd uses reasonable administrative, technical, and organizational safeguards designed to protect information against unauthorized access, loss, misuse, or alteration.",
      "No online service can guarantee absolute security. Churches and users should protect their login credentials, manage authorized integrations carefully, and promptly disconnect integrations that should no longer be active.",
    ],
  },
  {
    title: "Changes to This Policy",
    body: [
      "Shepherd may update this Privacy Policy as the application, integrations, or legal requirements change. Updated versions will be posted on this page with a revised Last Updated date.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Questions, requests, or concerns about this Privacy Policy may be sent to shreeshkumar.lillyprabhu@gmail.com.",
    ],
  },
];

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              This policy describes how Shepherd handles church engagement data, Planning Center data,
              Gmail data, visitor follow-up activity, analytics, and outreach workflows.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            <Link
              href="/terms"
              className="rounded-full border border-border bg-card px-3 py-1.5 text-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Terms of Service
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
            <CardTitle className="text-xl">Shepherd Privacy Policy</CardTitle>
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
                  {section.title === "Gmail Data" ? (
                    <p>
                      Google API Services User Data Policy:{" "}
                      <a
                        href="https://developers.google.com/terms/api-services-user-data-policy"
                        className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                      >
                        https://developers.google.com/terms/api-services-user-data-policy
                      </a>
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>

        <footer className="flex flex-col gap-2 border-t border-border pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Shepherd church engagement software</span>
          <div className="flex flex-wrap gap-3">
            <Link href="/terms" className="font-medium text-foreground hover:text-primary">
              Terms of Service
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
