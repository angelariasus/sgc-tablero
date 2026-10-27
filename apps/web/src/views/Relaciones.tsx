"use client";
import { uniq } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Tag } from "@/components/common";
import { Banner, PageHead, Sect } from "@/components/ui";

export default function Relaciones() {
  const ws = useWs();
  const { engine } = ws;
  const M = engine.M;
  const alias = M.indicadores.filter((i) => i.alias_sineace);
  const huerf = M.sineace.filter((s) => !s.indicadores_proceso.length);
  const nProc = M.indicadores.filter((i) => i.ficha !== "PE FM").length;
  const Ficha = ({ id, esc = "TM", children }: { id: string; esc?: string; children?: React.ReactNode }) => (
    <button className="linkbtn tag" onClick={() => ws.openFicha(id, esc)}>{children ?? id}</button>
  );
  return (
    <div>
      <PageHead title="Relaciones entre indicadores, procesos y estándares">Tres niveles que se miden distinto y se leen juntos: los 29 indicadores del modelo CONEAU, los indicadores de proceso del SGC y los procesos (26 del SGC, 9 del criterio 10.2).</PageHead>
      <div className="grid g3">
        <div className="card"><h3>{M.sineace.length} indicadores SINEACE</h3><p className="small">Los fija el modelo de acreditación [A4]. Son lo que CONEAU revisa. Se cargan por escuela y llevan su valor de referencia del modelo.</p></div>
        <div className="card"><h3>{nProc} indicadores de proceso</h3><p className="small">Los define cada ficha del SGC para gestionar el proceso. <b>{alias.length}</b> miden exactamente lo mismo que un indicador SINEACE: no se cargan dos veces, toman el dato del SINEACE. Los otros {nProc - alias.length} se cargan aparte. Además hay {M.indicadores.filter((i) => i.ficha === "PE FM").length} indicadores del plan estratégico de la Facultad (PE FM), que se cargan con la clave FAC.</p></div>
        <div className="card"><h3>26 procesos del SGC · 9 del criterio 10.2</h3><p className="small">Las fichas son la unidad de gestión. Los nueve procesos del criterio 10.2 son el mínimo que CONEAU exige; cada uno se apoya en una o más fichas y en sus indicadores.</p></div>
      </div>
      <Banner ex><b>Cómo se lee.</b> Un indicador SINEACE cumple un estándar (E1 a E10) por los criterios que cita su ficha. Si un indicador de proceso mide lo mismo, su estado es el del SINEACE. El estado de un proceso del 10.2 es el del peor de sus indicadores. El vínculo indicador-estándar es por la numeración de criterios del modelo y está <b>por confirmar</b> donde el texto plano es ambiguo.</Banner>

      <Sect title="Indicadores SINEACE ↔ indicadores de proceso ↔ procesos 10.2" icon="i-link" />
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>SINEACE</th><th>Estándares</th><th>Indicadores de proceso que lo miden o lo alimentan</th><th>Procesos 10.2</th><th>Fichas SGC</th></tr></thead>
          <tbody>
            {M.sineace.map((s) => {
              const al = alias.filter((i) => i.alias_sineace === s.id).map((i) => i.id);
              const rel = uniq([...M.rel_sineace_indicador.filter((r) => r[0] === s.id).map((r) => r[1]), ...s.indicadores_proceso]);
              const ps = engine.procsOfIndicator(s.id);
              return (
                <tr key={s.id}>
                  <td><button className="linkbtn id" onClick={() => ws.openFicha(s.id, "TM")}>{s.id}</button><div className="small">{s.nombre}</div></td>
                  <td>{s.estandares.length ? s.estandares.map((x) => <Tag key={x}>{x}</Tag>) : <Tag gap>por confirmar</Tag>}<div className="small muted">criterios {s.criterios_texto}</div></td>
                  <td>{rel.length ? rel.map((i) => <Ficha key={i} id={i}>{i}{al.includes(i) ? " =" : ""}</Ficha>) : <Tag gap>sin indicador de proceso: se mide directo</Tag>}{al.length > 0 && <div className="small muted">«=» mide lo mismo</div>}</td>
                  <td>{ps.length ? ps.map((p) => <Tag key={p}>P{engine.P102_BY[p].n}</Tag>) : <Tag gap>ninguno</Tag>}</td>
                  <td>{s.fichas.map((fc) => <Tag key={fc} title={engine.FICHA_BY[fc]?.nombre}>{fc}</Tag>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sect title={`Los ${alias.length} indicadores de proceso que heredan el dato SINEACE`} icon="i-link" />
      <p className="note">Se puede desactivar en Parámetros («heredar_alias»). Si se desactiva, cada uno se carga por separado.</p>
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Indicador de proceso</th><th>Ficha</th><th>Mide lo mismo que</th></tr></thead>
          <tbody>
            {alias.map((i) => (
              <tr key={i.id}><td><b>{i.id}</b> {i.nombre}</td><td>{i.ficha}</td><td><Ficha id={i.alias_sineace as string} /> {engine.SIN_BY[i.alias_sineace as string].nombre}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sect title={`Indicadores SINEACE sin indicador de proceso (${huerf.length})`} icon="i-diamond" />
      <div className="card">
        <p className="small">Ninguna ficha del SGC tiene hoy un indicador de proceso para estos. Se miden directo y quedan marcados como brecha de diseño para el comité.</p>
        <div className="pill-row">
          {huerf.length ? huerf.map((s) => <button key={s.id} className="linkbtn tag gap" title={s.nombre} onClick={() => ws.openFicha(s.id, "TM")}>{s.id} · {s.nombre.slice(0, 48)}</button>) : "Ninguno."}
        </div>
      </div>

      <Sect title="Procesos del criterio 10.2 y fichas" icon="i-grid" />
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Proceso 10.2</th><th>Ficha del SGC</th><th>Indicadores de proceso</th><th>SINEACE vinculados</th><th>Estándares</th></tr></thead>
          <tbody>
            {M.procesos102.map((p) => {
              const fs = M.rel_proceso_ficha.filter((r) => r[0] === p.id).map((r) => r[1]);
              const is = M.rel_proceso_indicador.filter((r) => r[0] === p.id).map((r) => r[1]);
              const sn = uniq(is.map((i) => engine.effId(i)).filter((i) => engine.SIN_BY[i]));
              const std = uniq(sn.flatMap((i) => engine.SIN_BY[i].estandares)).sort((a, b) => +a.slice(1) - +b.slice(1));
              return (
                <tr key={p.id}>
                  <td><b>P{p.n}</b> {p.nombre}<div className="small muted">Ficha: {p.estado_ficha}{p.ficha_propuesta && p.ficha_propuesta !== "Ninguna" ? " · propuesta: " + p.ficha_propuesta : ""}</div></td>
                  <td>{fs.map((fc) => <Tag key={fc} title={engine.FICHA_BY[fc]?.nombre}>{fc}</Tag>)}</td>
                  <td>{is.length}</td>
                  <td>{sn.length ? sn.map((i) => <Tag key={i}>{i}</Tag>) : "—"}</td>
                  <td>{std.length ? std.map((x) => <Tag key={x}>{x}</Tag>) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sect title="Fichas del SGC (26 procesos)" icon="i-doc" />
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Ficha</th><th>Proceso</th><th>Familia</th><th>Estado</th><th>Indicadores</th><th>Responsable</th></tr></thead>
          <tbody>
            {M.fichas.map((f) => (
              <tr key={f.id}><td><b>{f.id}</b></td><td>{f.nombre}</td><td>{f.familia}</td><td>{f.estado}</td><td className="num">{M.indicadores.filter((i) => i.ficha === f.id).length}</td><td>{f.responsable}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
