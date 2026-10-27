"use client";
import { ESC_BY, ORD, SCH, fmtN, fmtVal } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { ExOf, Heatmap, StChip, Tag } from "@/components/common";
import { LinkBtn, PageHead, Sect, StateChip } from "@/components/ui";

function ProcessDetail({ pid, ec }: { pid: string; ec: string }) {
  const ws = useWs();
  const { engine } = ws;
  const M = engine.M;
  const p = engine.P102_BY[pid];
  const cols: string[] = ec === "FAC" ? ["FAC"] : ws.escuela === "TODAS" || (SCH as string[]).includes(ec) ? [...SCH] : [ec];
  const ids = M.rel_proceso_indicador.filter((r) => r[0] === pid).map((r) => r[1]);
  const sts: Record<string, ReturnType<typeof engine.processState>> = {};
  cols.forEach((c) => { sts[c] = engine.processState(c, pid); });
  const fichas = M.rel_proceso_ficha.filter((r) => r[0] === pid).map((r) => r[1]);
  const poiItems = engine.poiProcItems(pid);
  const exP = (M.poi2025_extra || []).filter((e: any) => (M.proc_poi || []).some((r) => r[0] === pid && r[1] === e.act));
  return (
    <div className="card">
      <h3>P{p.n} {p.nombre}</h3>
      <p className="small muted">
        Ficha: <b>{p.estado_ficha}</b>
        {p.ficha_propuesta && p.ficha_propuesta !== "Ninguna" ? ` · propuesta: ${p.ficha_propuesta} (por aprobar)` : ""} · Manual, capítulo {p.capitulo} · Fichas SGC:{" "}
        {fichas.map((f) => <Tag key={f} title={engine.FICHA_BY[f]?.nombre}>{f}</Tag>)}
      </p>
      <div className="pill-row">{cols.map((c) => <span key={c}>{ESC_BY[c].corto}: <StateChip code={sts[c].code} /></span>)}</div>
      <div className="tblw" style={{ marginTop: 10 }}>
        <table className="tbl">
          <thead>
            <tr><th>Indicador de proceso</th>{cols.map((c) => <th key={c}>{ESC_BY[c].corto}</th>)}</tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const ind = engine.IND_BY[id];
              const eid = engine.effId(id);
              return (
                <tr key={id}>
                  <td>
                    <LinkBtn className="id" onClick={() => ws.openFicha(id, cols[0])}>{id}</LinkBtn> {ind.nombre}
                    <div className="small muted">{ind.ficha} · {ind.frecuencia}{eid !== id ? ` · mide lo mismo que ${eid} (modelo CONEAU)` : ""}</div>
                  </td>
                  {cols.map((c) => {
                    const scoped = engine.inScope(c, eid) || engine.inScope(c, id);
                    if (!scoped) return <td key={c}><StateChip code="NA" /><div className="small muted">fuera de alcance</div></td>;
                    const st = engine.status(c, id);
                    const mark = (sts[c].worst.item as any)?.id === id;
                    return (
                      <td key={c}>
                        {mark && (<><span className="tag" title="Este indicador marca el estado del proceso">★ marca el estado</span><br /></>)}
                        <StChip st={st} /><ExOf st={st} />
                        <div className="small num">{st.last ? `${fmtVal(st.last.valor, st.last.unidad)} · meta ${st.last.meta !== null ? fmtVal(st.last.meta, st.last.unidad) : "por definir"}` : "sin dato"}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {poiItems.map((it) => {
              const mark = cols.some((c) => (sts[c].worst.item as any)?.id === it.id);
              return (
                <tr key={it.id}>
                  <td>
                    <LinkBtn className="id" onClick={() => { ws.setVs({ poiAoi: it.x.aoi, poiAnio: it.rep.anio }); ws.go("poi"); }}>{it.id}</LinkBtn> {it.nombre}
                    <div className="small muted">Actividad del POI de la Facultad (compartida, sin reparto por escuela) · {it.rep.etiqueta} · ejecutado {fmtN(it.x.ejec, 0)} de {fmtN(it.x.prog, 0)} programado al corte · {it.x.pag || ""}</div>
                  </td>
                  {cols.map((c) => (
                    <td key={c}>
                      {mark && (<><span className="tag">★ marca el estado</span><br /></>)}
                      <StateChip code={it.code} />
                      <div className="small num">{fmtN(it.x.avance, 1)} % del programado al corte</div>
                    </td>
                  ))}
                </tr>
              );
            })}
            {exP.length > 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="small muted">
                  Archivo de trabajo del POI 2025 [A19], no oficial y fuera del semáforo:{" "}
                  {exP.map((e: any) => `${e.act} ${engine.AOI_BY[e.act]?.actividad || ""} ${fmtN(e.avance_recalculado, 1)} % (${String(e.ref).replace(/^.*hoja '[^']*', /, "")})`).join("; ")}. No están en el reporte anual en PDF.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Procesos() {
  const ws = useWs();
  const { engine } = ws;
  const M = engine.M;
  const cols: string[] = ws.escuela === "TODAS" ? [...ORD] : [ws.escuela];
  const sel = ws.vs.procSel && cols.includes(ws.vs.procSel.esc) ? ws.vs.procSel : { p: ws.vs.procSel?.p ?? "P1", esc: cols[0] };
  return (
    <div>
      <PageHead title="Procesos del criterio 10.2">
        Los nueve procesos mínimos que exige el criterio 10.2 del modelo CONEAU 2026 [A4]. El estado de cada proceso es el del peor de sus indicadores; en cada celda se ve cuál es. Los indicadores SINEACE alimentan a los indicadores de proceso que miden lo mismo.
      </PageHead>
      <div className="grid">
        <div className="card"><Heatmap cols={cols} sel={sel} onPick={(p, esc) => ws.setVs({ procSel: { p, esc } })} /></div>
        <div id="pdetail"><ProcessDetail pid={sel.p} ec={sel.esc} /></div>
      </div>
      <Sect title="Cómo se relacionan procesos, fichas e indicadores" icon="i-link" />
      <div className="card">
        <p className="small">
          Los <b>26 procesos del SGC</b> (fichas PE, PM, PS y ME, con PM09 y PM10 por aprobar) son la unidad de gestión. Los <b>9 procesos del criterio 10.2</b> son lo que CONEAU exige como mínimo; cada uno se apoya en una o más fichas ({M.rel_proceso_ficha.length} vínculos) y en sus indicadores de proceso ({M.rel_proceso_indicador.length} vínculos). Los <b>29 indicadores SINEACE</b> son los que fija el modelo; {M.indicadores.filter((i) => i.alias_sineace).length} indicadores de proceso miden exactamente lo mismo y toman su dato. Detalle en <LinkBtn onClick={() => ws.go("relaciones")}>Relaciones</LinkBtn>.
        </p>
      </div>
    </div>
  );
}
