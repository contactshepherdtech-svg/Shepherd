"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Who hasn't attended in a month?",
  "Who's most at risk right now?",
  "How many first-time visitors have we had recently?",
  "What's our attendance trend?",
];

export default function AskPage() {
  const { churchId, churchName, loading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sending]);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || sending || !churchId) return;

    setError(null);
    setInput("");

    const history = messages.slice(-6);
    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setSending(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase!.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        setError("Your session expired. Please sign in again.");
        return;
      }

      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ church_id: churchId, question: trimmed, history }),
      });

      const data = (await response.json()) as { success: boolean; answer?: string; error?: string };

      if (!response.ok || !data.success || !data.answer) {
        setError(data.error ?? "I couldn't answer that just now. Please try again.");
        return;
      }

      setMessages((current) => [...current, { role: "assistant", content: data.answer! }]);
    } catch {
      setError("Something went wrong reaching the assistant. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading workspace...</CardContent>
        </Card>
      </PageShell>
    );
  }

  if (!churchId) {
    return (
      <PageShell>
        <Card className="shepherd-elevate">
          <CardContent className="space-y-3 p-8 text-center">
            <Sparkles className="mx-auto size-6 text-primary" />
            <p className="shepherd-title">Connect your church to start asking</p>
            <p className="shepherd-subtitle mx-auto max-w-md">
              Once Planning Center is connected and your data is synced, you can ask Shepherd anything about your
              congregation.
            </p>
            <Button asChild>
              <Link href="/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const hasConversation = messages.length > 0;

  return (
    <PageShell>
      <section className="space-y-1">
        <p className="shepherd-kicker">Ask Shepherd</p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
          What would you like to know about {churchName ?? "your church"}?
        </h1>
        <p className="shepherd-subtitle">
          Ask in plain language — Shepherd answers from your synced members, attendance, and risk data.
        </p>
      </section>

      <Card className="shepherd-elevate flex min-h-[560px] flex-col">
        <CardContent className="flex flex-1 flex-col gap-4 p-5">
          <div className="shepherd-scrollbar flex-1 space-y-4 overflow-y-auto pr-1">
            {!hasConversation ? (
              <div className="flex h-full flex-col items-start justify-center gap-5 py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </span>
                  <p className="text-sm">Try one of these to get started</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="secondary"
                      size="sm"
                      onClick={() => void send(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[80%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm"
                          : "max-w-[85%] whitespace-pre-wrap rounded-2xl border border-border bg-[#FAFBFA] px-4 py-2.5 text-sm leading-6 text-foreground"
                      }
                    >
                      {message.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {sending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-[#FAFBFA] px-4 py-3">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="size-1.5 rounded-full bg-primary/60"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: dot * 0.18 }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          {error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-border pt-4"
          >
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your congregation..."
              disabled={sending}
              aria-label="Ask a question"
            />
            <Button type="submit" size="icon-lg" disabled={sending || !input.trim()} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
