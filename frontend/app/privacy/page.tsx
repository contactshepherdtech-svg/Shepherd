import type { Metadata } from "next";

import { Bullets, KeyPoints, LegalPage, Section, SUPPORT_EMAIL } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Shepherd",
  description:
    "How Shepherd handles your church's data — what it accesses from Planning Center and Gmail, what it stores, and the control you have.",
};

const GOOGLE_POLICY_URL = "https://developers.google.com/terms/api-services-user-data-policy";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Shepherd is church engagement software. It connects to the tools your church already uses — Planning Center, and optionally Gmail — to help your team notice members who are drifting and follow up in time. This policy explains, in plain language, exactly what data Shepherd accesses, what it stores, and the control you have over it."
    >
      <KeyPoints
        items={[
          "Shepherd never reads, searches, or sends your email. With Gmail, it only creates draft messages that your team reviews and sends.",
          "From Planning Center, Shepherd reads only your member directory and check-in (attendance) records — nothing else.",
          "Your church's data is isolated from every other church, and is never sold or used for advertising.",
          "An admin connects Planning Center and Gmail, and you can disconnect either at any time.",
          "You can ask us to delete your church's data by email.",
        ]}
      />

      <Section title="Who this policy covers">
        <p>
          Shepherd is used by churches. Your church — and the staff it authorizes — is the customer. Information
          about your members and visitors is provided by your church through its connected Planning Center account.
          Your church is responsible for having an appropriate basis to use that information with Shepherd and for
          its own commitments to its members.
        </p>
      </Section>

      <Section title="Information Shepherd stores">
        <p>When your church uses Shepherd, the following is stored in our database:</p>
        <Bullets
          items={[
            <><strong className="font-semibold text-foreground">Member information</strong> synced from Planning Center: names, email addresses, member status, Planning Center identifiers, and check-in (attendance) records.</>,
            <><strong className="font-semibold text-foreground">Engagement information Shepherd derives</strong>: visitor lifecycle (first-time, returning, established), an engagement/risk score and the reasons behind it, and follow-up status.</>,
            <><strong className="font-semibold text-foreground">Outreach you create</strong>: AI-generated or written email/SMS drafts and a log of outreach activity.</>,
            <><strong className="font-semibold text-foreground">Team & workspace</strong>: your church's name, staff accounts and their roles (admin, pastor, viewer), follow-up assignments, and pastoral notes.</>,
            <><strong className="font-semibold text-foreground">Connections</strong>: the access credentials (tokens) for the Planning Center and Gmail accounts you connect, and the email address of the connected Gmail account.</>,
            <><strong className="font-semibold text-foreground">Access requests</strong>: if you submit the &ldquo;Request access&rdquo; form on our site, the church name and email you enter.</>,
          ]}
        />
      </Section>

      <Section title="Planning Center data">
        <p>
          Shepherd connects to Planning Center only after an administrator authorizes it through Planning Center&apos;s
          secure sign-in (OAuth). The permission Shepherd requests is limited to{" "}
          <strong className="font-semibold text-foreground">People and Check-ins</strong> (the{" "}
          <code className="rounded bg-[#f1f3f2] px-1.5 py-0.5 text-[0.85em]">people check_ins</code> scope).
        </p>
        <p>From that, Shepherd reads members&apos; names, email addresses, member status, and check-in / attendance records — and nothing else.</p>
        <Bullets
          items={[
            "Shepherd's access is read-only. It cannot change or delete anything in your Planning Center account.",
            "Syncing happens on demand, when your team runs it — Shepherd does not pull data continuously in the background.",
            "Shepherd does not request or read other Planning Center data such as giving.",
          ]}
        />
      </Section>

      <Section title="Google account & Gmail data">
        <p>
          Connecting Gmail is optional and must be authorized by an administrator. When connected, Shepherd requests
          two Google permissions:
        </p>
        <Bullets
          items={[
            <><code className="rounded bg-[#f1f3f2] px-1.5 py-0.5 text-[0.85em]">gmail.compose</code> — to create email drafts in the connected Gmail account.</>,
            <><code className="rounded bg-[#f1f3f2] px-1.5 py-0.5 text-[0.85em]">userinfo.email</code> — to know which Gmail address is connected.</>,
          ]}
        />
        <p>
          <strong className="font-semibold text-foreground">
            Shepherd only creates drafts. It never reads, searches, lists, or downloads your email, and it never
            sends email on its own.
          </strong>{" "}
          Every draft Shepherd creates lands in your Gmail Drafts folder for a person on your team to review and
          send. We store the connected email address and the access credentials needed to create drafts.
        </p>
        <p>
          Shepherd&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a
            href={GOOGLE_POLICY_URL}
            className="font-medium text-primary underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </Section>

      <Section title="How Shepherd uses this information">
        <p>Shepherd uses the information above only to provide the service — to:</p>
        <Bullets
          items={[
            "Score engagement and flag members who appear to be disengaging.",
            "Build a prioritized outreach queue for your team.",
            "Prepare outreach drafts for your team to review and send.",
            "Coordinate staff follow-up (assignments, notes, status).",
            "Show dashboards summarizing church health and attendance.",
          ]}
        />
        <p>
          Shepherd does <strong className="font-semibold text-foreground">not</strong> sell your data, use it for
          advertising, or share it with other churches.
        </p>
      </Section>

      <Section title="AI-assisted drafts and the in-app assistant">
        <p>
          Shepherd uses a third-party AI provider, <strong className="font-semibold text-foreground">OpenRouter</strong>,
          to generate outreach drafts and to answer questions in the in-app assistant.
        </p>
        <Bullets
          items={[
            "To generate an outreach draft, Shepherd sends the member's first name, how long it's been since they last attended, and their recent attendance count.",
            "For the in-app assistant, Shepherd sends a snapshot of your members (such as names, status, attendance dates, and engagement/risk information) so it can answer your question.",
          ]}
        />
        <p>
          This information is processed by OpenRouter to produce the response and is subject to OpenRouter&apos;s own
          privacy terms, which we encourage you to review. Shepherd does not use your church&apos;s data to train its
          own models. If no AI provider is configured, Shepherd falls back to simple, non-AI templates.
        </p>
      </Section>

      <Section title="Who else processes your data">
        <p>Shepherd relies on a small number of trusted providers to operate:</p>
        <Bullets
          items={[
            <><strong className="font-semibold text-foreground">Supabase</strong> — our database and hosting provider, where the information above is stored.</>,
            <><strong className="font-semibold text-foreground">Google</strong> — to create Gmail drafts, only if you connect Gmail.</>,
            <><strong className="font-semibold text-foreground">Planning Center</strong> — the source your member and attendance data is synced from.</>,
            <><strong className="font-semibold text-foreground">OpenRouter</strong> — for AI-generated drafts and assistant answers, as described above.</>,
          ]}
        />
      </Section>

      <Section title="How your data is kept separate and secure">
        <p>
          Each church&apos;s data is isolated. Shepherd enforces database row-level security so that staff can only
          ever access their own church&apos;s records — one church can never read another&apos;s. Access within your
          church is role-based (admin, pastor, viewer), and pastoral notes are visible only to admins and pastors.
        </p>
        <p>
          Connection tokens are access-controlled and are never exposed to your browser or to other churches. Data is
          encrypted in transit (HTTPS), and our database provider encrypts data at rest. No system is perfectly
          secure, but we work to protect your information and limit access to it.
        </p>
      </Section>

      <Section title="Keeping and deleting data">
        <p>
          Shepherd keeps your synced and derived data for as long as your church uses Shepherd.{" "}
          <strong className="font-semibold text-foreground">
            Disconnecting Planning Center or Gmail stops future syncing and draft creation, but it does not, on its
            own, delete data Shepherd has already stored.
          </strong>
        </p>
        <p>
          To delete your church&apos;s data, email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>{" "}
          and we will process the request. Removing a staff member from a workspace ends their access but does not
          delete church or member data.
        </p>
      </Section>

      <Section title="Your choices and control">
        <Bullets
          items={[
            "An administrator can connect or disconnect Planning Center and Gmail at any time.",
            "You can request deletion of your church's data by email.",
            "Admins manage staff accounts and roles.",
            "Because member information comes from your church, requests from individual members about their information should be directed to their church first.",
          ]}
        />
      </Section>

      <Section title="Children's privacy">
        <p>
          Shepherd is a tool for church staff and is not directed to children. Member records — which may include
          minors who attend the church — are provided and controlled by the church. The church is responsible for
          handling that information appropriately and for obtaining any permissions it needs.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy as Shepherd evolves. When we do, we&apos;ll update the &ldquo;Last updated&rdquo;
          date above, and we&apos;ll communicate material changes to connected churches.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions about this policy or your data? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
