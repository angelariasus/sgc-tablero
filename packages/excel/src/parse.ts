/**
 * Lectura de los archivos Excel del tablero (plantilla de carga, parámetros y Consolidado de autoevaluación).
 * Puerto fiel de la v0.9; usa SheetJS 0.20 en el servidor.
 */
import * as XLSX from "xlsx";
import {
  ESC_BY, TM_AREAS, catalogIndex, clone, isoD, normArea, normRow, num, reglaKey, uniq,
  type AutoEval, type EvidRow, type Model, type NormRow, type Params, type Regla, type MetaRow,
} from "@sgc/engine";

export interface ParsedParams {
  gen: Record<string, any>;
  fecha: string;
  version: string;
  reglas: Regla[] | null;
  metas: Record<string, MetaRow[]> | null;
}

export interface ParsedFile {
  kind: "carga" | "parametros" | "consolidado";
  name: string;
  escuela: string;
  version: string;
  responsable: string;
  entrega: string;
  rows: NormRow[];
  evid: EvidRow[];
  alcance: Record<string, string> | null;
  respLocal: Record<string, string> | null;
  params: ParsedParams | null;
  warns: string[];
  errors: string[];
  ignoradas: number;
  nFilas: number;
  ejemplo: boolean;
  soloParams: boolean;
  autoeval: AutoEval | null;
  /** hojas presentes, para el informe de la vista previa */
  hojas: string[];
}

const cellS = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const pad2 = (n: number) => String(n).padStart(2, "0");

export function serialToISO(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) return isoD(new Date(Math.round((v - 25569) * 864e5)));
    return String(v);
  }
  if (v instanceof Date) return isoD(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const m2 = String(v).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m2) return `${m2[3]}-${pad2(+m2[2])}-${pad2(+m2[1])}`;
  return String(v);
}

function tableFrom(ws: XLSX.WorkSheet | undefined, key: string): { head: string[]; rows: Record<string, any>[] } | null {
  if (!ws) return null;
  const a = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
  let hi = -1;
  for (let i = 0; i < Math.min(a.length, 15); i++) if (a[i] && a[i].some((c) => String(c ?? "").trim() === key)) { hi = i; break; }
  if (hi < 0) return null;
  const head = a[hi].map((c) => String(c ?? "").trim());
  const rows: Record<string, any>[] = [];
  for (let i = hi + 1; i < a.length; i++) {
    const r = a[i];
    if (!r || r.every((c) => c === null || c === "")) continue;
    const o: Record<string, any> = {};
    head.forEach((h, j) => { if (h) o[h] = r[j] === undefined ? null : r[j]; });
    rows.push(o);
  }
  return { head, rows };
}

const grid = (ws: XLSX.WorkSheet | undefined): any[][] => (ws ? XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, defval: null, blankrows: true }) : []);

/** Lista de EV de un texto; expande rangos tipo «EV40 – EV44». */
export function evList(t: unknown): string[] {
  const s = String(t ?? "");
  const out = new Set<string>();
  const re = /EV\s*(\d+)(?:\s*[–-]\s*EV\s*(\d+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let k = a; k <= b; k++) out.add("EV" + k);
  }
  return Array.from(out);
}

const emptyFile = (name: string): ParsedFile => ({
  kind: "carga", name, escuela: "", version: "", responsable: "", entrega: "", rows: [], evid: [], alcance: null, respLocal: null, params: null, warns: [], errors: [], ignoradas: 0, nFilas: 0, ejemplo: false, soloParams: false, autoeval: null, hojas: [],
});

/** Lee un libro con las hojas Consolidado y Matrices (y, si las trae, Indicadores). */
export function parseConsolidado(wb: XLSX.WorkBook, fname: string, M: Model, ahora = new Date()): AutoEval {
  const { SIN_BY } = catalogIndex(M);
  const rec: AutoEval = { name: fname, tipo: "Consolidado", escuela: "", criterios: [], matrices: [], indicadores: [], warns: [], errors: [], cargadoEn: ahora.toISOString().slice(0, 19).replace("T", " "), nPend: 0, nMat: 0 };
  const g0 = grid(wb.Sheets.Consolidado);
  const title = cellS((g0[0] || [])[0]) + " " + cellS((g0[1] || [])[0]);
  rec.escuela = /EPTM|Tecnolog/i.test(title + fname) ? "TM" : /Enfermer|EPE/i.test(title + fname) ? "ENF" : /Obstetric/i.test(title + fname) ? "OBS" : "";
  if (!rec.escuela) rec.errors.push("No reconozco la escuela del Consolidado (esperaba EPTM, Enfermería u Obstetricia en el título o en el nombre del archivo).");
  const gm = grid(wb.Sheets.Matrices);
  const hm = gm.findIndex((r) => r && cellS(r[0]) === "N.º" && cellS(r[2]) === "Matriz");
  if (hm < 0) rec.errors.push("Hoja Matrices: no encuentro los encabezados (N.º, Matriz).");
  else
    for (let i = hm + 1; i < gm.length; i++) {
      const r = gm[i];
      const n = parseInt(cellS(r && r[0]), 10);
      if (!n || !r[2]) continue;
      rec.matrices.push({ n, bloque: cellS(r[1]), matriz: cellS(r[2]), criterios: cellS(r[3]).split(/[,;]\s*/).filter(Boolean), estado: cellS(r[4]), detalle: cellS(r[5]), ref: `Consolidado, hoja Matrices, fila ${i + 1}` });
    }
  const gc = g0;
  const hc = gc.findIndex((r) => r && cellS(r[0]) === "N.º estándar");
  if (hc < 0) rec.errors.push("Hoja Consolidado: no encuentro los encabezados (N.º estándar).");
  else
    for (let i = hc + 1; i < gc.length; i++) {
      const r = gc[i];
      const c = cellS(r && r[2]);
      if (!/^\d+\.\d+$/.test(c)) continue;
      const mats: { n: number; estado: string }[] = [];
      const re = /M(\d+)\s*\((\w+)\)/g;
      let m: RegExpExecArray | null;
      const ht = cellS(r[7]);
      while ((m = re.exec(ht))) mats.push({ n: +m[1], estado: m[2] });
      rec.criterios.push({ estandar: "E" + cellS(r[0]), criterio: c, resumen: cellS(r[3]), evExig: evList(r[4]), indicadoresGuia: cellS(r[5]), docs: cellS(r[6]), matrices: mats, valoracion: cellS(r[8]), nCitadas: +r[9] || 0, nEnlace: +r[10] || 0, evSin: evList(r[11]), debil: cellS(r[12]) === "—" ? "" : cellS(r[12]), falta: cellS(r[14]), prioridad: cellS(r[15]), ref: `Consolidado, hoja Consolidado, fila ${i + 1}` });
    }
  const pend = new Map(rec.matrices.map((x) => [x.n, x.estado]));
  rec.criterios.forEach((c) => c.matrices.forEach((x) => { if (pend.has(x.n)) x.estado = pend.get(x.n) as string; }));
  const gi = grid(wb.Sheets.Indicadores);
  const hi = gi.findIndex((r) => r && cellS(r[0]) === "ID");
  if (hi >= 0)
    for (let i = hi + 1; i < gi.length; i++) {
      const r = gi[i];
      const id = cellS(r && r[0]).replace(/^ID0*(\d+)$/, "ID$1");
      if (!SIN_BY[id]) continue;
      rec.indicadores.push({ id, referencial: num(r[2]), valor: num(r[3]), estadoRef: cellS(r[4]), criteriosGuia: cellS(r[5]), evGuia: cellS(r[6]), variables: cellS(r[7]), obs: cellS(r[8]), ref: `Consolidado, hoja Indicadores, fila ${i + 1}` });
    }
  if (rec.escuela && !rec.criterios.length) rec.errors.push("No se leyó ningún criterio.");
  rec.nPend = rec.matrices.filter((x) => /pendiente/i.test(x.estado)).length;
  rec.nMat = rec.matrices.length;
  return rec;
}

/** Hojas Criterios y Valores_informe de la plantilla de carga: autoevaluación de la escuela. Sin nada llenado no devuelve nada. */
function parseCriteriosSheets(wb: XLSX.WorkBook, f: ParsedFile, M: Model, ahora: Date): AutoEval | null {
  const { SIN_BY } = catalogIndex(M);
  const tcr = tableFrom(wb.Sheets.Criterios, "criterio");
  const tvi = tableFrom(wb.Sheets.Valores_informe, "indicador_id");
  if (!f.escuela || f.escuela === "FAC" || (!tcr && !tvi)) return null;
  const rec: AutoEval = { name: f.name, tipo: "Plantilla de carga", escuela: f.escuela, criterios: [], matrices: [], indicadores: [], warns: [], errors: [], cargadoEn: ahora.toISOString().slice(0, 19).replace("T", " "), nPend: 0, nMat: "" };
  let llenado = false;
  if (tcr)
    tcr.rows.forEach((r) => {
      const c = cellS(r.criterio);
      if (!/^\d+\.\d+$/.test(c)) return;
      const val = cellS(r.valoracion_informe);
      const evSin = evList(r.ev_exigidas_sin_citar);
      const mats = (cellS(r.matrices_pendientes).match(/M\d+/g) || []).map((x) => ({ n: +x.slice(1), estado: "Pendiente" }));
      if ((val && !/^sin dato$/i.test(val)) || evSin.length || mats.length || cellS(r.prioridad) || cellS(r.evidencia_que_falta) || num(r.evidencias_citadas) !== null) llenado = true;
      rec.criterios.push({ estandar: cellS(r.estandar) || "E" + c.split(".")[0], criterio: c, resumen: cellS(r.resumen), evExig: evList(r.ev_exigidas), indicadoresGuia: "", docs: "", matrices: mats, valoracion: /^sin dato$/i.test(val) ? "" : val, nCitadas: num(r.evidencias_citadas) ?? "", nEnlace: num(r.con_enlace) ?? "", evSin, debil: "", falta: cellS(r.evidencia_que_falta), prioridad: cellS(r.prioridad), ref: `${f.name}, hoja Criterios, criterio ${c}` });
    });
  if (tvi)
    tvi.rows.forEach((r) => {
      const id = cellS(r.indicador_id).replace(/^ID0*(\d+)$/, "ID$1");
      if (!SIN_BY[id]) return;
      const v = num(r.valor_informe);
      if (v === null && !cellS(r.estado_que_declara_el_informe) && !cellS(r.calculo)) return;
      llenado = true;
      const k = SIN_BY[id].unidad === "%" ? 100 : 1;
      const rf = num(r.referencial_en_informe);
      rec.indicadores.push({ id, referencial: rf === null ? null : rf / k, valor: v === null ? null : v / k, estadoRef: cellS(r.estado_que_declara_el_informe), criteriosGuia: "", evGuia: "", variables: cellS(r.calculo), obs: cellS(r.observacion), ref: `${f.name}, hoja Valores_informe, ${id}` });
    });
  rec.nPend = new Set(rec.criterios.flatMap((c) => c.matrices.map((m) => m.n))).size;
  return llenado ? rec : null;
}

/** Lee la plantilla de carga (o el libro de solo parámetros). */
export function parseWorkbookFile(wb: XLSX.WorkBook, fname: string, M: Model, ahora = new Date()): ParsedFile {
  const { CARG_BY, IND_BY } = catalogIndex(M);
  const f = emptyFile(fname);
  f.hojas = wb.SheetNames.slice();
  f.soloParams = !wb.Sheets.Portada && !wb.Sheets.Carga_Indicadores && !!wb.Sheets.Parametros;
  f.kind = f.soloParams ? "parametros" : "carga";
  if (!f.soloParams) ["Portada", "Carga_Indicadores"].forEach((n) => { if (!wb.Sheets[n]) f.errors.push(`Falta la hoja ${n}: no parece la plantilla de carga.`); });
  if (wb.Sheets.Portada) {
    const t = tableFrom(wb.Sheets.Portada, "campo");
    const kv: Record<string, any> = {};
    if (t) t.rows.forEach((r) => (kv[String(r.campo ?? "").trim()] = r.valor));
    f.version = String(kv.version_plantilla ?? "").trim();
    f.escuela = String(kv.escuela_id ?? "").trim().toUpperCase();
    f.responsable = String(kv.responsable_calidad ?? "").trim();
    f.entrega = serialToISO(kv.fecha_entrega);
    if (!ESC_BY[f.escuela]) f.errors.push("Portada: escuela_id vacío o inválido (TM, ENF, OBS o FAC).");
    if (f.version && f.version.split(".")[0] !== "0") f.warns.push(`Versión de plantilla ${f.version}: este tablero espera 0.x.`);
    if (!f.version) f.warns.push("Portada sin version_plantilla.");
  }
  if (f.errors.length && !ESC_BY[f.escuela] && !f.soloParams) return f;
  const tc = tableFrom(wb.Sheets.Carga_Indicadores, "indicador_id");
  if (tc) {
    tc.rows.forEach((r) => {
      if (r.indicador_id === null || String(r.indicador_id).trim() === "") return;
      f.nFilas++;
      const per = String(r.periodo ?? "").trim();
      const o = normRow({ periodo: per, escuela: f.escuela, area: r.area_id, indicador: r.indicador_id, numerador: r.numerador, denominador: r.denominador, valor: r.valor_directo, meta_propuesta: r.meta_propuesta, fuente_meta: r.fuente_meta, esperado: r.esperado_a_fecha, fuente_esperado: r.fuente_esperado, fuente_dato: r.fuente_dato, evidencia_ev: r.evidencia_ev, evidencia_ref: r.evidencia_ref, responsable_carga: r.responsable_carga, fecha_carga: serialToISO(r.fecha_carga), estado_validacion: r.estado_validacion, validado_por: r.validado_por, fecha_validacion: serialToISO(r.fecha_validacion), version_dato: r.version_dato, observacion: r.observacion, origen: r.origen }, fname);
      o.fila = f.nFilas;
      if (!CARG_BY[o.indicador] && !IND_BY[o.indicador]) { f.warns.push(`Fila con indicador desconocido «${o.indicador}»: ignorada.`); f.ignoradas++; return; }
      if (o.area && f.escuela === "TM" && !TM_AREAS.includes(o.area)) f.warns.push(`Área «${o.area}» no reconocida en Tecnología Médica: se usa tal cual; revisa el nombre.`);
      f.rows.push(o);
    });
    f.ejemplo = f.rows.length > 0 && f.rows.every((r) => r.origen === "EJEMPLO");
  } else if (wb.Sheets.Carga_Indicadores) f.errors.push("Carga_Indicadores: no encuentro la fila de encabezados (indicador_id).");
  const te = tableFrom(wb.Sheets.Evidencias, "ev_id");
  if (te)
    te.rows.forEach((r) => {
      if (!r.ev_id || !r.estado) return;
      f.evid.push({ escuela: f.escuela, area: normArea(r.area_id), ev: String(r.ev_id).trim(), estado: String(r.estado).trim(), ubicacion: String(r.ubicacion ?? ""), responsable: String(r.responsable ?? ""), fecha: serialToISO(r.fecha_actualizacion), observacion: String(r.observacion ?? ""), origen: String(r.origen ?? "") === "EJEMPLO" ? "EJEMPLO" : "Real" });
    });
  const ta = tableFrom(wb.Sheets.Alcance, "en_seguimiento");
  if (ta) {
    f.alcance = {}; f.respLocal = {};
    ta.rows.forEach((r) => {
      if (!r.indicador_id) return;
      const k = String(r.indicador_id).trim();
      f.alcance![k] = String(r.en_seguimiento ?? "").trim();
      if (r.responsable_local) f.respLocal![k] = String(r.responsable_local);
    });
  }
  const tp = tableFrom(wb.Sheets.Parametros, "clave");
  if (tp) {
    const gen: Record<string, any> = {};
    tp.rows.forEach((r) => { if (r.clave) gen[String(r.clave).trim()] = r.valor; });
    const tr = tableFrom(wb.Sheets.Reglas_alertas, "regla_id");
    const tm = tableFrom(wb.Sheets.Metas_Umbrales, "indicador_id");
    f.params = {
      gen, fecha: serialToISO(gen.fecha_parametros), version: String(gen.version_parametros ?? ""),
      reglas: tr ? tr.rows.filter((r) => r.regla_id).map((r) => ({ id: String(r.regla_id).trim(), nombre: String(r.nombre ?? ""), activa: String(r.activa ?? "Sí").trim(), severidad: String(r["severidad"] ?? "Aviso").trim(), condicion: String(r["condición (resumen)"] ?? ""), que: String(r["qué ocurre"] ?? ""), porque: String(r["por qué"] ?? ""), accion: String(r["decisión o acción sugerida"] ?? "") })) : null,
      metas: null,
    };
    if (tm) {
      const metas: Record<string, MetaRow[]> = {};
      tm.rows.forEach((r) => {
        if (!r.indicador_id) return;
        const k = String(r.indicador_id).trim();
        (metas[k] = metas[k] || []).push({ desde: num(r.desde_anio) ?? 0, meta: num(r.meta), sentido: String(r.sentido ?? "Por definir").trim(), unidad: String(r.unidad ?? "por definir").trim(), fuente_meta: String(r.fuente_meta ?? ""), estado_meta: String(r.estado_meta ?? "Por definir").trim(), verde_min: num(r.verde_min_pct), rojo_min: num(r.rojo_min_pct), base: String(r.base_umbral ?? "cumplimiento").trim() || "cumplimiento", avance: String(r.tipo_avance ?? "Puntual").trim() || "Puntual", regla: reglaKey(r.regla_cumplimiento), fuente_umbral: String(r.fuente_umbral ?? ""), nota: String(r.nota ?? "") });
      });
      Object.values(metas).forEach((rows) => rows.forEach((m) => { if (m.meta !== null && !m.fuente_meta) { m.meta = null; m.estado_meta = "Por confirmar"; f.warns.push("Una meta sin fuente_meta en Metas_Umbrales se ignoró."); } }));
      f.params.metas = metas;
    }
  }
  f.warns = uniq(f.warns);
  try { f.autoeval = parseCriteriosSheets(wb, f, M, ahora); } catch (e: any) { f.warns.push("Hojas Criterios o Valores_informe: no se pudieron leer (" + e.message + ")."); }
  return f;
}

export type ParsedAny = { tipo: "consolidado"; name: string; autoeval: AutoEval } | { tipo: "plantilla"; name: string; file: ParsedFile };

/** Detecta el tipo de libro y lo lee (igual que `loadFiles` del original). */
export function parseAny(buf: Uint8Array, fname: string, M: Model, ahora = new Date()): ParsedAny {
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  if (wb.Sheets.Consolidado && wb.Sheets.Matrices) return { tipo: "consolidado", name: fname, autoeval: parseConsolidado(wb, fname, M, ahora) };
  return { tipo: "plantilla", name: fname, file: parseWorkbookFile(wb, fname, M, ahora) };
}

/**
 * Adopta la hoja de parámetros con fecha más reciente (si es más nueva que la actual).
 * Devuelve los parámetros resultantes y un mensaje (vacío si no hubo nada que decir).
 */
export function applyParamsFrom(current: Params, files: { name: string; params: ParsedParams | null }[]): { params: Params; changed: boolean; message: string } {
  let best: { name: string; params: ParsedParams } | null = null;
  files.forEach((f) => { if (f.params && f.params.fecha && (!best || f.params.fecha > best.params.fecha)) best = f as any; });
  const cur = current.fecha || "";
  if (best && ((best as any).params.fecha > cur || ((best as any).params.fecha === cur && /^Por defecto|^Editados/.test(current.origen)))) {
    const b = best as { name: string; params: ParsedParams };
    const p = b.params;
    const n = clone(current);
    Object.keys(p.gen).forEach((k) => { if (p.gen[k] !== null && p.gen[k] !== undefined) n.gen[k] = k === "fecha_corte" || k === "fecha_parametros" ? serialToISO(p.gen[k]) : p.gen[k]; });
    if (p.reglas && p.reglas.length) n.reglas = p.reglas;
    if (p.metas) Object.keys(p.metas).forEach((k) => { n.metas[k] = p.metas![k]; });
    n.origen = `Archivo ${b.name} (${p.version || "s/v"}, ${p.fecha})`;
    n.fecha = p.fecha;
    return { params: n, changed: true, message: `Parámetros tomados de ${b.name} (fecha ${p.fecha}).` };
  }
  const diffs = files.filter((f) => f.params && f.params.fecha && f.params.fecha !== cur);
  return { params: current, changed: false, message: diffs.length ? "Los parámetros de los archivos no son más recientes que los activos; se mantienen los activos." : "" };
}

/** Abre un libro de Excel desde sus bytes. */
export function readWorkbook(buf: Uint8Array): XLSX.WorkBook {
  return XLSX.read(buf, { type: "array", cellDates: false });
}
