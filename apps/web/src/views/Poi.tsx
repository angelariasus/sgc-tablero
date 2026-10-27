"use client";
import { MESES, ST, fmtDate, fmtN, parseISO, type StateCode } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Ic } from "@/components/Icon";
import { PoiBulletChart, PoiLinesChart, PoiYearsChart } from "@/components/charts";
import { schoolsSel } from "@/components/common";
import { Banner, LinkBtn, Note, PageHead, Sect, StateChip } from "@/components/ui";

export default function Poi() {
  const ws = useWs();
  const { engine } = ws;
  const M = engine.M;
  const A = engine.poiAll();
  const anio = ws.vs.poiAnio in A ? ws.vs.poiAnio : M.poi_reportes[M.poi_reportes.length - 1].anio;
  const R = A[anio];
  const rep = R.rep;
  const vg = +engine.params.gen.banda_poi_verde || 95, rg = +engine.params.gen.banda_poi_rojo || 75;
  const sel = schoolsSel(ws.escuela).filter((e) => e !== "FAC");
  const escs = sel.length ? sel : ["ENF", "OBS", "TM"];
  const metaR = engine.metaRowFor("PE01-I3", anio);
  const pst: StateCode = metaR ? (R.i3 >= (metaR.meta as number) ? "OK" : "BAJO") : "DEF";
  const bandCount = { CRIT: R.conProg.filter((x: any) => x.avance < rg).length, RIESGO: R.conProg.filter((x: any) => x.avance >= rg && x.avance < vg).length, OK: R.conProg.filter((x: any) => x.avance >= vg).length };
  const aoiList = R.conProg.slice().sort((a: any, b: any) => a.aoi.localeCompare(b.aoi));
  const cur = ws.vs.poiAoi && aoiList.find((x: any) => x.aoi === ws.vs.poiAoi) ? ws.vs.poiAoi : aoiList[0] && aoiList[0].aoi;

  const groups: Record<string, any[]> = {};
  R.lista.forEach((x: any) => { const a = engine.AOI_BY[x.act]; const aei = (a && (a.aei as any)[String(anio)]) || "—"; (groups[aei] = groups[aei] || []).push(x); });
  const aeiName = (code: string) => {
    if (anio === 2026) { const a = M.aoi.find((z: any) => z.aei["2026"] === code && z.aei_2026_nombre); return a ? (a as any).aei_2026_nombre : "nombre en el PEI [A12]"; }
    const a = M.aoi.find((z: any) => z.aei[String(anio)] === code && z.ae_pefm_nombre);
    return a ? `${(a as any).ae_pefm_nombre} (AE del PE FM con el mismo código [CP])` : "nombre por confirmar";
  };

  const cont = M.pei_continua || [];
  const nR = cont.filter((c: any) => c.tono === "Rojo").length, nN = cont.length - nR;
  const marco = ws.vs.marco;
  const kO = marco === "pefm" ? "pe_oe" : "pei_oei", kA = marco === "pefm" ? "pe_ae" : "pei_aei", kV = marco === "pefm" ? "pe_vinculo" : "pei_vinculo";
  const byO: Record<string, any[]> = {};
  M.indicadores.forEach((i) => { const o = (i as any)[kO]; if (!o) return; (byO[o] = byO[o] || []).push(i); });

  return (
    <div>
      <PageHead title="PEI y POI">Indicadores vinculados a los objetivos y acciones estratégicas (OEI/AEI) y a las actividades operativas (AOI), con lo programado y lo ejecutado.</PageHead>
      <Banner ex>
        <b>POI compartido por la Facultad.</b> Los reportes de seguimiento ({M.poi_reportes.map((r) => r.reporte).join(", ")}) son del centro de costo 01.30 de la Facultad de Medicina y no distinguen escuela ni área. Por eso las AOI no se reparten entre Tecnología Médica, Enfermería y Obstetricia. <b>Desagregación por escuela: por confirmar</b> con la UPPR (ver Pendientes). El POI formal aprobado tampoco está en el proyecto: los reportes muestran solo las AOI activas.
      </Banner>
      <Banner>
        <b>Marco vigente.</b> Rige el PEI 2026-2030 (RR N.° 009248-2025-R, con opinión favorable del CEPLAN) [A12]; el PEI 2023-2027 queda como serie histórica de 2024 y 2025. Los documentos no dicen si el nuevo deja sin efecto al anterior ni cómo es la transición del PE FM 2024-2027: <b>por confirmar con la OGPL</b>. Las metas de la Facultad para 2026-2030 no figuran en la matriz [A18]: <b>por confirmar</b>.
      </Banner>
      <div className="filters">
        <span className="small muted">Reporte:</span>
        <div className="seg-btn" role="group" aria-label="Reporte del POI">
          {M.poi_reportes.map((r) => <button key={r.anio} aria-pressed={r.anio === anio} onClick={() => ws.setVs({ poiAnio: r.anio, poiAoi: null })}>{r.anio === 2026 ? "Feb. 2026 (parcial)" : r.anio}</button>)}
        </div>
        <span className="small muted">{rep.reporte} · consulta {fmtDate(parseISO(rep.consulta))} · estructura {anio === 2026 ? "PEI 2026-2030" : "PEI 2023-2027"}</span>
      </div>
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="card kpi">
          <span className="l">Cumplimiento del POI (PE01-I3)</span><span className="v">{fmtN(R.i3, 2)} %</span>
          {anio === 2025 && <span className="small muted">Cifra oficial: reporte anual en PDF [A15], {R.conProg.length} AOI, imprime {fmtN(rep.impreso, 2)} %. El Excel de trabajo [A19] da 93,81 % con 33 y trae 91,00 % escrito: diferencia registrada.</span>}
          <span className="small muted">Meta MAGPROF {metaR ? metaR.meta + " %" : "por definir"}</span>
          <div><StateChip code={pst} /></div>
        </div>
        <div className="card kpi"><span className="l">AOI con programación</span><span className="v">{R.conProg.length}</span><span className="small muted">de {R.lista.length} en el reporte</span></div>
        <div className="card kpi"><span className="l">AOI con {vg} % o más</span><span className="v">{R.p6n}</span><span className="small muted">{fmtN(R.p6, 1)} % (PE01-P6)</span></div>
        <div className="card kpi"><span className="l">AOI en riesgo / críticas</span><span className="v">{bandCount.RIESGO} / {bandCount.CRIT}</span><span className="small muted">{rg}–{vg} % / menos de {rg} %</span></div>
        <div className="card kpi"><span className="l">Sobreejecución (&gt; {engine.params.gen.umbral_sobreejecucion} %)</span><span className="v">{R.p7n}</span><span className="small muted">{fmtN(R.p7, 1)} % (PE01-P7) · el reporte lo trunca a 100 %</span></div>
      </div>
      <div className="grid g2">
        <PoiYearsChart />
        <PoiBulletChart anio={anio} onPick={(aoi) => ws.setVs({ poiAoi: aoi })} />
      </div>

      <Sect title="Programado vs ejecutado por actividad" icon="i-chart" />
      <div className="filters">
        <label>AOI
          <select aria-label="AOI" value={cur ?? ""} onChange={(e) => ws.setVs({ poiAoi: e.target.value })}>
            {aoiList.map((x: any) => <option key={x.aoi} value={x.aoi}>{x.aoi.slice(-5)} · {engine.AOI_BY[x.act]?.actividad || x.act}</option>)}
          </select>
        </label>
      </div>
      {cur && <PoiLinesChart anio={anio} aoiList={[cur]} />}

      <Sect title={`Actividades por acción estratégica (${anio === 2026 ? "AEI del PEI 2026-2030" : "AEI del PEI 2023-2027"})`} icon="i-link" />
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>AEI</th><th>AOI y actividad</th><th>Programado</th><th>Ejecutado</th><th>Avance</th><th>Indicadores vinculados</th><th>Escuela</th></tr></thead>
          <tbody>
            {Object.keys(groups).sort().map((aei) => {
              const g = groups[aei];
              const cp = g.filter((x) => x.prog > 0);
              const avg = cp.length ? cp.reduce((s, x) => s + x.avance, 0) / cp.length : null;
              return (
                <GroupRows key={aei} aei={aei} name={aeiName(aei)} g={g} cp={cp.length} avg={avg} vg={vg} rg={rg} escs={escs} />
              );
            })}
          </tbody>
        </table>
      </div>
      {anio === 2025 && (M.poi2025_extra || []).length > 0 && (
        <Banner>
          <b>Cifra oficial de 2025: el reporte anual en PDF [A15], con 30 actividades ({fmtN(M.poi2025_resumen.promedio_pdf_2025_30_aoi, 2)} %).</b> El Excel de seguimiento [A19] es un archivo de trabajo con 33. Las tres que solo trae el Excel no entran a las cifras:{" "}
          {M.poi2025_extra.map((e: any) => `${engine.AOI_BY[e.act]?.actividad || e.act} (${String(e.ref).replace(/^.*hoja '[^']*', /, "")}, ${fmtN(e.ejec, 0)} de ${fmtN(e.prog, 0)}, ${fmtN(e.avance_recalculado, 1)} %)`).join("; ")}. Con las 33 la media sería {fmtN(M.poi2025_resumen.promedio_recalculado, 2)} %. Decisión de Robert, 20-10-2026.
        </Banner>
      )}

      <Sect title="Plan operativo 2026 de Tecnología Médica [A17]" icon="i-doc" />
      <p className="note">Es el POI de escuela disponible, en formato UPPR (sin código visible en el archivo). Trae solo programación mensual, sin ejecución y sin desagregar por área. Los POI de Enfermería y Obstetricia están <b>por confirmar</b>: se pedirán a sus direcciones en el mismo formato.</p>
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Actividad (AOI de la Facultad)</th><th>Unidad</th>{MESES.map((m) => <th key={m}>{m}</th>)}<th>Total EPTM</th><th>Total Facultad 2026</th><th>Fuente</th></tr></thead>
          <tbody>
            {(M.eptm || []).map((e: any) => (
              <tr key={e.act_facultad}>
                <td><b>{e.act_facultad}</b> {engine.AOI_BY[e.act_facultad]?.actividad || e.actividad}<div className="small muted">{e.aei_fac || ""}</div></td>
                <td>{e.unidad}</td>
                {e.meses.map((v: number, i: number) => <td key={i} className="num">{v || ""}</td>)}
                <td className="num"><b>{e.total}</b></td><td className="num">{fmtN(e.total_fac, 0)}</td><td className="small">{e.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">La programación de la escuela cabe dentro de la de la Facultad en cada mes: es coherente con que las AOI recaigan en las escuelas, pero no prueba el reparto. La escuela programa 1 currículo y 1 plan de mejora aunque tiene cuatro áreas, lo que sugiere que se trata como un solo programa (pendiente de programas ya existente).</p>

      {cont.length > 0 && (
        <>
          <Sect title={`Indicadores que continúan en el PEI 2026-2030 (${cont.length})`} icon="i-link" />
          <p className="note">La matriz de la Facultad [A18] marca con texto rojo ({nR}) o naranja oscuro ({nN}) los indicadores que «continúan en medición para el plan 2026-2030». Por indicación de Robert (20-10-2026) ambos significan «continúa», pero se mantienen como dos estados distintos; qué diferencia a cada tono está por confirmar.</p>
          <div className="tblw" style={{ maxHeight: 380 }}>
            <table className="tbl">
              <thead><tr><th>Código</th><th>Indicador del PE FM</th><th>Estado en el PEI 2026-2030</th><th>Fuente</th></tr></thead>
              <tbody>
                {cont.map((c: any) => (
                  <tr key={c.cod}><td><b>{c.cod}</b></td><td>{engine.IND_BY["PEFM-" + c.cod]?.nombre || ""}</td><td><span className="tag">Continúa · marca {String(c.tono).toLowerCase()}</span></td><td className="small">{c.ref}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Sect title="Indicadores por objetivo estratégico" icon="i-link" />
      <div className="filters">
        <span className="small muted">Marco:</span>
        <div className="seg-btn" role="group" aria-label="Marco estratégico">
          <button aria-pressed={marco === "pefm"} onClick={() => ws.setVs({ marco: "pefm" })}>PE FM 2024-2027</button>
          <button aria-pressed={marco === "pei"} onClick={() => ws.setVs({ marco: "pei" })}>PEI UNMSM 2026-2030</button>
        </div>
      </div>
      <div className="grid g2">
        {Object.keys(byO).sort().map((o) => {
          const lst = byO[o];
          const byA: Record<string, any[]> = {};
          lst.forEach((i) => { const k = i[kA] || "Sin acción"; (byA[k] = byA[k] || []).push(i); });
          return (
            <details key={o} className="fold" open={Object.keys(byO).length <= 4}>
              <summary>{o} <span className="small muted">· {lst.length} indicadores</span></summary>
              <div>
                {Object.keys(byA).sort().map((a) => (
                  <div key={a}>
                    <p className="small" style={{ margin: "8px 0 4px" }}><b>{a}</b></p>
                    <div className="pill-row">
                      {byA[a].map((i) => {
                        const w = engine.worstAcross(i.id, escs);
                        return (
                          <button key={i.id} className={`chip st-${ST[w.code].cls}`} onClick={() => ws.openFicha(i.id, escs[0])} title={`${i.nombre} · vínculo: ${i[kV] || ""}`}>
                            <Ic n={ST[w.code].icon} /><span>{i.id}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <Note>El vínculo de cada indicador con el objetivo es criterio propio [CP] (mismo indicador, relacionado o contribuye). El PE FM 2024-2027 sigue al PEI 2023-2027; el PEI vigente es el 2026-2030 y el texto no dice si deja sin efecto al anterior (<LinkBtn onClick={() => ws.go("pendientes")}>Pendientes</LinkBtn>).</Note>
    </div>
  );
}

function GroupRows({ aei, name, g, cp, avg, vg, rg, escs }: { aei: string; name: string; g: any[]; cp: number; avg: number | null; vg: number; rg: number; escs: string[] }) {
  const ws = useWs();
  const { engine } = ws;
  return (
    <>
      <tr>
        <td colSpan={7} style={{ background: "var(--lila)" }}><b>{aei}</b> {name} <span className="small muted">· {cp} AOI con programación{avg !== null ? " · avance promedio " + fmtN(avg, 1) + " %" : ""}</span></td>
      </tr>
      {g.map((x) => {
        const a: any = engine.AOI_BY[x.act];
        const inds: string[] = a ? a.indicadores : [];
        const sn: string[] = a ? a.sineace : [];
        const code: StateCode = x.prog > 0 ? (x.avance >= vg ? "OK" : x.avance >= rg ? "RIESGO" : "CRIT") : "NA";
        const links = [...sn, ...inds];
        return (
          <tr key={x.aoi}>
            <td />
            <td><b>{x.aoi.slice(-5)}</b> {a ? a.actividad : x.act}<div className="small muted">{x.aoi} · p. {x.pag || ""}{a && !a.en_alcance_sgc ? " · fuera del alcance del SGC" : ""}</div></td>
            <td className="num">{fmtN(x.prog, 0)}</td>
            <td className="num">{fmtN(x.ejec, 0)}</td>
            <td>{x.prog > 0 ? <StateChip code={code}> <b>{fmtN(x.avance, 0)} %</b></StateChip> : <span className="muted small">S.P. (sin programación)</span>}</td>
            <td>{links.length ? links.map((i) => <button key={i} className="linkbtn tag" onClick={() => ws.openFicha(i, escs[0])}>{i}</button>) : <span className="tag gap">sin indicador</span>}</td>
            <td><span className="tag gap">Compartida por la Facultad</span></td>
          </tr>
        );
      })}
    </>
  );
}
