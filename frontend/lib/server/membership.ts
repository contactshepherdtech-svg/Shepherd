import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase";

export type Role = "admin" | "pastor" | "viewer";
export const ROLES: Role[] = ["admin", "pastor", "viewer"];
export const WRITE_ROLES: Role[] = ["admin", "pastor"]; // may create/modify pastoral data

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Build the request origin, trusting Vercel's forwarding headers when present so
// shareable invite links use the deployed host (not localhost).
export function getOrigin(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

export function getServiceClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getAuthedClient(authorization: string): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
}

export type Caller = {
  userId: string;
  email: string | null;
  // null = no membership row yet (deliberately distinct from a real church_id).
  // A user with no church is the expected state for a brand-new invitee.
  churchId: number | null;
  role: Role | null;
};

// Resolves the authenticated caller and their single church membership.
// Returns null ONLY when authentication itself fails (no/invalid token, or the
// server is misconfigured) — a valid user with no church returns a Caller with
// churchId: null. Membership is read with the service client so this never
// depends on (or recurses through) RLS.
export async function resolveCaller(authorization: string | null): Promise<Caller | null> {
  if (!authorization) return null;

  const authed = getAuthedClient(authorization);
  const service = getServiceClient();
  if (!authed || !service) return null;

  const { data: userData, error: userError } = await authed.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: rows, error: membershipError } = await service
    .from("church_users")
    .select("church_id, role")
    .eq("user_id", userData.user.id)
    .limit(1);

  if (membershipError) {
    console.error("[membership] church_users lookup failed:", membershipError);
    throw membershipError;
  }

  const row = (rows as Array<{ church_id: number; role: string }> | null)?.[0];

  return {
    userId: userData.user.id,
    email: userData.user.email ?? null,
    churchId: row ? row.church_id : null,
    role: row ? (row.role as Role) : null,
  };
}
