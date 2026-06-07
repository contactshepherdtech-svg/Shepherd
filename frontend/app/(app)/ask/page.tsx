"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const BUBBLE_CLASS =
  "max-w-[min(100%,42rem)] break-words [overflow-wrap:anywhere] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm";

const ASK_TIMEOUT_MS = 45_000;

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
  const messageIdRef = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: sending ? "auto" : "smooth" });
  }, [messages.length, sending]);

  const send = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || sending || !churchId) return;
    if (!supabase) {
      setError("Shepherd is not connected. Check your configuration.");
      return;
    }

    setError(null);
    setInput("");

    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));
    const userMessage: ChatMessage = {
      id: `msg-${++messageIdRef.current}`,
      role: "user",
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setSending(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ASK_TIMEOUT_MS);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        setError("Your session expired. Please sign in again.");
        setMessages((current) => current.filter((message) => message.id !== userMessage.id));
        return;
      }

      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ church_id: churchId, question: trimmed, history }),
        signal: controller.signal,
      });

      const data = (await response.json()) as { success: boolean; answer?: string; error?: string };

      if (!response.ok || !data.success || !data.answer) {
        setError(data.error ?? "I couldn't answer that just now. Please try again.");
        return;
      }

      setMessages((current) => [
        ...current,
        { id: `msg-${++messageIdRef.current}`, role: "assistant", content: data.answer! },
      ]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("That took too long. Please try again.");
      } else {
        setError("Something went wrong reaching the assistant. Please try again.");
      }
    } finally {
      clearTimeout(timeout);
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

      <Card className="shepherd-elevate flex h-[min(720px,calc(100vh-11rem))] min-h-[420px] flex-col">
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-5">
          <div className="shepherd-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
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
              messages.map((message) => (
                <div
                  key={message.id}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      message.role === "user"
                        ? `${BUBBLE_CLASS} bg-primary text-primary-foreground`
                        : `${BUBBLE_CLASS} border border-border bg-[#FAFBFA] text-foreground`
                    }
                  >
                    {message.content}
                  </div>
                </div>
              ))
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
