"use client";
import { useEffect, useRef } from "react";
import { ESC_BY, ORD, REGLAS, fmtDate, fmtN, fmtVal, parseISO, reglaKey, uniq } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Ic } from "./Icon";
import { CompareChart, TrendChart } from "./charts";
import { AlertCard, ExOf, StChip, Tag } from "./common";
import { ExBadge, StateChip } from "./ui";

/** Ficha de trazabilidad de un indicador: estado, definición, metas, vínculos, historial y alertas. */
export default function FichaDrawer() {
  const ws = useWs();
  const closeRef = useRef<HTMLButtonElement>(null);
  const f = ws.ficha;
  useEffect(() => {
    if (!f) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") ws.closeFicha(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f?.id]);
  if (!f) return null;

  const { engine } = ws;
  const M = engine.M;
  const id = f.id, esc_ = f.esc;
  const eid = engine.effId(id);
  const isS = !!engine.SIN_BY[id];
  const ind = engine.IND_BY[id];
  const mi = engine.metaInfo(eid);
  const catE = engine.CARG_BY[eid];
  const st = engine.status(esc_, id);
  const L = st.last;
  const procs = engine.procsOfIndicator(eid);
  const stds = engine.SIN_BY[eid] ? engine.SIN_BY[eid].estandares : [];
  const rows = engine.params.metas[eid] || [];
  const nombre = isS ? engine.SIN_BY[id].nombre : ind ? ind.nombre : id;
  const aois = uniq([...engine.aoiForInd(id), ...(eid !== id ? engine.aoiForInd(eid) : [])]);
  const evOfStd = stds.flatMap((sx) => M.evidencias.filter((e) => e.estandar === sx));
  const ae = engine.autoeval[esc_];
  const aeI = ae && ae.indicadores.find((x) => x.id === eid);
  const sx: any = engine.SIN_BY[eid] || {};
  const rk = reglaKey((rows[0] || ({} as any)).regla);
  const sts = ORD.map((e) => ({ esc: e as string, st: engine.status(e, id) })).filter((s) => s.st.last);
  const all = engine.DB.vis.concat(engine.DB.rejected).filter((r) => r.escuela === esc_ && r.indicador === eid).sort((a, c) => (c.pinfo ? c.pinfo.end.getTime() : 0) - (a.pinfo ? a.pinfo.end.getTime() : 0));
  const als = engine.ALERTS.filter((a) => (a.objetoId === id && a.escuela === esc_) || (eid !== id && a.objetoId === eid && a.escuela === esc_));
  const A = engine.poiAll();
  const fv = (v: number | null) => (v === null ? "—" : sx.unidad === "%" ? fmtN(v * 100, 1) + " %" : fmtN(v, 2) + (sx.unidad === "años" ? " años" : ""));

  return (
    <>
      <div className="drawer-bg" onClick={ws.closeFicha} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={"Ficha del indicador " + id}>
        <header>
          <div style={{ flex: 1 }}>
            <div className="small" style={{ opacity: 0.85 }}>{isS ? "Indicador del modelo CONEAU 2026" : "Indicador de proceso"} · {isS ? "SINEACE" : ind ? ind.ficha : ""}</div>
            <h2>{id} · {nombre}</h2>
          </div>
          <button ref={closeRef} className="btn" onClick={ws.closeFicha} aria-label="Cerrar ficha"><Ic n="i-x" />Cerrar</button>
        </header>
        <div className="body">
          <div className="filters">
            <span className="small muted">Escuela:</span>
            <div className="seg-btn" role="group" aria-label="Escuela de la ficha">
              {ORD.map((e) => <button key={e} aria-pressed={e === esc_} onClick={() => ws.setFichaEsc(e)}>{ESC_BY[e].corto}</button>)}
            </div>
          </div>
          <div className="card">
            <div className="pill-row">
              <StChip st={st} /><ExOf st={st} />
              {L && <span className="num"><b>{fmtVal(L.valor, L.unidad)}</b> en {L.pinfo.p}</span>}
              {eid !== id && <span className="tag">dato tomado de {eid} (mide lo mismo)</span>}
            </div>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Qué dice el estado</dt>
              <dd>
                {L
                  ? <>{fmtVal(L.valor, L.unidad)} frente a {L.meta !== null ? (L.sinEsperado ? `una meta anual de ${fmtVal(L.meta, L.unidad)} sin valor esperado al corte: ${L.espTxt}` : L.espTxt + (L.cumple !== null ? (L.cumple ? " (cumple)" : " (no cumple)") : ` (${fmtN(L.cumpl, 1)} % de lo esperado)`)) : "una meta por definir"}{st.desde ? `. En este estado desde el periodo ${st.desdePeriodo} (${fmtDate(st.desde)})` : ""}.</>
                  : "No hay ninguna medición con fuente cargada para esta escuela."}
              </dd>
              {st.vencido && L && (<><dt>Dato vencido</dt><dd>Esperado: periodo {st.expLabel}. Último: {L.pinfo.p}. Plazo vencido el {fmtDate(st.overdueSince)}.</dd></>)}
              {st.tendencia && (<><dt>Tendencia</dt><dd>Se aleja de la meta {st.tendencia.n} periodos seguidos: {st.tendencia.serie}</dd></>)}
            </dl>
          </div>

          {aeI && (
            <div className="card">
              <div className="pill-row"><span className="chip st-nodata"><Ic n="i-nodata" /><span>Sin dato validado</span></span><h3 style={{ margin: 0 }}>Valor del informe de autoevaluación</h3></div>
              <dl className="kv" style={{ marginTop: 8 }}>
                <dt>Valor del informe</dt><dd><b>{fv(aeI.valor)}</b> frente a un referencial de {fv(aeI.referencial)} <span className="small muted">(el Consolidado dice: {aeI.estadoRef || "—"})</span></dd>
                <dt>Cálculo</dt><dd>{aeI.variables || "—"}</dd>
                {aeI.obs && (<><dt>Observación</dt><dd>{aeI.obs}</dd></>)}
                <dt>Fuente</dt><dd>{ae.name} · {aeI.ref}</dd>
              </dl>
              <p className="small muted" style={{ margin: "8px 0 0" }}>Robert indicó que estos valores no son datos validados: solo ID1 trae sus variables. Se muestran para consulta, no definen el estado ni generan alertas de meta.</p>
            </div>
          )}

          <div className="card">
            <h3>Definición</h3>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Nombre</dt><dd>{nombre}</dd>
              <dt>Fórmula</dt><dd>{isS ? "Según la ficha del indicador en el modelo CONEAU 2026 [A4]; porcentaje o tiempo de acuerdo con su unidad" : ind?.formula}</dd>
              <dt>Fuente del dato</dt><dd>{isS ? "Encuestas y registros de la escuela [CP]" : ind?.fuente_dato}</dd>
              <dt>Periodicidad</dt><dd>{catE?.frecuencia || "—"} <span className="small muted">{isS ? "(tomada de los indicadores de proceso vinculados [CP])" : "(propuesta [CP])"}</span></dd>
              <dt>Responsable</dt><dd>{engine.responsableOf(esc_, id)}</dd>
              <dt>Unidad y sentido</dt><dd>{mi.unidad} · {mi.sentido}</dd>
              {rk !== "razon" && (<><dt>Regla de cumplimiento</dt><dd>{REGLAS[rk].nombre}<div className="small muted">{isS && sx.regla_nota ? sx.regla_nota : REGLAS[rk].txt}</div></dd></>)}
              <dt>Ámbito</dt><dd>{ind ? ind.ambito : "Escuela"}{ind && ind.ambito === "Facultad" ? " (cumplimiento del POI de la Facultad: no se reparte por escuela)" : ""}</dd>
            </dl>
          </div>

          <div className="card">
            <h3>Meta y umbrales</h3>
            <div className="tblw" style={{ marginTop: 8 }}>
              <table className="tbl">
                <thead><tr><th>Desde</th><th>Meta</th><th>Fuente de la meta</th><th>Límite meta</th><th>Límite riesgo</th><th>Fuente del umbral</th></tr></thead>
                <tbody>
                  {rows.length ? rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.desde ? r.desde : "siempre"}</td>
                      <td className="num">{r.meta !== null ? fmtVal(r.meta, mi.unidad) : <span className="tag gap">{r.estado_meta || "por definir"}</span>}</td>
                      <td>{r.fuente_meta || "—"}</td>
                      <td className="num">{r.verde_min != null ? r.verde_min + " %" : <span className="tag gap">por definir</span>}</td>
                      <td className="num">{r.rojo_min != null ? r.rojo_min + " %" : <span className="tag gap">por definir</span>}</td>
                      <td>{r.fuente_umbral || (r.verde_min != null ? "" : "Sin fuente: sin semáforo")}</td>
                    </tr>
                  )) : <tr><td colSpan={6}>Sin metas cargadas</td></tr>}
                </tbody>
              </table>
            </div>
            {mi.nota && <p className="note" style={{ marginTop: 8 }}>{mi.nota}</p>}
            {L?.bands && <p className="small" style={{ margin: "8px 0 0" }}><b>Umbrales aplicados a este dato:</b> En meta desde {L.bands.verde} % {L.bands.base === "valor" ? "de avance" : "de la meta"}; Crítico por debajo de {L.bands.rojo} %. Fuente: {L.bandsSrc || "parámetros"}.</p>}
            {L?.espFuente && <p className="small" style={{ margin: "8px 0 0" }}><b>Esperado a la fecha de corte:</b> {fmtVal(L.esperado, L.unidad)}{L.prorrata ? " (prorrateo lineal de la meta anual)" : ""}. Fuente: {L.espFuente}. La alerta compara contra este valor y no contra la meta anual.</p>}
            <p className="small muted">Sin umbral con fuente, el indicador no tiene semáforo: se compara con la meta y, si la supera, queda «En meta»; si no, «Bajo la meta, umbral por definir» en gris.</p>
          </div>

          <div className="card">
            <h3>Vínculos</h3>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Procesos del criterio 10.2</dt>
              <dd>{procs.length ? procs.map((p) => <Tag key={p}>P{engine.P102_BY[p].n} {engine.P102_BY[p].nombre}</Tag>) : <Tag gap>ninguno de los nueve</Tag>}</dd>
              <dt>Ficha(s) del SGC</dt>
              <dd>{(isS ? engine.SIN_BY[id].fichas : [ind!.ficha]).map((fc) => <Tag key={fc} title={engine.FICHA_BY[fc]?.nombre}>{fc} {engine.FICHA_BY[fc]?.nombre}</Tag>)}</dd>
              <dt>Estándar(es) CONEAU</dt>
              <dd>
                {stds.length ? stds.map((x) => <Tag key={x}>{x} {engine.EST_BY[x].nombre}</Tag>) : isS ? <Tag gap>por confirmar</Tag> : <Tag gap>vía el indicador SINEACE vinculado, si lo hay</Tag>}
                {isS && <div className="small muted">Criterios que cita la ficha: {sx.criterios_texto}{sx.criterios_fuente ? `. Fuente: ${sx.criterios_fuente}${sx.criterios_previos ? `; antes decía «${sx.criterios_previos}»` : ""}` : ""}</div>}
              </dd>
              {isS ? (
                <>
                  <dt>Indicadores de proceso</dt>
                  <dd>{engine.SIN_BY[id].indicadores_proceso.length ? engine.SIN_BY[id].indicadores_proceso.map((i) => <button key={i} className="linkbtn tag" onClick={() => ws.openFicha(i, esc_)}>{i}</button>) : <Tag gap>sin indicador de proceso: se mide directo</Tag>}</dd>
                </>
              ) : (
                <>
                  <dt>Indicador SINEACE</dt>
                  <dd>
                    {ind!.alias_sineace ? (<><button className="linkbtn tag" onClick={() => ws.openFicha(ind!.alias_sineace as string, esc_)}>{ind!.alias_sineace}</button> mide lo mismo</>)
                      : M.rel_sineace_indicador.filter((r) => r[1] === id).map((r) => <button key={r[0]} className="linkbtn tag" onClick={() => ws.openFicha(r[0], esc_)}>{r[0]}</button>).length
                        ? M.rel_sineace_indicador.filter((r) => r[1] === id).map((r) => <button key={r[0]} className="linkbtn tag" onClick={() => ws.openFicha(r[0], esc_)}>{r[0]}</button>)
                        : <Tag gap>sin referencia en el modelo</Tag>}
                  </dd>
                </>
              )}
              {ind && (
                <>
                  <dt>PE FM 2024-2027</dt>
                  <dd>{ind.pe_oe || "—"} · {ind.pe_ae || ""}<div className="small muted">{ind.pe_ind || ""} · vínculo: {ind.pe_vinculo || ""} · {ind.pe_fuente || ""}</div></dd>
                  {ind.continua_pei && (
                    <>
                      <dt>Continuidad en el PEI 2026-2030</dt>
                      <dd><span className={"tag cont-" + (ind.continua_tono === "Rojo" ? "r" : "n")}>Continúa · marca {String(ind.continua_tono).toLowerCase()}</span><div className="small muted">{M.pei_continua.find((c: any) => c.cod === ind.cod_pe_fm)?.ref || ""}. Los dos tonos se mantienen como estados distintos: qué diferencia a cada uno está por confirmar.</div></dd>
                    </>
                  )}
                  <dt>PEI UNMSM 2026-2030</dt>
                  <dd>{ind.pei_oei || "—"} · {ind.pei_aei || ""}<div className="small muted">{ind.pei_ind || ""} · vínculo: {ind.pei_vinculo || ""} · {ind.pei_fuente || ""}</div></dd>
                </>
              )}
              <dt>POI (AOI)</dt>
              <dd>
                {aois.length ? aois.map((a) => {
                  const x = engine.AOI_BY[a];
                  const last = A[2026]?.lista.find((z: any) => z.act === a && z.prog > 0) || A[2025]?.lista.find((z: any) => z.act === a && z.prog > 0);
                  return <div key={a}><span className="tag gap">Compartida por la Facultad</span> <b>{a}</b> {x?.actividad}{last && <span className="small muted"> · avance {fmtN(last.avance, 0)} % ({last.aoi.slice(-5)})</span>}</div>;
                }) : <Tag gap>sin AOI en los reportes</Tag>}
                <div className="small muted">POI formal aprobado y desagregación por escuela: por confirmar.</div>
              </dd>
              <dt>Evidencias (EV) del estándar</dt>
              <dd>{evOfStd.length ? <>{evOfStd.slice(0, 14).map((e) => <Tag key={e.id} title={e.descripcion}>{e.id}</Tag>)}{evOfStd.length > 14 && " …"}</> : <Tag gap>por confirmar</Tag>}</dd>
            </dl>
          </div>

          <div className="grid">
            <TrendChart series={sts} unit={mi.unidad === "%" ? "%" : ""} title={`Tendencia · ${id}`} />
            <CompareChart id={id} title={`Comparación entre escuelas · ${id}`} />
          </div>

          <div className="card">
            <h3>Historial de valores y trazabilidad</h3>
            {all.length ? (
              <div className="tblw" style={{ marginTop: 8 }}>
                <table className="tbl">
                  <thead><tr><th>Periodo</th><th>Valor</th><th>Estado</th><th>Fuente del dato</th><th>Evidencia</th><th>Cargó</th><th>Versión</th><th>Validación</th><th>Origen</th></tr></thead>
                  <tbody>
                    {all.map((r, i) => {
                      const ev = r.pinfo && !r.motivo ? engine.evalPoint(eid, r) : null;
                      return (
                        <tr key={i} style={r.motivo ? { opacity: 0.7 } : undefined}>
                          <td>{r.periodo}{r.area && <><br /><span className="small muted">{r.area}</span></>}</td>
                          <td className="num">{r.valor !== null && r.valor !== undefined ? fmtVal(r.valor, mi.unidad) : "—"}</td>
                          <td>{r.motivo ? (<><span className="chip st-info"><Ic n="i-info" /><span>No se muestra</span></span><div className="small">{r.motivo}</div></>) : <StateChip code={ev!.state} />}</td>
                          <td>{r.fuente_dato || "—"}</td>
                          <td>{[r.ev, r.ev_ref].filter(Boolean).join(" · ") || "sin evidencia"}</td>
                          <td>{r.cargado_por || "—"}<div className="small muted">{r.fecha_carga ? fmtDate(parseISO(r.fecha_carga)) : "—"}</div></td>
                          <td className="num">{r.version}</td>
                          <td>{r.estado_val}{r.validado_por && <div className="small muted">{r.validado_por}{r.fecha_val ? " · " + fmtDate(parseISO(r.fecha_val)) : ""}</div>}</td>
                          <td>{r.origen === "EJEMPLO" ? <ExBadge /> : "Real"}<div className="small muted">{r.archivo}</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty" style={{ marginTop: 8 }}>Sin mediciones de esta escuela.</div>}
          </div>

          <div className="card">
            <h3>Alertas de este indicador ({als.length})</h3>
            <div className="grid" style={{ marginTop: 8 }}>
              {als.length ? als.map((a) => <AlertCard key={a.uid} a={a} />) : <div className="empty">Sin alertas en esta escuela.</div>}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
