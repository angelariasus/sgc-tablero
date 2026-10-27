"use client";
import { type ReactNode } from "react";
import { ESC_BY, ST, SEV, fmtN, type Alert, type Status } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Ic } from "./Icon";
import { ExBadge, OverdueChip, SevChip, StateChip } from "./ui";

/** Estado de un indicador, con «Vencido» si corresponde. */
export function StChip({ st }: { st: Status }) {
  return (
    <>
      <StateChip code={st.state} />
      {st.vencido && <> <OverdueChip /></>}
    </>
  );
}
export const ExOf = ({ st }: { st: Pick<Status, "last"> }) => (st.last && st.last.m.origen === "EJEMPLO" ? <> <ExBadge /></> : null);

export function Tag({ children, gap = false, title }: { children: ReactNode; gap?: boolean; title?: string }) {
  return <span className={"tag" + (gap ? " gap" : "")} title={title}>{children}</span>;
}

/** Tarjeta de una alerta: qué ocurre, por qué, desde cuándo, a quién corresponde y la decisión sugerida. */
export function AlertCard({ a, compact = false }: { a: Alert; compact?: boolean }) {
  const ws = useWs();
  const sev = SEV[a.severidad] || SEV.Aviso;
  let link: ReactNode = null;
  if (a.objeto === "Indicador")
    link = <button className="btn small" onClick={() => ws.openFicha(a.objetoId, a.escuela)}><Ic n="i-doc" />Ver ficha</button>;
  else if (a.objeto === "AOI")
    link = <button className="btn small" onClick={() => { ws.setVs({ poiAoi: a.objetoNombre.split(" ")[0], poiAnio: a.anio ?? ws.vs.poiAnio }); ws.go("poi"); }}><Ic n="i-doc" />Ver en PEI y POI</button>;
  else if (a.objeto === "Criterio" || a.objeto === "Estándar")
    link = <button className="btn small" onClick={() => { ws.setVs({ estSel: a.estandarSel ?? null }); ws.go("estandares"); }}><Ic n="i-doc" />Ver {a.objeto === "Criterio" ? "el criterio" : "el estándar"}</button>;
  return (
    <article className={`alert sev-${sev.cls}`}>
      <div className="hd">
        <SevChip sev={a.severidad} />
        <b>{a.objetoId && a.objeto === "Indicador" ? a.objetoId + " · " : ""}{a.objetoNombre}</b>
        <span className="tag">{ESC_BY[a.escuela]?.corto || a.escuela}</span>
        <span className="tag gap">{a.regla} {a.reglaNombre}</span>
        {a.ejemplo && <ExBadge />}
      </div>
      <dl>
        <dt>Qué ocurre</dt><dd>{a.que}</dd>
        {!compact && (<><dt>Por qué</dt><dd>{a.porque}</dd></>)}
        <dt>Desde cuándo</dt><dd>{a.desdeTxt || "—"}</dd>
        <dt>A quién corresponde</dt><dd>{a.responsable}</dd>
        <dt>Decisión sugerida</dt><dd>{a.accion}</dd>
      </dl>
      {link && <div>{link}</div>}
    </article>
  );
}

/** Mapa de calor: procesos del criterio 10.2 por escuela. */
export function Heatmap({ cols, sel, onPick }: { cols: string[]; sel?: { p: string; esc: string } | null; onPick?: (p: string, esc: string) => void }) {
  const { engine } = useWs();
  const M = engine.M;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="heat" role="grid" aria-label="Mapa de calor: procesos del criterio 10.2 por escuela">
        <thead>
          <tr>
            <th scope="col">Proceso del criterio 10.2</th>
            {cols.map((c) => <th key={c} scope="col" className="c">{ESC_BY[c].corto}</th>)}
          </tr>
        </thead>
        <tbody>
          {M.procesos102.map((p) => (
            <tr key={p.id}>
              <th scope="row" className="rowlab">
                P{p.n} {p.nombre}
                <small>Ficha: {p.estado_ficha}{p.ficha_propuesta && p.ficha_propuesta !== "Ninguna" ? " · " + p.ficha_propuesta.split(" ")[0] + " por aprobar" : ""}</small>
              </th>
              {cols.map((c) => {
                const ps = engine.processState(c, p.id);
                const code = ps.code;
                if (code === "NA")
                  return (
                    <td key={c}>
                      <div className="hc st-na" title="Todavía no hay indicadores vigilados para este proceso en esta columna">
                        <span className="l1"><Ic n="i-nodata" />Sin indicador vigilado</span>
                        <span className="l2">pendiente de definir</span>
                      </div>
                    </td>
                  );
                const w = ps.worst.item as any;
                const total = ps.items.length;
                const con = ps.items.filter((i: any) => i.st.last).length;
                const l2 = w ? `Marca: ${w.id}${w.st.last && w.st.last.cumpl !== null ? " · " + fmtN(w.st.last.cumpl, 0) + " % de la meta" : ""}` : `${con} de ${total} con dato`;
                const pressed = !!sel && sel.p === p.id && sel.esc === c;
                return (
                  <td key={c}>
                    <button
                      className={`hc st-${ST[code].cls}`} aria-pressed={pressed} onClick={() => onPick?.(p.id, c)}
                      aria-label={`P${p.n} ${p.nombre}, ${ESC_BY[c].corto}: ${ST[code].label}. ${l2}`}
                    >
                      <span className="l1"><Ic n={ST[code].icon} />{ST[code].label}</span>
                      <span className="l2">{l2}</span>
                      <span className="l2">{con}/{total} con dato</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const nameOf = (ws: ReturnType<typeof useWs>, id: string) => (ws.engine.CARG_BY[id] || ws.engine.IND_BY[id] || { nombre: id }).nombre;
export function schoolsSel(escuela: string): string[] { return escuela === "TODAS" ? ["ENF", "OBS", "TM"] : escuela === "FAC" ? ["FAC"] : [escuela]; }
