/** Arma, desde la base, lo que necesitan el motor de cálculo y las vistas. */
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  auditLog, autoevaluations, decisionEntries, decisionValidations, evidenceStatus, measurements, parameterSets, profiles, schoolScope, settings, uploadRejections, uploads, type Db,
} from "@sgc/db";
import {
  DecisionBoard, Engine, type AutoEval, type DecEntry, type DecEvent, type DecValidation, type DecisionInput, type EngineInput, type EvidRow, type NormRow, type Params,
} from "@sgc/engine";
import type { Catalog } from "./catalog";

export interface ActiveParams { params: Params; id: number; version: number; createdAt: string }

export async function getActiveParams(db: Db): Promise<ActiveParams> {
  const [p] = await db.select().from(parameterSets).orderBy(desc(parameterSets.version)).limit(1);
  if (!p) throw new Error("No hay parámetros en la base de datos. Ejecuta «pnpm seed».");
  return {
    id: p.id, version: p.version, createdAt: p.createdAt.toISOString(),
    params: { gen: p.gen as any, reglas: p.reglas as any, metas: p.metas as any, origen: p.origen, fecha: p.fecha },
  };
}

export const DEFAULT_DECISION_CORTE = "2026-10-22";
export async function getDecisionCorte(db: Db): Promise<string> {
  const [s] = await db.select().from(settings).where(eq(settings.key, "decision_corte")).limit(1);
  return typeof s?.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.value) ? s.value : DEFAULT_DECISION_CORTE;
}

export interface UploadInfo {
  id: string; filename: string; sha256: string; size: number; kind: string; escuela: string | null; versionPlantilla: string; responsable: string; entrega: string;
  resumen: any; advertencias: string[]; uploadedBy: string | null; createdAt: string;
}

export async function listUploads(db: Db): Promise<UploadInfo[]> {
  const rows = await db.select().from(uploads).orderBy(asc(uploads.createdAt));
  return rows.map((u) => ({
    id: u.id, filename: u.filename, sha256: u.sha256, size: u.size, kind: u.kind, escuela: u.escuela, versionPlantilla: u.versionPlantilla, responsable: u.responsable, entrega: u.entrega,
    resumen: u.resumen, advertencias: (u.advertencias as string[]) ?? [], uploadedBy: u.uploadedBy, createdAt: u.createdAt.toISOString(),
  }));
}

/** Datos guardados que alimentan el motor. El orden es el de carga: a igual versión y fecha, gana lo más reciente. */
export async function loadStored(db: Db) {
  const ups = await db.select().from(uploads).orderBy(asc(uploads.createdAt));
  const order = new Map(ups.map((u, i) => [u.id, i]));
  const byOrder = <T extends { uploadId: string }>(a: T, b: T) => (order.get(a.uploadId) ?? 0) - (order.get(b.uploadId) ?? 0);

  // Las filas válidas y las rechazadas al cargar se devuelven juntas y en el orden de carga: el motor decide, como en el
  // tablero original, qué versión manda (una corrección más nueva pero sin fuente tapa a la anterior y se avisa con R11).
  const ms = await db.select().from(measurements).orderBy(asc(measurements.id));
  const rj = await db.select().from(uploadRejections).orderBy(asc(uploadRejections.id));
  const keyed: { ord: number; fila: number; row: NormRow }[] = [
    ...ms.map((m) => ({
      ord: order.get(m.uploadId) ?? 0, fila: m.fila,
      row: {
        periodo: m.periodo, escuela: m.escuela, area: m.area, indicador: m.indicador, numerador: m.numerador, denominador: m.denominador, valor_directo: m.valorDirecto,
        meta_propuesta: m.metaPropuesta, fuente_meta: m.fuenteMeta, esperado: m.esperado, fuente_esperado: m.fuenteEsperado, fuente_dato: m.fuenteDato, ev: m.ev, ev_ref: m.evRef,
        cargado_por: m.cargadoPor, fecha_carga: m.fechaCarga, estado_val: m.estadoVal, validado_por: m.validadoPor, fecha_val: m.fechaVal, version: m.version, obs: m.obs,
        origen: "Real" as const, archivo: m.archivo, fila: m.fila,
      } as NormRow,
    })),
    ...rj.map((r) => {
      const { valor: _v, pinfo: _p, motivo: _m, id: _i, reemplaza: _r, ...rest } = r.filaJson as NormRow;
      return { ord: order.get(r.uploadId) ?? 0, fila: r.fila, row: { ...rest, fila: r.fila } as NormRow };
    }),
  ];
  keyed.sort((a, b) => a.ord - b.ord || a.fila - b.fila);
  const measurementsOut: NormRow[] = keyed.map((k) => k.row);
  const rejectedOut: NormRow[] = [];

  const ev = (await db.select().from(evidenceStatus)).sort(byOrder);
  const evidence: EvidRow[] = ev.map((e) => ({ escuela: e.escuela, area: e.area, ev: e.ev, estado: e.estado, ubicacion: e.ubicacion, responsable: e.responsable, fecha: e.fecha, observacion: e.observacion, origen: "Real" }));

  const sc = (await db.select().from(schoolScope)).sort(byOrder);
  const scopes: Record<string, { alcance: Record<string, string>; respLocal: Record<string, string> }> = {};
  for (const s of sc) {
    const o = (scopes[s.escuela] ||= { alcance: {}, respLocal: {} });
    if (s.enSeguimiento) o.alcance[s.indicadorId] = s.enSeguimiento;
    if (s.responsableLocal) o.respLocal[s.indicadorId] = s.responsableLocal;
  }

  const aes = await db.select().from(autoevaluations);
  const autoeval: Record<string, AutoEval> = {};
  for (const a of aes) autoeval[a.escuela] = { ...(a.data as AutoEval), fabrica: a.fabrica || undefined };

  const cargas = ups.filter((u) => u.kind === "carga" || u.kind === "parametros");
  const schoolsWithFiles = Array.from(new Set(ups.filter((u) => u.kind === "carga" && u.escuela).map((u) => u.escuela as string)));
  return { uploads: ups, measurements: measurementsOut, rejected: rejectedOut, evidence, scopes, autoeval, schoolsWithFiles, fileNames: cargas.map((u) => u.filename) };
}

export interface EngineOpts { ejemplo?: boolean; corteOverride?: Date | null; today?: Date }

export async function loadEngineInput(db: Db, catalog: Catalog, opts: EngineOpts = {}, active?: ActiveParams): Promise<EngineInput> {
  const [st, ap] = await Promise.all([loadStored(db), active ?? getActiveParams(db)]);
  return {
    model: catalog.model, pdef: catalog.pdef, example: catalog.example, params: ap.params,
    measurements: st.measurements, rejected: st.rejected, evidence: st.evidence, scopes: st.scopes, schoolsWithFiles: st.schoolsWithFiles, autoeval: st.autoeval, fileNames: st.fileNames,
    options: { ejemplo: !!opts.ejemplo, corteOverride: opts.corteOverride ?? null, today: opts.today },
  };
}

export async function buildEngine(db: Db, catalog: Catalog, opts: EngineOpts = {}): Promise<Engine> {
  return new Engine(await loadEngineInput(db, catalog, opts));
}

/** La Oficina y la administración figuran como «oficina» en la vista Decisión; los responsables, con su escuela. */
export async function loadDecisionInput(db: Db): Promise<DecisionInput> {
  const [people, ents, vals, evs] = await Promise.all([
    db.select().from(profiles),
    db.select().from(decisionEntries).orderBy(asc(decisionEntries.ts), asc(decisionEntries.id)),
    db.select().from(decisionValidations).orderBy(asc(decisionValidations.ts), asc(decisionValidations.id)),
    db.select().from(auditLog).where(sql`${auditLog.extra} ->> 'ambito' = 'decision'`).orderBy(desc(auditLog.ts)).limit(1000),
  ]);
  const roster: DecisionInput["roster"] = {};
  const names: Record<string, string> = {};
  for (const p of people) {
    names[p.id] = p.nombre;
    if (!p.activo) continue;
    if (p.rol === "admin" || p.rol === "oficina") roster[p.id] = { rol: "oficina" };
    else if (p.rol === "responsable" && p.escuela) roster[p.id] = { rol: "responsable", escuela: p.escuela };
  }
  const entries: DecEntry[] = ents.map((e) => ({
    t: e.t as "v" | "p", key: e.key, esc: e.esc, area: e.area, ind: e.ind ?? undefined, per: e.per ?? undefined, val: e.val ?? undefined, fuente: e.fuente, corte: e.corte, nota: e.nota,
    anulado: e.anulado, proc: e.proc ?? undefined, ficha: e.ficha ?? undefined, dueno: e.dueno, ts: e.ts.toISOString(), autor: e.autor,
  }));
  const validations: DecValidation[] = vals.map((v) => ({ key: v.key, entryTs: v.entryTs.toISOString(), estado: v.estado, nota: v.nota, by: v.by, ts: v.ts.toISOString() }));
  const events: DecEvent[] = evs.map((e) => ({ ...((e.extra as object) ?? {}), ts: e.ts.toISOString(), by: e.actor ?? "", accion: e.accion, clave: e.clave, esc: e.esc, antes: e.antes ?? undefined, despues: e.despues ?? undefined, nota: e.nota }));
  return { roster, entries, validations, events, names };
}

export async function buildBoard(db: Db, engine: Engine, opts: { soloVal?: boolean } = {}): Promise<DecisionBoard> {
  const [input, corte] = await Promise.all([loadDecisionInput(db), getDecisionCorte(db)]);
  return new DecisionBoard(engine, input, { corte, soloVal: opts.soloVal });
}

export async function peopleByIds(db: Db, ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(profiles).where(inArray(profiles.id, ids));
}
