"use client";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  DC, DC_ORDER, DEC_AREAS, DEC_AREA_CORTO, DEC_ESC, DEC_ESC_NOM, DEC_FICHA_TXT, DEC_MODELO, DecisionBoard, dcWorst, decPerEnd, decPerLabel, fmtDate, fmtN, natKey, noAcc, parseISO,
  type DcCode,
} from "@sgc/engine";
import { ApiError, api } from "@/lib/api";
import { exportDecision, fmtDateTime } from "@/lib/actions";
import { useWs } from "@/lib/workspace";
import { Ic } from "@/components/Icon";
import { Banner, DcChip, LinkBtn, PageHead, Sect } from "@/components/ui";

type Item = any;

const escLabel = (it: Item) => DEC_ESC_NOM[it.esc] + (it.area ? " · " + DEC_AREA_CORTO[it.area] : "");

function trendMark(board: DecisionBoard, pts: { per: string; val: number }[], ind: string) {
  if (!pts || pts.length < 2) return { a: "—", dd: null as number | null, txt: "Un solo periodo: sin tendencia" };
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const dd = b.val - a.val;
  const u = board.IND[ind].unidad === "%" ? " pts" : " años";
  return { a: dd > 0 ? "↑" : dd < 0 ? "↓" : "→", dd, txt: `${dd > 0 ? "Sube" : dd < 0 ? "Baja" : "Sin cambio"}${dd ? " " + fmtN(Math.abs(dd), 1) + u : ""} frente a ${decPerLabel(a.per)}` };
}

/** Celda de los mapas de calor y botón de abrir ficha. */
function Cell({ it, txt, sub, pressed, onOpen }: { it: Item; txt?: string; sub?: string; pressed?: boolean; onOpen: (id: string) => void }) {
  const { board } = useWs();
  const c: DcCode = it.c;
  const t = txt !== undefined ? txt : it.ev && it.ev.last ? board.decFmt(it.cod, it.ev.last.val) : DC[c].short;
  const s = sub !== undefined ? sub : it.ev && it.ev.last ? decPerLabel(it.ev.last.per) + (it.ev.defPend ? " · por confirmar" : "") : (it.ev && it.ev.mini) || "";
  return (
    <button className={`hc dec-hc st-${DC[c].cls}`} aria-pressed={!!pressed} onClick={() => onOpen(it.id)} aria-label={`${it.cod} ${escLabel(it)}: ${DC[c].label}. ${it.motivo}`}>
      <span className="l1"><Ic n={DC[c].icon} />{t}</span>
      <span className="l2">{s}{it.ev && it.ev.last && !it.ev.vacio && it.ev.last.vestado !== "Validado" ? " · sin validar" : ""}</span>
    </button>
  );
}

function TrendChart({ it }: { it: Item }) {
  const { board } = useWs();
  const ind = it.cod, d = board.IND[ind];
  const pts = it.pts.slice(-6);
  if (!pts.length) return <div className="empty">Sin valores cargados: no hay tendencia que mostrar.</div>;
  const W = 480, H = 240, L = 44, R = 16, T = 26, B = 40, PX = 22;
  const vals = pts.map((p: any) => p.val);
  let mn = Math.min(0, ...vals, d.ref), mx = Math.max(...vals, d.ref);
  if (d.unidad === "%" && ind !== "ID6") { mx = Math.max(mx, 100); mn = 0; } else { const pad = (mx - mn) * 0.1 || 1; mx += pad; if (mn < 0) mn -= pad; }
  const x = (i: number) => L + PX + (pts.length === 1 ? (W - L - R - 2 * PX) / 2 : (i * (W - L - R - 2 * PX)) / (pts.length - 1));
  const y = (v: number) => T + ((mx - v) / (mx - mn)) * (H - T - B);
  const step = (mx - mn) / 4;
  const ticks = [0, 1, 2, 3, 4].map((k) => mn + step * k);
  return (
    <svg className="dec-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tendencia de ${ind}: ${pts.map((p: any) => decPerLabel(p.per) + " " + board.decFmt(ind, p.val)).join(", ")}. Referencial ${board.refTxt(ind)}.`}>
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="gr" /><text x={L - 6} y={y(t) + 4} textAnchor="end" className="ax">{fmtN(t, 0)}</text></g>))}
      {d.unidad === "%" && !d.menor && <rect x={L} y={y(d.ref)} width={W - L - R} height={Math.max(0, y(d.ref - 3) - y(d.ref))} className="dec-band" />}
      <line x1={L} x2={W - R} y1={y(d.ref)} y2={y(d.ref)} className="ref" />
      <text x={L + 6} y={y(d.ref) + 15} className="reft">Referencial {board.refTxt(ind)}</text>
      <polyline fill="none" className="ln" points={pts.map((p: any, i: number) => x(i) + "," + y(p.val)).join(" ")} />
      {pts.map((p: any, i: number) => (
        <g key={p.per}>
          <circle cx={x(i)} cy={y(p.val)} r={i === pts.length - 1 ? 6 : 4} className={i === pts.length - 1 ? "pt last st-" + DC[it.c as DcCode].cls : "pt"} />
          <text x={x(i)} y={y(p.val) - 10} textAnchor="middle" className="vl">{fmtN(p.val, 1)}</text>
          <text x={x(i)} y={H - 14} textAnchor="middle" className="ax">{decPerLabel(p.per)}</text>
        </g>
      ))}
    </svg>
  );
}

const MARKS = ["c", "s", "d", "t"] as const;
function MarkShape({ m, x, y, r }: { m: string; x: number; y: number; r: number }) {
  if (m === "s") return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} className="mk" />;
  if (m === "d") return <polygon points={`${x},${y - r * 1.35} ${x + r * 1.35},${y} ${x},${y + r * 1.35} ${x - r * 1.35},${y}`} className="mk" />;
  if (m === "t") return <polygon points={`${x},${y - r * 1.3} ${x + r * 1.25},${y + r} ${x - r * 1.25},${y + r}`} className="mk" />;
  return <circle cx={x} cy={y} r={r} className="mk" />;
}

function AreaHistory({ o, onOpen }: { o: { cod: string; leaves: Item[] }; onOpen: (id: string) => void }) {
  const { board } = useWs();
  const ind = o.cod, d = board.IND[ind];
  const leaves = o.leaves.filter((l) => l.pts.length);
  if (!leaves.length) return null;
  const pers = Array.from(new Set(leaves.flatMap((l) => l.pts.map((p: any) => p.per)))).sort((a, b) => decPerEnd(a) - decPerEnd(b)).slice(-4);
  const W = 480, H = 250, L = 44, R = 16, T = 22, B = 40, PX = 26;
  const x = (i: number) => L + PX + (pers.length === 1 ? (W - L - R - 2 * PX) / 2 : (i * (W - L - R - 2 * PX)) / (pers.length - 1));
  const y = (v: number) => T + ((100 - v) / 100) * (H - T - B);
  const ser = o.leaves.map((l, k) => ({ l, k, m: MARKS[k % 4], pts: pers.map((p, i) => { const q = l.pts.find((z: any) => z.per === p); return q ? { i, v: q.val, per: p } : null; }).filter(Boolean) as { i: number; v: number; per: string }[] })).filter((z) => z.pts.length);
  const desc = ser.map((z) => `${DEC_AREA_CORTO[z.l.area]}: ${z.pts.map((q) => decPerLabel(q.per) + " " + board.decFmt(ind, q.v)).join(", ")}`).join(". ");
  const ico = (v: number) => ((!d.menor ? v >= d.ref : v < d.ref) ? { i: "i-ok", c: "ok", t: "alcanza" } : !d.menor && d.unidad === "%" && d.ref - v <= 3 ? { i: "i-risk", c: "risk", t: "dentro de ±3 puntos" } : { i: "i-crit", c: "crit", t: "bajo el referencial" });
  return (
    <>
      <h4 className="dec-h4">Historial por área (últimos {pers.length} periodos: {decPerLabel(pers[0])} a {decPerLabel(pers[pers.length - 1])})</h4>
      <ul className="dec-leg" aria-label="Áreas">
        {ser.map((z) => (<li key={z.k} className={"s" + (z.k % 4)}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><MarkShape m={z.m} x={8} y={8} r={4.4} /></svg>{DEC_AREA_CORTO[z.l.area]}</li>))}
        <li className="refl"><svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><line x1={1} x2={21} y1={8} y2={8} className="refln" /></svg>Referencial {board.refTxt(ind)}</li>
      </ul>
      <svg className="dec-chart dec-multi" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Historial de ${ind} por área. ${desc}. Referencial ${board.refTxt(ind)}.`}>
        {[0, 25, 50, 75, 100].map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="gr" /><text x={L - 6} y={y(t) + 4} textAnchor="end" className="ax">{t}</text></g>))}
        {d.unidad === "%" && !d.menor && <rect x={L} y={y(d.ref)} width={W - L - R} height={Math.max(0, y(d.ref - 3) - y(d.ref))} className="dec-band" />}
        <line x1={L} x2={W - R} y1={y(d.ref)} y2={y(d.ref)} className="ref" />
        {ser.map((z) => (
          <g key={z.k} className={"s" + (z.k % 4)}>
            <polyline fill="none" className="ln" points={z.pts.map((q) => x(q.i) + "," + y(q.v)).join(" ")} />
            {z.pts.map((q) => (<g key={q.per}><title>{DEC_AREA_CORTO[z.l.area]} · {decPerLabel(q.per)}: {board.decFmt(ind, q.v)}</title><MarkShape m={z.m} x={x(q.i)} y={y(q.v)} r={4.4} /></g>))}
          </g>
        ))}
        {pers.map((p, i) => <text key={p} x={x(i)} y={H - 14} textAnchor="middle" className="ax">{decPerLabel(p)}</text>)}
      </svg>
      <div className="tblw" style={{ marginTop: 8 }}>
        <table className="tbl dec-hist4">
          <thead><tr><th>Área</th>{pers.map((p) => <th key={p} className="num">{decPerLabel(p)}</th>)}<th>Tendencia</th></tr></thead>
          <tbody>
            {o.leaves.map((l) => {
              const t = trendMark(board, l.pts, ind);
              const w = l.pts.slice(-4);
              const net = w.length > 1 ? w[w.length - 1].val - w[0].val : null;
              return (
                <tr key={l.id} className="clk" tabIndex={0} role="button" aria-label={`Abrir ${ind} ${DEC_AREA_CORTO[l.area]}`} onClick={() => onOpen(l.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l.id); } }}>
                  <th scope="row">{DEC_AREA_CORTO[l.area]}</th>
                  {pers.map((p) => {
                    const q = l.pts.find((z: any) => z.per === p);
                    if (!q) return <td key={p} className="num muted">—</td>;
                    const f = ico(q.val);
                    return (<td key={p} className="num"><span className={`dec-v st-${f.c}`} title={f.t}><Ic n={f.i} /><b>{board.decFmt(ind, q.val)}</b></span><span className="sr">{f.t}</span></td>);
                  })}
                  <td className="tr" title={t.txt}>
                    <b className="dec-tr">{t.a}</b> <span className="small">{t.dd === null ? "sin tendencia" : (t.dd > 0 ? "+" : t.dd < 0 ? "−" : "") + fmtN(Math.abs(t.dd), 1)}</span>
                    {net !== null && <div className="small muted">en {w.length} periodos: {net > 0 ? "+" : net < 0 ? "−" : ""}{fmtN(Math.abs(net), 1)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: "6px 0 0" }}>Cada valor muestra si alcanza el referencial, queda dentro de ±3 puntos o queda por debajo. Tendencia: cambio frente al periodo anterior y neto en el tramo. Toca un área para abrir su ficha. Valores informados por Robert al 22-10-2026, sin validar.</p>
    </>
  );
}

function SchoolCard({ esc, onOpen }: { esc: string; onOpen: (id: string) => void }) {
  const { board } = useWs();
  void onOpen;
  const items = board.items.filter((i) => i.esc === esc);
  const cnt = DecisionBoard.counts(items);
  const g = dcWorst(items.map((i) => i.c));
  const tot = items.length;
  const conDato = items.filter((i) => i.measured && !(i.ev && i.ev.defPend)).length;
  const worst = DecisionBoard.ranking(items)[0];
  const sinNada = cnt.gris === tot;
  const why = sinNada ? "Sin datos cargados: todo el semáforo está en gris y es riesgo de evidencia. La escuela puede cargar sus valores con su responsable." : worst ? `Lo más crítico: ${worst.cod} ${worst.nombre}. ${worst.motivo}` : "Todos los elementos alcanzan su referencial.";
  const pend = board.model.pts.filter((p) => p.esc === esc && p.vestado !== "Validado").length;
  return (
    <article className="card dec-sc" aria-label={DEC_ESC_NOM[esc]}>
      <div className="dec-sc-h"><h3>{DEC_ESC_NOM[esc]}</h3><DcChip c={g} txt={"Global: " + DC[g].label} /></div>
      <div className="dec-cnt" role="list" aria-label={"Alertas de " + DEC_ESC_NOM[esc]}>
        {DC_ORDER.map((c) => (
          <div key={c} className={`dec-n st-${DC[c].cls}`} role="listitem"><Ic n={DC[c].icon} /><b className="num">{cnt[c]}</b><span>{c === "rojo" ? "rojas" : c === "amarillo" ? "amarillas" : c === "verde" ? "verdes" : "grises"}</span></div>
        ))}
      </div>
      <div className="sbar" aria-hidden="true">
        {DC_ORDER.map((c) => cnt[c] ? <span key={c} className={`seg st-${DC[c].cls}`} style={{ flex: cnt[c] }} title={`${cnt[c]} ${DC[c].label.toLowerCase()}s`}><Ic n={DC[c].icon} />{cnt[c]}</span> : null)}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{conDato} de {tot} elementos con dato · {esc === "TM" ? "el indicador por área cuenta una vez por cada área" : "indicadores del Modelo y 9 procesos"}{pend ? ` · ${pend} valor${pend === 1 ? "" : "es"} sin validar` : ""}</p>
      <p className="why small">{why}</p>
    </article>
  );
}

function Drawer({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const ws = useWs();
  const { board } = ws;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, [id]);
  const m = id.match(/^(\w+)\|ALL\|(ID\d+)$/);
  let o: Item | null;
  if (m) { const leaves = board.byIndLeaf[`${m[1]}|${m[2]}`]; o = { all: true, esc: m[1], cod: m[2], leaves, nombre: board.IND[m[2]].nombre, id }; }
  else o = board.itemById(id);
  if (!o) return null;
  const title = `${o.cod} · ${o.nombre}`;
  const sub = o.all ? `${DEC_ESC_NOM[o.esc]} · programa` : escLabel(o);
  return (
    <>
      <div className="dec-bk" onClick={onClose} />
      <aside className="dec-dr" role="dialog" aria-modal="true" aria-labelledby="dec-dr-t" tabIndex={-1} ref={ref}>
        <header>
          <div>
            <div className="small muted">{sub} · alerta de gestión propuesta, corte {fmtDate(parseISO(board.corte))}</div>
            <h2 id="dec-dr-t">{title}</h2>
          </div>
          <button className="btn" onClick={onClose} aria-label="Cerrar la ficha"><Ic n="i-x" />Cerrar</button>
        </header>
        <div className="dec-dr-b">
          {o.all ? <FichaAll o={o} onOpen={onOpen} /> : o.tipo === "Proceso" ? <FichaProc it={o} onOpen={onOpen} /> : <FichaInd it={o} />}
        </div>
      </aside>
    </>
  );
}

function WhyNoEdit({ esc }: { esc: string }) {
  const { me } = useWs();
  return (
    <p className="dec-box small">
      <Ic n="i-info" /> {me.rol === "responsable" ? `Eres responsable de ${DEC_ESC_NOM[me.escuela ?? ""] ?? "una escuela"}: solo editas esa escuela (esta es ${DEC_ESC_NOM[esc]}).` : "Tu cuenta no está asignada como responsable de ninguna escuela, así que ves los datos sin editarlos."} La administración asigna un responsable por escuela en la vista Equipo.
    </p>
  );
}

function FichaInd({ it }: { it: Item }) {
  const ws = useWs();
  const { board } = ws;
  const d = board.IND[it.cod];
  const ev = it.ev, last = ev.last;
  const can = ws.can.editDecision(it.esc);
  const tm = trendMark(board, it.pts, it.cod);
  const rows = it.pts.slice().reverse();
  const hist = board.input.events.filter((e: any) => e.esc === it.esc && e.ind === it.cod && (e.area || "") === it.area).sort((a: any, b: any) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8);
  return (
    <>
      <div className="dec-kv">
        <div><span className="k">Último valor</span><b className="v num">{last ? board.decFmt(it.cod, last.val) : "—"}</b><span className="s">{last ? decPerLabel(last.per) : "sin dato"}</span></div>
        <div><span className="k">Referencial</span><b className="v num">{board.refTxt(it.cod)}</b><span className="s">Ficha {it.cod} del Modelo</span></div>
        <div><span className="k">Brecha</span><b className="v num">{last ? (it.brecha >= 0 ? "+" : "−") + fmtN(Math.abs(it.brecha), 1) + (d.unidad === "%" ? " pts" : " años") : "—"}</b><span className="s">{last ? (d.menor ? (it.brecha < 0 ? "cumple" : "no cumple") : it.brecha >= 0 ? "sobre el referencial" : "bajo el referencial") : "sin valor"}</span></div>
        <div><span className="k">Tendencia</span><b className="v">{tm.a}</b><span className="s">{tm.txt}</span></div>
      </div>
      <p className="dec-why"><DcChip c={it.c} /> <span>{ev.razon}</span></p>
      {ev.stale && last && <p className="small dec-warn"><Ic n="i-clock" /> Dato desactualizado: lo esperado al corte es {decPerLabel(ev.expected)} y el último valor es de {decPerLabel(last.per)}.</p>}
      <h4 className="dec-h4">Últimos periodos (hasta 4 semestres o años)</h4>
      <TrendChart it={it} />
      {it.pts.length > 0 && (
        <div className="tblw" style={{ marginTop: 8 }}>
          <table className="tbl">
            <thead><tr><th>Periodo</th><th>Valor</th><th>Fuente</th><th>Corte del dato</th><th>Validación</th><th>Origen</th></tr></thead>
            <tbody>
              {rows.map((p: any) => (
                <tr key={p.key}>
                  <td>{decPerLabel(p.per)}</td><td className="num strong">{board.decFmt(it.cod, p.val)}</td><td className="small">{p.fuenteCorta || p.fuente}</td><td className="small">{p.corte || ""}</td>
                  <td>{p.vestado === "Validado" ? <span className="chip st-ok"><Ic n="i-ok" /><span>Validado</span></span> : p.vestado === "Observado" ? <span className="chip st-risk"><Ic n="i-risk" /><span>Observado</span></span> : <span className="chip st-info"><Ic n="i-clock" /><span>Sin validar</span></span>}</td>
                  <td className="small">{p.origen}{p.autor ? " · " + board.who(p.autor) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4 className="dec-h4">Fuente y fecha de corte</h4>
      <dl className="dec-dl">
        <dt>Fuente del último valor</dt><dd>{last ? last.fuente : it.fuente}</dd>
        <dt>Fecha de corte</dt><dd>{last ? last.corte : it.esc === "TM" ? "2026-10-22" : "—"}</dd>
        <dt>Referencial</dt><dd>{board.refTxt(it.cod)} · {DEC_MODELO}, ficha {it.cod}{d.refNota ? ". " + d.refNota : ""}</dd>
        <dt>Frecuencia de cálculo</dt><dd>{d.frec} (campo de la ficha)</dd>
        <dt>Estándares y criterios</dt><dd>{d.est.map((e: string) => e.replace("E", "Estándar ")).join(", ")} · criterios {d.crit.join(", ")}</dd>
        <dt>Procesos del 10.2 vinculados</dt><dd>{it.procesos.length ? it.procesos.map((p: string) => board.procName(p)).join("; ") : "Ninguno vinculado en el proyecto"}</dd>
        <dt>Responsable</dt><dd>{it.resp}</dd>
        <dt>Siguiente acción <span className="exb">PROPUESTA</span></dt><dd>{it.accion}</dd>
      </dl>
      {hist.length > 0 && (<><h4 className="dec-h4">Quién cambió qué y cuándo</h4><ul className="dec-hist">{hist.map((e: any, i: number) => <li key={i}><b>{e.accion}</b> · {board.who(e.by)} · {fmtDateTime(e.ts)}{e.despues && e.despues.val !== undefined ? " · " + board.decFmt(it.cod, e.despues.val) : ""}</li>)}</ul></>)}
      {last && ws.can.validate && <ValidationBox last={last} />}
      {can ? <ValueForm it={it} /> : <WhyNoEdit esc={it.esc} />}
    </>
  );
}

function ValidationBox({ last }: { last: any }) {
  const ws = useWs();
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (estado: "Validado" | "Observado") => {
    setBusy(true);
    try {
      await api("/api/decision/validations", { body: { key: last.key, entryTs: last.ts, estado, nota } });
      ws.toast(estado === "Validado" ? "Valor validado." : "Valor marcado como observado.");
      setNota("");
      await ws.refresh();
    } catch (e) { ws.toast(e instanceof ApiError ? e.message : "No se pudo guardar la validación."); }
    setBusy(false);
  };
  return (
    <div className="dec-box">
      <h4 className="dec-h4" style={{ marginTop: 0 }}>Validación de la oficina</h4>
      <p className="small muted" style={{ margin: "0 0 8px" }}>Estado actual del último valor: <b>{last.vestado}</b>{last.vnota ? " · " + last.vnota : ""}. Si el valor cambia después de validarlo, la validación se pierde.</p>
      <label className="small" htmlFor="dec-vnota">Nota de la validación</label>
      <input type="text" id="dec-vnota" style={{ width: "100%" }} placeholder="Opcional" value={nota} onChange={(e) => setNota(e.target.value)} />
      <div className="dec-actions">
        <button className="btn primary" disabled={busy} onClick={() => send("Validado")}><Ic n="i-ok" />Validar valor</button>
        <button className="btn" disabled={busy} onClick={() => send("Observado")}><Ic n="i-risk" />Observar</button>
      </div>
    </div>
  );
}

function ValueForm({ it }: { it: Item }) {
  const ws = useWs();
  const { board } = ws;
  const d = board.IND[it.cod];
  const opts = board.perOptions(it.cod);
  const exp = board.expectedLast(d.frec);
  const [per, setPer] = useState(exp && opts.includes(exp) ? exp : opts[0]);
  const [val, setVal] = useState("");
  const [corte, setCorte] = useState(board.corte);
  const [fuente, setFuente] = useState("");
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    setErr("");
    try {
      await api("/api/decision/values", { body: { esc: it.esc, area: it.area, ind: it.cod, per, ...body } });
      ws.toast(ok);
      setVal(""); setFuente(""); setNota("");
      await ws.refresh();
    } catch (e) { setErr(e instanceof ApiError ? e.message : "No se pudo guardar."); }
    setBusy(false);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!fuente.trim()) return setErr("La fuente es obligatoria: sin fuente el valor no se guarda.");
    const v = parseFloat(String(val).replace(",", "."));
    if (!isFinite(v)) return setErr("Escribe un valor numérico.");
    if (!corte) return setErr("Indica la fecha de corte del dato.");
    void post({ val: v, fuente: fuente.trim(), corte, nota }, "Valor guardado. Queda sin validar hasta que la oficina lo valide.");
  };
  const anular = () => {
    const cur = board.model.pts.find((p) => p.key === DecisionBoard.keyV(it.esc, it.area, it.cod, per));
    if (!cur) return setErr("No hay un valor cargado en ese periodo.");
    if (!fuente.trim()) return setErr("Escribe en «Fuente» el motivo de la anulación.");
    void post({ val: cur.val, fuente: fuente.trim(), corte: board.corte, nota: "Anulado: " + nota, anulado: true }, "Valor anulado.");
  };
  return (
    <form className="dec-box dec-form" id="dec-form" onSubmit={submit} noValidate>
      <h4 className="dec-h4" style={{ marginTop: 0 }}>Cargar o corregir un valor · {escLabel(it)}</h4>
      <div className="dec-fg">
        <label htmlFor="dec-per">Periodo<select id="dec-per" value={per} onChange={(e) => setPer(e.target.value)}>{opts.map((p) => <option key={p} value={p}>{decPerLabel(p)}</option>)}</select></label>
        <label htmlFor="dec-val">Valor ({d.unidad === "%" ? "%" : "años"})<input type="text" id="dec-val" inputMode="decimal" autoComplete="off" required placeholder="Ejemplo: 72,5" value={val} onChange={(e) => setVal(e.target.value)} /></label>
        <label htmlFor="dec-corte">Fecha de corte del dato<input type="date" id="dec-corte" value={corte} required onChange={(e) => setCorte(e.target.value)} /></label>
      </div>
      <label htmlFor="dec-fuente">Fuente del dato (obligatoria)<textarea id="dec-fuente" required placeholder="Ejemplo: Registro de resultados de consulta dirigida a estudiantes, 2026-I, oficina de calidad" value={fuente} onChange={(e) => setFuente(e.target.value)} /></label>
      <label htmlFor="dec-nota">Nota (opcional)<input type="text" id="dec-nota" style={{ width: "100%" }} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
      <p className="small muted" id="dec-err" role="alert" style={{ margin: "4px 0", color: "var(--bad-t)" }}>{err}</p>
      <div className="dec-actions">
        <button className="btn primary" type="submit" disabled={busy}><Ic n="i-upload" />Guardar valor</button>
        <button className="btn" type="button" disabled={busy} onClick={anular}>Anular el valor de este periodo</button>
      </div>
      <p className="small muted" style={{ margin: "6px 0 0" }}>El valor queda «sin validar» hasta que la oficina lo valide. Todo cambio queda en la bitácora con quién, qué y cuándo.</p>
    </form>
  );
}

function FichaProc({ it, onOpen }: { it: Item; onOpen: (id: string) => void }) {
  const ws = useWs();
  const { board } = ws;
  const can = ws.can.editDecision(it.esc);
  const rec = it.rec;
  const hist = board.input.events.filter((e: any) => e.esc === it.esc && e.proc === it.cod).sort((a: any, b: any) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8);
  const leaves: Item[] = it.leaves || [];
  const [ficha, setFicha] = useState<string>(rec ? rec.ficha : "por confirmar");
  const [dueno, setDueno] = useState<string>(rec ? rec.dueno : "");
  const [fuente, setFuente] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fuente.trim()) return setErr("La fuente es obligatoria: sin fuente el valor no se guarda.");
    setBusy(true); setErr("");
    try {
      await api("/api/decision/processes", { body: { esc: it.esc, proc: it.cod, ficha, dueno: dueno.trim(), fuente: fuente.trim() } });
      ws.toast("Proceso actualizado.");
      setFuente("");
      await ws.refresh();
    } catch (er) { setErr(er instanceof ApiError ? er.message : "No se pudo guardar."); }
    setBusy(false);
  };
  return (
    <>
      <p className="dec-why"><DcChip c={it.c} /> <span>{it.motivo}</span></p>
      <h4 className="dec-h4">Cómo sale el estado del proceso</h4>
      <ul className="dec-comp">
        {it.comps.map((c: any) => (
          <li key={c.n}>
            {c.c ? <span className={`chip st-${DC[c.c as DcCode].cls}`}><Ic n={DC[c.c as DcCode].icon} /><span>{DC[c.c as DcCode].label}</span></span> : <span className="chip st-na"><Ic n="i-na" /><span>No aplica</span></span>}
            <div><b>{c.n}</b><div className="small muted">{c.t}</div></div>
          </li>
        ))}
      </ul>
      <p className="small muted">Regla propuesta: el proceso toma el peor de sus componentes (rojo, amarillo, gris, verde). Sin ficha es rojo; ficha en borrador es amarillo; lo que falta informar queda gris y no se muestra como verde.</p>
      {leaves.length > 0 && (
        <>
          <h4 className="dec-h4">Indicadores vinculados</h4>
          <div className="tblw">
            <table className="tbl">
              <thead><tr><th>Nivel</th><th>Indicador</th><th>Área</th><th>Valor</th></tr></thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="clk" tabIndex={0} role="button" onClick={() => onOpen(l.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l.id); } }}>
                    <td><DcChip c={l.c} txt={DC[l.c as DcCode].label} /></td><td><span className="id">{l.cod}</span> {l.nombre}</td><td>{l.area ? DEC_AREA_CORTO[l.area] : "—"}</td><td className="num">{l.valorTxt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <h4 className="dec-h4">Fuente y responsable</h4>
      <dl className="dec-dl">
        <dt>Fuente del estado</dt><dd>{it.fuente || "Sin dato de la escuela"}</dd>
        <dt>Fecha</dt><dd>{it.corte || "—"}</dd>
        <dt>Dueño o responsable</dt><dd>{it.resp}</dd>
        <dt>Siguiente acción <span className="exb">PROPUESTA</span></dt><dd>{it.accion}</dd>
        <dt>Estándar</dt><dd>Estándar 10, criterio 10.2: el SGC cubre como mínimo los nueve procesos del Modelo</dd>
      </dl>
      {hist.length > 0 && (<><h4 className="dec-h4">Quién cambió qué y cuándo</h4><ul className="dec-hist">{hist.map((e: any, i: number) => <li key={i}><b>{e.accion}</b> · {board.who(e.by)} · {fmtDateTime(e.ts)}</li>)}</ul></>)}
      {can ? (
        <form className="dec-box dec-form" id="dec-form" onSubmit={submit} noValidate>
          <h4 className="dec-h4" style={{ marginTop: 0 }}>Actualizar el proceso · {DEC_ESC_NOM[it.esc]}</h4>
          <div className="dec-fg">
            <label htmlFor="dec-ficha">Estado de la ficha<select id="dec-ficha" value={ficha} onChange={(e) => setFicha(e.target.value)}>{Object.keys(DEC_FICHA_TXT).map((k) => <option key={k} value={k}>{DEC_FICHA_TXT[k]}</option>)}</select></label>
            <label htmlFor="dec-dueno">Dueño designado<input type="text" id="dec-dueno" value={dueno} placeholder="Nombre y cargo" onChange={(e) => setDueno(e.target.value)} /></label>
          </div>
          <label htmlFor="dec-fuente">Fuente (resolución, acta o documento)<textarea id="dec-fuente" required placeholder="Ejemplo: Resolución del Comité de Calidad N.º …" value={fuente} onChange={(e) => setFuente(e.target.value)} /></label>
          <p className="small muted" role="alert" style={{ margin: "4px 0", color: "var(--bad-t)" }}>{err}</p>
          <div className="dec-actions"><button className="btn primary" type="submit" disabled={busy}><Ic n="i-upload" />Guardar</button></div>
        </form>
      ) : <WhyNoEdit esc={it.esc} />}
    </>
  );
}

function FichaAll({ o, onOpen }: { o: Item; onOpen: (id: string) => void }) {
  const { board } = useWs();
  return (
    <>
      <p className="small muted">Indicador medido por área. Elige un área para ver su tendencia y cargar valores.</p>
      <AreaHistory o={o} onOpen={onOpen} />
      <h4 className="dec-h4">Estado actual por área</h4>
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Área</th><th>Nivel</th><th>Último valor</th><th>Motivo</th></tr></thead>
          <tbody>
            {o.leaves.map((l: Item) => (
              <tr key={l.id} className="clk" tabIndex={0} role="button" onClick={() => onOpen(l.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l.id); } }}>
                <td>{DEC_AREA_CORTO[l.area]}</td><td><DcChip c={l.c} txt={DC[l.c as DcCode].label} /></td><td className="num">{l.valorTxt}</td><td className="small">{l.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="dec-dl" style={{ marginTop: 10 }}>
        <dt>Referencial</dt><dd>{board.refTxt(o.cod)} · ficha {o.cod} del Modelo</dd>
        <dt>Valor del programa</dt><dd>No se calcula: el promedio de porcentajes por área no equivale al indicador del programa sin el número de docentes de cada área. Se muestra el peor de los cuatro.</dd>
      </dl>
    </>
  );
}

function MapProc({ escs, sel, onOpen }: { escs: string[]; sel: string | null; onOpen: (id: string) => void }) {
  const { board, engine } = useWs();
  return (
    <div className="tblw" style={{ padding: 6 }}>
      <table className="heat" aria-label="Mapa de calor: procesos del criterio 10.2 por escuela">
        <thead><tr><th scope="col">Proceso del criterio 10.2</th>{escs.map((e) => <th key={e} scope="col" className="c">{DEC_ESC_NOM[e]}</th>)}</tr></thead>
        <tbody>
          {engine.M.procesos102.map((p) => (
            <tr key={p.id}>
              <th scope="row" className="rowlab">{"P" + p.n + " " + p.nombre}</th>
              {escs.map((e) => { const it = board.byProc[`${e}|${p.id}`]; return <td key={e}><Cell it={it} txt={it.valorTxt} sub={it.motivo.split(";")[0].replace(/\.$/, "")} pressed={sel === it.id} onOpen={onOpen} /></td>; })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MapInd({ escs, sel, onOpen }: { escs: string[]; sel: string | null; onOpen: (id: string) => void }) {
  const { board } = useWs();
  const cols: { e: string; area: string; lab: string; area_?: boolean }[] = [];
  escs.forEach((e) => { cols.push({ e, area: "", lab: DEC_ESC_NOM[e] + (e === "TM" ? " · programa" : "") }); if (e === "TM") DEC_AREAS.forEach((a) => cols.push({ e, area: a, lab: DEC_AREA_CORTO[a], area_: true })); });
  return (
    <div className="tblw" style={{ padding: 6 }}>
      <table className="heat dec-heat2" aria-label="Mapa de calor: indicadores por escuela y por área de Tecnología Médica">
        <thead><tr><th scope="col">Indicador</th>{cols.map((c) => <th key={c.e + c.area} scope="col" className="c">{c.lab}</th>)}</tr></thead>
        <tbody>
          {board.IDS.map((id) => (
            <tr key={id}>
              <th scope="row" className="rowlab"><span className="id">{id}</span> {board.IND[id].nombre.replace(/^Porcentaje de /, "% de ").replace(/^Evolución del porcentaje de /, "Evolución % de ")}<small>{board.IND[id].frec} · {board.refTxt(id)}</small></th>
              {cols.map((col) => {
                const k = col.e + col.area;
                if (col.area_) {
                  if (!board.porArea(board.model, "TM", id)) return <td key={k}><div className="hc st-na dec-na" title="Este indicador se mide para el programa, no por área" aria-hidden="true" /></td>;
                  const it = board.byIndLeaf[`TM|${id}`].find((x) => x.area === col.area);
                  const tm = trendMark(board, it.pts, id);
                  const lastv = it.ev && it.ev.last && !it.ev.vacio;
                  return <td key={k}><Cell it={it} pressed={sel === it.id} txt={lastv ? board.decFmt(id, it.ev.last.val) + (tm.dd === null ? "" : " " + tm.a) : undefined} onOpen={onOpen} /></td>;
                }
                const leaves = board.byIndLeaf[`${col.e}|${id}`];
                if (leaves.length > 1) {
                  const w = dcWorst(leaves.map((l: Item) => l.c));
                  const hasData = leaves.some((l: Item) => !l.ev.vacio);
                  const l1 = w === "gris" ? (hasData ? "Por confirmar" : "Sin dato") : DC[w].short;
                  return (
                    <td key={k}>
                      <button className={`hc dec-hc st-${DC[w].cls}`} onClick={() => onOpen(`${col.e}|ALL|${id}`)} aria-label={`${id} ${DEC_ESC_NOM[col.e]} programa: peor área, ${DC[w].label}`}>
                        <span className="l1"><Ic n={DC[w].icon} />{l1}</span><span className="l2">peor de las 4 áreas</span>
                      </button>
                    </td>
                  );
                }
                return <td key={k}><Cell it={leaves[0]} pressed={sel === leaves[0].id} onOpen={onOpen} /></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Decision() {
  const ws = useWs();
  const { board, engine } = ws;
  const M = engine.M;
  const [sel, setSel] = useState<string | null>(null);
  const [f, setF] = useState({ est: "", proc: "", nivel: "", tipo: "", q: "" });
  const escs = (DEC_ESC as string[]).includes(ws.escuela) ? [ws.escuela] : DEC_ESC;
  const scoped = useMemo(() => board.items.filter((i) => escs.includes(i.esc)), [board, escs.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const cnt = DecisionBoard.counts(scoped);
  const rank = DecisionBoard.ranking(scoped);
  const pend = board.model.pts.filter((p) => escs.includes(p.esc) && p.vestado !== "Validado").length;
  const q = noAcc(f.q);
  const list = scoped.filter((i) => (!f.est || i.estandares.includes(f.est)) && (!f.proc || i.procesos.includes(f.proc)) && (!f.nivel || i.c === f.nivel) && (!f.tipo || i.tipo === f.tipo) && (!q || noAcc(i.cod + " " + i.nombre + " " + i.motivo).includes(q)));
  const sorted = list.slice().sort((a, b) => DC[b.c as DcCode].rank - DC[a.c as DcCode].rank || DEC_ESC.indexOf(a.esc) - DEC_ESC.indexOf(b.esc) || natKey(a.cod).localeCompare(natKey(b.cod)) || a.area.localeCompare(b.area));
  const shown = sorted.slice(0, 120);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSel(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sel]);

  const open = (id: string) => setSel(id);
  const Row = ({ it, k }: { it: Item; k: number }) => (
    <tr className="clk" tabIndex={0} role="button" aria-label={`Abrir ${it.cod}`} onClick={() => open(it.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(it.id); } }}>
      <td className="num strong">{k + 1}</td><td><DcChip c={it.c} txt={DC[it.c as DcCode].label} /></td>
      <td><span className="id">{it.cod}</span> {it.nombre}<div className="small muted">{escLabel(it)} · {it.tipo}</div></td>
      <td>{it.motivo}</td><td>{it.resp}</td><td>{it.accion} <span className="exb" title="Propuesta del tablero, no una decisión oficial">PROPUESTA</span></td>
    </tr>
  );

  return (
    <div id="dec-root">
      <PageHead title="¿Qué proceso o indicador está en riesgo?">
        Alerta de gestión para las escuelas de Tecnología Médica, Enfermería y Obstetricia, con corte al {fmtDate(parseISO(board.corte))}. Fuente de referenciales: {DEC_MODELO}.
      </PageHead>
      <Banner>
        <b>Semáforo propuesto, no valoración oficial.</b> Aplica la sección 9.1 del Modelo: verde si alcanza el referencial; amarillo si queda dentro de ±3 puntos o mejora respecto al año anterior; rojo si no; gris si no hay dato (riesgo de evidencia, nunca verde). La escala oficial No logrado, Logrado y Logrado plenamente se aplica a los estándares, no a los indicadores. Esta vista no usa datos EJEMPLO.{ws.escuela === "FAC" ? " Facultad no entra en esta vista: se muestran las tres escuelas." : ""}
      </Banner>
      <details className="alg">
        <summary><b>Reglas y supuestos</b><span className="small muted">qué hace el semáforo y qué quedó por confirmar</span></summary>
        <div className="dec-sup">
          <ul>
            <li><b>Indicadores:</b> se evalúa el último periodo con dato. «Año anterior» es el mismo semestre del año previo (o el año previo, si es anual). El margen de ±3 puntos solo se aplica a porcentajes; en ID25 e ID26 (años) no hay margen y cumple si el valor es menor al referencial, como dice la ficha.</li>
            <li><b>Gris:</b> sin dato, sin medir, sin calcular o definición por confirmar. En la EPTM, ID10 queda en gris porque el dato informado (asignaturas con ≥80 % de aprobados) no es la medida de la ficha (estudiantes aprobados por asignatura).</li>
            <li><b>Procesos:</b> el estado sale de la ficha (sin ficha, borrador, aprobada), del dueño designado y de los indicadores vinculados con dato. Toma el peor de los tres. El vínculo proceso-indicador es del proyecto, no del Modelo.</li>
            <li><b>Semáforo global de la escuela:</b> el peor nivel entre sus elementos (rojo, amarillo, gris, verde). Criterio conservador, por confirmar.</li>
            <li><b>ID4:</b> referencial de 70 % por decisión de Robert (22-10-2026). La ficha del Modelo dice 60 % en el campo REFERENCIAL (línea 2357) y 70 % en la interpretación (línea 2358).</li>
            <li><b>Inconsistencias del Modelo que no se resuelven aquí:</b> ID29 figura en el criterio 8.5 y en el Estándar 6; las etiquetas EV40 a EV44 están desordenadas en el texto; la numeración EV49 a EV52 está por confirmar con la OCAA.</li>
            <li><b>Valores sin validar:</b> cuentan en el semáforo y se marcan «sin validar» hasta que la oficina los valide. El interruptor de abajo permite ver solo los validados.</li>
          </ul>
        </div>
      </details>
      <div className="filters">
        <label className="sw" htmlFor="dec-solo">
          <input type="checkbox" id="dec-solo" checked={ws.soloVal} onChange={(e) => ws.setSoloVal(e.target.checked)} />
          <span className="tr" aria-hidden="true" />
          <span>Contar solo valores validados por la oficina ({pend} sin validar)</span>
        </label>
        <span className="grow" />
        <ExportMenu />
      </div>

      <Sect title="Panel resumen" icon="i-home" />
      <div className="dec-tot" role="list" aria-label="Alertas del conjunto visible">
        {DC_ORDER.map((c) => (
          <div key={c} className={`dec-n st-${DC[c].cls}`} role="listitem"><Ic n={DC[c].icon} /><b className="num">{cnt[c]}</b><span>{c === "rojo" ? "alertas rojas" : c === "amarillo" ? "amarillas" : c === "verde" ? "verdes" : "grises (riesgo de evidencia)"}</span></div>
        ))}
      </div>
      <div className="grid g3 dec-sc-g">{escs.map((e) => <SchoolCard key={e} esc={e} onOpen={open} />)}</div>

      <Sect title="Los 10 elementos más críticos" icon="i-bell" />
      {rank.length ? (
        <>
          <div className="tblw">
            <table className="tbl dec-tbl">
              <thead><tr><th>#</th><th>Nivel</th><th>Elemento</th><th>Motivo</th><th>Responsable</th><th>Siguiente acción</th></tr></thead>
              <tbody>{rank.slice(0, 10).map((it, k) => <Row key={it.id} it={it} k={k} />)}</tbody>
            </table>
          </div>
          <p className="small muted">Orden: rojo, amarillo y gris; dentro de cada nivel, primero lo que tiene dato y la mayor brecha. Responsable y siguiente acción son propuestas; el responsable sale de las fichas del SGC y está por confirmar.</p>
        </>
      ) : <div className="empty">No hay elementos en alerta.</div>}

      <Sect title="Mapa de calor: procesos por escuela" icon="i-flow" />
      <MapProc escs={escs} sel={sel} onOpen={open} />
      <Sect title="Mapa de calor: indicadores por escuela y por área" icon="i-grid" />
      <p className="small muted">Los indicadores ID10 e ID19 de Tecnología Médica se miden por área; el resto, para el programa. Toca una celda para abrir su ficha.</p>
      <MapInd escs={escs} sel={sel} onOpen={open} />

      <Sect title="Alertas" icon="i-bell" />
      <div className="filters">
        <label htmlFor="dec-fn">Nivel<select id="dec-fn" value={f.nivel} onChange={(e) => setF({ ...f, nivel: e.target.value })}><option value="">Todos</option>{DC_ORDER.map((c) => <option key={c} value={c}>{DC[c].label}</option>)}</select></label>
        <label htmlFor="dec-ft">Tipo<select id="dec-ft" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">Indicadores y procesos</option><option value="Indicador">Indicadores</option><option value="Proceso">Procesos</option></select></label>
        <label htmlFor="dec-fe">Estándar<select id="dec-fe" value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })}><option value="">Todos</option>{M.estandares.map((e) => <option key={e.id} value={e.id}>{e.id.replace("E", "Estándar ") + " · " + e.nombre}</option>)}</select></label>
        <label htmlFor="dec-fp">Proceso<select id="dec-fp" value={f.proc} onChange={(e) => setF({ ...f, proc: e.target.value })}><option value="">Todos</option>{M.procesos102.map((p) => <option key={p.id} value={p.id}>{"P" + p.n + " " + p.nombre}</option>)}</select></label>
        <label htmlFor="dec-fq">Buscar<input type="text" id="dec-fq" value={f.q} placeholder="ID o palabra" onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
        <span className="small muted">La escuela se elige arriba.</span>
      </div>
      <p className="small" id="dec-count">{list.length} alerta{list.length === 1 ? "" : "s"} con los filtros actuales</p>
      {!list.length ? <div className="empty">Ninguna alerta coincide con los filtros.</div> : (
        <>
          <div className="tblw" style={{ maxHeight: 540 }}>
            <table className="tbl dec-tbl">
              <thead><tr><th>Nivel</th><th>Escuela</th><th>Elemento</th><th>Motivo</th><th>Valor</th><th>Referencial</th><th>Fuente y corte</th></tr></thead>
              <tbody>
                {shown.map((i) => (
                  <tr key={i.id} className="clk" tabIndex={0} role="button" aria-label={`Abrir ${i.cod} ${escLabel(i)}`} onClick={() => open(i.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i.id); } }}>
                    <td><DcChip c={i.c} txt={DC[i.c as DcCode].label} /></td><td>{escLabel(i)}</td><td><span className="id">{i.cod}</span> {i.nombre}</td><td>{i.motivo}</td><td className="num">{i.valorTxt}</td><td className="num">{i.refTxt}</td>
                    <td className="small">{i.fuenteCorta || i.fuente}{i.corte ? " · corte " + i.corte : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length > shown.length && <p className="small muted">Se muestran las {shown.length} primeras de {sorted.length} alertas; afina los filtros o exporta la lista completa.</p>}
        </>
      )}

      <Sect title="Equipo y bitácora" icon="i-link" />
      <TeamPanel />
      {sel && <Drawer id={sel} onClose={() => setSel(null)} onOpen={open} />}
    </div>
  );
}

function ExportMenu() {
  const ws = useWs();
  const ref = useRef<HTMLDetailsElement>(null);
  const go = async (what: string, fmt: "csv" | "xlsx") => { await exportDecision(ws, what, fmt); if (ref.current) ref.current.open = false; };
  return (
    <details className="menu" ref={ref}>
      <summary className="btn"><Ic n="i-download" />Exportar</summary>
      <div className="menu-p" role="menu">
        <button role="menuitem" onClick={() => go("todo", "xlsx")}>Excel completo (alertas, valores, procesos, bitácora)</button>
        <button role="menuitem" onClick={() => go("alertas", "csv")}>CSV · Alertas</button>
        <button role="menuitem" onClick={() => go("valores", "csv")}>CSV · Valores con fuente y corte</button>
        <button role="menuitem" onClick={() => go("procesos", "csv")}>CSV · Procesos</button>
        <button role="menuitem" onClick={() => go("bitacora", "csv")}>CSV · Bitácora</button>
      </div>
    </details>
  );
}

const ROL_TXT: Record<string, string> = { admin: "Administración", oficina: "Oficina de Calidad", responsable: "Responsable de escuela", lectura: "Solo lectura" };

function TeamPanel() {
  const ws = useWs();
  const { board, server } = ws;
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<{ id: string; nombre: string; rol: string; escuela: string | null }[]>([]);
  useEffect(() => { if (open) api("/api/team").then(setTeam).catch(() => {}); }, [open, server.serverTime]);
  const evs = board.input.events.slice().sort((a: any, b: any) => String(b.ts).localeCompare(String(a.ts)));
  const oficina = team.filter((p) => p.rol === "oficina" || p.rol === "admin");
  return (
    <details className="alg" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary><b>Equipo, permisos y bitácora</b><span className="small muted">tu rol: {ROL_TXT[ws.me.rol]}</span></summary>
      <div className="dec-eq">
        <p className="small">Un responsable por escuela puede cargar y corregir lo suyo; las demás personas solo ven. La oficina valida los valores antes del corte. Cada cambio queda en la bitácora con quién, qué y cuándo (hora del servidor).</p>
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>Escuela</th><th>Responsable con permiso de edición</th></tr></thead>
            <tbody>
              {DEC_ESC.map((e) => { const u = team.find((p) => p.rol === "responsable" && p.escuela === e); return <tr key={e}><td>{DEC_ESC_NOM[e]}</td><td>{u ? u.nombre : <span className="muted">Sin responsable asignado</span>}</td></tr>; })}
            </tbody>
          </table>
        </div>
        <p className="small" style={{ margin: "8px 0 0" }}><b>Oficina de Calidad y administración (validan):</b> {oficina.length ? oficina.map((p) => p.nombre).join(", ") : <span className="muted">sin personas asignadas</span>}</p>
        {ws.can.manageTeam && <p className="small">Para agregar o cambiar personas, usa la vista <LinkBtn onClick={() => ws.go("equipo")}>Equipo</LinkBtn>.</p>}
        <h4 className="dec-h4">Bitácora (últimos 25 movimientos)</h4>
        <div className="tblw" style={{ maxHeight: 320 }}>
          <table className="tbl">
            <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Elemento</th><th>Antes → después</th></tr></thead>
            <tbody>
              {evs.slice(0, 25).map((e: any, i: number) => (
                <tr key={i}>
                  <td className="num small">{fmtDateTime(e.ts)}</td><td>{board.who(e.by)}</td><td>{e.accion}</td><td className="small">{e.clave || ""}</td>
                  <td className="small">{e.antes ? JSON.stringify(e.antes) : ""}{e.antes && e.despues ? " → " : ""}{e.despues ? JSON.stringify(e.despues) : ""}</td>
                </tr>
              ))}
              <tr><td className="num small">2026-10-22</td><td>Carga inicial</td><td>Carga inicial</td><td className="small">EPTM</td><td className="small">ID6, ID10, ID13, ID14, ID19 y estado de los 9 procesos, informados por Robert</td></tr>
            </tbody>
          </table>
        </div>
        <div className="dec-actions" style={{ marginTop: 8 }}><button className="btn" onClick={() => exportDecision(ws, "bitacora", "csv")}><Ic n="i-download" />Bitácora en CSV</button></div>
      </div>
    </details>
  );
}

// evita que se considere sin usar el tipo ReactNode/Fragment en compilaciones estrictas
export type _Unused = ReactNode | typeof Fragment;
