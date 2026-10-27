"use client";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DC, SEV, ST, fmtN, type DcCode, type StateCode } from "@sgc/engine";
import { Ic } from "./Icon";

/* ---------- chips de estado ---------- */
export function StateChip({ code, children }: { code: StateCode; children?: ReactNode }) {
  const s = ST[code];
  return (
    <span className={`chip st-${s.cls}`} title={s.label + (s.sub ? " · " + s.sub : "")}>
      <Ic n={s.icon} />
      <span>{s.label}</span>
      {children}
    </span>
  );
}
export function OverdueChip() {
  return (
    <span className="chip st-risk" title="El último dato es anterior al periodo esperado según la periodicidad">
      <Ic n="i-clock" />
      <span>Vencido</span>
    </span>
  );
}
export function SevChip({ sev }: { sev: string }) {
  const v = SEV[sev] || SEV.Aviso;
  return (
    <span className={`chip st-${v.cls}`}>
      <Ic n={v.icon} />
      <span>{sev}</span>
    </span>
  );
}
export function DcChip({ c, txt }: { c: DcCode; txt?: string }) {
  return (
    <span className={`chip st-${DC[c].cls}`}>
      <Ic n={DC[c].icon} />
      <span>{txt ?? DC[c].label + " · " + DC[c].short}</span>
    </span>
  );
}
export const ExBadge = () => <span className="exb">EJEMPLO</span>;

/* ---------- estructura de página ---------- */
export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="ph">
      <h1>{title}</h1>
      <div className="gl" />
      <p>{children}</p>
    </div>
  );
}
export function Sect({ title, icon = "i-diamond" }: { title: string; icon?: string }) {
  return (
    <div className="sect">
      <Ic n={icon} />
      <h2>{title}</h2>
    </div>
  );
}
export const Note = ({ children }: { children: ReactNode }) => <p className="note">{children}</p>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
export function Banner({ children, ex = false, icon = "i-info" }: { children: ReactNode; ex?: boolean; icon?: string }) {
  return (
    <div className={"banner" + (ex ? " ex" : "")} role="note">
      <Ic n={icon} />
      <div>{children}</div>
    </div>
  );
}
export function LinkBtn({ onClick, children, style, className = "" }: { onClick: () => void; children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <button type="button" className={"linkbtn " + className} style={style} onClick={onClick}>
      {children}
    </button>
  );
}

/* ---------- barra apilada de estados ---------- */
export function StateBar({ counts, total }: { counts: Record<string, number>; total?: number }) {
  const order: StateCode[] = ["CRIT", "RIESGO", "BAJO", "SD", "SEG", "OK", "DEF"];
  const present = order.filter((k) => counts[k]);
  void total;
  return (
    <>
      <div className="sbar" role="img" aria-label={present.map((k) => ST[k].label + " " + counts[k]).join(", ")}>
        {present.length ? (
          present.map((k) => (
            <span key={k} className={`seg st-${ST[k].cls}`} style={{ flex: counts[k] }} title={`${ST[k].label}: ${counts[k]}`}>
              <Ic n={ST[k].icon} />
              <b>{counts[k]}</b>
            </span>
          ))
        ) : (
          <span className="seg st-def" style={{ flex: 1 }}>Sin indicadores</span>
        )}
      </div>
      <div className="sbar-lg">
        {present.map((k) => (
          <span key={k} className="lgs">
            <Ic n={ST[k].icon} />
            {ST[k].label} {counts[k]}
          </span>
        ))}
      </div>
    </>
  );
}

/* ---------- mini-serie ---------- */
export function Spark({ ev, w = 90, h = 26 }: { ev: { valor: number }[]; w?: number; h?: number }) {
  if (!ev || ev.length < 1) return null;
  const vs = ev.map((e) => e.valor);
  const mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn || 1;
  const X = (i: number) => 3 + (w - 6) * (ev.length === 1 ? 0.5 : i / (ev.length - 1));
  const Y = (v: number) => h - 4 - ((h - 8) * (v - mn)) / r;
  const d = ev.map((e, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(e.valor).toFixed(1)).join("");
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Serie de ${ev.length} periodos, último ${fmtN(vs[vs.length - 1])}`}>
      <path d={d} className="ln s2" fill="none" />
      <circle cx={X(ev.length - 1).toFixed(1)} cy={Y(vs[vs.length - 1]).toFixed(1)} r={3} className="mk s2" />
    </svg>
  );
}

/* ---------- información emergente de los gráficos ---------- */
interface TipCtx { show(content: ReactNode, x: number, y: number): void; hide(): void }
const TipContext = createContext<TipCtx | null>(null);

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ content: ReactNode; x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const api = useMemo<TipCtx>(() => ({ show: (content, x, y) => setTip({ content, x, y }), hide: () => setTip(null) }), []);
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let l = tip.x + 14, t = tip.y + 14;
    if (l + r.width > window.innerWidth - 8) l = tip.x - r.width - 14;
    if (t + r.height > window.innerHeight - 8) t = tip.y - r.height - 14;
    setPos({ left: Math.max(8, l), top: Math.max(8, t) });
  }, [tip]);
  return (
    <TipContext.Provider value={api}>
      {children}
      {tip && (
        <div className="tip" role="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }}>
          {tip.content}
        </div>
      )}
    </TipContext.Provider>
  );
}

/** Eventos para mostrar una información emergente al pasar el ratón o al enfocar con el teclado. */
export function useTip() {
  const t = useContext(TipContext)!;
  return useCallback(
    (content: () => ReactNode) => ({
      onMouseMove: (e: React.MouseEvent) => t.show(content(), e.clientX, e.clientY),
      onMouseLeave: () => t.hide(),
      onFocus: (e: React.FocusEvent<Element>) => { const r = (e.currentTarget as Element).getBoundingClientRect(); t.show(content(), r.left + r.width / 2, r.top + r.height / 2); },
      onBlur: () => t.hide(),
    }),
    [t],
  );
}
