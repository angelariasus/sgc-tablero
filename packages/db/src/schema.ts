/**
 * Esquema de la base de datos (PostgreSQL / Supabase).
 *
 * Reglas que garantiza la base, aunque falle una validación de la API:
 *  - una medición sin fuente del dato no se puede guardar (check fuente_dato);
 *  - periodos y escuelas válidos;
 *  - un solo responsable activo por escuela;
 *  - todas las tablas tienen RLS activado y sin políticas: la clave pública de Supabase no lee nada.
 */
import { sql } from "drizzle-orm";
import {
  bigserial, boolean, check, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

export const ROLES = ["admin", "oficina", "responsable", "lectura"] as const;
export type Rol = (typeof ROLES)[number];

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date", precision: 3 });

/** Personas con acceso. `id` es el id del usuario de Supabase Auth (auth.users). */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    nombre: text("nombre").notNull(),
    rol: text("rol").$type<Rol>().notNull(),
    escuela: text("escuela"),
    activo: boolean("activo").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profiles_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("profiles_un_responsable_por_escuela").on(t.escuela).where(sql`${t.rol} = 'responsable' and ${t.activo}`),
    check("profiles_rol_chk", sql`${t.rol} in ('admin','oficina','responsable','lectura')`),
    check("profiles_escuela_chk", sql`${t.escuela} is null or ${t.escuela} in ('ENF','OBS','TM')`),
    check("profiles_responsable_escuela_chk", sql`${t.rol} <> 'responsable' or ${t.escuela} is not null`),
  ],
).enableRLS();

/** Catálogo del modelo (estándares, indicadores, fichas, POI…): un documento por colección. */
export const catalogDocs = pgTable("catalog_docs", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}).enableRLS();

/** Parámetros del tablero con historial: el vigente es el de mayor `version`. */
export const parameterSets = pgTable(
  "parameter_sets",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    version: integer("version").notNull(),
    fecha: text("fecha").notNull(),
    origen: text("origen").notNull(),
    gen: jsonb("gen").notNull(),
    reglas: jsonb("reglas").notNull(),
    metas: jsonb("metas").notNull(),
    nota: text("nota").notNull().default(""),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("parameter_sets_version_uq").on(t.version)],
).enableRLS();

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => profiles.id),
}).enableRLS();

/** Cada archivo Excel recibido (el original queda en Storage, con su huella). */
export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    sha256: text("sha256").notNull(),
    size: integer("size").notNull(),
    storagePath: text("storage_path").notNull(),
    kind: text("kind").notNull(),
    escuela: text("escuela"),
    versionPlantilla: text("version_plantilla").notNull().default(""),
    responsable: text("responsable").notNull().default(""),
    entrega: text("entrega").notNull().default(""),
    resumen: jsonb("resumen").notNull().default({}),
    advertencias: jsonb("advertencias").notNull().default([]),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("uploads_kind_chk", sql`${t.kind} in ('carga','consolidado','parametros')`),
    index("uploads_created_idx").on(t.createdAt),
  ],
).enableRLS();

/** Mediciones. Solo entran filas con fuente del dato, periodo válido y escuela válida. */
export const measurements = pgTable(
  "measurements",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    uploadId: uuid("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
    fila: integer("fila").notNull().default(0),
    periodo: text("periodo").notNull(),
    escuela: text("escuela").notNull(),
    area: text("area").notNull().default(""),
    indicador: text("indicador").notNull(),
    numerador: doublePrecision("numerador"),
    denominador: doublePrecision("denominador"),
    valorDirecto: doublePrecision("valor_directo"),
    metaPropuesta: doublePrecision("meta_propuesta"),
    fuenteMeta: text("fuente_meta").notNull().default(""),
    esperado: doublePrecision("esperado"),
    fuenteEsperado: text("fuente_esperado").notNull().default(""),
    fuenteDato: text("fuente_dato").notNull(),
    ev: text("ev").notNull().default(""),
    evRef: text("ev_ref").notNull().default(""),
    cargadoPor: text("cargado_por").notNull().default(""),
    fechaCarga: text("fecha_carga").notNull().default(""),
    estadoVal: text("estado_val").notNull().default("Borrador"),
    validadoPor: text("validado_por").notNull().default(""),
    fechaVal: text("fecha_val").notNull().default(""),
    version: integer("version").notNull().default(1),
    obs: text("obs").notNull().default(""),
    archivo: text("archivo").notNull().default(""),
  },
  (t) => [
    check("measurements_fuente_chk", sql`btrim(${t.fuenteDato}) <> ''`),
    check("measurements_periodo_chk", sql`${t.periodo} ~ '^[0-9]{4}(-(S[12]|T[1-4]|0[1-9]|1[0-2]))?$'`),
    check("measurements_escuela_chk", sql`${t.escuela} in ('ENF','OBS','TM','FAC')`),
    index("measurements_upload_idx").on(t.uploadId),
    index("measurements_clave_idx").on(t.escuela, t.indicador, t.periodo),
  ],
).enableRLS();

/** Filas rechazadas al cargar (por ejemplo, sin fuente): alimentan la alerta R11. */
export const uploadRejections = pgTable(
  "upload_rejections",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    uploadId: uuid("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
    fila: integer("fila").notNull().default(0),
    escuela: text("escuela").notNull(),
    area: text("area").notNull().default(""),
    indicador: text("indicador").notNull().default(""),
    periodo: text("periodo").notNull().default(""),
    motivo: text("motivo").notNull(),
    fechaCarga: text("fecha_carga").notNull().default(""),
    filaJson: jsonb("fila_json").notNull().default({}),
  },
  (t) => [index("upload_rejections_upload_idx").on(t.uploadId)],
).enableRLS();

/** Estado de las evidencias por archivo, escuela, área y EV (a igual clave, manda el archivo más reciente). */
export const evidenceStatus = pgTable(
  "evidence_status",
  {
    escuela: text("escuela").notNull(),
    area: text("area").notNull().default(""),
    ev: text("ev").notNull(),
    estado: text("estado").notNull(),
    ubicacion: text("ubicacion").notNull().default(""),
    responsable: text("responsable").notNull().default(""),
    fecha: text("fecha").notNull().default(""),
    observacion: text("observacion").notNull().default(""),
    uploadId: uuid("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.uploadId, t.escuela, t.area, t.ev] })],
).enableRLS();

/** Alcance y responsable local por archivo, escuela e indicador (hoja Alcance; manda el archivo más reciente). */
export const schoolScope = pgTable(
  "school_scope",
  {
    escuela: text("escuela").notNull(),
    indicadorId: text("indicador_id").notNull(),
    enSeguimiento: text("en_seguimiento").notNull().default(""),
    responsableLocal: text("responsable_local").notNull().default(""),
    uploadId: uuid("upload_id").notNull().references(() => uploads.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.uploadId, t.escuela, t.indicadorId] })],
).enableRLS();

/** Consolidado de autoevaluación por escuela. */
export const autoevaluations = pgTable("autoevaluations", {
  escuela: text("escuela").primaryKey(),
  data: jsonb("data").notNull(),
  fabrica: boolean("fabrica").notNull().default(false),
  uploadId: uuid("upload_id").references(() => uploads.id, { onDelete: "set null" }),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}).enableRLS();

/** Vista «Decisión»: valores y estado de procesos editados por las personas (solo se agregan filas). */
export const decisionEntries = pgTable(
  "decision_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    t: text("t").notNull(),
    key: text("key").notNull(),
    esc: text("esc").notNull(),
    area: text("area").notNull().default(""),
    ind: text("ind"),
    per: text("per"),
    val: doublePrecision("val"),
    fuente: text("fuente").notNull().default(""),
    corte: text("corte").notNull().default(""),
    nota: text("nota").notNull().default(""),
    anulado: boolean("anulado").notNull().default(false),
    proc: text("proc"),
    ficha: text("ficha"),
    dueno: text("dueno").notNull().default(""),
    ts: ts("ts").notNull(),
    autor: uuid("autor").notNull().references(() => profiles.id),
  },
  (t) => [
    check("decision_entries_t_chk", sql`${t.t} in ('v','p')`),
    check("decision_entries_esc_chk", sql`${t.esc} in ('ENF','OBS','TM')`),
    // un valor sin fuente no se guarda, salvo que se anule
    check("decision_entries_fuente_chk", sql`${t.t} <> 'v' or ${t.anulado} or btrim(${t.fuente}) <> ''`),
    index("decision_entries_key_idx").on(t.key, t.ts),
  ],
).enableRLS();

export const decisionValidations = pgTable(
  "decision_validations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: text("key").notNull(),
    entryTs: ts("entry_ts").notNull(),
    estado: text("estado").notNull(),
    nota: text("nota").notNull().default(""),
    by: uuid("by").notNull().references(() => profiles.id),
    ts: ts("ts").notNull(),
  },
  (t) => [check("decision_validations_estado_chk", sql`${t.estado} in ('Validado','Observado')`), index("decision_validations_key_idx").on(t.key)],
).enableRLS();

/** Bitácora de auditoría: quién hizo qué y cuándo (siempre con la hora del servidor). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    ts: ts("ts").notNull().defaultNow(),
    actor: uuid("actor").references(() => profiles.id),
    accion: text("accion").notNull(),
    clave: text("clave").notNull().default(""),
    esc: text("esc").notNull().default(""),
    antes: jsonb("antes"),
    despues: jsonb("despues"),
    nota: text("nota").notNull().default(""),
    /** datos para filtrar el historial de un elemento: ind, area, per, proc… */
    extra: jsonb("extra").notNull().default({}),
  },
  (t) => [index("audit_log_ts_idx").on(t.ts)],
).enableRLS();
