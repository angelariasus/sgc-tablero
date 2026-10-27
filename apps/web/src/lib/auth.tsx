"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { configureApi } from "./api";
import { API_URL, AUTH_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export interface AuthState {
  status: "loading" | "out" | "in";
  mode: "supabase" | "dev";
  signIn(email: string, password?: string): Promise<string | null>;
  signOut(): Promise<void>;
  /** correos disponibles para elegir en modo local */
  devUsers: { email: string; nombre: string; rol: string }[];
}

const Ctx = createContext<AuthState | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fuera de AuthProvider");
  return c;
};

const DEV_KEY = "sgc-dev-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [devUsers, setDevUsers] = useState<AuthState["devUsers"]>([]);
  const supa = useRef<SupabaseClient | null>(null);
  const devToken = useRef<string | null>(null);

  const signOutInner = useCallback(async () => {
    if (AUTH_MODE === "dev") {
      devToken.current = null;
      sessionStorage.removeItem(DEV_KEY);
      setStatus("out");
      return;
    }
    await supa.current?.auth.signOut();
    setStatus("out");
  }, []);

  useEffect(() => {
    configureApi(
      async () => {
        if (AUTH_MODE === "dev") return devToken.current;
        const { data } = await supa.current!.auth.getSession();
        return data.session?.access_token ?? null;
      },
      () => { void signOutInner(); },
    );
    if (AUTH_MODE === "dev") {
      devToken.current = sessionStorage.getItem(DEV_KEY);
      setStatus(devToken.current ? "in" : "out");
      fetch(`${API_URL}/api/dev/users`).then((r) => (r.ok ? r.json() : [])).then(setDevUsers).catch(() => {});
      return;
    }
    if (!supa.current) {
      supa.current = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    }
    const c = supa.current;
    c.auth.getSession().then(({ data }) => setStatus(data.session ? "in" : "out"));
    const { data: sub } = c.auth.onAuthStateChange((_e, session) => setStatus(session ? "in" : "out"));
    return () => sub.subscription.unsubscribe();
  }, [signOutInner]);

  const signIn = useCallback(async (email: string, password?: string) => {
    if (AUTH_MODE === "dev") {
      const r = await fetch(`${API_URL}/api/dev/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return (j.message as string) ?? "No se pudo iniciar sesión.";
      devToken.current = j.token;
      sessionStorage.setItem(DEV_KEY, j.token);
      setStatus("in");
      return null;
    }
    const { error } = await supa.current!.auth.signInWithPassword({ email: email.trim(), password: password ?? "" });
    if (error) return /invalid login/i.test(error.message) ? "Correo o contraseña incorrectos." : error.message;
    return null;
  }, []);

  const value = useMemo<AuthState>(() => ({ status, mode: AUTH_MODE, signIn, signOut: signOutInner, devUsers }), [status, signIn, signOutInner, devUsers]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
