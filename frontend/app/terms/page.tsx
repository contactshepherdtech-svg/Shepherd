import type { Metadata } from "next";

import { Bullets, LegalPage, Section, SUPPORT_EMAIL } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Shepherd",
  description: "The terms that govern your church's use of Shepherd.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These Terms govern your church's use of Shepherd. By connecting an account or using the app, you agree to them on behalf of your church. Please read them alongside our Privacy Policy, which explains how we handle your data."
    >
      <Section title="Agreement to these terms">
        <p>
          By accessing or using Shepherd, you confirm that you are authorized to act for your church and that your
          church agrees to these Terms. If you don&apos;t agree, please don&apos;t use Shepherd.
        </p>
      </Section>

      <Section title="What Shepherd is">
        <p>
          Shepherd is church engagement software. It syncs member and attendance data from Planning Center, scores
          engagement to surface members who may be disengaging, and helps your team prepare and coordinate outreach.
          Shepherd prepares drafts and recommendations; a person on your team always reviews and sends the actual
          messages.
        </p>
      </Section>

      <Section title="Accounts and roles">
        <Bullets
          items={[
            "Your church authorizes Shepherd and connects its own Planning Center (and optionally Gmail) account.",
            "Staff accounts have roles — admin, pastor, or viewer — that determine what each person can see and do. Each user belongs to one church.",
            "Administrators manage connections, staff, and roles.",
            "You are responsible for keeping account credentials secure and for activity that happens under your church's accounts.",
          ]}
        />
      </Section>

      <Section title="Your church's data and responsibilities">
        <p>
          Your church&apos;s data remains your church&apos;s. You authorize Shepherd to access and process your
          Planning Center and Gmail data as described in the{" "}
          <a href="/privacy" className="font-medium text-primary underline underline-offset-4">Privacy Policy</a>{" "}
          in order to provide the service. Your church is responsible for:
        </p>
        <Bullets
          items={[
            "Having an appropriate basis and any necessary permissions to use your members' information in Shepherd.",
            "The accuracy of the information in your connected systems.",
            "Your own commitments and obligations to your members and visitors.",
          ]}
        />
      </Section>

      <Section title="Outreach and communications">
        <p>
          Shepherd creates drafts; it never sends messages on its own. A person on your team reviews and sends every
          message. Your church is responsible for the content it sends and for complying with applicable
          communications laws and rules — including anti-spam and text-messaging regulations — and with your
          recipients&apos; preferences.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>
          Shepherd works with Planning Center, Google / Gmail, OpenRouter, and Supabase to operate. Your use of those
          connections is also subject to those providers&apos; own terms, and you agree to comply with Planning
          Center&apos;s and Google&apos;s terms when you connect them. Shepherd is not responsible for third-party
          services, and their features, availability, and terms may change.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <Bullets
          items={[
            "Use Shepherd unlawfully, or to harass, harm, or mislead anyone.",
            "Attempt to access another church's data or any data you're not authorized to see.",
            "Reverse-engineer, disrupt, overload, or attempt to break the security of the service.",
            "Use Shepherd in violation of Planning Center's or Google's terms.",
          ]}
        />
      </Section>

      <Section title="Early access, availability & no warranty">
        <p>
          Shepherd is offered on an early-access basis and is provided{" "}
          <strong className="font-semibold text-foreground">&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong>{" "}
          without warranties of any kind, to the maximum extent permitted by law. We don&apos;t guarantee that the
          service will be uninterrupted or error-free. Engagement scores and generated drafts are aids for your
          team&apos;s judgment — they are not guaranteed to be accurate and are not a substitute for pastoral
          discernment.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the maximum extent permitted by law, Shepherd and its operators will not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or for any loss of data, arising from your use of
          the service. This section does not limit liability that cannot be limited under applicable law.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          Your church may stop using Shepherd at any time and disconnect its integrations. We may suspend or end
          access for misuse or to protect the service or others. On termination, data deletion is handled as
          described in the Privacy Policy — contact us to remove your church&apos;s data.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these Terms as Shepherd evolves. When we do, we&apos;ll update the &ldquo;Last updated&rdquo;
          date above. Continued use of Shepherd after a change means you accept the updated Terms.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These Terms are governed by the laws of{" "}
          <span className="rounded bg-[#fff5cc] px-1 text-foreground">[governing jurisdiction — to be finalized]</span>,
          without regard to conflict-of-laws rules.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions about these Terms? Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
