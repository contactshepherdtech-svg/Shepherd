"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

type AuthContextValue = {
  user: User | null;
  churchId: number | null;
  churchName: string | null;
  church: ChurchRecord | null;
  churchUser: ChurchUserRecord | null;
  planningCenterConnection: PlanningCenterConnection | null;
  planningCenterConnected: boolean;
  loading: boolean;
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

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    clearWorkspace();
  }, [clearWorkspace]);

  return (
    <AuthContext.Provider
      value={{
        user,
        churchId,
        churchName,
        church,
        churchUser,
        planningCenterConnection,
        planningCenterConnected: isPlanningCenterConnected(planningCenterConnection),
        loading,
        refreshWorkspace,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
