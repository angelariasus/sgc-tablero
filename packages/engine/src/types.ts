import type { PeriodInfo } from "./periods";
import type { StateCode } from "./states";

export type EscId = "ENF" | "OBS" | "TM" | "FAC";

/** Catálogo del modelo (antes incrustado en el HTML). Se tipan los campos que usa el motor. */
export interface Model {
  estandares: { id: string; nombre: string; n_criterios: number; ev_desde: string; ev_hasta: string; procesos_sgc: string }[];
  evidencias: { id: string; estandar: string; descripcion: string; lectura: string; procesos_sgc: string }[];
  sineace: SineaceDef[];
  fichas: { id: string; nombre: string; familia: string; responsable: string; estado: string }[];
  procesos102: { id: string; n: number | string; nombre: string; estado_ficha: string; ficha_propuesta: string; capitulo: string }[];
  rel_proceso_ficha: [string, string][];
  rel_proceso_indicador: [string, string][];
  rel_sineace_indicador: [string, string][];
  rel_indicador_aoi: any[];
  rel_sineace_aoi: any[];
  indicadores: IndicadorDef[];
  aoi: AoiDef[];
  poi_hecho: [number, number, string, string, number, number, string][];
  poi_reportes: PoiReporte[];
  poi_seguimiento: any[];
  pefm: any[];
  pei: any[];
  fuentes: { id: string; tipo: string; nombre: string }[];
  pendientes_previos: { ambito: string; pendiente: string; accion: string }[];
  contradicciones: any[];
  real_mediciones: any[];
  poi2025_resumen: any;
  poi2025_extra: any[];
  proc_poi: [string, string][];
  poi_responsables: Record<string, any>;
  poi_responsables_ref: Record<string, any>;
  eptm: any[];
  pei_equiv: Record<string, any>;
  pei_continua: any[];
  incongruencias: any[];
  formatos: any[];
  incong_v3_desde?: number;
  pendientes_v3?: { ambito: string; pendiente: string; accion: string }[];
  [k: string]: any;
}

export interface SineaceDef {
  id: string;
  nombre: string;
  ref_texto?: string;
  ref: number | null;
  unidad: string;
  sentido: string;
  criterios_texto?: string;
  criterios: string[];
  estandares: string[];
  criterios_por_confirmar?: any;
  fichas: string[];
  frecuencia: string;
  frecuencia_nota?: string;
  indicadores_proceso: string[];
  aliados?: any;
  regla?: string;
  regla_nota?: string;
  avance?: string;
  [k: string]: any;
}

export interface IndicadorDef {
  id: string;
  ficha: string;
  familia?: string;
  nombre: string;
  formula?: string;
  fuente_dato?: string;
  frecuencia: string;
  meta_texto?: string;
  unidad: string;
  sentido: string;
  responsable?: string;
  estado_ficha?: string;
  alias_sineace?: string | null;
  metas: { desde: number; meta: number; fuente: string }[];
  estado_meta?: string;
  meta_nota?: string;
  piloto?: boolean;
  ambito?: string;
  avance?: string;
  aoi_esperado?: string;
  [k: string]: any;
}

export interface AoiDef {
  id: string;
  actividad: string;
  unidad?: string;
  en_alcance_sgc?: boolean;
  vinculo?: string;
  [k: string]: any;
}

export interface PoiReporte {
  anio: number;
  reporte: string;
  consulta: string;
  mes_corte: number;
  impreso: number;
  etiqueta: string;
}

export interface ParamsDef {
  general: [string, any, string, string][];
  reglas: string[][];
}

export interface ExampleData {
  mediciones: any[];
  evidencias: any[];
}

export interface Regla {
  id: string;
  nombre: string;
  activa: string;
  severidad: string;
  condicion: string;
  que: string;
  porque: string;
  accion: string;
}

export interface MetaRow {
  desde: number;
  meta: number | null;
  sentido: string;
  unidad: string;
  fuente_meta: string;
  estado_meta: string;
  verde_min: number | null;
  rojo_min: number | null;
  base: string;
  avance: string;
  regla: string;
  fuente_umbral: string;
  nota: string;
}

export interface Params {
  gen: Record<string, any>;
  reglas: Regla[];
  metas: Record<string, MetaRow[]>;
  origen: string;
  fecha: string;
}

/** Una medición normalizada (fila de carga). */
export interface NormRow {
  periodo: string;
  escuela: string;
  area: string;
  indicador: string;
  numerador: number | null;
  denominador: number | null;
  valor_directo: number | null;
  meta_propuesta: number | null;
  fuente_meta: string;
  esperado: number | null;
  fuente_esperado: string;
  fuente_dato: string;
  ev: string;
  ev_ref: string;
  cargado_por: string;
  fecha_carga: string;
  estado_val: string;
  validado_por: string;
  fecha_val: string;
  version: number;
  obs: string;
  origen: "Real" | "EJEMPLO";
  archivo: string;
  fila?: number;
  // calculados al armar la base
  pinfo?: PeriodInfo;
  valor?: number | null;
  id?: string;
  motivo?: string;
  reemplaza?: number;
  [k: string]: any;
}

export interface EvidRow {
  escuela: string;
  area: string;
  ev: string;
  estado: string;
  ubicacion: string;
  responsable: string;
  fecha: string;
  observacion: string;
  origen: "Real" | "EJEMPLO";
}

export interface AutoCriterio {
  estandar: string;
  criterio: string;
  resumen: string;
  evExig: string[];
  indicadoresGuia: string;
  docs: string;
  matrices: { n: number; estado: string }[];
  valoracion: string;
  nCitadas: number | "";
  nEnlace: number | "";
  evSin: string[];
  debil: string;
  falta: string;
  prioridad: string;
  ref: string;
}

export interface AutoEval {
  name: string;
  tipo: string;
  escuela: string;
  criterios: AutoCriterio[];
  matrices: { n: number; bloque: string; matriz: string; criterios: string[]; estado: string; detalle: string; ref: string }[];
  indicadores: { id: string; referencial: number | null; valor: number | null; estadoRef: string; criteriosGuia: string; evGuia: string; variables: string; obs: string; ref: string }[];
  warns: string[];
  errors: string[];
  cargadoEn: string;
  nPend: number;
  nMat: number | "";
  fabrica?: boolean;
}

export interface SchoolScope {
  alcance: Record<string, string> | null;
  respLocal: Record<string, string> | null;
}

export interface EvalPoint {
  valor: number;
  meta: number | null;
  ref: number | null;
  esperado: number | null;
  espTxt: string;
  prorrata: boolean;
  espFuente: string;
  fuenteMeta: string;
  unidad: string;
  sentido: string;
  cumpl: number | null;
  state: StateCode;
  bands: { verde: number; rojo: number; base: string } | null;
  bandsSrc: string;
  pinfo: PeriodInfo;
  m: NormRow;
  regla: string;
  cumple: boolean | null;
  parcial?: boolean;
  sinEsperado?: boolean;
  poiEsp?: any;
}

export interface Status {
  esc: string;
  id: string;
  eid: string;
  freq: string;
  sr: { eid: string; id: string; pts: NormRow[]; ev: EvalPoint[] };
  last: EvalPoint | null;
  state: StateCode;
  desde: Date | null;
  desdePeriodo?: string;
  runLen?: number;
  desdeTxt: string;
  vencido: boolean;
  expEnd: Date | null;
  expLabel: string;
  overdueSince: Date | null;
  tendencia: { n: number; serie: string } | null;
  mi: { unidad: string; sentido: string; estado: string; nota: string };
}

export interface Alert {
  uid: string;
  regla: string;
  reglaNombre: string;
  severidad: string;
  escuela: string;
  objeto: string;
  objetoId: string;
  objetoNombre: string;
  desde: Date | null;
  desdeTxt: string;
  responsable: string;
  proceso?: string[];
  periodo: string;
  que: string;
  porque: string;
  accion: string;
  ejemplo?: boolean;
  poi?: boolean;
  anio?: number;
  estandarSel?: string;
  sev?: string;
  ctx?: Record<string, any>;
}

export interface Cargable {
  id: string;
  tipo: string;
  nombre: string;
  frecuencia: string;
  ambito?: string;
  piloto?: boolean;
}
