"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DEC_ESC, DEC_ESC_NOM } from "@sgc/engine";
import { ApiError, api } from "@/lib/api";
import { fmtDateTime, run } from "@/lib/actions";
import { useWs } from "@/lib/workspace";
import { Ic } from "@/components/Icon";
import { Banner, Note, PageHead, Sect } from "@/components/ui";

interface Person { id: string; email: string; nombre: string; rol: string; escuela: string | null; activo: boolean; createdAt: string }
interface AuditRow { id: number; ts: string; actor: string | null; accion: string; clave: string; esc: string; antes: unknown; despues: unknown; nota: string }

const ROLES = [
  ["admin", "Administración (todo, incluido el equipo)"],
  ["oficina", "Oficina de Calidad (valida y edita parámetros)"],
  ["responsable", "Responsable de una escuela"],
  ["lectura", "Solo lectura"],
] as const;

export default function Equipo() {
  const ws = useWs();
  const [people, setPeople] = useState<Person[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [form, setForm] = useState({ email: "", nombre: "", rol: "lectura", escuela: "ENF", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (ws.can.manageTeam) setPeople(await api<Person[]>("/api/team").catch(() => []));
    if (ws.can.readAudit) setAudit(await api<AuditRow[]>("/api/audit?limit=100").catch(() => []));
  }, [ws.can.manageTeam, ws.can.readAudit]);
  useEffect(() => { void load(); }, [load]);

  if (!ws.can.manageTeam) {
    return (
      <div>
        <PageHead title="Equipo">Las personas con acceso al tablero y sus permisos.</PageHead>
        <Banner>Solo la administración gestiona al equipo. Si necesitas una cuenta o un cambio de permisos, pídelo a la administración.</Banner>
        {ws.can.readAudit && <AuditTable rows={audit} names={ws.server.decision.names} />}
      </div>
    );
  }

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/api/team", { body: { ...form, escuela: form.rol === "responsable" ? form.escuela : null } });
      ws.toast(`Cuenta creada para ${form.nombre}. Entrégale el correo y la contraseña inicial por un canal seguro.`);
      setForm({ email: "", nombre: "", rol: "lectura", escuela: "ENF", password: "" });
      await load(); await ws.refresh();
    } catch (er) { setErr(er instanceof ApiError ? er.message : "No se pudo crear la cuenta."); }
    setBusy(false);
  };
  const patch = async (id: string, body: Record<string, unknown>, ok: string) => {
    if (await run(ws, () => api(`/api/team/${id}`, { method: "PATCH", body }), ok)) { await load(); await ws.refresh(); }
  };
  const resetPw = async (p: Person) => {
    const pw = window.prompt(`Nueva contraseña para ${p.nombre} (mínimo 10 caracteres):`);
    if (!pw) return;
    await run(ws, () => api(`/api/team/${p.id}/password`, { body: { password: pw } }), "Contraseña restablecida.");
  };

  return (
    <div>
      <PageHead title="Equipo">Solo entran personas definidas aquí: no hay registro público. Cada cuenta tiene un nombre y un rol; todo lo que hace queda en la bitácora con su nombre.</PageHead>
      <Sect title="Agregar una persona" icon="i-upload" />
      <form className="card dec-form" onSubmit={create} noValidate>
        <div className="dec-fg">
          <label>Nombre completo<input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
          <label>Correo<input type="email" required autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Contraseña inicial (mín. 10)<input type="text" required autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label>Rol<select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>{ROLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          {form.rol === "responsable" && <label>Escuela<select value={form.escuela} onChange={(e) => setForm({ ...form, escuela: e.target.value })}>{DEC_ESC.map((x) => <option key={x} value={x}>{DEC_ESC_NOM[x]}</option>)}</select></label>}
        </div>
        <p className="small" role="alert" style={{ color: "var(--bad-t)", margin: "6px 0" }}>{err}</p>
        <div className="dec-actions"><button className="btn primary" type="submit" disabled={busy}><Ic n="i-upload" />Crear cuenta</button></div>
        <p className="small muted" style={{ margin: "6px 0 0" }}>Hay un solo responsable por escuela: si asignas uno nuevo, el anterior pasa a solo lectura.</p>
      </form>

      <Sect title={`Personas (${people.length})`} icon="i-grid" />
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Escuela</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} style={p.activo ? undefined : { opacity: 0.6 }}>
                <td><b>{p.nombre}</b>{p.id === ws.me.id && <> <span className="tag">tú</span></>}</td>
                <td className="small">{p.email}</td>
                <td>
                  <select aria-label={`Rol de ${p.nombre}`} value={p.rol} onChange={(e) => patch(p.id, { rol: e.target.value, escuela: e.target.value === "responsable" ? p.escuela ?? "ENF" : null }, "Rol actualizado.")}>
                    {ROLES.map(([k, t]) => <option key={k} value={k}>{t.split(" (")[0]}</option>)}
                  </select>
                </td>
                <td>
                  {p.rol === "responsable" ? (
                    <select aria-label={`Escuela de ${p.nombre}`} value={p.escuela ?? "ENF"} onChange={(e) => patch(p.id, { escuela: e.target.value }, "Escuela actualizada.")}>{DEC_ESC.map((x) => <option key={x} value={x}>{DEC_ESC_NOM[x]}</option>)}</select>
                  ) : "—"}
                </td>
                <td>{p.activo ? <span className="chip st-ok"><Ic n="i-ok" /><span>Activa</span></span> : <span className="chip st-na"><Ic n="i-na" /><span>Desactivada</span></span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn small" onClick={() => resetPw(p)}>Restablecer contraseña</button>{" "}
                  <button className="btn small" onClick={() => patch(p.id, { activo: !p.activo }, p.activo ? "Cuenta desactivada." : "Cuenta activada.")}>{p.activo ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>Desactivar una cuenta le quita el acceso al instante y conserva su historial. No se borran cuentas para no perder la trazabilidad de quién cargó cada dato.</Note>
      <AuditTable rows={audit} names={ws.server.decision.names} />
    </div>
  );
}

function AuditTable({ rows, names }: { rows: AuditRow[]; names: Record<string, string> }) {
  return (
    <>
      <Sect title="Bitácora completa (últimos 100 movimientos)" icon="i-doc" />
      <div className="tblw" style={{ maxHeight: 460 }}>
        <table className="tbl">
          <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Elemento</th><th>Detalle</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num small">{fmtDateTime(r.ts)}</td><td>{r.actor ? names[r.actor] ?? "—" : "Sistema"}</td><td>{r.accion}</td><td className="small">{r.clave}{r.esc ? ` · ${r.esc}` : ""}</td>
                <td className="small">{r.antes ? JSON.stringify(r.antes) : ""}{r.antes && r.despues ? " → " : ""}{r.despues ? JSON.stringify(r.despues) : ""}{r.nota ? ` · ${r.nota}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
