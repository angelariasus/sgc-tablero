"use client";
import { ESC_BY, ORD, SCH, ST, fmtDate, fmtN, type StateCode } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Ic } from "@/components/Icon";
import { AlertCard, Heatmap, nameOf } from "@/components/common";
import { CoverageChart, GapsChart } from "@/components/charts";
import { Banner, Empty, LinkBtn, PageHead, Sect, StateBar, StateChip } from "@/components/ui";

export default function General() {
  const ws = useWs();
  const { engine, catalog } = ws;
  const M = catalog.model;

  const summary = (ec: string) => {
    const items = engine.scopeList(ec).map((c) => { const st = engine.status(ec, c.id); return { id: c.id, nombre: c.nombre, code: st.state as StateCode, st, gap: engine.gapOf(st) }; });
    const counts: Record<string, number> = { CRIT: 0, RIESGO: 0, BAJO: 0, SD: 0, OK: 0, DEF: 0 };
    items.forEach((i) => { counts[i.code] = (counts[i.code] ?? 0) + 1; });
    return { items, counts, worst: engine.worstOf(items), alerts: engine.ALERTS.filter((a) => a.escuela === ec), cov: engine.coverageStats(ec), has: engine.schoolHasData(ec) };
  };
  const sums = Object.fromEntries(ORD.map((e) => [e, summary(e)]));
  const all3 = SCH.flatMap((e) => sums[e].items);
  const wAll = engine.worstOf(all3.concat(sums.FAC.items));
  const nAl: Record<string, number> = { Crítica: 0, "En riesgo": 0, Aviso: 0 };
  engine.ALERTS.forEach((a) => { nAl[a.severidad] = (nAl[a.severidad] || 0) + 1; });
  const nVig = SCH.reduce((s, e) => s + sums[e].items.length, 0);
  const nDato = SCH.reduce((s, e) => s + sums[e].cov.dato, 0);
  const A = engine.poiAll();
  const top = engine.ALERTS.filter((a) => a.severidad !== "Aviso").slice(0, 6);
  const gapRows = SCH.flatMap((e) => engine.scopeList(e).map((c) => ({ esc: e, id: c.id, nombre: c.nombre, st: engine.status(e, c.id) })));
  const wItem = wAll.item as any;

  return (
    <div>
      <PageHead title="Vista general">Semáforo global y por escuela. Cada escuela carga su información; la Facultad es el marco común. El peor indicador marca el estado y se indica cuál es.</PageHead>
      <div className="card hl" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 34px", alignItems: "center" }}>
          <div>
            <div className="kpi"><span className="l">Semáforo global (peor indicador)</span><span className="v" style={{ fontSize: "1.5rem" }}>{ST[wAll.code].label}</span></div>
            <div style={{ marginTop: 6 }}><StateChip code={wAll.code} /></div>
          </div>
          <div className="kpis" style={{ flex: 1, minWidth: 300 }}>
            <div className="kpi"><span className="v">{nVig}</span><span className="l">Indicadores vigilados (3 escuelas)</span></div>
            <div className="kpi"><span className="v">{nVig ? fmtN((nDato / nVig) * 100, 0) : 0} %</span><span className="l">Con dato con fuente</span></div>
            <div className="kpi"><span className="v">{nAl["Crítica"]}</span><span className="l">Alertas críticas</span></div>
            <div className="kpi"><span className="v">{nAl["En riesgo"]}</span><span className="l">Alertas en riesgo</span></div>
            <div className="kpi"><span className="v">{nAl["Aviso"]}</span><span className="l">Avisos</span></div>
          </div>
        </div>
        {wItem && (
          <p className="small" style={{ margin: "12px 0 0" }}>
            Marca el estado: <b>{wItem.id}</b> {wItem.nombre || nameOf(ws, wItem.id)}
            {wItem.st.desde ? " · " + (wItem.st.state === "SD" ? "" : "desde " + fmtDate(wItem.st.desde)) : ""}.{" "}
            <LinkBtn style={{ color: "#fff" }} onClick={() => ws.openFicha(wItem.id, wItem.st.esc)}>Ver ficha</LinkBtn>
          </p>
        )}
      </div>

      <Sect title="Escuelas lado a lado" icon="i-grid" />
      <div className="grid g4">
        {[...SCH, "FAC"].map((e) => {
          const s = sums[e];
          const code: StateCode = s.items.length ? s.worst.code : "SD";
          const w = s.worst.item as any;
          const na = { c: s.alerts.filter((a) => a.severidad === "Crítica").length, r: s.alerts.filter((a) => a.severidad === "En riesgo").length, a: s.alerts.filter((a) => a.severidad === "Aviso").length };
          return (
            <section key={e} className={"card scard " + (e === "FAC" ? "fac" : "")} aria-label={ESC_BY[e].nombre}>
              <div>
                <h3>{ESC_BY[e].nombre}</h3>
                <div className="muted small">{e === "FAC" ? "Marco común: POI compartido, sin reparto por escuela" : e === "TM" ? "Cuatro áreas: Radiología, Terapia Física, Terapia Ocupacional, Lab. Clínico y Anat. Patológica" : "Programa de pregrado"}</div>
                {e !== "FAC" && (
                  <div style={{ marginTop: 4 }}>
                    <span className="tag" title="Orden de implementación definido por Robert">{ESC_BY[e].faseTxt}</span>
                    {!engine.enImplementacion(e) && <span className="tag gap">aún sin exigir carga</span>}
                  </div>
                )}
              </div>
              <div className="big">
                <StateChip code={code} />
                {!s.has && e !== "FAC" && <span className="small muted">sin archivo cargado</span>}
              </div>
              <StateBar counts={s.counts} total={s.items.length} />
              <div className="why">
                {w ? (
                  <>
                    <b>Marca el estado:</b> <LinkBtn onClick={() => ws.openFicha(w.id, e)}>{w.id}</LinkBtn> {nameOf(ws, w.id)}.
                    {w.st.last && w.st.last.cumpl !== null ? ` ${fmtN(w.st.last.cumpl, 0)} % de la meta` : ""}
                    {w.st.desde ? `, desde ${fmtDate(w.st.desde)}` : ""}.
                  </>
                ) : s.items.length ? "Ningún indicador con semáforo todavía." : "Sin indicadores vigilados."}
              </div>
              <div className="small muted">Con dato {s.cov.dato}/{s.cov.n} · evidencia {s.cov.evi} · validados {s.cov.val}</div>
              <div className="pill-row">
                <button className="btn small" onClick={() => { ws.setVs({ fAl: { esc: e, sev: "", regla: "", touched: true } }); ws.go("alertas"); }}><Ic n="i-bell" />Alertas {na.c + na.r + na.a}</button>
                <span className="small muted">{na.c} críticas · {na.r} en riesgo · {na.a} avisos</span>
              </div>
            </section>
          );
        })}
      </div>

      <Banner>
        <b>La Facultad es el marco común.</b> El POI disponible (reportes de seguimiento 2024, 2025 y febrero de 2026) es del centro de costo 01.30 de la Facultad y no distingue escuelas: se muestra como <b>compartido por la Facultad</b>. Cumplimiento promedio de las AOI:{" "}
        {M.poi_reportes.map((r, i) => (
          <span key={r.anio}>{i ? " · " : ""}{r.anio === 2026 ? "feb. 2026 (parcial)" : r.anio}: <b>{fmtN(A[r.anio].i3, 2)} %</b></span>
        ))}
        . La desagregación por escuela está <b>por confirmar</b>. <LinkBtn onClick={() => ws.go("poi")}>Ver PEI y POI</LinkBtn>
      </Banner>

      <Sect title="Qué requiere una decisión" icon="i-bell" />
      {top.length ? (
        <>
          <div className="grid g2">{top.map((a) => <AlertCard key={a.uid} a={a} compact />)}</div>
          <p style={{ marginTop: 10 }}><button className="btn" onClick={() => { ws.setVs({ fAl: { esc: "", sev: "", regla: "", touched: true } }); ws.go("alertas"); }}><Ic n="i-bell" />Ver las {engine.ALERTS.length} alertas</button></p>
        </>
      ) : <Empty>No hay alertas críticas ni en riesgo. Revisa los avisos o carga más datos.</Empty>}

      <Sect title="Mapa de calor: proceso × escuela" icon="i-grid" />
      <div className="card">
        <Heatmap cols={ORD} onPick={(p, esc) => { ws.setVs({ procSel: { p, esc } }); ws.go("procesos"); }} />
        <p className="note">Cada celda muestra el estado del proceso según su peor indicador y cuál es. Haz clic para ver los indicadores en <LinkBtn onClick={() => ws.go("procesos")}>Procesos 10.2</LinkBtn>.</p>
      </div>

      <Sect title="Brechas y cobertura" icon="i-chart" />
      <div className="grid g2" style={{ marginTop: 14 }}>
        <GapsChart rows={gapRows} n={10} onOpen={(id, esc) => ws.openFicha(id, esc)} />
        <CoverageChart escs={[...SCH]} />
      </div>
    </div>
  );
}
