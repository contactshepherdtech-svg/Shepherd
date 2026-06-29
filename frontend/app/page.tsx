import type { Metadata } from "next";

import { LandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "Shepherd — Know who's slipping away before they're gone",
  description:
    "Shepherd reads your Planning Center data and surfaces the members quietly disengaging — so your team can reach them in time.",
};

export default function HomePage() {
  return <LandingPage />;
}
