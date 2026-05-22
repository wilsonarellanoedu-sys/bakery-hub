import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "supervisor" | "cajero" | "panadero" | "almacen";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRolesFor(userId: string, attempt = 0): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    console.error("[useAuth] fetchRoles error", error);
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      return fetchRolesFor(userId, attempt + 1);
    }
    return [];
  }
  const roles = (data ?? []).map((r) => r.role as AppRole);
  // Retry once if empty (may indicate auth token not yet attached)
  if (roles.length === 0 && attempt < 2) {
    await new Promise((r) => setTimeout(r, 300));
    return fetchRolesFor(userId, attempt + 1);
  }
  return roles;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadRoles = async (uid: string) => {
      const r = await fetchRolesFor(uid);
      if (!cancelled) setRoles(r);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadRoles(sess.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        await loadRoles(sess.user.id);
      }
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    roles,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    isAdmin: roles.includes("admin"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
