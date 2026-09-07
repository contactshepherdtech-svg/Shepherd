import { Gauge, ListChecks, Settings, Siren, Sparkles, UserCog, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Single source of truth for the app's primary navigation. Both the desktop
// sidebar and the mobile drawer consume this, so links/icons/labels — and the
// admin-only Staff gate below — can never drift between the two navs.
export const navItems: NavItem[] = [
  { href: "/ask", label: "Ask", icon: Sparkles },
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/members", label: "Members", icon: Users },
  { href: "/people", label: "People", icon: Users },
  { href: "/priority", label: "Priority", icon: Siren },
  { href: "/assignments", label: "Assignments", icon: ListChecks },
  { href: "/staff", label: "Staff", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Staff is an admin-only management surface (the /api/staff/list API is also
// admin-gated server-side). Hide the nav entry for pastors and viewers.
export function filterNavItems(role: string | null | undefined): NavItem[] {
  return navItems.filter((item) => item.href !== "/staff" || role === "admin");
}
