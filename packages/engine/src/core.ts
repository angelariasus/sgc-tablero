/**
 * Motor de cálculo del tablero SGC (puerto fiel de la v0.9).
 * Es TypeScript puro: sin DOM, sin base de datos. Lo usan la API (exportaciones) y el navegador (vistas).
 */
import { FREQ_MONTHS, expectedEnd, nextEndAfter, periodInfo, periodLabelFromEnd } from "./periods";
import { ST, type StateCode } from "./states";
import type {
  Alert, AoiDef, AutoEval, Cargable, EscId, EvidRow, EvalPoint, ExampleData, IndicadorDef, MetaRow, Model, NormRow,
  Params, ParamsDef, Regla, SineaceDef, Status,
} from "./types";
import {
  addDays, clone, dUTC, fmtDate, fmtMonth, fmtN, isoD, natKey, noAcc, num, pad2, parseISO, uniq,
} from "./util";

export const TM_AREAS = ["Radiología", "Terapia Física", "Terapia Ocupacional", "Laboratorio Clínico y Anatomía Patológica"];
const AREA_LEGACY: Record<string, string> = {
  "tm-a1": TM_AREAS[0], "tm-a2": TM_AREAS[1], "tm-a3": TM_AREAS[2], "tm-a4": TM_AREAS[3],
  "tm-rad": TM_AREAS[0], "tm-tf": TM_AREAS[1], "tm-to": TM_AREAS[2], "tm-lcap": TM_AREAS[3],
};
/** Área de TM: acepta el nombre (con o sin tildes) o los códigos de la plantilla 0.1 (TM-A1 a TM-A4). */
export function normArea(v: unknown): string {
  const t = String(v ?? "").trim();
  if (!t) return "";
  const k = noAcc(t);
  if (AREA_LEGACY[k]) return AREA_LEGACY[k];
  const hit = TM_AREAS.find((a) => noAcc(a) === k);
  return hit || t;
}

export interface EscDef { id: EscId; nombre: string; corto: string; areas: string[]; fase?: number; faseTxt?: string }
export const ESC_LIST: EscDef[] = [
  { id: "ENF", nombre: "Enfermería", corto: "Enfermería", areas: [], fase: 1, faseTxt: "Fase 1 · piloto" },
  { id: "OBS", nombre: "Obstetricia", corto: "Obstetricia", areas: [], fase: 2, faseTxt: "Fase 2" },
  { id: "TM", nombre: "Tecnología Médica", corto: "Tec. Médica", areas: TM_AREAS, fase: 3, faseTxt: "Fase 3 · por áreas" },
  { id: "FAC", nombre: "Facultad (marco común)", corto: "Facultad", areas: [] },
];
export const ESC_BY: Record<string, EscDef> = Object.fromEntries(ESC_LIST.map((e) => [e.id, e]));
export const SCH: EscId[] = ["ENF", "OBS", "TM"];
export const ORD: EscId[] = ["ENF", "OBS", "TM", "FAC"];
export const EJ_CORTE = "2026-10-20";
export const POI_IND = ["PE01-I3", "PE01-P6", "PE01-P7", "PE01-P8"];

export const REGLAS: Record<string, { nombre: string; txt: string }> = {
  razon: { nombre: "Razón al esperado", txt: "" },
  menor_igual: { nombre: "Cumple si es menor o igual al referencial", txt: "Es un tiempo: cumple si el valor es menor o igual al referencial." },
  no_negativa: { nombre: "Cumple si la variación es mayor o igual a 0", txt: "Es una variación: cumple si no es negativa (mayor o igual a 0)." },
};
const REGLA_NOMBRES: Record<string, string> = {
  "Razón al esperado": "razon",
  "Cumple si es menor o igual al referencial": "menor_igual",
  "Cumple si la variación es mayor o igual a 0": "no_negativa",
};
export const reglaKey = (v: unknown): string => {
  const t = String(v ?? "").trim();
  return REGLAS[t] ? t : REGLA_NOMBRES[t] || "razon";
};

export const fmtVal = (v: number | null | undefined, u: string | undefined): string =>
  v === null || v === undefined
    ? "—"
    : fmtN(v, 2) + (u === "%" ? " %" : u && u !== "por definir" && u !== "número" ? " " + (u === "años" && Math.abs(v) === 1 ? "año" : u) : "");

export function fillTpl(t: string, ctx: Record<string, any>): string {
  return String(t || "").replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== "" ? ctx[k] : "—"));
}

export function cargablesOf(M: Model): Cargable[] {
  return [
    ...M.sineace.map((s) => ({ id: s.id, tipo: "SINEACE", nombre: s.nombre, frecuencia: s.frecuencia, ambito: "Escuela" })),
    ...M.indicadores
      .filter((i) => !i.alias_sineace)
      .map((i) => ({ id: i.id, tipo: i.ficha === "PE FM" ? "PE FM" : "Proceso", nombre: i.nombre, frecuencia: i.frecuencia, ambito: i.ambito, piloto: i.piloto })),
  ];
}

/** Metas por defecto (las del modelo y las de las fichas), una fila por indicador cargable. */
export function defaultMetas(M: Model): Record<string, MetaRow[]> {
  const SIN_BY = Object.fromEntries(M.sineace.map((s) => [s.id, s]));
  const IND_BY = Object.fromEntries(M.indicadores.map((i) => [i.id, i]));
  const out: Record<string, MetaRow[]> = {};
  cargablesOf(M).forEach((c) => {
    const src: any = c.tipo === "SINEACE" ? SIN_BY[c.id] : IND_BY[c.id];
    const rows: MetaRow[] =
      c.tipo === "SINEACE"
        ? [{ desde: 0, meta: src.ref, sentido: src.sentido, unidad: src.unidad, fuente_meta: "Valor de referencia del modelo CONEAU 2026, " + c.id + " [A4]", estado_meta: "Con fuente", verde_min: null, rojo_min: null, base: "cumplimiento", avance: src.avance || "Puntual", regla: src.regla || "razon", fuente_umbral: "", nota: ("Referencia del modelo; no equivale a una meta aprobada por la Facultad. " + (src.regla_nota || "")).trim() }]
        : src.metas.length
          ? src.metas.map((m: any) => ({ desde: m.desde, meta: m.meta, sentido: src.sentido, unidad: src.unidad, fuente_meta: m.fuente, estado_meta: "Con fuente", verde_min: null, rojo_min: null, base: "cumplimiento", avance: src.avance || "Puntual", regla: "razon", fuente_umbral: "", nota: src.meta_nota }))
          : [{ desde: 0, meta: null, sentido: src.sentido, unidad: src.unidad, fuente_meta: "", estado_meta: src.estado_meta === "En conflicto" ? "En conflicto" : "Por definir", verde_min: null, rojo_min: null, base: "cumplimiento", avance: src.avance || "Puntual", regla: "razon", fuente_umbral: "", nota: src.meta_nota }];
    out[c.id] = rows;
  });
  return out;
}

export function buildParams(src: ParamsDef): Params {
  const gen: Record<string, any> = {};
  src.general.forEach((g) => (gen[g[0]] = g[1]));
  const reglas: Regla[] = src.reglas.map((r) => ({ id: r[0], nombre: r[1], activa: r[2], severidad: r[3], condicion: r[4], que: r[5], porque: r[6], accion: r[7] }));
  const f = src.general.find((g) => g[0] === "fecha_parametros");
  return { gen, reglas, metas: {}, origen: "Por defecto (tablero)", fecha: f ? String(f[1]) : "" };
}

/** Parámetros por defecto del tablero (base del primer juego de parámetros en la base de datos). */
export function defaultParams(M: Model, pdef: ParamsDef): Params {
  const p = buildParams(pdef);
  p.metas = defaultMetas(M);
  return p;
}

/** Normaliza una fila de carga (de un Excel o de la base) al formato interno. */
export function normRow(r: any, origenArchivo?: string): NormRow {
  return {
    periodo: String(r.periodo ?? "").trim(),
    escuela: String(r.escuela ?? "").trim().toUpperCase(),
    area: normArea(r.area),
    indicador: String(r.indicador ?? "").trim(),
    numerador: num(r.numerador),
    denominador: num(r.denominador),
    valor_directo: num(r.valor),
    meta_propuesta: num(r.meta_propuesta),
    fuente_meta: String(r.fuente_meta ?? "").trim(),
    esperado: num(r.esperado),
    fuente_esperado: String(r.fuente_esperado ?? "").trim(),
    fuente_dato: String(r.fuente_dato ?? "").trim(),
    ev: String(r.evidencia_ev ?? "").trim(),
    ev_ref: String(r.evidencia_ref ?? "").trim(),
    cargado_por: String(r.responsable_carga ?? "").trim(),
    fecha_carga: r.fecha_carga ? String(r.fecha_carga).slice(0, 10) : "",
    estado_val: String(r.estado_validacion ?? "").trim() || "Borrador",
    validado_por: String(r.validado_por ?? "").trim(),
    fecha_val: r.fecha_validacion ? String(r.fecha_validacion).slice(0, 10) : "",
    version: num(r.version_dato) || 1,
    obs: String(r.observacion ?? "").trim(),
    origen: String(r.origen ?? "").trim() === "EJEMPLO" ? "EJEMPLO" : "Real",
    archivo: origenArchivo || "",
  };
}

/** Valor de una medición: el directo, o numerador sobre denominador (por 100 si la unidad es %). */
export function calcValorRow(m: Pick<NormRow, "valor_directo" | "numerador" | "denominador">, unidad: string): number | null {
  if (m.valor_directo !== null) return m.valor_directo;
  if (m.numerador !== null && m.denominador !== null && m.denominador > 0) return (m.numerador / m.denominador) * (unidad === "%" ? 100 : 1);
  if (m.numerador !== null) return m.numerador;
  return null;
}

export interface EngineOptions {
  ejemplo: boolean;
  corteOverride?: Date | null;
  /** "hoy" (se inyecta para que las pruebas sean deterministas) */
  today?: Date;
}

export interface ScopeInput {
  alcance?: Record<string, string> | null;
  respLocal?: Record<string, string> | null;
}

export interface EngineInput {
  model: Model;
  pdef: ParamsDef;
  example: ExampleData;
  params: Params;
  /** filas de carga guardadas (reales), en el orden en que se cargaron */
  measurements: NormRow[];
  /** filas rechazadas en la carga (por ejemplo, sin fuente) */
  rejected?: NormRow[];
  evidence?: EvidRow[];
  scopes?: Record<string, ScopeInput | undefined>;
  /** escuelas que tienen al menos un archivo cargado */
  schoolsWithFiles?: string[];
  autoeval?: Record<string, AutoEval>;
  /** nombres de los archivos cargados (para la hoja Léeme de la exportación) */
  fileNames?: string[];
  options: EngineOptions;
}

export class Engine {
  readonly M: Model;
  readonly pdef: ParamsDef;
  readonly EXJ: ExampleData;
  params: Params;
  readonly ejemplo: boolean;
  readonly corteOverride: Date | null;
  readonly today: Date;
  readonly input: EngineInput;

  readonly IND_BY: Record<string, IndicadorDef>;
  readonly SIN_BY: Record<string, SineaceDef>;
  readonly FICHA_BY: Record<string, Model["fichas"][number]>;
  readonly P102_BY: Record<string, Model["procesos102"][number]>;
  readonly EST_BY: Record<string, Model["estandares"][number]>;
  readonly EV_BY: Record<string, Model["evidencias"][number]>;
  readonly AOI_BY: Record<string, AoiDef>;
  readonly FUENTE_BY: Record<string, Model["fuentes"][number]>;
  readonly CARGABLES: Cargable[];
  readonly CARG_BY: Record<string, Cargable>;
  readonly PROC_IND_IN_102: Set<string>;
  readonly autoeval: Record<string, AutoEval>;
  readonly scopes: Record<string, ScopeInput | undefined>;
  readonly schoolsWithFiles: Set<string>;

  DB!: { vis: NormRow[]; rejected: NormRow[] };
  ALERTS: Alert[] = [];
  private POI_CACHE: Record<number, any> | null = null;
  private sc = new Map<string, Status>();
  private CRIT_CAT: any[] | null = null;

  constructor(input: EngineInput) {
    this.input = input;
    const M = (this.M = input.model);
    this.pdef = input.pdef;
    this.EXJ = input.example;
    this.params = input.params;
    this.ejemplo = !!input.options.ejemplo;
    this.corteOverride = input.options.corteOverride ?? null;
    this.today = input.options.today ?? new Date();
    this.autoeval = input.autoeval ?? {};
    this.scopes = input.scopes ?? {};
    this.schoolsWithFiles = new Set(input.schoolsWithFiles ?? []);

    this.IND_BY = Object.fromEntries(M.indicadores.map((i) => [i.id, i]));
    this.SIN_BY = Object.fromEntries(M.sineace.map((s) => [s.id, s]));
    this.FICHA_BY = Object.fromEntries(M.fichas.map((f) => [f.id, f]));
    this.P102_BY = Object.fromEntries(M.procesos102.map((p) => [p.id, p]));
    this.EST_BY = Object.fromEntries(M.estandares.map((e) => [e.id, e]));
    this.EV_BY = Object.fromEntries(M.evidencias.map((e) => [e.id, e]));
    this.AOI_BY = Object.fromEntries(M.aoi.map((a) => [a.id, a]));
    this.FUENTE_BY = Object.fromEntries(M.fuentes.map((f) => [f.id, f]));
    this.CARGABLES = cargablesOf(M);
    this.CARG_BY = Object.fromEntries(this.CARGABLES.map((c) => [c.id, c]));
    this.PROC_IND_IN_102 = new Set(M.rel_proceso_indicador.map((r) => r[1]));

    this.buildDB();
    this.ALERTS = this.buildAlerts();
  }

  /* ---------- fecha de corte ---------- */
  corteDate(): Date {
    const g = this.params.gen.fecha_corte;
    const d = g ? parseISO(g instanceof Date ? isoD(g) : g) : null;
    if (this.corteOverride) return this.corteOverride;
    if (d) return d;
    if (this.ejemplo) return parseISO(EJ_CORTE)!;
    const n = this.today;
    return dUTC(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }

  defaultScope(c: Cargable): boolean {
    return c.tipo === "SINEACE" || !!c.piloto || this.PROC_IND_IN_102.has(c.id);
  }

  /* ---------- unidades y valor ---------- */
  unitFor(id: string): string {
    const rows = this.params.metas[id];
    return rows && rows[0] ? rows[0].unidad : this.CARG_BY[id] && this.IND_BY[id] ? this.IND_BY[id].unidad : "por definir";
  }
  calcValor(m: NormRow): number | null { return calcValorRow(m, this.unitFor(m.indicador)); }

  /* ---------- POI de la Facultad ---------- */
  private poiCompute(anio: number, mesCorte: number) {
    const byAoi: Record<string, any> = {};
    this.M.poi_hecho.forEach(([a, mes, aoi, act, prog, ejec, pag]) => {
      if (a !== anio) return;
      (byAoi[aoi] = byAoi[aoi] || { aoi, act, pag, meses: [] }).meses.push({ mes, prog, ejec });
    });
    const out: any[] = [];
    Object.values(byAoi).forEach((o: any) => {
      o.meses.sort((x: any, y: any) => x.mes - y.mes);
      let pa = 0, ea = 0;
      const acum: any[] = [];
      o.meses.forEach((m: any) => {
        if (m.mes <= mesCorte) { pa += m.prog; ea += m.ejec; }
        acum.push({
          mes: m.mes,
          prog: o.meses.filter((z: any) => z.mes <= m.mes).reduce((s: number, z: any) => s + z.prog, 0),
          ejec: o.meses.filter((z: any) => z.mes <= m.mes).reduce((s: number, z: any) => s + z.ejec, 0),
        });
      });
      o.prog = pa; o.ejec = ea; o.acum = acum;
      o.avance = pa > 0 ? Math.min(100, (ea / pa) * 100) : null;
      o.ratio = pa > 0 ? (ea / pa) * 100 : null;
      out.push(o);
    });
    return out;
  }
  poiAll(): Record<number, any> {
    if (this.POI_CACHE) return this.POI_CACHE;
    const res: Record<number, any> = {};
    this.M.poi_reportes.forEach((rep) => {
      const lst = this.poiCompute(rep.anio, rep.mes_corte);
      const conProg = lst.filter((x) => x.prog > 0);
      const sobre = +this.params.gen.umbral_sobreejecucion || 120;
      const vinc = conProg.filter((x) => { const a = this.AOI_BY[x.act]; return a && a.en_alcance_sgc && ["Directo", "Relacionado"].includes(a.vinculo as string); });
      res[rep.anio] = {
        rep, lista: lst, conProg,
        i3: conProg.length ? conProg.reduce((s, x) => s + x.avance, 0) / conProg.length : null,
        p6: conProg.length ? (conProg.filter((x) => x.avance >= 95).length / conProg.length) * 100 : null,
        p6n: conProg.filter((x) => x.avance >= 95).length,
        p7: conProg.length ? (conProg.filter((x) => x.ratio > sobre).length / conProg.length) * 100 : null,
        p7n: conProg.filter((x) => x.ratio > sobre).length,
        p8: vinc.length ? (vinc.filter((x) => x.avance >= 95).length / vinc.length) * 100 : null,
        p8n: vinc.filter((x) => x.avance >= 95).length, p8d: vinc.length,
      };
    });
    this.POI_CACHE = res;
    return res;
  }
  private poiMeasurements(): NormRow[] {
    const A = this.poiAll();
    const out: NormRow[] = [];
    this.M.poi_reportes.forEach((rep) => {
      const r = A[rep.anio];
      const per = rep.mes_corte === 12 ? String(rep.anio) : `${rep.anio}-${pad2(rep.mes_corte)}`;
      const src = `Reporte de seguimiento del POI ${rep.anio}, centro de costo 01.30 (${rep.reporte}), consultado el ${fmtDate(parseISO(rep.consulta))}`;
      const common: any = { periodo: per, escuela: "FAC", area: "", fuente_dato: src, ev: "", ev_ref: `Reporte ${rep.reporte} (PDF, 4 páginas), páginas 1 a 4`, cargado_por: "Carga inicial desde los reportes impresos", fecha_carga: rep.consulta, estado_val: "Dato de reporte", validado_por: "Reporte oficial del aplicativo CEPLAN", fecha_val: rep.consulta, version: 1, obs: "", origen: "Real", archivo: "Reporte POI " + rep.reporte, numerador: null, denominador: null, meta_propuesta: null, fuente_meta: "" };
      out.push({ ...common, indicador: "PE01-I3", valor_directo: r.i3, obs: `Promedio de ${r.conProg.length} AOI con programación; el reporte imprime ${fmtN(rep.impreso, 2)} %` });
      out.push({ ...common, indicador: "PE01-P6", valor_directo: r.p6, obs: `${r.p6n} de ${r.conProg.length} AOI` });
      out.push({ ...common, indicador: "PE01-P7", valor_directo: r.p7, obs: `${r.p7n} de ${r.conProg.length} AOI` });
      out.push({ ...common, indicador: "PE01-P8", valor_directo: r.p8, obs: `${r.p8n} de ${r.p8d} AOI vinculadas al SGC` });
    });
    return out;
  }

  /* ---------- base de mediciones ---------- */
  private buildDB() {
    this.POI_CACHE = null;
    const rejected: NormRow[] = [];
    const base: NormRow[] = [];
    this.poiMeasurements().forEach((m) => base.push(m));
    (this.M.real_mediciones || []).forEach((r) => base.push(normRow(r, "Matriz de la Facultad [A18]")));
    if (this.ejemplo) this.EXJ.mediciones.forEach((r) => base.push(normRow(r, "EJEMPLO (incrustado)")));
    this.input.measurements.forEach((r) => base.push({ ...r }));
    const filt = base.filter((r) => this.ejemplo || r.origen !== "EJEMPLO");
    const byKey = new Map<string, NormRow>();
    filt.forEach((r) => {
      const k = [r.periodo, r.escuela, r.area, r.indicador].join("|");
      const prev = byKey.get(k);
      if (!prev || r.version > prev.version || (r.version === prev.version && (r.fecha_carga || "") >= (prev.fecha_carga || ""))) {
        if (prev) r.reemplaza = (prev.reemplaza || 0) + 1;
        byKey.set(k, r);
      }
    });
    const vis: NormRow[] = [];
    byKey.forEach((r) => {
      r.pinfo = periodInfo(r.periodo)!;
      r.valor = this.calcValor(r);
      r.id = [r.periodo, r.escuela, r.area, r.indicador].join("|");
      if (!r.pinfo || r.valor === null || !r.indicador || !ESC_BY[r.escuela]) {
        r.motivo = !r.pinfo ? "Periodo no válido" : r.valor === null ? "Sin valor" : !ESC_BY[r.escuela] ? "Escuela no válida" : "Sin indicador";
        rejected.push(r);
        return;
      }
      if (!this.CARG_BY[r.indicador] && !this.IND_BY[r.indicador]) { r.motivo = "Indicador no existe en el catálogo"; rejected.push(r); return; }
      if (!r.fuente_dato) { r.motivo = "Sin fuente del dato: no se muestra como dato"; rejected.push(r); return; }
      vis.push(r);
    });
    vis.sort((a, b) => a.pinfo!.end.getTime() - b.pinfo!.end.getTime() || a.version - b.version);
    // filas rechazadas al cargar el archivo (nunca llegan a la tabla de mediciones)
    (this.input.rejected ?? []).forEach((r) => {
      if (!this.ejemplo && r.origen === "EJEMPLO") return;
      rejected.push({ ...r });
    });
    this.DB = { vis, rejected };
  }

  /* ---------- metas y evaluación ---------- */
  effId(id: string): string {
    const i = this.IND_BY[id];
    return i && i.alias_sineace && this.params.gen.heredar_alias !== "No" ? i.alias_sineace : id;
  }
  metaRowFor(id: string, year: number): MetaRow | null {
    const rows = (this.params.metas[id] || []).filter((r) => r.meta !== null && r.meta !== undefined && String(r.fuente_meta || "").trim() && r.desde <= year);
    if (!rows.length) return null;
    return rows.reduce((a, b) => (b.desde >= a.desde ? b : a));
  }
  metaInfo(id: string) {
    const rows = this.params.metas[id] || [];
    const r0: Partial<MetaRow> = rows[0] || {};
    return { unidad: r0.unidad || "por definir", sentido: r0.sentido || "Por definir", estado: r0.estado_meta || "Por definir", nota: r0.nota || "" };
  }
  private yearFraction(pinfo: { end: Date }) { return Math.min(1, (pinfo.end.getUTCMonth() + 1) / 12); }

  poiFraccion(id: string, pinfo: { y: number; end: Date }) {
    const ind = this.IND_BY[id];
    if (!ind || !ind.aoi_esperado) return null;
    const rep = this.M.poi_reportes.find((r) => r.anio === pinfo.y);
    if (!rep) return null;
    const mesCierre = pinfo.end.getUTCMonth() + 1;
    const rows = this.M.poi_hecho.filter((r) => r[0] === pinfo.y && r[3] === ind.aoi_esperado && !String(r[2]).startsWith("Sin código"));
    const tot = rows.reduce((t, r) => t + r[4], 0);
    if (!(tot > 0)) return null;
    const acum = rows.filter((r) => r[1] <= mesCierre).reduce((t, r) => t + r[4], 0);
    return { f: acum / tot, det: [{ act: ind.aoi_esperado, tot, acum }], rep, mes: mesCierre };
  }

  evalPoint(id: string, m: NormRow): EvalPoint {
    const mi = this.metaInfo(id);
    const year = m.pinfo!.y;
    let mr: any = this.metaRowFor(id, year);
    let meta: number | null = mr ? mr.meta : null;
    let fuenteMeta = mr ? mr.fuente_meta : "";
    if (m.meta_propuesta !== null && m.fuente_meta) {
      meta = m.meta_propuesta;
      fuenteMeta = m.fuente_meta + " (meta propuesta en la carga)";
      mr = { ...(mr || {}), verde_min: mr ? mr.verde_min : null, rojo_min: mr ? mr.rojo_min : null, base: mr ? mr.base : "cumplimiento", fuente_umbral: mr ? mr.fuente_umbral : "" };
    }
    const regla = reglaKey(mr && mr.regla);
    const v = m.valor as number;
    const out: EvalPoint = { valor: v, meta, ref: meta, esperado: null, espTxt: "", prorrata: false, espFuente: "", fuenteMeta, unidad: mi.unidad, sentido: mi.sentido, cumpl: null, state: "DEF", bands: null, bandsSrc: "", pinfo: m.pinfo!, m, regla, cumple: null };
    if (meta === null || mi.sentido === "Por definir") return out;
    let esp: number = meta;
    if (m.esperado !== null && m.esperado !== undefined && m.fuente_esperado) { esp = m.esperado; out.espFuente = m.fuente_esperado; }
    else if (mr && mr.avance === "Acumulado en el año") {
      const fp = this.poiFraccion(id, m.pinfo!);
      if (fp) {
        esp = meta * fp.f; out.poiEsp = fp;
        out.espFuente = `Meta anual × ${fmtN(fp.f * 100, 1)} % programado acumulado al cierre de ${m.pinfo!.p} según el POI mensual de la Facultad (actividad ${fp.det[0].act}: ${fmtN(fp.det[0].acum, 0)} de ${fmtN(fp.det[0].tot, 0)}; reporte ${fp.rep.reporte}); actividad de referencia elegida por criterio propio [CP]`;
      } else if (m.origen === "EJEMPLO") {
        const f = this.yearFraction(m.pinfo!);
        if (f < 1) { esp = meta * f; out.prorrata = true; out.espFuente = `EJEMPLO: meta anual × ${fmtN(f * 100, 0)} % del año transcurrido al cierre de ${m.pinfo!.p}`; }
      } else if (m.pinfo!.tipo !== "A") {
        out.espTxt = "sin programado acumulado en el POI mensual: no hay valor esperado con fuente"; out.parcial = true; out.state = "SEG"; out.sinEsperado = true;
        return out;
      }
    }
    out.esperado = esp; out.ref = esp;
    out.espTxt = esp !== meta || out.espFuente ? `lo esperado a la fecha (${fmtVal(esp, mi.unidad)}; meta anual ${fmtVal(meta, mi.unidad)})` : `una meta de ${fmtVal(meta, mi.unidad)}`;
    let c: number;
    const menor = mi.sentido === "Menor es mejor";
    if (esp === 0) c = menor ? (v <= 0 ? 100 : 0) : v >= 0 ? 100 : 0;
    else c = menor ? (v > 0 ? (esp / v) * 100 : 100) : (v / esp) * 100;
    out.cumpl = c;
    const freqI = (this.CARG_BY[id] || ({} as Cargable)).frecuencia;
    if (regla === "menor_igual" || regla === "no_negativa") {
      out.cumple = regla === "menor_igual" ? v <= esp : v >= esp;
      out.espTxt = regla === "menor_igual" ? `un máximo de ${fmtVal(esp, mi.unidad)} (cumple si es menor o igual)` : `una variación no negativa (cumple si es mayor o igual a ${fmtVal(esp, mi.unidad)})`;
    }
    if (!(mr && mr.avance === "Acumulado en el año") && !out.espFuente && freqI === "Anual" && m.pinfo!.tipo !== "A") { out.state = "SEG"; out.parcial = true; return out; }
    if (out.cumple !== null) { out.state = out.cumple ? "OK" : "BAJO"; return out; }
    let vm: number | null = mr && mr.verde_min != null ? mr.verde_min : null;
    let rm: number | null = mr && mr.rojo_min != null ? mr.rojo_min : null;
    let base = (mr && mr.base) || "cumplimiento";
    let src = (mr && mr.fuente_umbral) || "";
    if (vm !== null && rm !== null && !String(src).trim()) { vm = rm = null; }
    if (vm === null || rm === null) {
      if (m.origen === "EJEMPLO") { vm = 95; rm = 75; base = "cumplimiento"; src = "EJEMPLO: bandas de los reportes del POI aplicadas solo para demostrar el semáforo"; }
      else { vm = rm = null; }
    }
    if (vm !== null && rm !== null) {
      out.bands = { verde: vm, rojo: rm, base };
      out.bandsSrc = src;
      const x = base === "valor" ? v : c;
      out.state = x >= vm ? "OK" : x >= rm ? "RIESGO" : "CRIT";
    } else out.state = c >= 100 ? "OK" : "BAJO";
    return out;
  }

  seriesFor(esc: string, id: string) {
    const eid = this.effId(id);
    const rows = this.DB.vis.filter((r) => r.escuela === esc && r.indicador === eid);
    const byP = new Map<string, NormRow[]>();
    rows.forEach((r) => { (byP.get(r.periodo) || byP.set(r.periodo, []).get(r.periodo)!).push(r); });
    const pts: NormRow[] = [];
    byP.forEach((lst) => {
      const escRow = lst.find((r) => r.area === "");
      let rep: NormRow;
      if (escRow) rep = escRow;
      else {
        const vals = lst.map((r) => r.valor as number);
        rep = {
          ...lst[0], area: "(promedio de áreas)", valor: vals.reduce((a, b) => a + b, 0) / vals.length, promedioAreas: lst.length,
          ev: lst.every((r) => r.ev || r.ev_ref) ? lst[0].ev : "", ev_ref: lst.every((r) => r.ev || r.ev_ref) ? lst[0].ev_ref : "",
          estado_val: lst.every((r) => r.estado_val === "Validado" || r.estado_val === "Dato de reporte") ? "Validado" : lst.find((r) => r.estado_val !== "Validado")!.estado_val,
        };
      }
      pts.push(rep);
    });
    pts.sort((a, b) => a.pinfo!.end.getTime() - b.pinfo!.end.getTime());
    const ev = pts.map((m) => this.evalPoint(eid, m));
    return { eid, id, pts, ev };
  }

  status(esc: string, id: string): Status {
    const k = esc + "|" + id;
    const hit = this.sc.get(k);
    if (hit) return hit;
    const sr = this.seriesFor(esc, id);
    const eid = sr.eid;
    const mi = this.metaInfo(eid);
    const freq = (this.CARG_BY[eid] || ({} as Cargable)).frecuencia || "Anual";
    const corte = this.corteDate();
    const gracia = +this.params.gen.dias_gracia || 0;
    const expEnd = expectedEnd(freq, corte, gracia);
    const res: Status = { esc, id, eid, freq, sr, last: null, state: "SD", desde: null, desdeTxt: "", vencido: false, expEnd, expLabel: periodLabelFromEnd(freq, expEnd), overdueSince: null, tendencia: null, mi };
    if (sr.ev.length) {
      const L = sr.ev[sr.ev.length - 1];
      res.last = L; res.state = L.state;
      let i = sr.ev.length - 1;
      while (i > 0 && sr.ev[i - 1].state === L.state) i--;
      res.desde = sr.ev[i].pinfo.end; res.desdePeriodo = sr.ev[i].pinfo.p; res.runLen = sr.ev.length - i;
      if (expEnd && L.pinfo.end < expEnd) {
        res.vencido = true;
        const nx = nextEndAfter(freq, L.pinfo.end);
        res.overdueSince = nx ? addDays(nx, gracia) : null;
      }
      const n = Math.max(1, +this.params.gen.n_periodos_tendencia || 2);
      if (sr.ev.length >= n + 1) {
        const tail = sr.ev.slice(-(n + 1));
        const key = (e: EvalPoint) => (e.cumpl !== null ? e.cumpl : mi.sentido === "Mayor es mejor" ? e.valor : mi.sentido === "Menor es mejor" ? -e.valor : null);
        const ks = tail.map(key);
        if (ks.every((k2) => k2 !== null) && ks.slice(1).every((k2, j) => (k2 as number) < (ks[j] as number) - 1e-9))
          res.tendencia = { n, serie: tail.map((e) => `${e.pinfo.p}: ${fmtN(e.valor)}${e.unidad === "%" ? " %" : ""}`).join(" → ") };
      }
    }
    this.sc.set(k, res);
    return res;
  }

  /* ---------- alcance ---------- */
  inScope(esc: string, id: string): boolean {
    const c = this.CARG_BY[id];
    if (!c) return false;
    const v = this.scopes[esc]?.alcance?.[id];
    if (v) return v === "Sí" || (v === "Solo Facultad" && esc === "FAC");
    if (esc === "FAC") return c.ambito === "Facultad";
    if (c.ambito === "Facultad") return false;
    return this.defaultScope(c);
  }
  scopeList(esc: string): Cargable[] { return this.CARGABLES.filter((c) => this.inScope(esc, c.id)); }
  enImplementacion(esc: string): boolean {
    if (esc === "FAC") return true;
    const lst = String(this.params.gen.escuelas_en_implementacion ?? "").split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
    return lst.includes(esc) || this.schoolHasData(esc);
  }
  schoolHasData(esc: string): boolean { return this.DB.vis.some((r) => r.escuela === esc) || this.schoolsWithFiles.has(esc); }
  responsableOf(esc: string, id: string): string {
    const loc = this.scopes[esc]?.respLocal?.[id];
    if (loc) return loc;
    const i = this.IND_BY[id];
    if (i) return i.responsable || "Por confirmar";
    const s = this.SIN_BY[id];
    if (s) {
      const fs = s.fichas.map((x) => this.FICHA_BY[x]).filter(Boolean).map((f) => f.responsable.replace(/\s*\(por confirmar\)/, ""));
      return (fs[0] || "Por confirmar") + " (por confirmar)";
    }
    return "Por confirmar";
  }
  procsOfIndicator(id: string): string[] {
    const ids = new Set([id]);
    Object.values(this.IND_BY).forEach((i) => { if (i.alias_sineace === id) ids.add(i.id); });
    const ps = new Set<string>();
    this.M.rel_proceso_indicador.forEach(([p, i]) => { if (ids.has(i)) ps.add(p); });
    if (this.SIN_BY[id]) this.SIN_BY[id].indicadores_proceso.forEach((i) => this.M.rel_proceso_indicador.forEach(([p, ii]) => { if (ii === i) ps.add(p); }));
    return Array.from(ps).sort();
  }
  STAND_OF = (id: string): string[] => (this.SIN_BY[id] ? this.SIN_BY[id].estandares : []);
  aoiForInd = (id: string): string[] => uniq([...this.M.rel_indicador_aoi.filter((r) => r[0] === id).map((r) => r[1]), ...this.M.rel_sineace_aoi.filter((r) => r[0] === id).map((r) => r[1])]);

  /* ---------- agregación: peor indicador ---------- */
  rankOf(code: StateCode): number {
    if (code === "SD" && this.params.gen.sin_dato_en_agregado === "Excluye") return 0;
    return ST[code].rank;
  }
  worstOf<T extends { code: StateCode; gap?: number }>(items: T[]): { code: StateCode; item: T | null } {
    let best: T | null = null;
    items.forEach((it) => {
      const r = this.rankOf(it.code);
      if (r <= 0) return;
      if (!best || r > this.rankOf(best.code) || (r === this.rankOf(best.code) && (it.gap || 0) > (best.gap || 0))) best = it;
    });
    if (best) return { code: (best as T).code, item: best };
    const hasDef = items.some((it) => it.code === "DEF");
    const hasOk = items.some((it) => it.code === "OK");
    return { code: hasOk ? "OK" : hasDef ? "DEF" : "NA", item: null };
  }
  gapOf = (st: Status): number => (st.last && st.last.cumpl !== null ? Math.max(0, 100 - st.last.cumpl) : 0);

  aggregateIndicators(esc: string, ids: string[]) {
    const items = ids
      .filter((id) => this.inScope(esc, this.effId(id)) || this.inScope(esc, id))
      .map((id) => { const st = this.status(esc, id); return { id, code: st.state, st, gap: this.gapOf(st) }; });
    const w = this.worstOf(items);
    const counts: Record<string, number> = { CRIT: 0, RIESGO: 0, BAJO: 0, SD: 0, SEG: 0, OK: 0, DEF: 0 };
    items.forEach((i) => counts[i.code]++);
    return { items, worst: w, counts };
  }
  worstAcross(id: string, escs: string[]) {
    const items = escs
      .filter((e) => this.inScope(e, this.effId(id)) || this.inScope(e, id))
      .map((e) => { const st = this.status(e, id); return { id, code: st.state, st, gap: this.gapOf(st), esc: e }; });
    return items.length ? this.worstOf(items) : { code: "NA" as StateCode, item: null };
  }

  poiProcItems(pid: string): any[] {
    const A = this.poiAll();
    const out: any[] = [];
    (this.M.proc_poi || []).filter((r) => r[0] === pid).forEach(([, act]) => {
      for (let k = this.M.poi_reportes.length - 1; k >= 0; k--) {
        const rep = this.M.poi_reportes[k];
        const x = A[rep.anio].lista.find((z: any) => z.act === act && z.prog > 0);
        if (!x) continue;
        const vg = +this.params.gen.banda_poi_verde || 95, rg = +this.params.gen.banda_poi_rojo || 75;
        const code: StateCode = x.avance >= vg ? "OK" : x.avance >= rg ? "RIESGO" : "CRIT";
        const a = this.AOI_BY[act];
        out.push({
          id: "POI " + act, poi: true, act, nombre: a ? a.actividad : act, rep, x, code, gap: Math.max(0, 100 - x.avance), scoped: true,
          st: { state: code, esc: "FAC", last: { cumpl: x.avance, valor: x.ejec, meta: x.prog, unidad: "", pinfo: { p: rep.etiqueta }, m: { origen: "Real" } }, desde: null },
        });
        return;
      }
    });
    return out;
  }
  processState(esc: string, pid: string) {
    const ids = this.M.rel_proceso_indicador.filter((r) => r[0] === pid).map((r) => r[1]);
    let list = ids;
    if (esc === "FAC") list = ids.filter((i) => this.IND_BY[i] && (this.IND_BY[i].ambito === "Facultad" || this.DB.vis.some((r) => r.escuela === "FAC" && r.indicador === this.effId(i))));
    const items: any[] = list
      .map((id) => {
        const eid = this.effId(id);
        const scoped = this.inScope(esc, eid) || this.inScope(esc, id);
        const st = this.status(esc, id);
        return { id, eid, code: scoped ? st.state : "NA", st, gap: this.gapOf(st), scoped };
      })
      .filter((i) => i.scoped);
    this.poiProcItems(pid).forEach((i) => items.push(i));
    if (!items.length) return { code: "NA" as StateCode, items: [] as any[], counts: {} as Record<string, number>, worst: { code: "NA" as StateCode, item: null as any } };
    const w = this.worstOf(items);
    const counts: Record<string, number> = { CRIT: 0, RIESGO: 0, BAJO: 0, SD: 0, SEG: 0, OK: 0, DEF: 0 };
    items.forEach((i) => counts[i.code]++);
    return { code: w.code, items, counts, worst: w };
  }

  coverageStats(esc: string) {
    const list = this.scopeList(esc);
    const n = list.length;
    let dato = 0, evi = 0, val = 0, venc = 0;
    list.forEach((c) => {
      const st = this.status(esc, c.id);
      if (st.last) {
        dato++;
        if (st.last.m.ev || st.last.m.ev_ref) evi++;
        if (["Validado", "Dato de reporte"].includes(st.last.m.estado_val)) val++;
        if (st.vencido) venc++;
      }
    });
    return { n, dato, evi, val, venc };
  }

  /* ---------- evidencias ---------- */
  evidenceRows(modo?: "EJ" | "REAL"): EvidRow[] {
    const all: EvidRow[] = [];
    if (this.ejemplo) this.EXJ.evidencias.forEach((e: any) => all.push({ ...e, origen: "EJEMPLO" }));
    (this.input.evidence ?? []).forEach((e) => all.push(e));
    const map = new Map<string, EvidRow>();
    all
      .filter((e) => (this.ejemplo || e.origen !== "EJEMPLO") && (modo === "EJ" ? e.origen === "EJEMPLO" : modo === "REAL" ? e.origen !== "EJEMPLO" : true))
      .forEach((e) => map.set([e.escuela, e.area, e.ev].join("|"), e));
    return Array.from(map.values());
  }
  EV_OK = (r: EvidRow) => r.estado === "Validada" || r.estado === "Disponible";
  evFaltantes(esc: string, std: string) {
    const evs = this.M.evidencias.filter((e) => e.estandar === std).map((e) => e.id);
    const areas = esc === "TM" ? TM_AREAS : [""];
    const rows = this.evidenceRows();
    const by = new Map(rows.map((r) => [r.escuela + "|" + r.area + "|" + r.ev, r]));
    const falt: string[] = [];
    let ejemplo = false;
    evs.forEach((ev) => {
      const rs = areas.map((a) => by.get(esc + "|" + a + "|" + ev));
      rs.forEach((r) => { if (r && r.origen === "EJEMPLO") ejemplo = true; });
      if (rs.some((r) => !r || (!this.EV_OK(r) && r.estado !== "No aplica"))) falt.push(ev);
    });
    return { evs, falt, ejemplo };
  }

  /** Catálogo de criterios del modelo (se toma del Consolidado incluido; igual para las tres escuelas). */
  critCatalog() {
    if (this.CRIT_CAT) return this.CRIT_CAT;
    const src = Object.values(this.autoeval).find((a) => a.fabrica) || Object.values(this.autoeval)[0];
    if (src) this.CRIT_CAT = src.criterios.map((c) => ({ estandar: c.estandar, criterio: c.criterio, resumen: c.resumen, evExig: c.evExig }));
    return this.CRIT_CAT || [];
  }

  /* ---------- alertas ---------- */
  ruleOf(id: string) { return this.params.reglas.find((r) => r.id === id); }

  private buildAlerts(): Alert[] {
    const out: Alert[] = [];
    const gen = this.params.gen;
    const add = (reg: string, o: any) => {
      const r = this.ruleOf(reg);
      if (!r || r.activa === "No") return;
      const sev = o.sev || r.severidad;
      out.push({
        regla: reg, reglaNombre: r.nombre, severidad: sev, ...o,
        periodo: o.objeto === "Indicador" ? String(o.ctx && o.ctx.periodo !== undefined && o.ctx.periodo !== "—" ? o.ctx.periodo : "") : o.anio ? String(o.anio) : "",
        que: fillTpl(r.que, o.ctx), porque: fillTpl(r.porque, o.ctx), accion: fillTpl(r.accion, o.ctx),
      });
    };
    SCH.forEach((esc) => {
      if (!this.schoolHasData(esc) && this.enImplementacion(esc)) {
        add("R10", { escuela: esc, objeto: "Escuela", objetoId: esc, objetoNombre: ESC_BY[esc].nombre, desde: null, desdeTxt: "Sin archivo de carga", responsable: "Dirección de la escuela y coordinación de calidad (por confirmar)", ctx: { escuela: ESC_BY[esc].nombre } });
      }
    });
    ORD.forEach((esc) => {
      if (esc !== "FAC" && !this.schoolHasData(esc)) return;
      const rej = this.DB.rejected.filter((r) => r.escuela === esc && r.motivo && r.motivo.startsWith("Sin fuente"));
      if (rej.length) add("R11", { escuela: esc, objeto: "Carga", objetoId: esc, objetoNombre: `${rej.length} fila(s) sin fuente`, desde: parseISO(rej[0].fecha_carga), desdeTxt: rej[0].fecha_carga ? fmtDate(parseISO(rej[0].fecha_carga)) : "—", responsable: "Responsable de carga de la escuela", ctx: { n: rej.length, escuela: ESC_BY[esc].nombre } });
      this.scopeList(esc).forEach((c) => {
        const st = this.status(esc, c.id);
        const nm = c.nombre;
        const label = `${c.id} ${nm}`;
        const respo = this.responsableOf(esc, c.id);
        const ctx0: Record<string, any> = { indicador: label, escuela: ESC_BY[esc].nombre, frecuencia: st.freq.toLowerCase(), gracia: gen.dias_gracia, periodo_esperado: st.expLabel };
        const base = { escuela: esc, objeto: "Indicador", objetoId: c.id, objetoNombre: nm, responsable: respo, proceso: this.procsOfIndicator(this.effId(c.id)) };
        if (!st.last) {
          if (st.expEnd && this.enImplementacion(esc)) add("R03", { ...base, desde: addDays(st.expEnd, +gen.dias_gracia || 0), desdeTxt: `vencido el ${fmtDate(addDays(st.expEnd, +gen.dias_gracia || 0))}`, ctx: ctx0 });
          return;
        }
        const L = st.last;
        const ctx: Record<string, any> = {
          ...ctx0, valor: fmtVal(L.valor, L.unidad), meta: L.meta !== null ? fmtVal(L.meta, L.unidad) : "—",
          esperado_txt: L.meta !== null ? L.espTxt : "una meta por definir", cumpl: L.cumpl !== null ? fmtN(L.cumpl, 1) : "—",
          periodo: L.pinfo.p, desde: st.overdueSince ? fmtDate(st.overdueSince) : "—", sentido: st.mi.sentido.toLowerCase(),
          verde_min: L.bands ? L.bands.verde : "—", rojo_min: L.bands ? L.bands.rojo : "—",
          base_txt: L.bands && L.bands.base === "valor" ? "% de avance" : "% de la meta", fuente_umbral: L.bandsSrc || "los parámetros",
          estado_validacion: L.m.estado_val, n: st.tendencia ? st.tendencia.n : "", serie: st.tendencia ? st.tendencia.serie : "",
        };
        const dsd = st.desde ? `desde el periodo ${st.desdePeriodo} (${fmtDate(st.desde)})` : "";
        const exTag = L.m.origen === "EJEMPLO";
        if (st.state === "CRIT") add("R01", { ...base, desde: st.desde, desdeTxt: dsd, ctx, ejemplo: exTag });
        if (st.state === "RIESGO") add("R02", { ...base, desde: st.desde, desdeTxt: dsd, ctx, ejemplo: exTag });
        if (st.state === "BAJO") add("R09", { ...base, desde: st.desde, desdeTxt: dsd, ctx, ejemplo: exTag });
        if (st.vencido) add("R04", { ...base, desde: st.overdueSince, desdeTxt: st.overdueSince ? `plazo vencido el ${fmtDate(st.overdueSince)}` : "", ctx, ejemplo: exTag });
        if (st.tendencia) add("R05", { ...base, desde: st.sr.ev[st.sr.ev.length - 1 - st.tendencia.n].pinfo.end, desdeTxt: `desde el periodo ${st.sr.ev[st.sr.ev.length - 1 - st.tendencia.n].pinfo.p}`, ctx, ejemplo: exTag });
        if (gen.evidencia_obligatoria !== "No" && !(L.m.ev || L.m.ev_ref)) add("R06", { ...base, desde: parseISO(L.m.fecha_carga) || L.pinfo.end, desdeTxt: `cargado el ${L.m.fecha_carga ? fmtDate(parseISO(L.m.fecha_carga)) : "—"}`, ctx, ejemplo: exTag });
        if (!["Validado", "Dato de reporte"].includes(L.m.estado_val)) add("R07", { ...base, desde: parseISO(L.m.fecha_carga) || L.pinfo.end, desdeTxt: `cargado el ${L.m.fecha_carga ? fmtDate(parseISO(L.m.fecha_carga)) : "—"}`, ctx, ejemplo: exTag });
      });
    });
    // R08 POI
    const A = this.poiAll();
    const anios = gen.poi_evaluar === "Todos" ? this.M.poi_reportes.map((r) => r.anio) : [this.M.poi_reportes[this.M.poi_reportes.length - 1].anio];
    const vg = +gen.banda_poi_verde || 95, rg = +gen.banda_poi_rojo || 75;
    anios.forEach((an) => {
      const rep = A[an].rep;
      A[an].conProg.forEach((x: any) => {
        if (x.avance >= vg) return;
        const a = this.AOI_BY[x.act];
        let desdeMes: number | null = null;
        for (let i = x.acum.length - 1; i >= 0; i--) {
          const z = x.acum[i];
          if (z.mes > rep.mes_corte) continue;
          if (z.prog > 0 && Math.min(100, (z.ejec / z.prog) * 100) < vg) desdeMes = z.mes;
          else if (z.prog > 0) break;
        }
        const ctx = { aoi: x.aoi, actividad: a ? a.actividad : x.act, avance: fmtN(x.avance, 1), corte: rep.etiqueta, ejec: fmtN(x.ejec, 0), prog: fmtN(x.prog, 0), verde_min: vg, rojo_min: rg };
        add("R08", { escuela: "FAC", objeto: "AOI", objetoId: x.act, objetoNombre: `${x.aoi} · ${a ? a.actividad : ""}`, sev: x.avance < rg ? "Crítica" : "En riesgo", desde: desdeMes ? dUTC(an, desdeMes, 1) : null, desdeTxt: desdeMes ? `desde ${fmtMonth(dUTC(an, desdeMes, 1))}` : "", responsable: "UPPR y responsable de la actividad (por confirmar); compartida por la Facultad", proceso: [], ctx, poi: true, anio: an });
      });
    });
    // R12 y R13: autoevaluación por criterio
    Object.values(this.autoeval).forEach((ae) => {
      const base = (c: any) => ({ escuela: ae.escuela, objeto: "Criterio", objetoId: c.criterio, objetoNombre: `${c.criterio} ${c.resumen}`, responsable: "Responsable del estándar " + c.estandar.replace("E", "") + " y Comité de Calidad de la escuela (por confirmar)", proceso: [], desde: null, desdeTxt: "Consolidado " + (ae.fabrica ? "incluido de fábrica" : "cargado " + ae.cargadoEn.slice(0, 10)), estandarSel: c.estandar });
      ae.criterios.forEach((c) => {
        if (c.evSin.length) add("R12", { ...base(c), ctx: { criterio: c.criterio, estandar: c.estandar, escuela: ESC_BY[ae.escuela].nombre, n_sin: c.evSin.length, n_exig: Math.max(c.evExig.length, c.evSin.length), evidencias: c.evSin.join(", "), ref: c.ref, valoracion: c.valoracion } });
        const pm = c.matrices.filter((x) => /pendiente/i.test(x.estado));
        if (pm.length) {
          const nom = (n: number) => { const x = ae.matrices.find((y) => y.n === n); return `M${n}${x ? " " + x.matriz.slice(0, 60) + (x.matriz.length > 60 ? "…" : "") : ""}`; };
          add("R13", { ...base(c), ctx: { criterio: c.criterio, estandar: c.estandar, escuela: ESC_BY[ae.escuela].nombre, n_pend_crit: pm.length, matriz: pm.map((x) => nom(x.n)).join("; "), ref: ae.matrices.find((y) => y.n === pm[0].n)?.ref || c.ref, n_pend: ae.nPend, n_mat: ae.nMat } });
        }
      });
    });
    // R14: estándares sin indicadores del modelo
    this.M.estandares.filter((e) => !this.M.sineace.some((x) => x.estandares.includes(e.id))).forEach((e) => {
      SCH.filter((x) => this.enImplementacion(x)).forEach((esc) => {
        const r = this.evFaltantes(esc, e.id);
        if (!r.falt.length) return;
        add("R14", { escuela: esc, objeto: "Estándar", objetoId: e.id, objetoNombre: `${e.id} ${e.nombre} (${r.evs[0]}–${r.evs[r.evs.length - 1]})`, responsable: "Responsable del estándar " + e.id.replace("E", "") + " y Comité de Calidad de la escuela (por confirmar)", proceso: [], desde: null, desdeTxt: "Hasta que se cargue la hoja Evidencias", estandarSel: e.id, ejemplo: r.ejemplo, ctx: { estandar: e.id + " · " + e.nombre, escuela: ESC_BY[esc].nombre, n_sin: r.falt.length, n_exig: r.evs.length, evidencias: r.falt.join(", "), nproc: this.M.procesos102.length } });
      });
    });
    out.forEach((a) => { a.uid = `${a.regla}|${a.escuela}|${a.objetoId}|${a.anio || ""}`; });
    out.sort(cmpAlert);
    return out;
  }
}

export function cmpAlert(a: Alert, b: Alert): number {
  const SEVR: Record<string, number> = { Crítica: 3, "En riesgo": 2, Aviso: 1 };
  return (
    ORD.indexOf(a.escuela as EscId) - ORD.indexOf(b.escuela as EscId) ||
    (SEVR[b.severidad] || 0) - (SEVR[a.severidad] || 0) ||
    natKey(a.objetoId).localeCompare(natKey(b.objetoId)) ||
    String(a.periodo || "").localeCompare(String(b.periodo || "")) ||
    (a.desde ? a.desde.getTime() : 9e15) - (b.desde ? b.desde.getTime() : 9e15) ||
    String(a.regla).localeCompare(String(b.regla))
  );
}

export { FREQ_MONTHS, clone };

/** Índices del catálogo que necesitan los lectores de Excel (sin armar un Engine completo). */
export function catalogIndex(M: Model) {
  const CARGABLES = cargablesOf(M);
  return {
    CARGABLES,
    CARG_BY: Object.fromEntries(CARGABLES.map((c) => [c.id, c])) as Record<string, Cargable>,
    IND_BY: Object.fromEntries(M.indicadores.map((i) => [i.id, i])) as Record<string, IndicadorDef>,
    SIN_BY: Object.fromEntries(M.sineace.map((s) => [s.id, s])) as Record<string, SineaceDef>,
  };
}
