"use client";
import { ESC_BY, ORD, SCH, ST, fmtVal, type StateCode } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { CompareChart, TrendChart } from "@/components/charts";
import { ExOf, StChip } from "@/components/common";
import { PageHead, Sect, Spark, StateChip } from "@/components/ui";

export default function Indicadores() {
  const ws = useWs();
  const { engine } = ws;
  const M = engine.M;
  const escs: string[] = ws.escuela === "TODAS" ? [...SCH, "FAC"] : ws.escuela === "FAC" ? ["FAC"] : [ws.escuela];
  const f = ws.vs.fInd;
  const setF = (patch: Partial<typeof f>) => ws.setVs({ fInd: { ...f, ...patch } });

  const rows = engine.CARGABLES.filter((c) => {
    if (f.tipo && c.tipo !== f.tipo) return false;
    if (f.proc && !engine.procsOfIndicator(c.id).includes(f.proc)) return false;
    if (f.est) {
      const sx = c.tipo === "SINEACE" ? engine.SIN_BY[c.id] : engine.SIN_BY[engine.effId(c.id)];
      if (!sx || !sx.estandares.includes(f.est)) return false;
    }
    if (f.q && !(c.id + " " + c.nombre).toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.estado) { const w = engine.worstAcross(c.id, escs); if (w.code !== f.estado) return false; }
    return escs.some((e) => engine.inScope(e, c.id)) || c.tipo === "SINEACE";
  });

  const cid = engine.CARG_BY[ws.vs.cmpInd] ? ws.vs.cmpInd : engine.CARGABLES[0].id;
  const sts = ORD.map((e) => ({ esc: e as string, st: engine.status(e, cid) })).filter((s) => s.st.last && (ws.escuela === "TODAS" || s.esc === ws.escuela));
  const unit = engine.metaInfo(cid).unidad === "%" ? "%" : "";

  return (
    <div>
      <PageHead title="Indicadores">Los 29 indicadores SINEACE y los indicadores de proceso que se cargan. Haz clic en una fila para ver su ficha de trazabilidad.</PageHead>
      <div className="filters">
        <label>Tipo
          <select value={f.tipo} onChange={(e) => setF({ tipo: e.target.value })}>
            <option value="">Todos</option><option>SINEACE</option><option>Proceso</option><option>PE FM</option>
          </select>
        </label>
        <label>Proceso 10.2
          <select value={f.proc} onChange={(e) => setF({ proc: e.target.value })}>
            <option value="">Todos</option>
            {M.procesos102.map((p) => <option key={p.id} value={p.id}>P{p.n} {p.nombre.slice(0, 38)}</option>)}
          </select>
        </label>
        <label>Estándar
          <select value={f.est} onChange={(e) => setF({ est: e.target.value })}>
            <option value="">Todos</option>
            {M.estandares.map((e) => <option key={e.id} value={e.id}>{e.id}</option>)}
          </select>
        </label>
        <label>Estado
          <select value={f.estado} onChange={(e) => setF({ estado: e.target.value })}>
            <option value="">Todos</option>
            {(["CRIT", "RIESGO", "BAJO", "SD", "SEG", "OK", "DEF"] as StateCode[]).map((k) => <option key={k} value={k}>{ST[k].label}</option>)}
          </select>
        </label>
        <label>Buscar<input type="text" value={f.q} onChange={(e) => setF({ q: e.target.value })} placeholder="código o palabra" /></label>
      </div>
      <p className="small muted">{rows.length} indicadores.</p>
      <div className="tblw">
        <table className="tbl" id="tbl-ind">
          <thead>
            <tr><th>ID</th><th>Indicador</th><th>Frecuencia</th><th>Meta</th>{escs.map((e) => <th key={e}>{ESC_BY[e].corto}</th>)}<th>Serie</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const mi = engine.metaInfo(c.id);
              const mr = engine.metaRowFor(c.id, engine.corteDate().getUTCFullYear()) || engine.metaRowFor(c.id, 9999);
              const also = M.indicadores.filter((i) => i.alias_sineace === c.id).map((i) => i.id);
              const first = escs.map((e) => engine.status(e, c.id)).find((s) => s.last);
              return (
                <tr key={c.id} className="clk" onClick={() => ws.openFicha(c.id, c.tipo === "PE FM" ? "FAC" : escs[0])}>
                  <td className="id">{c.id}</td>
                  <td>{c.nombre}<div className="small muted">{c.tipo}{also.length ? " · mide también " + also.join(", ") : ""}{c.tipo === "Proceso" ? " · " + engine.IND_BY[c.id].ficha : ""}</div></td>
                  <td>{c.frecuencia}</td>
                  <td className="num">{mr ? fmtVal(mr.meta, mi.unidad) : mi.estado === "En conflicto" ? <span className="tag gap">en conflicto</span> : <span className="tag gap">por definir</span>}</td>
                  {escs.map((e) => {
                    if (!engine.inScope(e, c.id)) return <td key={e}><StateChip code="NA" /></td>;
                    const st = engine.status(e, c.id);
                    return <td key={e}><StChip st={st} /><ExOf st={st} /><div className="small num">{st.last ? fmtVal(st.last.valor, st.last.unidad) + " · " + st.last.pinfo.p : ""}</div></td>;
                  })}
                  <td>{first ? <Spark ev={first.sr.ev} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sect title="Gráficos de un indicador" icon="i-chart" />
      <div className="filters">
        <label>Indicador
          <select value={cid} onChange={(e) => ws.setVs({ cmpInd: e.target.value })}>
            {engine.CARGABLES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.nombre.slice(0, 70)}</option>)}
          </select>
        </label>
      </div>
      <div className="grid g2">
        <TrendChart series={sts} unit={unit} title={`Tendencia · ${cid}`} />
        <CompareChart id={cid} title={`Comparación entre escuelas · ${cid}`} />
      </div>
    </div>
  );
}
