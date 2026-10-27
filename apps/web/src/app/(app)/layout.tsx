"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { useAuth } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";

/** Solo entran personas con sesión; el acceso real lo vuelve a comprobar la API en cada petición. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => { if (auth.status === "out") router.replace("/login"); }, [auth.status, router]);
  if (auth.status !== "in") {
    return (
      <div className="wrap" style={{ maxWidth: 520, margin: "12vh auto" }} role="status" aria-live="polite">
        <div className="card"><p className="muted" style={{ margin: 0 }}>Verificando la sesión…</p></div>
      </div>
    );
  }
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
