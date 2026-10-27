/** Escritura de los libros de exportación del tablero (mismas hojas y columnas que la v0.9). */
import * as XLSX from "xlsx";
import {
  DEC_BASE_FUENTE, DEC_MODELO, EXP_SCHEMA, EXPORT_KINDS, SHEET_NAMES, exportMeta, exportRows, exportSuffix, fmtDate, parseISO, paramsSheets, toCSV, validateRows,
  type DecisionBoard, type Engine, type ExportKind, type Row,
} from "@sgc/engine";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const CSV_MIME = "text/csv;charset=utf-8";

export class ExportError extends Error {
  constructor(message: string, readonly problemas: string[] = []) { super(message); }
}

/** Hoja con una celda explícita en cada columna de cada fila (sin celdas omitidas). */
function sheetFrom(what: ExportKind, rows: Row[]): XLSX.WorkSheet {
  const sch = EXP_SCHEMA[what];
  const cols = Object.keys(sch);
  const aoa = [cols as (string | number)[]].concat(rows.map((r) => cols.map((c) => r[c])));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let i = 1; i < aoa.length; i++)
    cols.forEach((c, j) => {
      const ref = XLSX.utils.encode_cell({ r: i, c: j });
      const cell: XLSX.CellObject = ws[ref] || (ws[ref] = { t: "s", v: "" });
      if (sch[c] !== "n") { cell.t = "s"; cell.v = String(aoa[i][j]); delete cell.w; }
    });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(aoa.length - 1, 1), c: cols.length - 1 } });
  ws["!cols"] = cols.map((c) => ({ wch: Math.min(60, Math.max(c.length + 2, 14)) }));
  ws["!autofilter"] = { ref: ws["!ref"] };
  return ws;
}

/** Filas validadas de las hojas pedidas; si alguna columna o tipo está mal, se detiene la exportación. */
export function validatedSets(E: Engine, what: ExportKind | "todo") {
  const list: ExportKind[] = what === "todo" ? [...EXPORT_KINDS] : [what];
  const data = {} as Record<ExportKind, Row[]>;
  const errs: string[] = [];
  list.forEach((k) => { data[k] = exportRows(E, k); errs.push(...validateRows(k, data[k])); });
  if (errs.length) throw new ExportError(`Exportación detenida: ${errs.length} problema(s) de columnas o tipos de dato. Primero: ${errs[0]}`, errs);
  return { list, data };
}

export function exportCsv(E: Engine, what: ExportKind, generado: Date) {
  const { data } = validatedSets(E, what);
  const rows = data[what];
  if (!rows.length) throw new ExportError("No hay filas para exportar.");
  return { filename: `SGC_${what}${exportSuffix(E, generado)}.csv`, mime: CSV_MIME, body: Buffer.from(toCSV(rows, what), "utf8"), filas: rows.length };
}

export function exportXlsx(E: Engine, what: ExportKind | "todo", generado: Date) {
  const { list, data } = validatedSets(E, what);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exportMeta(E, generado)), "Leeme");
  list.forEach((k) => XLSX.utils.book_append_sheet(wb, sheetFrom(k, data[k]), SHEET_NAMES[k]));
  wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ name: n })) };
  const body = XLSX.write(wb, { type: "buffer", bookType: "xlsx", bookSST: true }) as Buffer;
  return { filename: `SGC_${what === "todo" ? "tablero" : what}${exportSuffix(E, generado)}.xlsx`, mime: XLSX_MIME, body };
}

export function exportParamsXlsx(E: Engine, generado: Date) {
  const sheets = paramsSheets(E);
  const wb = XLSX.utils.book_new();
  (Object.keys(sheets) as (keyof typeof sheets)[]).forEach((n) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheets[n]), n));
  const body = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { filename: `SGC_Parametros_${generado.toISOString().slice(0, 10)}.xlsx`, mime: XLSX_MIME, body };
}

export type DecisionKind = "alertas" | "valores" | "procesos" | "bitacora";
export const DECISION_KINDS: DecisionKind[] = ["alertas", "valores", "procesos", "bitacora"];

function csvOf(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const cols = Object.keys(rows[0]);
  return "﻿" + [cols.map(cell).join(",")].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(","))).join("\r\n");
}

export function decisionRows(board: DecisionBoard, items: any[], what: DecisionKind) {
  return { alertas: () => board.rowsAlertas(items), valores: () => board.rowsValores(), procesos: () => board.rowsProcesos(items), bitacora: () => board.rowsBitacora() }[what]();
}

export function exportDecisionCsv(board: DecisionBoard, items: any[], what: DecisionKind) {
  const rows = decisionRows(board, items, what);
  if (!rows.length) throw new ExportError("No hay filas para exportar.");
  return { filename: `SGC_decision_${board.corte}_${what}.csv`, mime: CSV_MIME, body: Buffer.from(csvOf(rows), "utf8") };
}

export function exportDecisionXlsx(board: DecisionBoard, items: any[]) {
  const wb = XLSX.utils.book_new();
  const sinValidar = board.model.pts.filter((p) => p.vestado !== "Validado").length;
  const supu = [
    ["Alerta de gestión PROPUESTA con la sección 9.1 del " + DEC_MODELO + ". No es una valoración oficial."],
    ["Fecha de corte: " + fmtDate(parseISO(board.corte))],
    ["Verde: alcanza el referencial. Amarillo: dentro de ±3 puntos del referencial o mejora respecto al año anterior. Rojo: fuera de ese margen y sin mejora. Gris: sin dato o por confirmar (riesgo de evidencia)."],
    ["Datos EPTM: " + DEC_BASE_FUENTE],
    ["Enfermería y Obstetricia: sin datos cargados."],
    ["Valores sin validar por la oficina: " + sinValidar + " de " + board.model.pts.length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(supu), "Supuestos");
  ([["Alertas", "alertas"], ["Valores", "valores"], ["Procesos", "procesos"], ["Bitácora", "bitacora"]] as [string, DecisionKind][]).forEach(([n, k]) => {
    const rows = decisionRows(board, items, k);
    XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["Sin filas"]]), n);
  });
  const body = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { filename: `SGC_decision_${board.corte}.xlsx`, mime: XLSX_MIME, body };
}
