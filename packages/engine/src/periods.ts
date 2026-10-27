import { MESES, addDays, dUTC, pad2 } from "./util";

export interface PeriodInfo {
  p: string;
  y: number;
  tipo: "A" | "S" | "T" | "M";
  start: Date;
  end: Date;
  label: string;
}

export function periodInfo(p: unknown): PeriodInfo | null {
  const s = String(p ?? "").trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})$/))) {
    const y = +m[1];
    return { p: s, y, tipo: "A", start: dUTC(y, 1, 1), end: dUTC(y, 12, 31), label: `Año ${y}` };
  }
  if ((m = s.match(/^(\d{4})-S([12])$/))) {
    const y = +m[1], k = +m[2];
    return { p: s, y, tipo: "S", start: k === 1 ? dUTC(y, 1, 1) : dUTC(y, 7, 1), end: k === 1 ? dUTC(y, 6, 30) : dUTC(y, 12, 31), label: `${y} · semestre ${k}` };
  }
  if ((m = s.match(/^(\d{4})-T([1-4])$/))) {
    const y = +m[1], q = +m[2];
    return { p: s, y, tipo: "T", start: dUTC(y, q * 3 - 2, 1), end: new Date(Date.UTC(y, q * 3, 0)), label: `${y} · trimestre ${q}` };
  }
  if ((m = s.match(/^(\d{4})-(0[1-9]|1[0-2])$/))) {
    const y = +m[1], mo = +m[2];
    return { p: s, y, tipo: "M", start: dUTC(y, mo, 1), end: new Date(Date.UTC(y, mo, 0)), label: `${MESES[mo - 1]}-${y}` };
  }
  return null;
}

export const FREQ_MONTHS: Record<string, number> = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 };

/** Último periodo cuyo cierre más la gracia ya pasó a la fecha de corte, según la periodicidad. */
export function expectedEnd(freq: string, corte: Date, gracia: number): Date | null {
  const mths = FREQ_MONTHS[freq] || 12;
  const y = corte.getUTCFullYear();
  const ends: Date[] = [];
  for (let yy = y - 2; yy <= y; yy++) {
    for (let mo = mths; mo <= 12; mo += mths) ends.push(new Date(Date.UTC(yy, mo, 0)));
  }
  const ok = ends.filter((e) => addDays(e, gracia) <= corte);
  return ok.length ? ok[ok.length - 1] : null;
}

export function periodLabelFromEnd(freq: string, end: Date | null): string {
  if (!end) return "—";
  const y = end.getUTCFullYear(), mo = end.getUTCMonth() + 1;
  if (freq === "Anual") return String(y);
  if (freq === "Semestral") return `${y}-S${mo <= 6 ? 1 : 2}`;
  if (freq === "Trimestral") return `${y}-T${Math.ceil(mo / 3)}`;
  return `${y}-${pad2(mo)}`;
}

/** Fin del primer periodo de esa periodicidad posterior a una fecha. */
export function nextEndAfter(freq: string, d: Date): Date | null {
  const mths = FREQ_MONTHS[freq] || 12;
  for (let yy = d.getUTCFullYear(); yy <= d.getUTCFullYear() + 2; yy++)
    for (let mo = mths; mo <= 12; mo += mths) {
      const e = new Date(Date.UTC(yy, mo, 0));
      if (e > d) return e;
    }
  return null;
}
