/** Utilidades de formato y fechas (UTC), iguales a las del tablero v0.9. */
export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const pad2 = (n: number): string => String(n).padStart(2, "0");
export const isoD = (d: Date): string => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
export const dUTC = (y: number, m: number, d: number): Date => new Date(Date.UTC(y, m - 1, d));
export const parseISO = (s: unknown): Date | null => {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? dUTC(+m[1], +m[2], +m[3]) : null;
};
export const fmtDate = (d: Date | null | undefined): string =>
  d ? `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}` : "—";
export const fmtMonth = (d: Date | null | undefined): string => (d ? `${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()}` : "—");
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 864e5);
export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
};
export const fmtN = (v: number | null | undefined, dec = 1): string =>
  v === null || v === undefined || !isFinite(v) ? "—" : (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(dec)).replace(".", ",");
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export const uniq = <T>(a: T[]): T[] => Array.from(new Set(a));
export const noAcc = (t: unknown): string =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const natKey = (id: unknown): string => String(id || "").replace(/\d+/g, (m) => m.padStart(4, "0"));
export const round2 = (v: number | null | undefined): number | "" => (v === null || v === undefined ? "" : Math.round(v * 100) / 100);
