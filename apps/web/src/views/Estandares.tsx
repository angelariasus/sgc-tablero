"use client";
import { type ReactNode } from "react";
import { ESC_BY, SCH, ST, TM_AREAS, fmtVal, type EvidRow, type StateCode } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Ic } from "@/components/Icon";
import { AlertCard, ExOf, Heatmap, StChip, Tag, schoolsSel } from "@/components/common";
import { Banner, Empty, LinkBtn, Note, PageHead, Sect, StateChip } from "@/components/ui";

function AutoevalSection({ std }: { std: string | null }) {
  const ws = useWs();
  const { engine } = ws;
  const M = engine.M;
  const aes = Object.values(engine.autoeval).filter((a) => ws.escuela === "TODAS" || ws.escuela === a.escuela);
  if (!aes.length) return null;
  return (
    <>
      {aes.map((ae) => {
        const cr = ae.criterios.filter((c) => !std || c.estandar === std);
        const cnt = (k: string) => ae.criterios.filter((c) => c.valoracion === k).length;
        const sinEv = ae.criterios.filter((c) => c.evSin.length).length;
        const conMat = ae.criterios.filter((c) => c.matrices.some((x) => /pendiente/i.test(x.estado))).length;
        return (
          <div key={ae.escuela}>
            <Sect title={`Autoevaluación por criterio · ${ESC_BY[ae.escuela].nombre}`} icon="i-target" />
            <Note>
              Fuente: Consolidado de autoevaluación [A22] ({ae.name}{ae.fabrica ? ", incluido de fábrica" : ""}). {ae.criterios.length} criterios: {cnt("L")} en L, {cnt("LP")} en LP, {cnt("Por definir")} «Por definir» y {cnt("No desarrollado")} sin desarrollar. {sinEv} criterios con evidencias exigidas sin citar (alerta R12) y {conMat} con alguna matriz pendiente (alerta R13); {ae.nPend} de {ae.nMat} matrices siguen pendientes. Las valoraciones son las del informe, no las calcula el tablero.
            </Note>
            <div className="tblw" style={{ maxHeight: 520 }}>
              <table className="tbl">
                <thead>
                  <tr><th>Criterio</th><th>Valoración</th><th>EV exigidas sin citar</th><th>Matrices pendientes</th><th>Prioridad</th><th>Indicadores del Modelo que lo citan</th><th>Fuente</th></tr>
                </thead>
                <tbody>
                  {cr.map((c) => {
                    const pm = c.matrices.filter((x) => /pendiente/i.test(x.estado));
                    const inds = M.sineace.filter((x) => x.criterios.includes(c.criterio)).map((x) => x.id);
                    return (
                      <tr key={c.criterio}>
                        <td><b>{c.criterio}</b> <span className="small muted">{c.resumen}</span></td>
                        <td>{c.valoracion}</td>
                        <td>{c.evSin.length ? c.evSin.map((e) => <Tag key={e} title={engine.EV_BY[e]?.descripcion}>{e}</Tag>) : <span className="muted small">ninguna</span>}</td>
                        <td>{pm.length ? pm.map((x) => <Tag key={x.n}>M{x.n}</Tag>) : <span className="muted small">ninguna</span>}</td>
                        <td>{c.prioridad}</td>
                        <td>{inds.length ? inds.map((i) => <button key={i} className="linkbtn tag" onClick={() => ws.openFicha(i, ae.escuela)}>{i}</button>) : <span className="muted small">ninguno</span>}</td>
                        <td className="small">{c.ref}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}

export default function Estandares() {
  const ws = useWs();
  const { engine } = ws;
  const M = engine.M;
  const escs = schoolsSel(ws.escuela);
  const std = ws.vs.estSel;
  const evRows = engine.evidenceRows();

  const stdState = (id: string) => {
    const ids = M.sineace.filter((s) => s.estandares.includes(id)).map((s) => s.id);
    const items: { id: string; code: StateCode; st: ReturnType<typeof engine.status>; gap: number; esc: string }[] = [];
    escs.forEach((e) => ids.forEach((i) => { if (engine.inScope(e, i)) { const st = engine.status(e, i); items.push({ id: i, code: st.state, st, gap: engine.gapOf(st), esc: e }); } }));
    return { ids, w: engine.worstOf(items), n: items.length };
  };
  const evCov = (stdId: string, modo?: "EJ" | "REAL") => {
    const evs = M.evidencias.filter((e) => e.estandar === stdId).map((e) => e.id);
    const rows = engine.evidenceRows(modo).filter((r) => escs.includes(r.escuela) && evs.includes(r.ev));
    return { total: rows.length, ok: rows.filter(engine.EV_OK).length };
  };
  const CovBar = ({ c, lbl, ex }: { c: { total: number; ok: number }; lbl: string; ex: boolean }) => (
    <>
      <span className="small muted">{ex && <><span className="exb">EJEMPLO</span> </>}{lbl}: {c.total ? c.ok + " de " + c.total + " disponibles" : "sin estado cargado"}</span>
      <span className={"bar-s" + (ex ? " ex" : "")} aria-hidden="true"><i style={{ width: `${c.total ? (c.ok / c.total) * 100 : 0}%` }} /></span>
    </>
  );

  const e10Sec = () => {
    const al = engine.ALERTS.filter((a) => a.objeto === "Estándar" && a.objetoId === "E10" && escs.includes(a.escuela));
    return (
      <>
        <Sect title="Estándar 10 · procesos del criterio 10.2 y evidencias EV49–EV52" icon="i-target" />
        <Note>El estándar 10 no tiene indicadores del modelo SINEACE: se vigila por los {M.procesos102.length} procesos mínimos del criterio 10.2 y por las evidencias EV49 a EV52. Mientras no haya datos cargados, esas evidencias figuran con la alerta «sin evidencia exigida» (R14) y los procesos sin indicador vigilado quedan sin estado.</Note>
        {al.length ? <div className="grid g2">{al.map((a) => <AlertCard key={a.uid} a={a} compact />)}</div> : <Empty>Las evidencias EV49 a EV52 están disponibles en las escuelas seleccionadas.</Empty>}
        <div className="card" style={{ marginTop: 12 }}><Heatmap cols={escs.filter((c) => c !== "FAC")} /></div>
      </>
    );
  };

  const list = M.sineace.filter((s) => !std || s.estandares.includes(std));
  const areas = [{ k: "ENF|", l: "Enfermería" }, { k: "OBS|", l: "Obstetricia" }, ...TM_AREAS.map((a) => ({ k: "TM|" + a, l: "TM · " + a }))];
  const evMap = new Map(evRows.map((r) => [r.escuela + "|" + r.area + "|" + r.ev, r]));
  const noInd = (id: string) => { const s = engine.EV_BY[id]?.estandar; return !!s && !M.sineace.some((x) => x.estandares.includes(s)); };
  const EvChip = ({ r, evId }: { r?: EvidRow; evId: string }): ReactNode => {
    if (!r) return noInd(evId) ? <span className="chip st-risk"><Ic n="i-risk" /><span>Sin evidencia exigida</span></span> : <span className="chip st-nodata"><Ic n="i-nodata" /><span>Sin estado</span></span>;
    const m = ({ Validada: ["st-ok", "i-ok"], Disponible: ["st-info", "i-doc"], "En elaboración": ["st-risk", "i-risk"], "No iniciada": ["st-crit", "i-crit"], "No aplica": ["st-na", "i-na"] } as Record<string, string[]>)[r.estado] || ["st-nodata", "i-nodata"];
    return (
      <>
        <span className={"chip " + m[0]} title={r.ubicacion || ""}><Ic n={m[1]} /><span>{r.estado}</span></span>
        {r.origen === "EJEMPLO" && <> <span className="exb">EJEMPLO</span></>}
      </>
    );
  };
  const stds = std ? [std] : M.estandares.map((e) => e.id);

  return (
    <div>
      <PageHead title="Estándares E1–E10 e indicadores ID01–ID29">
        Los 10 estándares y los 29 indicadores del modelo de acreditación CONEAU 2026 [A4]. Un indicador se asocia a un estándar por los criterios que cita su ficha; la numeración de criterios del texto plano está por confirmar.
      </PageHead>
      <div className="grid g-auto" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
        {M.estandares.map((e) => {
          const s = stdState(e.id);
          const evTxt = `Evidencias EV${e.ev_desde.slice(2)}–${e.ev_hasta.slice(2)}`;
          let head: ReactNode, line2: string;
          if (s.ids.length) { head = <StateChip code={s.w.code} />; line2 = `${s.ids.length} ${s.ids.length === 1 ? "indicador" : "indicadores"} del modelo · ${e.n_criterios} criterios`; }
          else {
            const al = engine.ALERTS.filter((a) => a.objeto === "Estándar" && a.objetoId === e.id && escs.includes(a.escuela));
            head = al.length ? <span className="chip st-risk"><Ic n="i-risk" /><span>Sin evidencia exigida</span></span> : <span className="chip st-nodata"><Ic n="i-nodata" /><span>Sin indicadores del modelo</span></span>;
            line2 = e.id === "E10" ? `Sin indicadores del modelo · ${M.procesos102.length} procesos del criterio 10.2 · ${e.n_criterios} criterios` : `Sin indicadores del modelo · ${e.n_criterios} criterios`;
          }
          return (
            <button key={e.id} className="estc" aria-pressed={std === e.id} onClick={() => ws.setVs({ estSel: std === e.id ? null : e.id })}>
              <span className="eid">{e.id}</span>
              <span className="enm">{e.nombre}</span>
              {head}
              <span className="small muted">{line2}</span>
              <span className="small">{s.w.item ? <>Marca: <b>{(s.w.item as any).id}</b></> : <>&nbsp;</>}</span>
              {ws.ejemplo ? (<><CovBar c={evCov(e.id, "EJ")} lbl={evTxt} ex /><CovBar c={evCov(e.id, "REAL")} lbl={evTxt + " · datos reales"} ex={false} /></>) : <CovBar c={evCov(e.id, "REAL")} lbl={evTxt} ex={false} />}
            </button>
          );
        })}
      </div>

      {std === "E10" && e10Sec()}
      <Sect title="Indicadores ID01–ID29" icon="i-grid" />
      <div className="filters">
        <span className="small muted">{std && <>Filtrado por <b>{std}</b> · </>}{list.length} indicadores.</span>
        {std && <button className="btn small" onClick={() => ws.setVs({ estSel: null })}>Quitar filtro</button>}
      </div>
      {!list.length ? (
        <p className="note">Este estándar no tiene indicadores del modelo SINEACE: se vigila con los procesos del criterio 10.2 y las evidencias que se muestran arriba y abajo.</p>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(175px,1fr))" }}>
            {list.map((s) => {
              const items = escs.filter((e) => engine.inScope(e, s.id)).map((e) => { const st = engine.status(e, s.id); return { id: s.id, code: st.state, st, gap: engine.gapOf(st), esc: e }; });
              const w = engine.worstOf(items);
              const code: StateCode = items.length ? w.code : "NA";
              const it = (w.item as any) || items[0];
              return (
                <button key={s.id} className={`tile st-${ST[code].cls}`} onClick={() => ws.openFicha(s.id, it ? it.esc : escs[0])}>
                  <span className="idn"><span>{s.id}</span><StateChip code={code} /></span>
                  <span className="nm">{s.nombre}</span>
                  <span className="small">{it && it.st.last ? <><b>{fmtVal(it.st.last.valor, it.st.last.unidad)}</b> / ref. {s.ref_texto}</> : <>ref. {s.ref_texto}</>}</span>
                </button>
              );
            })}
          </div>
          <div className="tblw" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead>
                <tr><th>ID</th><th>Indicador</th><th>Referencia</th><th>Estándar(es)</th>{SCH.map((e) => <th key={e}>{ESC_BY[e].corto}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="clk" onClick={() => ws.openFicha(s.id, escs[0] === "FAC" ? "TM" : escs[0])}>
                    <td className="id">{s.id}</td>
                    <td>{s.nombre}</td>
                    <td className="num">{s.ref_texto}</td>
                    <td>{s.estandares.length ? s.estandares.map((x) => <Tag key={x}>{x}</Tag>) : <Tag gap>por confirmar</Tag>}</td>
                    {SCH.map((e) => {
                      const st = engine.status(e, s.id);
                      return (
                        <td key={e}>
                          {engine.inScope(e, s.id) ? (<><StChip st={st} /><ExOf st={st} /><div className="small num">{st.last ? fmtVal(st.last.valor, st.last.unidad) : ""}</div></>) : <StateChip code="NA" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!std && e10Sec()}
      <AutoevalSection std={std} />

      <Sect title="Evidencia por área" icon="i-doc" />
      {ws.ejemplo && (
        <Banner ex><b>EJEMPLO.</b> Mientras el interruptor de datos de ejemplo esté activo, los estados de esta tabla y las barras de evidencias disponibles de arriba son de ejemplo (marcados EJEMPLO) y se muestran aparte de los datos reales cargados por archivo.</Banner>
      )}
      <p className="note">Estado de cada evidencia del modelo (EV1–EV52) por área. Tecnología Médica se muestra por sus cuatro áreas: Radiología, Terapia Física, Terapia Ocupacional y Laboratorio Clínico y Anatomía Patológica. Los estados salen de la hoja Evidencias de cada archivo de carga.</p>
      <div className="tblw">
        <table className="tbl">
          <thead>
            <tr><th>Evidencia</th>{areas.map((a) => <th key={a.k}>{a.l}</th>)}</tr>
          </thead>
          <tbody>
            {stds.map((sid) => (
              <EvGroup key={sid} sid={sid} areas={areas} evMap={evMap} EvChip={EvChip} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="note"><LinkBtn onClick={() => ws.go("pendientes")}>Ver pendientes</LinkBtn></p>
    </div>
  );
}

function EvGroup({ sid, areas, evMap, EvChip }: { sid: string; areas: { k: string; l: string }[]; evMap: Map<string, EvidRow>; EvChip: (p: { r?: EvidRow; evId: string }) => ReactNode }) {
  const { engine } = useWs();
  return (
    <>
      <tr><td colSpan={areas.length + 1} style={{ background: "var(--lila)", fontWeight: 700 }}>{sid} · {engine.EST_BY[sid].nombre}</td></tr>
      {engine.M.evidencias.filter((e) => e.estandar === sid).map((e) => (
        <tr key={e.id}>
          <td><b>{e.id}</b> <span className="small muted">{(e.descripcion || "").slice(0, 90)}{(e.descripcion || "").length > 90 ? "…" : ""}</span></td>
          {areas.map((a) => { const [es, ar] = a.k.split("|"); return <td key={a.k}>{EvChip({ r: evMap.get(es + "|" + ar + "|" + e.id), evId: e.id })}</td>; })}
        </tr>
      ))}
    </>
  );
}
