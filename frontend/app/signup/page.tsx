"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  // Invite token carried from /invite/<token>. Captured at submit time (read from
  // the URL in the handler, no useSearchParams → no Suspense boundary needed).
  // When present, a new account is routed to the accept flow instead of onboarding.
  const [invite, setInvite] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    // Capture any invite token from the URL for post-signup routing.
    const inviteToken = new URLSearchParams(window.location.search).get("invite");
    setInvite(inviteToken);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.session) {
      setConfirmMessage(
        inviteToken
          ? "Account created! Confirm your email, then sign in to accept your invitation."
          : "Account created! Check your email to confirm your address, then sign in.",
      );
      setLoading(false);
      return;
    }

    router.replace(inviteToken ? `/invite/${inviteToken}` : "/onboarding");
  };

  if (confirmMessage) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,107,85,0.09) 0%, transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-8 text-center shadow-[0_24px_70px_rgba(17,24,39,0.10)]"
        >
          <div
            className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-primary/12"
            aria-hidden
          >
            <svg className="size-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">{confirmMessage}</p>
          <Link
            href={invite ? `/login?invite=${invite}` : "/login"}
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Radial background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(0,107,85,0.09) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[380px] space-y-8"
      >
        {/* Logo — no container, soft glow via filter */}
        <div className="flex flex-col items-center gap-5">
          <div style={{ filter: "drop-shadow(0 10px 28px rgba(0,107,85,0.28))" }}>
            <Image
              src="/shepherd-logo.png"
              alt="Shepherd"
              width={380}
              height={253}
              className="h-auto w-[340px] max-w-full"
              priority
            />
          </div>
          <div className="space-y-1.5 text-center">
            <h1 className="font-heading text-[26px] font-bold tracking-tight text-foreground">
              Create your account
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set up Shepherd for your church in minutes.
            </p>
          </div>
        </div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-border/60 bg-card/92 p-6 shadow-[0_24px_70px_rgba(17,24,39,0.10)] backdrop-blur-sm"
        >
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@church.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <motion.div whileTap={{ scale: 0.985 }}>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </motion.div>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
