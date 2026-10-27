"use client";
/** Gráficos SVG accesibles del tablero (con alternativa en tabla y descripción para lectores de pantalla). */
import { useState, type ReactNode } from "react";
import { MESES, ORD, ST, fmtDate, fmtN, fmtVal, parseISO, periodInfo, uniq, type EvalPoint, type Status } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Ic } from "./Icon";
import { ExBadge, StateChip, useTip } from "./ui";

export const SERIES: Record<string, { cls: string; shape: "square" | "triangle" | "circle" | "diamond"; name: string }> = {
  ENF: { cls: "s2", shape: "square", name: "Enfermería" },
  OBS: { cls: "s3", shape: "triangle", name: "Obstetricia" },
  TM: { cls: "s1", shape: "circle", name: "Tec. Médica" },
  FAC: { cls: "s4", shape: "diamond", name: "Facultad" },
};

export function niceScale(min: number, max: number, n = 5) {
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (min === max) max = min + 1;
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag, step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { lo, hi, ticks };
}

type Shape = "square" | "triangle" | "circle" | "diamond";
export function Marker({ shape, x, y, r, cls, ...rest }: { shape: Shape; x: number; y: number; r: number; cls: string } & React.SVGProps<SVGElement>) {
  const p: any = { className: cls, ...rest };
  if (shape === "square") return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={1.5} {...p} />;
  if (shape === "triangle") return <path d={`M${x},${y - r * 1.2} L${x + r * 1.1},${y + r * 0.9} L${x - r * 1.1},${y + r * 0.9} Z`} {...p} />;
  if (shape === "diamond") return <path d={`M${x},${y - r * 1.3} L${x + r * 1.2},${y} L${x},${y + r * 1.3} L${x - r * 1.2},${y} Z`} {...p} />;
  return <circle cx={x} cy={y} r={r} {...p} />;
}

export interface LegendItem { label: string; cls: string; shape?: Shape; line?: boolean; dash?: string }
export function Legend({ items, children }: { items: LegendItem[]; children?: ReactNode }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label} className="lg">
          <svg width="26" height="14" aria-hidden="true">
            {it.line && <line x1="1" y1="7" x2="25" y2="7" className={it.cls} strokeDasharray={it.dash} strokeWidth={2.2} />}
            {it.shape && <Marker shape={it.shape} x={13} y={7} r={4.5} cls={it.cls} />}
          </svg>
          {it.label}
        </span>
      ))}
      {children}
    </div>
  );
}

/** Marco común: título, descripción, botón «Ver como tabla» y la tabla equivalente. */
export function ChartBox({ title, desc, cols, rows, children, legend, empty }: { title: string; desc?: string; cols: string[]; rows: ReactNode[][]; children?: ReactNode; legend?: ReactNode; empty?: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="chart">
      <figcaption>
        <div>
          <h4>{title}</h4>
          {desc && <p className="muted small">{desc}</p>}
        </div>
        <button type="button" className="btn ghost small" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Ver como gráfico" : "Ver como tabla"}
        </button>
      </figcaption>
      <div className="chart-body" hidden={asTable}>
        {empty ?? children}
      </div>
      <div className="chart-table" hidden={!asTable}>
        <table className="tbl">
          <caption className="sr">{title}</caption>
          <thead>
            <tr>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      {legend}
    </figure>
  );
}

const refLabel = (e: EvalPoint | undefined) => (e && e.espFuente ? "Esperado" : "Meta");
const pct = (unit: string) => (unit === "%" ? " %" : "");

/* ---- Tendencia: líneas por escuela, meta dorada punteada y bandas de umbral ---- */
export function TrendChart({ series, unit = "", title, desc }: { series: { esc: string; st: Status }[]; unit?: string; title?: string; desc?: string }) {
  const tip = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const tipHover = (i: number, content: () => ReactNode) => {
    const t = tip(content);
    return {
      onMouseMove: t.onMouseMove,
      onMouseEnter: () => setHover(i),
      onFocus: (e: React.FocusEvent<Element>) => { setHover(i); t.onFocus(e); },
      onMouseLeave: () => { setHover(null); t.onMouseLeave(); },
      onBlur: () => { setHover(null); t.onBlur(); },
    };
  };
  const W = 820, H = 330, m = { l: 54, r: 150, t: 18, b: 56 };
  const cats = uniq(series.flatMap((s) => s.st.sr.ev.map((e) => e.pinfo.p))).map((p) => periodInfo(p)!).sort((a, b) => a.end.getTime() - b.end.getTime());
  const ttl = title || "Tendencia por periodo";
  const dsc = desc || "Cada línea es una escuela. La línea dorada punteada es la meta; las bandas muestran los umbrales cuando tienen fuente.";
  if (!cats.length) {
    return <ChartBox title={ttl} desc={dsc} cols={["Periodo"]} rows={[]} empty={<p className="empty">Sin datos con fuente para este indicador. Carga la plantilla de la escuela o activa los datos EJEMPLO.</p>} />;
  }
  const vals = series.flatMap((s) => s.st.sr.ev.map((e) => e.valor)).concat(series.flatMap((s) => s.st.sr.ev.map((e) => e.ref)).filter((v): v is number => v !== null));
  const bandAt = (ev: EvalPoint) => {
    if (!ev.bands || ev.ref === null || ev.bands.base === "valor") {
      if (ev.bands && ev.bands.base === "valor") return { v: ev.bands.verde, r: ev.bands.rojo };
      return null;
    }
    const menor = ev.sentido === "Menor es mejor";
    return menor ? { v: ev.ref / (ev.bands.verde / 100), r: ev.ref / (ev.bands.rojo / 100) } : { v: (ev.ref * ev.bands.verde) / 100, r: (ev.ref * ev.bands.rojo) / 100 };
  };
  let anyBands = false;
  const bandVals: number[] = [];
  series.forEach((s) => s.st.sr.ev.forEach((e) => { const b = bandAt(e); if (b) { anyBands = true; bandVals.push(b.v, b.r); } }));
  const all = vals.concat(bandVals);
  let ymin = Math.min(...all), ymax = Math.max(...all);
  const pad = (ymax - ymin) * 0.12 || 5;
  ymin = unit === "%" ? Math.max(0, ymin - pad) : ymin - pad;
  ymax = ymax + pad;
  if (unit === "%") ymax = Math.min(Math.max(ymax, 20), 110);
  const sc = niceScale(ymin, ymax, 5);
  const x = (i: number) => m.l + (cats.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (cats.length - 1));
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const seg = (W - m.l - m.r) / Math.max(1, cats.length - 1);

  // bandas
  const bandEls: ReactNode[] = [];
  let bandLabels: ReactNode = null;
  if (anyBands) {
    const refEv = series[0].st.sr.ev;
    cats.forEach((c, i) => {
      const ev = refEv.find((e) => e.pinfo.p === c.p) || series.map((s) => s.st.sr.ev.find((e) => e.pinfo.p === c.p)).find(Boolean);
      const b = ev && bandAt(ev);
      if (!b || !ev) return;
      const x0 = cats.length === 1 ? m.l : Math.max(m.l, x(i) - seg / 2), x1 = cats.length === 1 ? W - m.r : Math.min(W - m.r, x(i) + seg / 2);
      const menor = ev.sentido === "Menor es mejor";
      const yv = y(b.v), yr = y(b.r), top = m.t, bot = H - m.b;
      const rect = (ya: number, yb: number, cls: string, k: string) => <rect key={`${i}${k}`} x={x0} y={Math.min(ya, yb)} width={x1 - x0} height={Math.abs(yb - ya)} className={cls} />;
      if (!menor) bandEls.push(rect(top, yv, "band-ok", "a"), rect(yv, yr, "band-risk", "b"), rect(yr, bot, "band-crit", "c"));
      else bandEls.push(rect(bot, yv, "band-ok", "a"), rect(yv, yr, "band-risk", "b"), rect(yr, top, "band-crit", "c"));
    });
    const first = series[0].st.sr.ev;
    const ev = first[first.length - 1] || series[0].st.sr.ev.slice(-1)[0];
    const b = ev && bandAt(ev);
    if (b && ev) {
      const menor = ev.sentido === "Menor es mejor";
      bandLabels = (
        <>
          <text x={m.l + 6} y={menor ? y((b.v + sc.lo) / 2) : y((b.v + sc.hi) / 2) + 4} className="bandlab">▲ En meta</text>
          <text x={m.l + 6} y={y((b.v + b.r) / 2) + 4} className="bandlab">◆ En riesgo</text>
          <text x={m.l + 6} y={menor ? y((b.r + sc.hi) / 2) + 4 : y((b.r + sc.lo) / 2) + 4} className="bandlab">✖ Crítico</text>
        </>
      );
    }
  }

  // meta (escalón dorado punteado)
  const refEvSeries = series.map((s) => s.st.sr.ev).find((e) => e.some((z) => z.ref !== null));
  let hasMeta = false;
  let goalPath = "";
  const labs: { y: number; node: (yy: number) => ReactNode }[] = [];
  if (refEvSeries) {
    const pts = cats.map((c, i) => { const e = refEvSeries.find((z) => z.pinfo.p === c.p); return e && e.ref !== null ? ([x(i), y(e.ref)] as [number, number]) : null; }).filter((p): p is [number, number] => !!p);
    if (pts.length) {
      hasMeta = true;
      pts.forEach((p, k) => { goalPath += k === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${pts[k - 1][1]}L${p[0]},${p[1]}`; });
      const lp = pts[pts.length - 1];
      const lastRef = refEvSeries.filter((z) => z.ref !== null).slice(-1)[0];
      labs.push({ y: lp[1] + 4, node: (yy) => <text key="goal" x={W - m.r + 6} y={yy} className="goaltxt">{`${refLabel(lastRef)} ${fmtN(lastRef.ref, 1)}${pct(unit)}`}</text> });
    }
  }
  // líneas
  const lines = series.map((s) => {
    const S0 = SERIES[s.esc];
    const pts = s.st.sr.ev.map((e) => { const i = cats.findIndex((c) => c.p === e.pinfo.p); return { i, e, X: x(i), Y: y(e.valor) }; });
    const lp = pts[pts.length - 1];
    if (lp) labs.push({ y: lp.Y + 4, node: (yy) => <text key={"l" + s.esc} x={Math.min(W - m.r + 6, lp.X + 10)} y={yy} className={"dl " + S0.cls}>{S0.name + " " + fmtN(lp.e.valor, 1) + pct(unit)}</text> });
    return (
      <g key={s.esc}>
        {pts.length > 1 && <path d={pts.map((p, k) => (k ? "L" : "M") + p.X + "," + p.Y).join("")} className={"ln " + S0.cls} fill="none" />}
        {pts.map((p) => <Marker key={p.i} shape={S0.shape} x={p.X} y={p.Y} r={4.8} cls={"mk " + S0.cls} />)}
      </g>
    );
  });
  const sorted = labs.map((l, k) => ({ ...l, k })).sort((a, b) => a.y - b.y);
  sorted.forEach((l, i) => { if (i && l.y < sorted[i - 1].y + 15) l.y = sorted[i - 1].y + 15; });

  const tableRows: ReactNode[][] = [];
  cats.forEach((c) => series.forEach((s) => {
    const e = s.st.sr.ev.find((z) => z.pinfo.p === c.p);
    if (e) tableRows.push([c.p, SERIES[s.esc].name, fmtN(e.valor, 2), e.ref !== null ? fmtN(e.ref, 2) : "por definir", <StateChip key="s" code={e.state} />, e.m.fuente_dato]);
  }));
  const lg: { label: string; cls: string; shape?: Shape; line?: boolean; dash?: string }[] = series.map((s) => ({ label: SERIES[s.esc].name, cls: "ln " + SERIES[s.esc].cls, shape: SERIES[s.esc].shape, line: true }));
  if (hasMeta) lg.push({ label: series.some((q) => q.st.sr.ev.some((e) => e.espFuente)) ? "Esperado a la fecha (con fuente)" : "Meta (con fuente)", cls: "goal", line: true, dash: "5 4" });

  return (
    <ChartBox
      title={ttl} desc={dsc} cols={["Periodo", "Escuela", "Valor", "Meta", "Estado", "Fuente del dato"]} rows={tableRows}
      legend={
        <Legend items={lg}>
          {anyBands && <span className="lg muted small">Bandas: ▲ En meta · ◆ En riesgo · ✖ Crítico (solo con umbral con fuente o EJEMPLO)</span>}
          {!hasMeta && <span className="lg muted small">Sin meta con fuente: no hay línea de meta ni semáforo</span>}
        </Legend>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="group" aria-label={`${ttl}. ${series.map((s) => SERIES[s.esc].name).join(", ")}. ${cats.length} periodos.`}>
        <title>{ttl}</title>
        {bandEls}
        {bandLabels}
        {sc.ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="gridl" />
            <text x={m.l - 8} y={y(t) + 4} className="axt" textAnchor="end">{fmtN(t, 1) + pct(unit)}</text>
          </g>
        ))}
        {cats.map((c, i) => (
          <g key={c.p}>
            <text x={x(i)} y={H - m.b + 18} className="axt" textAnchor="middle">{c.p}</text>
            <line x1={x(i)} x2={x(i)} y1={H - m.b} y2={H - m.b + 4} className="axl" />
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="axl" />
        <text x={m.l + (W - m.l - m.r) / 2} y={H - 6} className="axt" textAnchor="middle">Periodo (por fecha de cierre)</text>
        {hasMeta && <path d={goalPath} className="goal" fill="none" />}
        {lines}
        {sorted.map((l) => l.node(l.y))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} className="guide" />}
        {cats.map((c, i) => (
          <rect
            key={c.p} x={x(i) - seg / 2} y={m.t} width={seg} height={H - m.t - m.b} fill="transparent" tabIndex={0}
            aria-label={`Periodo ${c.p}: ` + series.map((s) => { const e = s.st.sr.ev.find((z) => z.pinfo.p === c.p); return e ? `${SERIES[s.esc].name} ${fmtN(e.valor)}` : ""; }).filter(Boolean).join("; ")}
            {...tipHover(i, () => (
              <>
                <strong>{c.label}</strong>
                {series.map((s) => {
                  const e = s.st.sr.ev.find((z) => z.pinfo.p === c.p);
                  if (!e) return null;
                  return (
                    <div key={s.esc}>
                      <div className="trow">
                        <svg width="14" height="14"><g><Marker shape={SERIES[s.esc].shape} x={7} y={7} r={4} cls={"mk " + SERIES[s.esc].cls} /></g></svg>
                        <span>{SERIES[s.esc].name}: <b>{fmtN(e.valor, 2) + pct(unit)}</b></span> <StateChip code={e.state} /> {e.m.origen === "EJEMPLO" && <ExBadge />}
                      </div>
                      <div className="small muted">{refLabel(e)} {e.ref !== null ? fmtN(e.ref, 2) + pct(unit) : "por definir"} · {e.m.fuente_dato}</div>
                    </div>
                  );
                })}
              </>
            ))}
          />
        ))}
      </svg>
    </ChartBox>
  );
}

/* ---- Comparación entre escuelas para un mismo indicador ---- */
export function CompareChart({ id, title, desc }: { id: string; title?: string; desc?: string }) {
  const { engine } = useWs();
  const tip = useTip();
  const sts = ORD.map((e) => ({ esc: e, st: engine.status(e, id) })).filter((s) => s.st.last);
  const ttl = title || "Comparación entre escuelas";
  const dsc = desc || "Último valor de cada escuela; la línea dorada punteada es la meta.";
  if (!sts.length) return <ChartBox title={ttl} desc={dsc} cols={["Escuela"]} rows={[]} empty={<p className="empty">Ninguna escuela tiene dato con fuente para este indicador.</p>} />;
  const unit = sts[0].st.last!.unidad;
  const W = 640, H = 300, m = { l: 54, r: 24, t: 40, b: 56 };
  const vals = sts.map((s) => s.st.last!.valor).concat(sts.map((s) => s.st.last!.ref).filter((v): v is number => v !== null));
  const sc = niceScale(unit === "%" ? 0 : Math.min(0, ...vals), Math.max(...vals) * 1.15, 5);
  const bw = Math.min(90, ((W - m.l - m.r) / sts.length) * 0.55);
  const x = (i: number) => m.l + ((W - m.l - m.r) * (i + 0.5)) / sts.length;
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const metas = sts.map((s) => s.st.last!.ref).filter((v): v is number => v !== null);
  return (
    <ChartBox
      title={ttl} desc={dsc} cols={["Escuela", "Periodo", "Valor", "Meta", "Estado", "Fuente"]}
      rows={sts.map((s) => [SERIES[s.esc].name, s.st.last!.pinfo.p, fmtN(s.st.last!.valor, 2), s.st.last!.ref !== null ? fmtN(s.st.last!.ref, 2) : "por definir", <StateChip key="c" code={s.st.last!.state} />, s.st.last!.m.fuente_dato])}
      legend={<Legend items={[...sts.map((s) => ({ label: SERIES[s.esc].name, cls: "bar " + SERIES[s.esc].cls, shape: "square" as Shape })), ...(metas.length ? [{ label: sts.some((q) => q.st.last!.espFuente) ? "Esperado a la fecha (con fuente)" : "Meta (con fuente)", cls: "goal", line: true, dash: "5 4" }] : [])]} />}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="group" aria-label={`Comparación del indicador ${id} entre escuelas`}>
        {sc.ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="gridl" />
            <text x={m.l - 8} y={y(t) + 4} className="axt" textAnchor="end">{fmtN(t, 1) + pct(unit)}</text>
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={y(sc.lo)} y2={y(sc.lo)} className="axl" />
        {sts.map((s, i) => {
          const L = s.st.last!, S0 = SERIES[s.esc];
          const top = y(L.valor), base = y(Math.max(sc.lo, 0));
          return (
            <g key={s.esc}>
              <rect
                x={x(i) - bw / 2} y={Math.min(top, base)} width={bw} height={Math.max(2, Math.abs(base - top))} rx={4} className={"bar " + S0.cls} tabIndex={0}
                aria-label={`${S0.name}: ${fmtN(L.valor, 2)}, ${ST[L.state].label}`}
                {...tip(() => (
                  <>
                    <strong>{S0.name}</strong> {L.m.origen === "EJEMPLO" && <ExBadge />}
                    <div>Periodo {L.pinfo.p}: <b>{fmtVal(L.valor, L.unidad)}</b></div>
                    <div>{refLabel(L)} {L.ref !== null ? fmtVal(L.ref, L.unidad) : "por definir"} · <StateChip code={L.state} /></div>
                    <div className="small muted">{L.m.fuente_dato}</div>
                  </>
                ))}
              />
              <text x={x(i)} y={top - 24} className="val" textAnchor="middle">{fmtN(L.valor, 1) + pct(unit)}</text>
              <g transform={`translate(${x(i) - 38},${top - 20})`}>
                <use href={"#" + ST[L.state].icon} width={12} height={12} className={"ic-" + ST[L.state].cls} />
                <text x={16} y={10} className="stl">{ST[L.state].label}</text>
              </g>
              <text x={x(i)} y={H - m.b + 20} className="axt" textAnchor="middle">{S0.name}</text>
              <text x={x(i)} y={H - m.b + 36} className="axt muted" textAnchor="middle">{L.pinfo.p}</text>
            </g>
          );
        })}
        {metas.length > 0 && (
          <>
            <line x1={m.l} x2={W - m.r} y1={y(metas[0])} y2={y(metas[0])} className="goal" />
            <text x={W - m.r} y={y(metas[0]) - 6} className="goaltxt" textAnchor="end">{`${refLabel(sts[0].st.last!)} ${fmtN(metas[0], 1)}${pct(unit)}`}</text>
          </>
        )}
      </svg>
    </ChartBox>
  );
}

/* ---- Brechas: indicadores más lejos de la meta ---- */
export function GapsChart({ rows: rowsIn, n = 12, title, onOpen }: { rows: { esc: string; id: string; nombre: string; st: Status }[]; n?: number; title?: string; onOpen?: (id: string, esc: string) => void }) {
  const tip = useTip();
  const rows = rowsIn.filter((r) => r.st.last && r.st.last.cumpl !== null).sort((a, b) => a.st.last!.cumpl! - b.st.last!.cumpl!).slice(0, n);
  const ttl = title || "Brechas: indicadores más lejos de la meta";
  const dsc = "Cumplimiento respecto de la meta con fuente (100 % = meta). Ordenados de mayor a menor distancia.";
  if (!rows.length) return <ChartBox title={ttl} desc={dsc} cols={["Indicador"]} rows={[]} empty={<p className="empty">No hay indicadores con meta con fuente y dato para medir brechas.</p>} />;
  const W = 760, rh = 30, m = { l: 300, r: 130, t: 12, b: 34 }, H = m.t + m.b + rows.length * rh;
  const mx = Math.max(120, Math.ceil(Math.max(...rows.map((r) => r.st.last!.cumpl!)) / 20) * 20);
  const x = (v: number) => m.l + ((W - m.l - m.r) * Math.min(v, mx)) / mx;
  const ticks: number[] = [];
  for (let t = 0; t <= mx; t += 20) ticks.push(t);
  return (
    <ChartBox
      title={ttl} desc={dsc} cols={["Indicador", "Escuela", "Valor", "Meta", "Cumplimiento", "Estado"]}
      rows={rows.map((r) => [r.id + " " + r.nombre, SERIES[r.esc].name, fmtN(r.st.last!.valor, 2), fmtN(r.st.last!.meta, 2), fmtN(r.st.last!.cumpl, 1) + " %", <StateChip key="s" code={r.st.last!.state} />])}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="group" aria-label="Brechas respecto de la meta">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} className="gridl" />
            <text x={x(t)} y={H - m.b + 16} className="axt" textAnchor="middle">{t + " %"}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const L = r.st.last!, yy = m.t + i * rh, S0 = SERIES[r.esc];
          const label = `${r.id} · ${r.nombre}`;
          const tl = label.length > 46 ? label.slice(0, 45) + "…" : label;
          return (
            <g key={r.esc + r.id}>
              <text x={m.l - 10} y={yy + rh / 2 + 1} className="axt lab" textAnchor="end">{tl}</text>
              <title>{label}</title>
              <text x={m.l - 10} y={yy + rh / 2 + 13} className="axt muted tiny" textAnchor="end">{S0.name}</text>
              <rect
                x={m.l} y={yy + 6} width={Math.max(2, x(L.cumpl!) - m.l)} height={rh - 14} rx={3} className={"bar " + S0.cls} tabIndex={0} style={{ cursor: onOpen ? "pointer" : undefined }}
                aria-label={`${label}, ${S0.name}: ${fmtN(L.cumpl, 1)} % de la meta, ${ST[L.state].label}`}
                onClick={() => onOpen?.(r.id, r.esc)}
                {...tip(() => (
                  <>
                    <strong>{label}</strong> {L.m.origen === "EJEMPLO" && <ExBadge />}
                    <div>{S0.name} · periodo {L.pinfo.p}</div>
                    <div>Valor <b>{fmtVal(L.valor, L.unidad)}</b> · meta {fmtVal(L.meta, L.unidad)} · <b>{fmtN(L.cumpl, 1)} %</b> de la meta</div>
                    <div><StateChip code={L.state} /></div>
                  </>
                ))}
              />
              <g transform={`translate(${W - m.r + 8},${yy + 7})`}>
                <use href={"#" + ST[L.state].icon} width={14} height={14} className={"ic-" + ST[L.state].cls} />
                <text x={19} y={11} className="stl">{`${fmtN(L.cumpl, 0)} % · ${ST[L.state].label}`}</text>
              </g>
            </g>
          );
        })}
        <line x1={x(100)} x2={x(100)} y1={m.t - 4} y2={H - m.b} className="goal" />
        <text x={x(100)} y={m.t - 2} className="goaltxt" textAnchor="middle">Meta</text>
      </svg>
    </ChartBox>
  );
}

/* ---- Cobertura: dato, evidencia y validación ---- */
export function CoverageChart({ escs, title }: { escs: string[]; title?: string }) {
  const { engine } = useWs();
  const tip = useTip();
  const ttl = title || "Cobertura: dato, evidencia y validación";
  const W = 760, rowH = 22, gap = 18, m = { l: 110, r: 90, t: 8, b: 8 };
  const kinds: [keyof ReturnType<typeof engine.coverageStats>, string][] = [["dato", "Con dato"], ["evi", "Con evidencia"], ["val", "Validados"]];
  const stats = escs.map((e) => ({ e, c: engine.coverageStats(e) }));
  const H = m.t + m.b + stats.length * (kinds.length * rowH + gap);
  const x = (p: number) => m.l + ((W - m.l - m.r) * p) / 100;
  return (
    <ChartBox
      title={ttl} desc="De los indicadores vigilados en cada escuela, cuántos tienen dato con fuente, evidencia y validación."
      cols={["Escuela", "Vigilados", "Con dato", "Con evidencia", "Validados", "Con dato vencido"]} rows={stats.map((s) => [SERIES[s.e].name, s.c.n, s.c.dato, s.c.evi, s.c.val, s.c.venc])}
      legend={<Legend items={[{ label: "Con dato", cls: "bar c1", shape: "square" }, { label: "Con evidencia", cls: "bar c2", shape: "square" }, { label: "Validados", cls: "bar c3", shape: "square" }]} />}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="group" aria-label="Cobertura de indicadores por escuela">
        {[0, 25, 50, 75, 100].map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} className="gridl" />)}
        {stats.map((s, i) => {
          const y0 = m.t + i * (kinds.length * rowH + gap);
          return (
            <g key={s.e}>
              <text x={6} y={y0 + 16} className="axt strong">{SERIES[s.e].name}</text>
              <text x={6} y={y0 + 32} className="axt muted tiny">{`${s.c.n} vigilados`}</text>
              {kinds.map(([k, lab], j) => {
                const p = s.c.n ? ((s.c[k] as number) / s.c.n) * 100 : 0;
                const yy = y0 + j * rowH;
                return (
                  <g key={k}>
                    <rect x={m.l} y={yy + 3} width={W - m.l - m.r} height={rowH - 8} rx={3} className="trk" />
                    <rect
                      x={m.l} y={yy + 3} width={Math.max(p ? 3 : 0, x(p) - m.l)} height={rowH - 8} rx={3} className={"bar " + (j === 0 ? "c1" : j === 1 ? "c2" : "c3")} tabIndex={0}
                      aria-label={`${SERIES[s.e].name}, ${lab}: ${s.c[k]} de ${s.c.n}`}
                      {...tip(() => (<><strong>{SERIES[s.e].name}</strong><div>{lab}: <b>{s.c[k]} de {s.c.n}</b> ({fmtN(p, 0)} %)</div></>))}
                    />
                    <text x={W - m.r + 8} y={yy + 15} className="axt">{`${lab} ${s.c[k]}/${s.c.n}`}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </ChartBox>
  );
}

/* ---- POI: programado vs ejecutado acumulado mensual ---- */
export function PoiLinesChart({ anio, aoiList }: { anio: number; aoiList: string[] }) {
  const { engine } = useWs();
  const tip = useTip();
  const A = engine.poiAll()[anio];
  const rep = A.rep;
  const sel = A.lista.filter((x: any) => aoiList.includes(x.aoi) && x.prog > 0);
  const ttl = `Programado vs ejecutado acumulado, ${rep.etiqueta}`;
  const dsc = "La línea dorada punteada es lo programado; la violeta es lo ejecutado. Suma de las AOI elegidas (unidades de medida distintas: úsalo con una o con actividades de la misma unidad).";
  if (!sel.length) return <ChartBox title={ttl} desc={dsc} cols={["Mes"]} rows={[]} empty={<p className="empty">Elige al menos una AOI con programación en este reporte.</p>} />;
  const months = Array.from({ length: rep.mes_corte }, (_, i) => i + 1);
  const prog = months.map((mo) => sel.reduce((s: number, x: any) => s + (x.acum.find((z: any) => z.mes === mo) || { prog: 0 }).prog, 0));
  const ejec = months.map((mo) => sel.reduce((s: number, x: any) => s + (x.acum.find((z: any) => z.mes === mo) || { ejec: 0 }).ejec, 0));
  const W = 700, H = 290, m = { l: 62, r: 100, t: 16, b: 44 };
  const sc = niceScale(0, Math.max(...prog, ...ejec) * 1.08, 5);
  const x = (i: number) => m.l + (months.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (months.length - 1));
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const path = (arr: number[]) => arr.map((v, i) => (i ? "L" : "M") + x(i) + "," + y(v)).join("");
  const step = (W - m.l - m.r) / Math.max(1, months.length - 1);
  return (
    <ChartBox
      title={ttl} desc={dsc} cols={["Mes", "Programado acumulado", "Ejecutado acumulado"]} rows={months.map((mo, i) => [MESES[mo - 1], fmtN(prog[i], 0), fmtN(ejec[i], 0)])}
      legend={<Legend items={[{ label: "Programado acumulado", cls: "goal", line: true, dash: "5 4" }, { label: "Ejecutado acumulado", cls: "ln s2", line: true, shape: "circle" }]} />}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="group" aria-label={`Programado y ejecutado acumulado ${rep.etiqueta}`}>
        {sc.ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="gridl" />
            <text x={m.l - 8} y={y(t) + 4} className="axt" textAnchor="end">{fmtN(t, 0)}</text>
          </g>
        ))}
        {months.map((mo, i) => <text key={mo} x={x(i)} y={H - m.b + 18} className="axt" textAnchor="middle">{MESES[mo - 1]}</text>)}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} className="axl" />
        <path d={path(prog)} className="goal" fill="none" />
        <path d={path(ejec)} className="ln s2" fill="none" />
        {months.map((mo, i) => <Marker key={mo} shape="circle" x={x(i)} y={y(ejec[i])} r={4.2} cls="mk s2" />)}
        <text x={x(months.length - 1) + 8} y={y(prog[prog.length - 1]) - 4} className="goaltxt">{"Programado " + fmtN(prog[prog.length - 1], 0)}</text>
        <text x={x(months.length - 1) + 8} y={y(ejec[ejec.length - 1]) + 14} className="dl s2">{"Ejecutado " + fmtN(ejec[ejec.length - 1], 0)}</text>
        {months.map((mo, i) => (
          <rect
            key={mo} x={x(i) - step / 2} y={m.t} width={step} height={H - m.t - m.b} fill="transparent" tabIndex={0} aria-label={`${MESES[mo - 1]}: programado ${prog[i]}, ejecutado ${ejec[i]}`}
            {...tip(() => (<><strong>{MESES[mo - 1]} {anio}</strong><div>Programado acumulado: <b>{fmtN(prog[i], 0)}</b></div><div>Ejecutado acumulado: <b>{fmtN(ejec[i], 0)}</b></div><div className="small muted">{rep.reporte} · actividad compartida por la Facultad</div></>))}
          />
        ))}
      </svg>
    </ChartBox>
  );
}

/* ---- POI: avance por AOI sobre las bandas del reporte ---- */
export function PoiBulletChart({ anio, onPick }: { anio: number; onPick?: (aoi: string) => void }) {
  const { engine } = useWs();
  const tip = useTip();
  const A = engine.poiAll()[anio];
  const rep = A.rep;
  const vg = +engine.params.gen.banda_poi_verde || 95, rg = +engine.params.gen.banda_poi_rojo || 75;
  const rows = A.conProg.slice().sort((a: any, b: any) => a.avance - b.avance || b.ratio - a.ratio);
  const rh = 24, W = 780, m = { l: 330, r: 70, t: 22, b: 8 }, H = m.t + m.b + rows.length * rh;
  const x = (v: number) => m.l + ((W - m.l - m.r) * Math.min(v, 100)) / 100;
  const codeOf = (av: number) => (av >= vg ? "OK" : av >= rg ? "RIESGO" : "CRIT") as "OK" | "RIESGO" | "CRIT";
  return (
    <ChartBox
      title={`Avance de cada AOI, ${rep.etiqueta}`}
      desc={`Ejecutado sobre programado acumulado al corte (tope 100 %, como los reportes). Bandas de los reportes: menos de ${rg} %, de ${rg} a menos de ${vg} % y ${vg} % o más. El marcador ◆ muestra la ejecución sin tope.`}
      cols={["AOI", "Actividad", "Programado", "Ejecutado", "Avance %", "Banda"]}
      rows={rows.map((r: any) => [r.aoi, engine.AOI_BY[r.act]?.actividad ?? "", fmtN(r.prog, 0), fmtN(r.ejec, 0), fmtN(r.avance, 1), <StateChip key="s" code={codeOf(r.avance)} />])}
      legend={<Legend items={[{ label: "Avance (tope 100 %)", cls: "bar s1", shape: "square" }, { label: "Ejecución mayor que lo programado", cls: "mk s2", shape: "diamond" }]} />}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="group" aria-label={`Avance por AOI, ${rep.etiqueta}`}>
        <rect x={x(0)} y={m.t - 6} width={x(rg) - x(0)} height={H - m.t - m.b + 6} className="band-crit" />
        <rect x={x(rg)} y={m.t - 6} width={x(vg) - x(rg)} height={H - m.t - m.b + 6} className="band-risk" />
        <rect x={x(vg)} y={m.t - 6} width={x(100) - x(vg)} height={H - m.t - m.b + 6} className="band-ok" />
        {([[0, "0 %"], [rg, rg + " %"], [vg, vg + " %"], [100, "100 %"]] as [number, string][]).map(([v, t]) => (
          <text key={v} x={x(v)} y={12} className="axt" textAnchor={v === 0 ? "start" : "middle"}>{t}</text>
        ))}
        {rows.map((r: any, i: number) => {
          const a = engine.AOI_BY[r.act];
          const yy = m.t + i * rh;
          const code = codeOf(r.avance);
          const label = `${r.aoi.slice(-5)} · ${a ? a.actividad : r.act}`;
          const tl = label.length > 50 ? label.slice(0, 49) + "…" : label;
          return (
            <g key={r.aoi}>
              <text x={m.l - 8} y={yy + 15} className="axt lab" textAnchor="end">{tl}</text>
              <rect
                x={m.l} y={yy + 4} width={Math.max(2, x(r.avance) - m.l)} height={rh - 10} rx={3} className="bar s1" tabIndex={0} style={{ cursor: onPick ? "pointer" : undefined }}
                aria-label={`${label}: avance ${fmtN(r.avance, 1)} %, ${ST[code].label}`} onClick={() => onPick?.(r.aoi)}
                {...tip(() => (
                  <>
                    <strong>{a ? a.actividad : r.act}</strong>
                    <div className="small muted">{r.aoi} · compartida por la Facultad</div>
                    <div>Programado {fmtN(r.prog, 0)} · ejecutado {fmtN(r.ejec, 0)}</div>
                    <div>Avance <b>{fmtN(r.avance, 1)} %</b> (sin tope {fmtN(r.ratio, 1)} %)</div>
                    <div><StateChip code={code} /></div>
                    <div className="small muted">{rep.reporte} · p. {r.pag || ""}</div>
                  </>
                ))}
              />
              {r.ratio > 100 && <Marker shape="diamond" x={x(100) + 6} y={yy + rh / 2} r={4} cls="mk s2" />}
              <g transform={`translate(${W - m.r + 6},${yy + 5})`}>
                <use href={"#" + ST[code].icon} width={13} height={13} className={"ic-" + ST[code].cls} />
                <text x={17} y={10.5} className="stl">{fmtN(r.avance, 0) + " %"}</text>
              </g>
            </g>
          );
        })}
      </svg>
    </ChartBox>
  );
}

/* ---- POI: cumplimiento PE01-I3 por año frente a la meta del MAGPROF ---- */
export function PoiYearsChart() {
  const { engine } = useWs();
  const tip = useTip();
  const A = engine.poiAll();
  const years = engine.M.poi_reportes.map((r) => r.anio);
  const W = 560, H = 270, m = { l: 54, r: 20, t: 34, b: 52 };
  const metas = years.map((a) => { const r = engine.metaRowFor("PE01-I3", a); return r ? r.meta : null; });
  const sc = niceScale(0, 110, 5);
  const x = (i: number) => m.l + ((W - m.l - m.r) * (i + 0.5)) / years.length;
  const y = (v: number) => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const bw = 70;
  return (
    <ChartBox
      title="Cumplimiento del POI de la Facultad por año (PE01-I3)" desc="Promedio del avance de las AOI con programación. Dorado punteado: meta del MAGPROF por año. 2026 es parcial (febrero)."
      cols={["Reporte", "AOI con programación", "PE01-I3 %", "Meta MAGPROF %", "Impreso en el reporte %"]}
      rows={years.map((a, i) => [A[a].rep.etiqueta, A[a].conProg.length, fmtN(A[a].i3, 2), metas[i] ?? "por definir", fmtN(A[a].rep.impreso, 2)])}
      legend={<Legend items={[{ label: "PE01-I3 (promedio de avance)", cls: "bar s1", shape: "square" }, { label: "Meta MAGPROF", cls: "goal", line: true, dash: "5 4" }]} />}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="svgc" role="group" aria-label="Cumplimiento del POI por año">
        {sc.ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="gridl" />
            <text x={m.l - 8} y={y(t) + 4} className="axt" textAnchor="end">{t + " %"}</text>
          </g>
        ))}
        {years.map((a, i) => {
          const v = A[a].i3, rep = A[a].rep;
          const stc = engine.params.metas["PE01-I3"] && metas[i] !== null ? (v >= (metas[i] as number) ? "OK" : "BAJO") : "DEF";
          const code = stc as "OK" | "BAJO" | "DEF";
          return (
            <g key={a}>
              <rect
                x={x(i) - bw / 2} y={y(v)} width={bw} height={y(0) - y(v)} rx={4} className="bar s1" tabIndex={0} aria-label={`${rep.etiqueta}: ${fmtN(v, 2)} %`}
                {...tip(() => (
                  <>
                    <strong>{rep.etiqueta}</strong>
                    <div>PE01-I3: <b>{fmtN(v, 2)} %</b> ({A[a].conProg.length} AOI con programación)</div>
                    <div>Meta MAGPROF: {metas[i] !== null ? metas[i] + " %" : "por definir"} · <StateChip code={code} /></div>
                    <div className="small muted">{rep.reporte}, consultado el {fmtDate(parseISO(rep.consulta))}</div>
                  </>
                ))}
              />
              <text x={x(i)} y={y(v) - 24} className="val" textAnchor="middle">{fmtN(v, 2) + " %"}</text>
              <g transform={`translate(${x(i) - 38},${y(v) - 20})`}>
                <use href={"#" + ST[code].icon} width={12} height={12} className={"ic-" + ST[code].cls} />
                <text x={16} y={10} className="stl">{ST[code].label}</text>
              </g>
              {metas[i] !== null && (
                <>
                  <line x1={x(i) - bw / 2 - 12} x2={x(i) + bw / 2 + 12} y1={y(metas[i] as number)} y2={y(metas[i] as number)} className="goal" />
                  <text x={x(i) + bw / 2 + 14} y={y(metas[i] as number) + 4} className="goaltxt tiny">{metas[i] + " %"}</text>
                </>
              )}
              <text x={x(i)} y={H - m.b + 20} className="axt" textAnchor="middle">{rep.etiqueta}</text>
            </g>
          );
        })}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} className="axl" />
      </svg>
    </ChartBox>
  );
}

export { Ic };
