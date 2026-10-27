"use client";
import { ESC_BY, ORD } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { exportTablero } from "@/lib/actions";
import { Ic } from "@/components/Icon";
import { AlertCard } from "@/components/common";
import { Empty, PageHead, SevChip } from "@/components/ui";

export default function Alertas() {
  const ws = useWs();
  const { engine } = ws;
  const f = ws.vs.fAl;
  const setF = (patch: Partial<typeof f>) => ws.setVs({ fAl: { ...f, ...patch, touched: true } });
  // si hay una escuela elegida arriba y no se tocó el filtro, se usa esa
  const escFiltro = f.touched ? f.esc : ws.escuela !== "TODAS" ? ws.escuela : "";
  const all = engine.ALERTS;
  const list = all.filter((a) => (!escFiltro || a.escuela === escFiltro) && (!f.sev || a.severidad === f.sev) && (!f.regla || a.regla === f.regla));
  const byRule: Record<string, number> = {};
  all.forEach((a) => { byRule[a.regla] = (byRule[a.regla] || 0) + 1; });
  const cnt = (L: typeof all) => ({ c: L.filter((x) => x.severidad === "Crítica").length, r: L.filter((x) => x.severidad === "En riesgo").length, a: L.filter((x) => x.severidad === "Aviso").length });
  const tot = cnt(all), vis = cnt(list);
  const filtered = !!(escFiltro || f.sev || f.regla);

  return (
    <div>
      <PageHead title="Alertas">Reglas explícitas y editables en Parámetros. Cada alerta dice qué ocurre, por qué, desde cuándo, a quién corresponde y qué decisión se sugiere.</PageHead>
      <div className="filters">
        <label>Escuela
          <select value={escFiltro} onChange={(e) => setF({ esc: e.target.value })}>
            <option value="">Todas</option>
            {ORD.map((e) => <option key={e} value={e}>{ESC_BY[e].corto}</option>)}
          </select>
        </label>
        <label>Severidad
          <select value={f.sev} onChange={(e) => setF({ esc: escFiltro, sev: e.target.value })}>
            <option value="">Todas</option><option>Crítica</option><option>En riesgo</option><option>Aviso</option>
          </select>
        </label>
        <label>Regla
          <select value={f.regla} onChange={(e) => setF({ esc: escFiltro, regla: e.target.value })}>
            <option value="">Todas</option>
            {engine.params.reglas.map((r) => <option key={r.id} value={r.id}>{r.id} {r.nombre} ({byRule[r.id] || 0})</option>)}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => exportTablero(ws, "alertas", "xlsx")}><Ic n="i-download" />Alertas (Excel)</button>
        <button className="btn" onClick={() => exportTablero(ws, "alertas", "csv")}><Ic n="i-download" />Alertas (CSV)</button>
      </div>
      <p className="small muted">
        <b>{tot.c + tot.r} críticas y en riesgo</b> de <b>{all.length} alertas en total</b> ({tot.c} críticas, {tot.r} en riesgo y {tot.a} avisos); la cifra de la barra lateral cuenta solo las críticas y en riesgo.{" "}
        {filtered ? <>Con los filtros actuales se muestran <b>{list.length}</b> ({vis.c} críticas, {vis.r} en riesgo y {vis.a} avisos).</> : "Se muestran todas."}
        {ws.ejemplo && " Incluye alertas calculadas sobre datos EJEMPLO (marcadas)."}
      </p>
      <p className="small muted">Orden: por escuela (Enfermería, Obstetricia, Tecnología Médica y Facultad) y, dentro de cada una, por gravedad: crítica, en riesgo y aviso.</p>
      {!list.length && <Empty>No hay alertas con estos filtros.</Empty>}
      {ORD.map((e) => {
        const L = list.filter((a) => a.escuela === e);
        if (!L.length) return null;
        const c = cnt(L);
        return (
          <details key={e} className="alg" open>
            <summary>
              <b>{ESC_BY[e].nombre}</b>{ESC_BY[e].faseTxt && <> <span className="tag">{ESC_BY[e].faseTxt}</span></>}{" "}
              <span className="small muted">{L.length} alertas · {c.c} críticas · {c.r} en riesgo · {c.a} avisos</span>
            </summary>
            <div className="grid">
              {["Crítica", "En riesgo", "Aviso"].map((sv) => {
                const X = L.filter((a) => a.severidad === sv);
                if (!X.length) return null;
                return (
                  <div key={sv} className="grid">
                    <h4 className="alsev"><SevChip sev={sv} /> <span className="small muted">{X.length}</span></h4>
                    {X.map((a) => <AlertCard key={a.uid} a={a} />)}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
