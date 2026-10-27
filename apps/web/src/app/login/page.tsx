"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (auth.status === "in") router.replace("/decision"); }, [auth.status, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const msg = await auth.signIn(email, password);
    setBusy(false);
    if (msg) setErr(msg);
  };

  return (
    <main className="wrap" style={{ maxWidth: 460, margin: "9vh auto" }} id="main">
      <div className="card">
        <div className="ph" style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: "1.45rem" }}>SGC · Tablero de decisiones</h1>
          <div className="gl" />
          <p className="small">Escuelas de Tecnología Médica, Enfermería y Obstetricia · Facultad de Medicina San Fernando</p>
        </div>
        <form onSubmit={submit} noValidate className="dec-form">
          {auth.mode === "dev" ? (
            <>
              <p className="small muted">Modo local de desarrollo: elige una cuenta ya creada. En producción se inicia sesión con correo y contraseña.</p>
              <label htmlFor="email">Cuenta
                <select id="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }}>
                  <option value="">Elige una cuenta…</option>
                  {auth.devUsers.map((u) => <option key={u.email} value={u.email}>{u.nombre} · {u.rol} · {u.email}</option>)}
                </select>
              </label>
            </>
          ) : (
            <>
              <label htmlFor="email">Correo<input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} /></label>
              <label htmlFor="password">Contraseña<input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} /></label>
            </>
          )}
          <p className="small" role="alert" style={{ color: "var(--bad-t)", margin: "8px 0" }}>{err}</p>
          <button className="btn primary" type="submit" disabled={busy || !email}>{busy ? "Entrando…" : "Entrar"}</button>
          <p className="small muted" style={{ marginTop: 12 }}>El acceso es solo para personas con cuenta creada por la administración. No hay registro público.</p>
        </form>
      </div>
    </main>
  );
}
