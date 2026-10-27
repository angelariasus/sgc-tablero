/** Filas de exportación (CSV y Excel) del tablero v0.9, con la misma validación previa de columnas y tipos. */
import { ESC_BY, ORD, REGLAS, reglaKey, type Engine } from "./core";
import { ST } from "./states";
import { fmtDate, isoD, natKey, round2 } from "./util";

export type ExportKind = "indicadores" | "alertas" | "trazabilidad" | "criterios" | "valores_informe";
export type Row = Record<string, string | number>;

/** Esquema de cada hoja. Tipos: t texto, n número (o vacío), p periodo, u unidad del catálogo. */
export const EXP_SCHEMA: Record<ExportKind, Record<string, "t" | "n" | "p" | "u">> = {
  indicadores: { escuela: "t", indicador_id: "t", nombre: "t", tipo: "t", dato_tomado_de: "t", frecuencia: "t", procesos_10_2: "t", estandares: "t", estado: "t", periodo: "p", valor: "n", unidad: "u", meta: "n", esperado_a_la_fecha: "n", fuente_esperado: "t", fuente_meta: "t", cumplimiento_pct: "n", limite_meta_pct: "n", limite_riesgo_pct: "n", fuente_umbral: "t", en_este_estado_desde: "t", dato_vencido: "t", periodo_esperado: "p", tendencia_a_la_baja: "t", evidencia: "t", validacion: "t", fuente_dato: "t", cargado_por: "t", fecha_carga: "t", version_dato: "n", origen: "t", archivo: "t" },
  alertas: { regla: "t", nombre_regla: "t", severidad: "t", escuela: "t", objeto: "t", objeto_id: "t", nombre: "t", periodo: "p", que_ocurre: "t", por_que: "t", desde: "t", a_quien_corresponde: "t", accion_sugerida: "t", origen: "t", corte: "t" },
  trazabilidad: { escuela: "t", area: "t", indicador_id: "t", nombre: "t", periodo: "p", valor: "n", numerador: "n", denominador: "n", estado: "t", motivo_si_no_se_muestra: "t", meta_aplicada: "n", esperado_a_la_fecha: "n", fuente_esperado: "t", fuente_meta: "t", fuente_dato: "t", evidencia_ev: "t", evidencia_ref: "t", cargado_por: "t", fecha_carga: "t", version_dato: "n", estado_validacion: "t", validado_por: "t", fecha_validacion: "t", procesos_10_2: "t", estandares: "t", aoi_vinculadas: "t", origen: "t", archivo: "t", observacion: "t" },
  criterios: { escuela: "t", estandar: "t", criterio: "t", resumen: "t", valoracion_informe: "t", ev_exigidas: "t", ev_exigidas_sin_citar: "t", matrices_pendientes: "t", prioridad: "t", indicadores_que_lo_citan: "t", evidencias_citadas: "n", con_enlace: "n", evidencia_que_falta: "t", archivo: "t", fuente: "t", origen: "t" },
  valores_informe: { escuela: "t", indicador_id: "t", nombre: "t", unidad_modelo: "u", valor_informe: "n", referencial: "n", referencial_texto: "t", fuente_referencial: "t", referencial_en_informe: "n", estado_que_declara_el_informe: "t", calculo: "t", observacion: "t", estado: "t", uso: "t", archivo: "t", fuente: "t", origen: "t" },
};
export const SHEET_NAMES: Record<ExportKind, string> = { indicadores: "Indicadores", alertas: "Alertas", trazabilidad: "Trazabilidad", criterios: "Criterios", valores_informe: "Valores_informe" };
export const EXPORT_KINDS = Object.keys(EXP_SCHEMA) as ExportKind[];
const SIN_DATO = "sin dato";

function rowsIndicadores(E: Engine): Row[] {
  const out: Row[] = [];
  ORD.forEach((e) => {
    E.scopeList(e).forEach((c) => {
      const st = E.status(e, c.id);
      const L = st.last;
      const procs = E.procsOfIndicator(E.effId(c.id)).map((p) => "P" + E.P102_BY[p].n).join(" ");
      out.push({
        escuela: ESC_BY[e].nombre, indicador_id: c.id, nombre: c.nombre, tipo: c.tipo, dato_tomado_de: st.eid !== c.id ? st.eid : "", frecuencia: c.frecuencia,
        procesos_10_2: procs, estandares: E.STAND_OF(E.effId(c.id)).join(" "),
        estado: ST[st.state].label, periodo: L ? L.pinfo.p : "", valor: L ? round2(L.valor) : "", unidad: L ? L.unidad : E.metaInfo(st.eid).unidad,
        meta: L && L.meta !== null ? L.meta : "", esperado_a_la_fecha: L && L.esperado !== null ? round2(L.esperado) : "", fuente_esperado: L ? L.espFuente : "", fuente_meta: L ? L.fuenteMeta : "", cumplimiento_pct: L && L.cumpl !== null ? round2(L.cumpl) : "",
        limite_meta_pct: L && L.bands ? L.bands.verde : "", limite_riesgo_pct: L && L.bands ? L.bands.rojo : "", fuente_umbral: L ? L.bandsSrc : "",
        en_este_estado_desde: st.desde ? fmtDate(st.desde) : "", dato_vencido: st.vencido ? "Sí" : "No", periodo_esperado: st.expLabel || "",
        tendencia_a_la_baja: st.tendencia ? st.tendencia.serie : "",
        evidencia: L ? [L.m.ev, L.m.ev_ref].filter(Boolean).join(" · ") : "", validacion: L ? L.m.estado_val : "", fuente_dato: L ? L.m.fuente_dato : "",
        cargado_por: L ? L.m.cargado_por : "", fecha_carga: L ? L.m.fecha_carga : "", version_dato: L ? L.m.version : "", origen: L ? L.m.origen : "", archivo: L ? L.m.archivo : "",
      });
    });
  });
  return out;
}

function rowsAlertas(E: Engine): Row[] {
  return E.ALERTS.map((a) => ({
    regla: a.regla, nombre_regla: a.reglaNombre, severidad: a.severidad, escuela: ESC_BY[a.escuela]?.nombre || a.escuela, objeto: a.objeto, objeto_id: a.objetoId, nombre: a.objetoNombre, periodo: a.periodo || "",
    que_ocurre: a.que, por_que: a.porque, desde: a.desdeTxt || "", a_quien_corresponde: a.responsable, accion_sugerida: a.accion, origen: a.ejemplo ? "EJEMPLO" : "Real",
    corte: fmtDate(E.corteDate()),
  }));
}

function rowsTraza(E: Engine): Row[] {
  const out: Row[] = [];
  const add = (r: any, rej: boolean) => {
    const eid = r.indicador;
    const ev = !rej ? E.evalPoint(eid, r) : null;
    const aois = E.aoiForInd(eid).join(" ");
    out.push({
      escuela: ESC_BY[r.escuela]?.nombre || r.escuela, area: r.area, indicador_id: eid, nombre: (E.CARG_BY[eid] || E.IND_BY[eid] || { nombre: "" }).nombre || "", periodo: r.periodo, valor: round2(r.valor), numerador: r.numerador ?? "", denominador: r.denominador ?? "",
      estado: rej ? "No se muestra" : ST[ev!.state].label, motivo_si_no_se_muestra: r.motivo || "", meta_aplicada: ev && ev.meta !== null ? ev.meta : "", esperado_a_la_fecha: ev && ev.esperado !== null ? round2(ev.esperado) : "", fuente_esperado: ev ? ev.espFuente : "", fuente_meta: ev ? ev.fuenteMeta : "",
      fuente_dato: r.fuente_dato, evidencia_ev: r.ev, evidencia_ref: r.ev_ref, cargado_por: r.cargado_por, fecha_carga: r.fecha_carga, version_dato: r.version, estado_validacion: r.estado_val, validado_por: r.validado_por, fecha_validacion: r.fecha_val,
      procesos_10_2: E.procsOfIndicator(eid).map((p) => "P" + E.P102_BY[p].n).join(" "), estandares: E.STAND_OF(eid).join(" "), aoi_vinculadas: aois, origen: r.origen, archivo: r.archivo, observacion: r.obs,
    });
  };
  E.DB.vis.forEach((r) => add(r, false));
  E.DB.rejected.forEach((r) => add(r, true));
  return out;
}

function rowsCriterios(E: Engine): Row[] {
  const out: Row[] = [];
  ORD.filter((e) => e !== "FAC").forEach((e) => {
    const ae = E.autoeval[e];
    if (ae)
      ae.criterios.forEach((c) => {
        const pm = c.matrices.filter((x) => /pendiente/i.test(x.estado));
        out.push({ escuela: ESC_BY[e].nombre, estandar: c.estandar, criterio: c.criterio, resumen: c.resumen, valoracion_informe: c.valoracion || SIN_DATO, ev_exigidas: c.evExig.join(" "), ev_exigidas_sin_citar: c.evSin.join(" "), matrices_pendientes: pm.map((x) => "M" + x.n).join(" "), prioridad: c.prioridad || "", indicadores_que_lo_citan: E.M.sineace.filter((x) => x.criterios.includes(c.criterio)).map((x) => x.id).join(" "), evidencias_citadas: c.nCitadas ?? "", con_enlace: c.nEnlace ?? "", evidencia_que_falta: c.falta || "", archivo: ae.name, fuente: c.ref, origen: ae.fabrica ? "Consolidado EPTM (incluido)" : "Archivo cargado" });
      });
    else
      E.critCatalog().forEach((c: any) =>
        out.push({ escuela: ESC_BY[e].nombre, estandar: c.estandar, criterio: c.criterio, resumen: c.resumen, valoracion_informe: SIN_DATO, ev_exigidas: c.evExig.join(" "), ev_exigidas_sin_citar: "", matrices_pendientes: "", prioridad: "", indicadores_que_lo_citan: E.M.sineace.filter((x) => x.criterios.includes(c.criterio)).map((x) => x.id).join(" "), evidencias_citadas: "", con_enlace: "", evidencia_que_falta: "", archivo: "", fuente: "Catálogo de criterios del modelo (sin informe cargado de la escuela)", origen: "Sin dato" }),
      );
  });
  return out;
}

function rowsValoresInforme(E: Engine): Row[] {
  const pctU = (id: string, v: number | null | undefined) => (v === null || v === undefined ? "" : round2(E.SIN_BY[id].unidad === "%" ? v * 100 : v));
  const out: Row[] = [];
  ORD.filter((e) => e !== "FAC").forEach((e) => {
    const ae = E.autoeval[e];
    E.M.sineace.forEach((sn) => {
      const x = ae && ae.indicadores.find((z) => z.id === sn.id);
      out.push({ escuela: ESC_BY[e].nombre, indicador_id: sn.id, nombre: sn.nombre, unidad_modelo: sn.unidad, valor_informe: x ? pctU(sn.id, x.valor) : "", referencial: sn.ref === null || sn.ref === undefined ? "" : sn.ref, referencial_texto: sn.ref_texto || "", fuente_referencial: "Modelo CONEAU 2026 [A4]", referencial_en_informe: x ? pctU(sn.id, x.referencial) : "", estado_que_declara_el_informe: x ? x.estadoRef : "", calculo: x ? x.variables : "", observacion: x ? x.obs : "", estado: x ? "Sin dato validado" : SIN_DATO, uso: "Solo referencia: no interviene en semáforos, alertas ni gráficos", archivo: x ? ae!.name : "", fuente: x ? x.ref : "", origen: x ? (ae!.fabrica ? "Consolidado EPTM (incluido)" : "Archivo cargado") : "Sin dato" });
    });
  });
  return out;
}

const PER_RE = /^\d{4}(-(S[12]|T[1-4]|(0[1-9]|1[0-2])))?$/;
/** Lista de problemas: cada fila debe traer exactamente las columnas del encabezado, en su orden, con el tipo de la columna. */
export function validateRows(what: ExportKind, rows: Row[]): string[] {
  const sch = EXP_SCHEMA[what];
  const cols = Object.keys(sch);
  const errs: string[] = [];
  const uni = new Set(["", "%", "días", "años", "número", "por definir"]);
  rows.forEach((r, i) => {
    const keys = Object.keys(r);
    if (keys.length !== cols.length || keys.some((k, j) => k !== cols[j])) {
      errs.push(`${what} fila ${i + 2}: tiene ${keys.length} columnas y el encabezado ${cols.length}${keys.length === cols.length ? " (distinto orden o nombre)" : ""}`);
      return;
    }
    cols.forEach((c) => {
      const v: any = r[c];
      const t = sch[c];
      if (v === undefined || v === null) errs.push(`${what} fila ${i + 2}, ${c}: celda sin valor (debe ir vacía como texto)`);
      else if (t === "n" && !(v === "" || (typeof v === "number" && Number.isFinite(v)))) errs.push(`${what} fila ${i + 2}, ${c}: se esperaba un número y llegó «${String(v).slice(0, 30)}»`);
      else if (t === "p" && !(v === "" || (typeof v === "string" && PER_RE.test(v)))) errs.push(`${what} fila ${i + 2}, ${c}: se esperaba un periodo (2025, 2025-S1, 2025-T1 o 2025-03) y llegó «${String(v).slice(0, 30)}»`);
      else if (t === "u" && !(typeof v === "string" && uni.has(v))) errs.push(`${what} fila ${i + 2}, ${c}: unidad fuera del catálogo «${String(v).slice(0, 30)}»`);
      else if ((t === "t" || t === "u") && typeof v !== "string") errs.push(`${what} fila ${i + 2}, ${c}: se esperaba texto y llegó ${typeof v}`);
    });
  });
  return errs;
}

function normalizeRows(what: ExportKind, rows: Row[]): Row[] {
  const sch = EXP_SCHEMA[what];
  return rows.map((r) => {
    const o: Row = {};
    Object.keys(r).forEach((c) => {
      const v: any = r[c];
      const t = sch[c];
      o[c] = v === undefined || v === null || (typeof v === "number" && !Number.isFinite(v)) ? "" : (t === "t" || t === "p") && typeof v === "number" ? String(v) : v;
    });
    return o;
  });
}

function orderBySchool(rows: Row[]): Row[] {
  const escIdx = (name: string) => { const i = ORD.findIndex((e) => ESC_BY[e].nombre === name); return i < 0 ? 99 : i; };
  return rows.map((r, i) => [r, i] as const).sort((x, y) => escIdx(x[0].escuela as string) - escIdx(y[0].escuela as string) || x[1] - y[1]).map((x) => x[0]);
}
const stateRank = (lbl: string) => {
  const code = (Object.keys(ST) as (keyof typeof ST)[]).find((k) => ST[k].label === lbl);
  return code === undefined ? 50 : -ST[code].rank;
};
function sortTraza(rows: Row[]): Row[] {
  const escIdx = (name: string) => { const i = ORD.findIndex((e) => ESC_BY[e].nombre === name); return i < 0 ? 99 : i; };
  return rows.map((r, i) => [r, i] as const)
    .sort((x, y) => escIdx(x[0].escuela as string) - escIdx(y[0].escuela as string) || stateRank(x[0].estado as string) - stateRank(y[0].estado as string) || natKey(x[0].indicador_id).localeCompare(natKey(y[0].indicador_id)) || String(x[0].periodo).localeCompare(String(y[0].periodo)) || x[1] - y[1])
    .map((x) => x[0]);
}

export function exportRows(E: Engine, what: ExportKind): Row[] {
  const builders: Record<ExportKind, (e: Engine) => Row[]> = { indicadores: rowsIndicadores, alertas: rowsAlertas, trazabilidad: rowsTraza, criterios: rowsCriterios, valores_informe: rowsValoresInforme };
  let rows = builders[what](E);
  rows = orderBySchool(rows);
  if (what === "trazabilidad") rows = sortTraza(rows);
  return normalizeRows(what, rows);
}

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function toCSV(rows: Row[], what: ExportKind): string {
  if (!rows.length) return "";
  const cols = Object.keys(EXP_SCHEMA[what]);
  return "﻿" + [cols.map(csvCell).join(",")].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))).join("\r\n");
}

/** Hoja "Léeme" del Excel completo. */
export function exportMeta(E: Engine, generado: Date): { campo: string; valor: string }[] {
  return [
    { campo: "Tablero", valor: "SGC · Escuelas de Tecnología Médica, Enfermería y Obstetricia" },
    { campo: "Generado el", valor: isoD(generado) },
    { campo: "Fecha de corte", valor: fmtDate(E.corteDate()) },
    { campo: "Orden de escuelas", valor: "Enfermería (Fase 1, piloto), Obstetricia (Fase 2), Tecnología Médica (Fase 3, por áreas) y Facultad (marco común)" },
    { campo: "Datos EJEMPLO incluidos", valor: E.ejemplo ? "Sí: toda fila con origen EJEMPLO es inventada y no refleja a ninguna escuela" : "No" },
    { campo: "Parámetros", valor: `${E.params.origen} · fecha ${E.params.fecha}` },
    { campo: "Archivos cargados", valor: (E.input.fileNames ?? []).join(", ") || "Ninguno" },
    { campo: "Hojas Criterios y Valores_informe", valor: "Igual estructura para las tres escuelas: 53 criterios y 29 ID por escuela; sin informe cargado queda «sin dato». Los valores del informe son solo referencia y no intervienen en semáforos, alertas ni gráficos." },
    { campo: "Nota", valor: "Los valores de referencia SINEACE son del Modelo CONEAU 2026 [A4], no metas aprobadas. Sin fuente no se muestra dato." },
  ];
}

export function exportSuffix(E: Engine, generado: Date): string {
  return (E.ejemplo ? "_EJEMPLO" : "") + "_" + isoD(generado);
}

/** Filas del libro de parámetros (hojas Parametros, Reglas_alertas y Metas_Umbrales). */
export function paramsSheets(E: Engine) {
  const g = E.pdef.general.map(([k, , tipo, nota]) => ({ clave: k, valor: E.params.gen[k] instanceof Date ? isoD(E.params.gen[k]) : (E.params.gen[k] ?? ""), tipo, "fuente y nota": nota }));
  const reglas = E.params.reglas.map((r) => ({ regla_id: r.id, nombre: r.nombre, activa: r.activa, severidad: r.severidad, "condición (resumen)": r.condicion, "qué ocurre": r.que, "por qué": r.porque, "decisión o acción sugerida": r.accion }));
  const metas: Record<string, any>[] = [];
  Object.keys(E.params.metas).forEach((k) =>
    E.params.metas[k].forEach((r) => metas.push({ indicador_id: k, desde_anio: r.desde, meta: r.meta ?? "", sentido: r.sentido, unidad: r.unidad, fuente_meta: r.fuente_meta, estado_meta: r.estado_meta, verde_min_pct: r.verde_min ?? "", rojo_min_pct: r.rojo_min ?? "", base_umbral: r.base, fuente_umbral: r.fuente_umbral, nota: r.nota, tipo_avance: r.avance || "Puntual", regla_cumplimiento: REGLAS[reglaKey(r.regla)].nombre })),
  );
  return { Parametros: g, Reglas_alertas: reglas, Metas_Umbrales: metas };
}
