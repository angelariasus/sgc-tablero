/**
 * Vista «Decisión» (v0.7 del tablero original): alerta de gestión PROPUESTA con la sección 9.1 del Modelo CONEAU-SINEACE.
 * Semáforo verde, amarillo, rojo y gris por indicador y por proceso, con valores cargados, ediciones y validaciones.
 */
import type { Engine } from "./core";
import { periodInfo } from "./periods";
import { fmtN, natKey, parseISO } from "./util";

export const DEC_CORTE = "2026-10-22";
export const DEC_MODELO = "Modelo de Acreditación CONEAU-SINEACE, edición de marzo de 2026";
export const DEC_BASE_FUENTE = "Dato informado por Robert para la EPTM en el proyecto (mensaje del 22-10-2026); documento de origen por confirmar";
export const DEC_BASE_TS = "2026-10-22T00:00:00.000Z";
export const DEC_AREA_COD: Record<string, string> = { "Radiología": "RAD", "Terapia Física": "TF", "Terapia Ocupacional": "TO", "Laboratorio Clínico y Anatomía Patológica": "LCAP" };
export const DEC_COD_AREA: Record<string, string> = Object.fromEntries(Object.entries(DEC_AREA_COD).map(([a, c]) => [c, a]));
export const DEC_AREA_CORTO: Record<string, string> = { RAD: "Radiología", TF: "Terapia Física", TO: "Terapia Ocupacional", LCAP: "Lab. Clínico y AP" };
export const DEC_AREAS = ["RAD", "TF", "TO", "LCAP"];
export const DEC_ESC = ["ENF", "OBS", "TM"];
export const DEC_ESC_NOM: Record<string, string> = { ENF: "Enfermería", OBS: "Obstetricia", TM: "Tecnología Médica" };
/* frecuencia de cálculo según las fichas del Modelo (campo FRECUENCIA DE CÁLCULO) */
export const DEC_FREQ: Record<string, string> = { ID1: "Anual", ID2: "Semestral", ID3: "Semestral", ID4: "Semestral", ID5: "Semestral", ID6: "Anual", ID7: "Semestral", ID8: "Semestral", ID9: "Semestral", ID10: "Semestral", ID11: "Semestral", ID12: "Cada tres años", ID13: "Semestral", ID14: "Semestral", ID15: "Anual", ID16: "Semestral", ID17: "Semestral", ID18: "Semestral", ID19: "Semestral", ID20: "Anual", ID21: "Anual", ID22: "Anual", ID23: "Anual", ID24: "Anual", ID25: "Anual", ID26: "Anual", ID27: "Anual", ID28: "Anual", ID29: "Anual" };
/* Decisión de Robert (22-10-2026): ID4 = 70 %. El campo REFERENCIAL de la ficha dice 60 % (línea 2357 del texto del Modelo) y la INTERPRETACIÓN dice 70 % (línea 2358). */
export const DEC_REF_OVERRIDE: Record<string, { ref: number; nota: string }> = { ID4: { ref: 70, nota: "Decisión de Robert (22-10-2026): 70 %, según la interpretación de la ficha. El campo REFERENCIAL de la ficha dice 60 % (Modelo, texto plano, línea 2357); la interpretación dice 70 % (línea 2358). Por confirmar con la OCAA." } };
export const DEC_FICHA_TXT: Record<string, string> = { "por confirmar": "Por confirmar", "sin ficha": "Sin ficha", borrador: "Ficha en borrador", aprobada: "Ficha aprobada" };
export const DEC_FICHA_COL: Record<string, DcCode> = { "por confirmar": "gris", "sin ficha": "rojo", borrador: "amarillo", aprobada: "verde" };

export type DcCode = "verde" | "amarillo" | "rojo" | "gris";
/* ---- semáforo ---- */
export const DC: Record<DcCode, { n: number; rank: number; label: string; short: string; cls: string; icon: string }> = {
  verde: { n: 3, rank: 0, label: "Verde", short: "Alcanza", cls: "ok", icon: "i-ok" },
  amarillo: { n: 2, rank: 2, label: "Amarillo", short: "Vigilar", cls: "risk", icon: "i-risk" },
  rojo: { n: 1, rank: 3, label: "Rojo", short: "En riesgo", cls: "crit", icon: "i-crit" },
  gris: { n: 0, rank: 1, label: "Gris", short: "Sin dato", cls: "nodata", icon: "i-nodata" },
};
export const DC_ORDER: DcCode[] = ["rojo", "amarillo", "gris", "verde"];
export const dcWorst = (list: DcCode[]): DcCode => list.reduce<DcCode | null>((w, c) => (!w || DC[c].rank > DC[w].rank ? c : w), null) || "gris";

/* ---- datos base de la EPTM (corte 22-10-2026, informados por Robert) ---- */
export const DEC_BASE_SERIES: { ind: string; area: string; per: string[]; v: number[]; def?: boolean }[] = [
  { ind: "ID19", area: "RAD", per: ["2024-S2", "2025-S1", "2025-S2", "2026-S1"], v: [89, 96, 60, 100] },
  { ind: "ID19", area: "TF", per: ["2024-S2", "2025-S1", "2025-S2", "2026-S1"], v: [74, 89, 88, 50] },
  { ind: "ID19", area: "TO", per: ["2024-S2", "2025-S1", "2025-S2", "2026-S1"], v: [69, 79, 93, 87] },
  { ind: "ID19", area: "LCAP", per: ["2024-S2", "2025-S1", "2025-S2", "2026-S1"], v: [57, 55, 52, 75] },
  { ind: "ID13", area: "", per: ["2024-S2", "2025-S1", "2025-S2", "2026-S1"], v: [13, 13, 18, 14] },
  { ind: "ID14", area: "", per: ["2024-S2", "2025-S1", "2025-S2", "2026-S1"], v: [25, 31, 28, 28] },
  { ind: "ID6", area: "", per: ["2025", "2026"], v: [35.6, 3.9] },
  { ind: "ID10", area: "RAD", per: ["2024-S2", "2025-S1", "2025-S2"], v: [100, 100, 100], def: true },
  { ind: "ID10", area: "TF", per: ["2024-S2", "2025-S1", "2025-S2"], v: [83, 100, 100], def: true },
  { ind: "ID10", area: "TO", per: ["2024-S2", "2025-S1", "2025-S2"], v: [100, 100, 100], def: true },
  { ind: "ID10", area: "LCAP", per: ["2024-S2", "2025-S1", "2025-S2"], v: [100, 92, 94], def: true },
];
export const DEC_DEF_NOTA = "El dato informado es la proporción de asignaturas con ≥80 % de aprobados; la ficha del Modelo define ID10 como porcentaje de estudiantes aprobados por asignatura. Definición por confirmar: el semáforo queda en gris.";
export const DEC_BASE_NOTA: Record<string, { txt: string; acc: string }> = {};
["ID1", "ID2", "ID3", "ID4", "ID5", "ID7", "ID8", "ID9", "ID12", "ID16", "ID17", "ID18", "ID20", "ID21", "ID22", "ID23", "ID24", "ID26", "ID27", "ID29"].forEach((id) => {
  DEC_BASE_NOTA[id] = { txt: "Sin medir; encuesta OCCAA programada para 2026-II", acc: "Aplicar la encuesta programada (OCCAA, 2026-II) y cargar el resultado con su fuente." };
});
["ID15", "ID25", "ID28"].forEach((id) => { DEC_BASE_NOTA[id] = { txt: "Sin calcular", acc: "Calcular el indicador con la fórmula de la ficha del Modelo y cargar el valor con su fuente." }; });
DEC_BASE_NOTA.ID11 = { txt: "Sin dato", acc: "Obtener los registros de ejecución de los sílabos y cargar el valor con su fuente." };
export const DEC_BASE_PROC_FUENTE = "Estado del SGC en la EPTM informado por Robert (22-10-2026): «en diseño»; Manual v0.1 y ficha piloto del proceso 1; faltan 8 fichas, la resolución de los comités de Calidad y de Gestión y la primera revisión por la Dirección (criterio 10.4)";

/* ---- periodos ---- */
export function decPerLabel(p: string): string { const m = String(p).match(/^(\d{4})-S([12])$/); return m ? m[1] + (m[2] === "1" ? "-I" : "-II") : String(p); }
export function decPerEnd(p: string): number { const i = periodInfo(p); return i ? i.end.getTime() : 0; }
export function decPerPrevYear(p: string): string | null { const m = String(p).match(/^(\d{4})(-S[12])?$/); return m ? +m[1] - 1 + (m[2] || "") : null; }

/* ---- tipos de entrada ---- */
export type DecRol = "oficina" | "responsable";
export interface DecEntry {
  t: "v" | "p";
  key: string;
  esc: string;
  /** valores */ area?: string; ind?: string; per?: string; val?: number; fuente?: string; corte?: string; nota?: string; anulado?: boolean;
  /** procesos */ proc?: string; ficha?: string; dueno?: string;
  ts: string;
  /** id de quien lo registró */ autor: string;
}
export interface DecValidation { key: string; entryTs: string; estado: string; nota?: string; by: string; ts: string }
export interface DecEvent { ts: string; by: string; accion: string; clave?: string; esc?: string; antes?: any; despues?: any; nota?: string; [k: string]: any }
export interface DecisionInput {
  /** quién puede validar o editar (el administrador y la Oficina de Calidad figuran como «oficina») */
  roster: Record<string, { rol: DecRol; escuela?: string }>;
  entries: DecEntry[];
  validations: DecValidation[];
  events: DecEvent[];
  /** nombres visibles por id de usuario */
  names: Record<string, string>;
}
export interface DecisionOptions {
  /** fecha de corte de la evaluación de «dato vencido» (por defecto, la del original) */
  corte?: string;
  /** solo valores validados por la oficina */
  soloVal?: boolean;
}

export interface DecPoint {
  key: string; esc: string; area: string; ind: string; per: string; val: number; fuente: string; fuenteCorta?: string; corte: string; nota: string; def: boolean;
  origen: string; autor: string; ts: string; anulado: boolean; valArchivo?: string;
  vestado: string; vpor: string; vcuando: string; vnota: string;
}

export class DecisionBoard {
  readonly E: Engine;
  readonly input: DecisionInput;
  readonly corte: string;
  readonly soloVal: boolean;
  readonly IND: Record<string, { id: string; nombre: string; ref: number; refNota: string; unidad: string; menor: boolean; est: string[]; crit: string[]; frec: string }> = {};
  readonly IDS: string[];
  readonly PROC_IDS: Record<string, string[]> = {};
  model!: { pts: DecPoint[]; procs: Map<string, any> };
  items: any[] = [];
  byProc: Record<string, any> = {};
  byIndLeaf: Record<string, any[]> = {};

  constructor(E: Engine, input: DecisionInput, opts: DecisionOptions = {}) {
    this.E = E;
    this.input = input;
    this.corte = opts.corte || DEC_CORTE;
    this.soloVal = !!opts.soloVal;
    Object.keys(E.SIN_BY).forEach((id) => {
      const s = E.SIN_BY[id];
      const ov = DEC_REF_OVERRIDE[id];
      this.IND[id] = { id, nombre: s.nombre, ref: ov ? ov.ref : (s.ref as number), refNota: ov ? ov.nota : "", unidad: s.unidad, menor: s.sentido === "Menor es mejor", est: s.estandares || [], crit: s.criterios || [], frec: DEC_FREQ[id] || "Anual" };
    });
    this.IDS = Object.keys(this.IND).sort((a, b) => +a.slice(2) - +b.slice(2));
    E.M.procesos102.forEach((p) => { this.PROC_IDS[p.id] = []; });
    this.IDS.forEach((id) => E.procsOfIndicator(id).forEach((p) => { if (this.PROC_IDS[p]) this.PROC_IDS[p].push(id); }));
    this.build();
  }

  static keyV = (ek: string, area: string, ind: string, per: string) => ["v", ek, area || "PROG", ind, per].join("_");
  static keyP = (ek: string, proc: string) => ["p", ek, proc].join("_");

  /* ---- formato ---- */
  decFmt(ind: string, v: number | null | undefined): string {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    const u = this.IND[ind].unidad;
    if (u === "%") return (ind === "ID6" && v > 0 ? "+" : "") + fmtN(v, 1) + " %";
    if (u === "años") return fmtN(v, 1) + (Math.abs(v - 1) < 1e-9 ? " año" : " años");
    return fmtN(v, 1);
  }
  refTxt(ind: string): string {
    const d = this.IND[ind];
    return (d.menor ? "< " : "≥ ") + (d.unidad === "%" ? fmtN(d.ref, 0) + " %" : fmtN(d.ref, 0) + (d.ref === 1 ? " año" : " años"));
  }
  expectedLast(frec: string): string | null {
    const y = +this.corte.slice(0, 4), mo = +this.corte.slice(5, 7);
    if (frec === "Semestral") return mo >= 7 ? y + "-S1" : y - 1 + "-S2";
    if (frec === "Anual") return String(y - 1);
    return null;
  }
  perOptions(ind: string): string[] {
    const f = this.IND[ind].frec;
    const y = +this.corte.slice(0, 4);
    const out: string[] = [];
    const corte = parseISO(this.corte)!.getTime();
    if (f === "Semestral") {
      for (let k = y; k >= y - 3; k--) ["-S2", "-S1"].forEach((sf) => { const i = periodInfo(k + sf)!; if (i.start.getTime() <= corte) out.push(k + sf); });
      return out;
    }
    for (let k = y; k >= y - 5; k--) out.push(String(k));
    return out;
  }

  /* ---- armado del modelo de datos ---- */
  private validators(): Set<string> {
    return new Set(Object.keys(this.input.roster).filter((u) => this.input.roster[u].rol === "oficina"));
  }
  collect() {
    const pts = new Map<string, any>();
    const procs = new Map<string, any>();
    const put = (m: Map<string, any>, k: string, v: any) => { const p = m.get(k); if (!p || v.ts >= p.ts) m.set(k, v); };
    // 1. base de la EPTM
    DEC_BASE_SERIES.forEach((s) =>
      s.per.forEach((per, i) => {
        const k = DecisionBoard.keyV("TM", s.area, s.ind, per);
        pts.set(k, { key: k, esc: "TM", area: s.area, ind: s.ind, per, val: s.v[i], fuente: DEC_BASE_FUENTE, fuenteCorta: "Informado por Robert (22-10-2026)", corte: DEC_CORTE, nota: s.def ? DEC_DEF_NOTA : "", def: !!s.def, origen: "Base", autor: "", ts: DEC_BASE_TS, anulado: false });
      }),
    );
    this.E.M.procesos102.forEach((p) => {
      procs.set("TM|" + p.id, { esc: "TM", proc: p.id, ficha: p.id === "P1" ? "borrador" : "sin ficha", dueno: "", fuente: DEC_BASE_PROC_FUENTE, ts: DEC_BASE_TS, origen: "Base" });
    });
    // 2. archivos de carga reales (sin EJEMPLO)
    this.E.DB.vis.forEach((r) => {
      if (r.origen === "EJEMPLO" || !this.IND[r.indicador] || !DEC_ESC.includes(r.escuela) || r.valor === null) return;
      const area = r.area ? DEC_AREA_COD[r.area] || "" : "";
      const k = DecisionBoard.keyV(r.escuela, area, r.indicador, r.periodo);
      put(pts, k, { key: k, esc: r.escuela, area, ind: r.indicador, per: r.periodo, val: r.valor, fuente: r.fuente_dato, corte: r.fecha_carga || "", nota: r.obs || "", def: false, origen: "Archivo de carga", autor: r.cargado_por || "", ts: (r.fecha_carga || "2026-01-01") + "T00:00:00.000Z", anulado: false, valArchivo: r.estado_val });
    });
    // 3. ediciones guardadas
    const roster = this.input.roster;
    this.input.entries.forEach((e) => {
      const r = roster[e.autor];
      if (!r || !e.key) return;
      if (!(r.rol === "oficina" || r.escuela === e.esc)) return;
      if (e.t === "v") { if (!this.IND[e.ind as string] || !DEC_ESC.includes(e.esc)) return; put(pts, e.key, { ...e, origen: "Edición", autor: e.autor, def: false }); }
      else if (e.t === "p") { if (!this.PROC_IDS[e.proc as string] || !DEC_ESC.includes(e.esc)) return; put(procs, e.key, { ...e, origen: "Edición", autor: e.autor }); }
    });
    // estado de validación
    const valid = this.input.validations.filter((v) => this.validators().has(v.by));
    const stateOf = (key: string, ts: string, archivo?: string) => {
      let best: DecValidation | null = null;
      valid.forEach((v) => { if (v.key === key && v.entryTs === ts && (!best || v.ts > best.ts)) best = v; });
      if (best) { const b = best as DecValidation; return { estado: b.estado, por: b.by, cuando: b.ts, nota: b.nota || "" }; }
      if (archivo === "Validado") return { estado: "Validado", por: "", cuando: "", nota: "Validado en el archivo de carga" };
      return { estado: "Pendiente", por: "", cuando: "", nota: "" };
    };
    const outP: DecPoint[] = [];
    pts.forEach((p) => {
      if (p.anulado) return;
      const st = stateOf(p.key, p.ts, p.valArchivo);
      outP.push({ ...p, vestado: st.estado, vpor: st.por, vcuando: st.cuando, vnota: st.nota });
    });
    const outR = new Map<string, any>();
    procs.forEach((r, k) => {
      const key = r.key || "p_" + r.esc + "_" + r.proc;
      const st = stateOf(key, r.ts);
      outR.set(k, { ...r, key, vestado: st.estado });
    });
    return { pts: outP, procs: outR };
  }
  series(m: { pts: DecPoint[] }, ek: string, area: string, ind: string): DecPoint[] {
    const lst = m.pts.filter((p) => p.esc === ek && p.area === area && p.ind === ind && (!this.soloVal || p.vestado === "Validado"));
    return lst.sort((a, b) => decPerEnd(a.per) - decPerEnd(b.per));
  }
  porArea(m: { pts: DecPoint[] }, ek: string, ind: string): boolean { return ek === "TM" && m.pts.some((p) => p.esc === "TM" && p.ind === ind && p.area !== ""); }

  /* ---- regla del semáforo (propuesta, sección 9.1 del Modelo) ---- */
  accion(c: DcCode, ind: string, defPend: boolean): string {
    if (defPend) return "Confirmar con la Oficina de Calidad y la OCAA si el dato corresponde a la definición de la ficha; si no, calcular ID10 con la fórmula del Modelo.";
    if (c === "rojo") return "Analizar las causas con la Dirección de Escuela, registrar una acción de mejora con responsable y plazo, y volver a medir en el siguiente periodo.";
    if (c === "amarillo") return "Vigilar el indicador, confirmar la causa de la brecha y verificar el resultado en el siguiente periodo.";
    if (c === "verde") return "Mantener la medición y conservar la evidencia del dato.";
    return "Cargar el valor con su fuente y fecha de corte.";
  }
  evalPts(ind: string, pts: DecPoint[], ek: string): any {
    const d = this.IND[ind];
    const nota = ek === "TM" ? DEC_BASE_NOTA[ind] : null;
    if (!pts.length) {
      return {
        c: "gris" as DcCode, last: null, prev: null, ref: d.ref,
        razon: ek === "TM" && nota ? nota.txt + " (informado por Robert, 22-10-2026)." : "Sin dato: no hay un valor cargado con fuente. Se muestra como riesgo de evidencia, no como verde.",
        corto: ek === "TM" && nota ? nota.txt : "Sin dato", mini: ek === "TM" && nota ? nota.txt.split(";")[0].toLowerCase() : "sin cargar",
        accion: nota ? nota.acc : "Cargar el valor con su fuente y fecha de corte.", vacio: true,
      };
    }
    const last = pts[pts.length - 1];
    const pp = decPerPrevYear(last.per);
    const prev = pts.find((p) => p.per === pp) || null;
    const v = last.val;
    const dif = v - d.ref;
    const margen = d.unidad === "%" ? 3 : 0;
    let c: DcCode, razon: string, corto: string;
    const vt = this.decFmt(ind, v), rt = this.refTxt(ind);
    if (!d.menor ? v >= d.ref : v < d.ref) { c = "verde"; razon = `Alcanza el referencial: ${vt} frente a ${rt}.`; corto = "Alcanza el referencial"; }
    else if (!d.menor && margen && d.ref - v <= margen) { c = "amarillo"; razon = `Queda ${fmtN(d.ref - v, 1)} punto${d.ref - v === 1 ? "" : "s"} bajo el referencial (${vt} frente a ${rt}), dentro del margen de ±3 puntos.`; corto = "Dentro de ±3 puntos"; }
    else if (prev && (d.menor ? v < prev.val : v > prev.val)) { c = "amarillo"; razon = `Está bajo el referencial (${vt} frente a ${rt}), pero mejora respecto al año anterior (${decPerLabel(prev.per)}: ${this.decFmt(ind, prev.val)}).`; corto = "Mejora frente al año anterior"; }
    else {
      c = "rojo";
      razon = d.menor ? `No cumple el referencial: ${vt} frente a ${rt}` : `Queda ${fmtN(d.ref - v, 1)} puntos bajo el referencial (${vt} frente a ${rt}), fuera del margen de ±3 puntos`;
      razon += prev ? ` y sin mejora respecto al año anterior (${decPerLabel(prev.per)}: ${this.decFmt(ind, prev.val)}).` : " y sin dato del año anterior (n-1) para demostrar mejora.";
      corto = prev ? "Sin mejora frente al año anterior" : "Sin dato del año anterior";
    }
    let defPend = false, prov: DcCode | null = null;
    if (last.def) { prov = c; c = "gris"; defPend = true; razon = `${last.nota} Lectura provisional si la medida fuera la de la ficha: ${DC[prov].label.toLowerCase()} (${razon})`; corto = "Definición por confirmar"; }
    const exp = this.expectedLast(d.frec);
    const stale = !!exp && decPerEnd(last.per) < decPerEnd(exp);
    return { c, last, prev, ref: d.ref, dif, razon, corto, defPend, prov, stale, expected: exp, accion: this.accion(c, ind, defPend), vacio: false };
  }

  /* ---- armado de elementos (hojas de indicadores y procesos) ---- */
  procName(pid: string): string { const p = this.E.P102_BY[pid]; return p ? "P" + p.n + " " + p.nombre : pid; }
  build() {
    const E = this.E;
    const m = this.collect();
    this.model = m;
    const items: any[] = [];
    const byIndLeaf: Record<string, any[]> = {};
    const byProc: Record<string, any> = {};
    DEC_ESC.forEach((ek) => {
      this.IDS.forEach((ind) => {
        const d = this.IND[ind];
        const porArea = this.porArea(m, ek, ind);
        const areas = porArea ? DEC_AREAS : [""];
        areas.forEach((area) => {
          const pts = this.series(m, ek, area, ind);
          const ev = this.evalPts(ind, pts, ek);
          const it: any = {
            id: `${ek}|${area || "PROG"}|${ind}`, tipo: "Indicador", esc: ek, area, cod: ind, nombre: d.nombre, c: ev.c, ev, pts,
            estandares: d.est, procesos: E.procsOfIndicator(ind), porArea,
            motivo: ev.razon, valorTxt: ev.last ? `${this.decFmt(ind, ev.last.val)} (${decPerLabel(ev.last.per)})` : "—", refTxt: this.refTxt(ind),
            fuente: ev.last ? ev.last.fuente : ek === "TM" && DEC_BASE_NOTA[ind] ? "Mensaje de Robert del 22-10-2026 (indicador sin medir, sin calcular o sin dato)" : "Sin fuente: no hay dato cargado",
            corte: ev.last ? ev.last.corte : ek === "TM" ? DEC_CORTE : "",
            accion: ev.accion, resp: E.responsableOf(ek, ind), brecha: ev.last ? ev.dif : null, measured: !ev.vacio, kind: 0,
          };
          items.push(it);
          (byIndLeaf[`${ek}|${ind}`] = byIndLeaf[`${ek}|${ind}`] || []).push(it);
        });
      });
    });
    DEC_ESC.forEach((ek) => {
      E.M.procesos102.forEach((p) => {
        const rec = m.procs.get(`${ek}|${p.id}`) || null;
        const fichaE: string = rec ? rec.ficha : "por confirmar";
        const dueno: string = rec ? rec.dueno || "" : "";
        const comps: { n: string; c: DcCode | null; t: string }[] = [];
        comps.push({ n: "Ficha del proceso", c: DEC_FICHA_COL[fichaE], t: DEC_FICHA_TXT[fichaE] });
        comps.push({ n: "Dueño designado", c: dueno ? "verde" : "gris", t: dueno ? dueno : "Por confirmar" });
        const ids = this.PROC_IDS[p.id] || [];
        const leaves: any[] = [];
        ids.forEach((id) => (byIndLeaf[`${ek}|${id}`] || []).forEach((l) => leaves.push(l)));
        const medidos = leaves.filter((l) => l.measured && !l.ev.defPend).length;
        if (ids.length) {
          const cs: DcCode[] = leaves.map((l) => l.c);
          const w = dcWorst(cs);
          const nR = cs.filter((c) => c === "rojo").length, nA = cs.filter((c) => c === "amarillo").length, nG = cs.filter((c) => c === "gris").length;
          comps.push({ n: "Indicadores medidos", c: w, t: `${medidos} de ${leaves.length} con dato · ${nR} en rojo, ${nA} en amarillo, ${nG} en gris` });
        } else comps.push({ n: "Indicadores medidos", c: null, t: "Sin indicador del Modelo vinculado a este proceso (vínculo del proyecto [CP])" });
        const c = dcWorst(comps.filter((x) => x.c).map((x) => x.c as DcCode));
        const problemas: string[] = [];
        if (fichaE === "sin ficha") problemas.push("sin ficha"); else if (fichaE === "borrador") problemas.push("ficha en borrador"); else if (fichaE === "por confirmar") problemas.push("estado de la ficha por confirmar");
        if (!dueno) problemas.push("dueño por confirmar");
        if (ids.length && medidos < leaves.length) problemas.push(medidos ? `solo ${medidos} de ${leaves.length} indicadores con dato` : "ningún indicador con dato");
        if (comps[2] && comps[2].c === "rojo") problemas.push("indicadores en rojo");
        const motivo = c === "verde" ? "Ficha aprobada, dueño designado e indicadores sin alerta." : problemas.length ? problemas[0][0].toUpperCase() + problemas[0].slice(1) + (problemas.length > 1 ? "; " + problemas.slice(1).join("; ") : "") + "." : "Revisar el proceso.";
        let accion: string;
        if (fichaE === "sin ficha") accion = "Elaborar la ficha del proceso y designar a su dueño.";
        else if (fichaE === "borrador") accion = "Presentar la ficha a los comités de Calidad y de Gestión para su resolución y designar al dueño.";
        else if (fichaE === "por confirmar") accion = "Informar el estado de la ficha y el dueño del proceso en la escuela.";
        else if (!dueno) accion = "Designar al dueño del proceso.";
        else accion = "Atender los indicadores del proceso que están en alerta.";
        const respFicha = (E.M.rel_proceso_ficha.filter((r) => r[0] === p.id).map((r) => E.FICHA_BY[r[1]]).filter((f) => f && f.responsable && !/^por confirmar$/i.test(f.responsable))[0] || ({} as any)).responsable;
        const it: any = {
          id: `${ek}|PROC|${p.id}`, tipo: "Proceso", esc: ek, area: "", cod: p.id, nombre: p.nombre, c, comps, rec,
          mini: rec ? "dueño " + (dueno ? "designado" : "por confirmar") + (ids.length ? " · " + medidos + "/" + leaves.length + " indicadores con dato" : "") : "sin dato de la escuela",
          estandares: Array.from(new Set(["E10", ...ids.flatMap((i) => this.IND[i].est)])), procesos: [p.id], porArea: false,
          motivo, valorTxt: DEC_FICHA_TXT[fichaE], refTxt: "Ficha aprobada y dueño designado",
          fuente: rec ? rec.fuente || "" : "Sin dato de la escuela",
          fuenteCorta: rec ? (rec.origen === "Base" ? "Estado del SGC en la EPTM informado por Robert (22-10-2026)" : rec.fuente || "") : "Sin dato de la escuela",
          corte: rec ? (rec.ts || "").slice(0, 10) : "",
          accion, resp: dueno || (respFicha ? respFicha.replace(/\s*\(por confirmar\)/, "") + " (por confirmar)" : "Por confirmar"),
          brecha: null, measured: fichaE !== "por confirmar", nprob: problemas.length, kind: 1, leaves,
        };
        items.push(it);
        byProc[`${ek}|${p.id}`] = it;
      });
    });
    this.items = items;
    this.byProc = byProc;
    this.byIndLeaf = byIndLeaf;
  }

  itemsOf = (esc: string) => this.items.filter((i) => i.esc === esc);
  static counts(items: { c: DcCode }[]) { const c: Record<DcCode, number> = { rojo: 0, amarillo: 0, verde: 0, gris: 0 }; items.forEach((i) => c[i.c]++); return c; }
  static ranking(items: any[]): any[] {
    const arr = items.filter((i) => i.c !== "verde").slice();
    const gap = (i: any, board: DecisionBoard) => (i.tipo === "Indicador" && i.brecha !== null ? Math.abs(i.brecha) / (board.IND[i.cod].ref || 1) : 0);
    // la brecha usa el referencial del indicador del propio elemento
    const self = (i: any) => (i.tipo === "Indicador" && i.brecha !== null && i.ev ? Math.abs(i.brecha) / (i.ev.ref || 1) : 0);
    void gap;
    arr.sort((a, b) => DC[b.c as DcCode].rank - DC[a.c as DcCode].rank || (b.measured as any) - (a.measured as any) || self(b) - self(a) || (b.nprob || 0) - (a.nprob || 0) || DEC_ESC.indexOf(a.esc) - DEC_ESC.indexOf(b.esc) || natKey(a.cod).localeCompare(natKey(b.cod)));
    return arr;
  }
  itemById = (id: string) => this.items.find((i) => i.id === id) || null;
  who = (uid: string) => (uid ? this.input.names[uid] || "Persona sin nombre visible" : "—");

  /* ---- filas de exportación ---- */
  rowsAlertas(items: any[]) {
    return items.map((i) => ({
      Escuela: DEC_ESC_NOM[i.esc], "Área": i.area ? DEC_AREA_CORTO[i.area] : i.porArea ? "Programa" : "", Tipo: i.tipo, Código: i.cod, Elemento: i.nombre,
      Nivel: DC[i.c as DcCode].label + " (propuesta)", Motivo: i.motivo, Valor: i.valorTxt, Referencial: i.refTxt,
      "Brecha (puntos)": i.brecha === null || i.brecha === undefined ? "" : Math.round(i.brecha * 10) / 10,
      Estándares: i.estandares.join(", "), Procesos: i.procesos.map((p: string) => "P" + (this.E.P102_BY[p] ? this.E.P102_BY[p].n : p)).join(", "), Responsable: i.resp, "Siguiente acción": i.accion,
      Fuente: i.fuente, "Fecha de corte del dato": i.corte,
    }));
  }
  rowsValores() {
    return this.model.pts.slice()
      .sort((a, b) => natKey(a.ind).localeCompare(natKey(b.ind)) || DEC_ESC.indexOf(a.esc) - DEC_ESC.indexOf(b.esc) || a.area.localeCompare(b.area) || decPerEnd(a.per) - decPerEnd(b.per))
      .map((p) => ({
        Escuela: DEC_ESC_NOM[p.esc], "Área": p.area ? DEC_AREA_CORTO[p.area] : "", Indicador: p.ind, Nombre: this.IND[p.ind].nombre, Periodo: decPerLabel(p.per), Valor: p.val, Unidad: this.IND[p.ind].unidad, Referencial: this.refTxt(p.ind),
        Fuente: p.fuente, "Fecha de corte del dato": p.corte, Origen: p.origen, "Registrado por": p.autor ? this.who(p.autor) : "", "Validación de la oficina": p.vestado, Nota: p.nota,
      }));
  }
  rowsProcesos(items: any[]) {
    return items.filter((i) => i.tipo === "Proceso").map((i) => ({ Escuela: DEC_ESC_NOM[i.esc], Proceso: i.nombre, Nivel: DC[i.c as DcCode].label, Ficha: i.valorTxt, "Dueño designado": i.rec && i.rec.dueno ? i.rec.dueno : "Por confirmar", Motivo: i.motivo, Responsable: i.resp, "Siguiente acción": i.accion, Fuente: i.fuente }));
  }
  rowsBitacora() {
    const out: Record<string, string>[] = [{ Fecha: "2026-10-22", Quién: "Carga inicial (datos informados por Robert)", Acción: "Carga inicial", Elemento: "EPTM: ID6, ID10, ID13, ID14, ID19 y estado de los 9 procesos", Antes: "", Después: "", Nota: DEC_BASE_FUENTE }];
    this.input.events.slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts))).forEach((e) => out.push({ Fecha: e.ts, Quién: this.who(e.by), Acción: e.accion, Elemento: e.clave || "", Antes: e.antes ? JSON.stringify(e.antes) : "", Después: e.despues ? JSON.stringify(e.despues) : "", Nota: e.nota || "" }));
    return out;
  }
}
