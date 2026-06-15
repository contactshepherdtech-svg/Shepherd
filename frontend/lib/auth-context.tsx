"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";

import {
  getChurchForUser,
  getPlanningCenterConnection,
  isPlanningCenterConnected,
  type ChurchRecord,
  type ChurchUserRecord,
  type PlanningCenterConnection,
} from "@/lib/data";
import { supabase } from "@/lib/supabase";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

// Don't auto-sync on login if the last sync is fresher than this.
const SYNC_FRESHNESS_MS = 15 * 60 * 1000;
// How often to re-read the connection row while a sync is running.
const SYNC_POLL_INTERVAL_MS = 4000;
// Hard cap on polling. Kept just above the server's 60s execution ceiling so a
// stuck 'syncing' row can't make tabs poll for the full stale-lock window.
const SYNC_POLL_MAX_MS = 90_000;

type AuthContextValue = {
  user: User | null;
  churchId: number | null;
  churchName: string | null;
  church: ChurchRecord | null;
  churchUser: ChurchUserRecord | null;
  planningCenterConnection: PlanningCenterConnection | null;
  planningCenterConnected: boolean;
  loading: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  triggerSync: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  churchId: null,
  churchName: null,
  church: null,
  churchUser: null,
  planningCenterConnection: null,
  planningCenterConnected: false,
  loading: true,
  syncStatus: "idle",
  syncError: null,
  triggerSync: async () => {},
  refreshWorkspace: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [churchId, setChurchId] = useState<number | null>(null);
  const [churchName, setChurchName] = useState<string | null>(null);
  const [church, setChurch] = useState<ChurchRecord | null>(null);
  const [churchUser, setChurchUser] = useState<ChurchUserRecord | null>(null);
  const [planningCenterConnection, setPlanningCenterConnection] = useState<PlanningCenterConnection | null>(null);
  const [loading, setLoading] = useState(true);
  // This-tab optimistic in-flight flag — flips the chip to "syncing" the moment
  // we POST, before the server has written sync_status='syncing'.
  const [syncing, setSyncing] = useState(false);
  // Synchronous guard so this tab never fires two overlapping syncs (the server
  // lock covers cross-tab/cross-trigger; this avoids the wasted round-trip).
  const syncInFlight = useRef(false);

  const planningCenterConnected = isPlanningCenterConnected(planningCenterConnection);

  const clearWorkspace = useCallback(() => {
    setChurchId(null);
    setChurchName(null);
    setChurch(null);
    setChurchUser(null);
    setPlanningCenterConnection(null);
  }, []);

  const loadWorkspace = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      clearWorkspace();
      return;
    }

    try {
      const result = await getChurchForUser(currentUser.id);
      if (!result) {
        clearWorkspace();
        return;
      }

      const connection = await getPlanningCenterConnection(result.church.id);
      setChurchId(result.church.id);
      setChurchName(result.church.name?.trim() || "My Church");
      setChurch(result.church);
      setChurchUser(result.churchUser);
      setPlanningCenterConnection(connection);
    } catch (error) {
      console.error("Failed to load Shepherd workspace", error);
      clearWorkspace();
    }
  }, [clearWorkspace]);

  const refreshWorkspace = useCallback(async () => {
    if (!user) {
      clearWorkspace();
      return;
    }

    await loadWorkspace(user);
  }, [clearWorkspace, loadWorkspace, user]);

  // Shared sync trigger. Used by the manual button AND the auto-sync triggers,
  // so all paths go through the same in-flight guard and server-side lock.
  // Non-blocking by design: callers don't await it for UI; the chip reflects
  // progress via `syncing` + the polled connection row.
  const triggerSync = useCallback(async () => {
    if (!supabase || !churchId || syncInFlight.current) return;

    syncInFlight.current = true;
    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;

      // The route is synchronous, so this resolves when the run finishes (or
      // returns 409 if another run already owns the lock). Either way we refresh
      // the connection row below; the poll effect covers the 409 / cross-tab case.
      await fetch("/api/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ church_id: churchId }),
      });

      const connection = await getPlanningCenterConnection(churchId);
      setPlanningCenterConnection(connection);
    } catch (error) {
      console.error("Failed to trigger Planning Center sync", error);
    } finally {
      syncInFlight.current = false;
      setSyncing(false);
    }
  }, [churchId]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let resolved = false;
    const apply = (currentUser: User | null) => {
      setUser(currentUser);
      void loadWorkspace(currentUser).finally(() => setLoading(false));
    };

    // onAuthStateChange fires INITIAL_SESSION immediately and is reliable even
    // when getSession() stalls, so it drives the initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolved = true;
      apply(session?.user ?? null);
    });

    // Fallback in case the initial event is missed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!resolved) apply(session?.user ?? null);
    }).catch((error) => {
      console.error("Failed to load session", error);
      // A stale/invalid refresh token in localStorage throws "Invalid Refresh
      // Token: Refresh Token Not Found" and keeps erroring until cleared.
      const message = String(error?.message ?? error);
      if (/refresh token/i.test(message)) {
        void supabase?.auth.signOut();
      }
      if (!resolved) apply(null);
    });

    return () => subscription.unsubscribe();
  }, [loadWorkspace]);

  // Poll the connection row while a sync is running so the chip and counts stay
  // live — including in tabs that didn't initiate the sync. Hard-capped at
  // SYNC_POLL_MAX_MS so a stuck 'syncing' row can't poll for the whole stale-lock
  // window.
  const dbSyncStatus = (planningCenterConnection?.sync_status as SyncStatus | null) ?? "idle";
  useEffect(() => {
    if (!churchId) return;
    if (!syncing && dbSyncStatus !== "syncing") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + SYNC_POLL_MAX_MS;

    const tick = async () => {
      if (cancelled || Date.now() > deadline) return;
      try {
        const connection = await getPlanningCenterConnection(churchId);
        if (cancelled) return;
        if (connection) setPlanningCenterConnection(connection);
        if (connection?.sync_status === "syncing") {
          timer = setTimeout(() => void tick(), SYNC_POLL_INTERVAL_MS);
        }
      } catch (error) {
        console.error("Failed to poll sync status", error);
      }
    };

    timer = setTimeout(() => void tick(), SYNC_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [churchId, syncing, dbSyncStatus]);

  // Auto-sync triggers (both route through triggerSync → server lock dedups):
  //   • after a Planning Center connection completes — callback redirects with
  //     ?pc_connected=1 → always sync immediately.
  //   • on login/load — only if the last sync is stale, and at most once per
  //     session per church.
  useEffect(() => {
    if (loading || !churchId || !planningCenterConnected) return;
    if (syncInFlight.current || dbSyncStatus === "syncing") return;
    if (typeof window === "undefined") return;

    const sessionKey = `shepherd:autosynced:${churchId}`;
    const params = new URLSearchParams(window.location.search);
    if (params.get("pc_connected") === "1") {
      // Strip the flag so a refresh can't re-trigger the connect-time sync, and
      // set the session guard so a failed run doesn't immediately auto-retry
      // (the manual button is the retry path).
      params.delete("pc_connected");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? `?${query}` : ""));
      sessionStorage.setItem(sessionKey, "1");
      void triggerSync();
      return;
    }

    if (sessionStorage.getItem(sessionKey)) return;

    const lastSyncMs = planningCenterConnection?.last_sync_at
      ? new Date(planningCenterConnection.last_sync_at).getTime()
      : 0;
    const isStale = !lastSyncMs || Date.now() - lastSyncMs > SYNC_FRESHNESS_MS;
    if (!isStale) return;

    sessionStorage.setItem(sessionKey, "1");
    void triggerSync();
  }, [
    loading,
    churchId,
    planningCenterConnected,
    dbSyncStatus,
    planningCenterConnection?.last_sync_at,
    triggerSync,
  ]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    clearWorkspace();
  }, [clearWorkspace]);

  const syncStatus: SyncStatus = syncing || dbSyncStatus === "syncing" ? "syncing" : dbSyncStatus;
  const syncError = planningCenterConnection?.sync_error ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        churchId,
        churchName,
        church,
        churchUser,
        planningCenterConnection,
        planningCenterConnected,
        loading,
        syncStatus,
        syncError,
        triggerSync,
        refreshWorkspace,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
