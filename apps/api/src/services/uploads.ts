/** Carga de archivos Excel: análisis (vista previa) y guardado en una sola transacción. */
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  autoevaluations, evidenceStatus, measurements, parameterSets, schoolScope, uploadRejections, uploads, type Db,
} from "@sgc/db";
import { ESC_BY, calcValorRow, catalogIndex, periodInfo, type AutoEval, type Model, type NormRow } from "@sgc/engine";
import { applyParamsFrom, parseAny, type ParsedFile } from "@sgc/excel";
import type { Actor } from "../perm";
import { can } from "../perm";
import type { FileStore } from "../storage";
import { audit } from "./audit";
import type { ActiveParams } from "./state";

export interface Rejection { fila: number; escuela: string; area: string; indicador: string; periodo: string; motivo: string; fecha_carga: string; row: NormRow }

export interface Analysis {
  filename: string;
  tipo: "carga" | "consolidado" | "parametros";
  escuela: string | null;
  version: string;
  sha256: string;
  size: number;
  valid: NormRow[];
  rejected: Rejection[];
  ignoradas: number;
  ejemploDescartadas: number;
  evid: ParsedFile["evid"];
  alcance: Record<string, string> | null;
  respLocal: Record<string, string> | null;
  autoeval: AutoEval | null;
  paramsMessage: string;
  paramsChanged: boolean;
  paramsIgnored: boolean;
  nuevosParams: ActiveParams["params"] | null;
  warns: string[];
  errors: string[];
  responsable: string;
  entrega: string;
  hojas: string[];
}

export interface AnalyzeOpts { catalogModel: Model; active: ActiveParams; actor: Actor; allowExample: boolean; ahora?: Date }

/** Lee el archivo y decide qué se guardaría; no toca la base. */
export function analyze(buf: Buffer, filename: string, o: AnalyzeOpts): Analysis {
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const parsed = parseAny(new Uint8Array(buf), filename, o.catalogModel, o.ahora);
  const base: Analysis = {
    filename, tipo: "carga", escuela: null, version: "", sha256, size: buf.length, valid: [], rejected: [], ignoradas: 0, ejemploDescartadas: 0, evid: [], alcance: null, respLocal: null, autoeval: null,
    paramsMessage: "", paramsChanged: false, paramsIgnored: false, nuevosParams: null, warns: [], errors: [], responsable: "", entrega: "", hojas: [],
  };

  if (parsed.tipo === "consolidado") {
    const ae = parsed.autoeval;
    base.tipo = "consolidado";
    base.escuela = ae.escuela || null;
    base.errors.push(...ae.errors);
    base.warns.push(...ae.warns);
    if (!ae.errors.length) base.autoeval = ae;
    return base;
  }

  const f = parsed.file;
  base.tipo = f.soloParams ? "parametros" : "carga";
  base.escuela = f.escuela || null;
  base.version = f.version;
  base.responsable = f.responsable;
  base.entrega = f.entrega;
  base.hojas = f.hojas;
  base.errors.push(...f.errors);
  base.warns.push(...f.warns);
  base.ignoradas = f.ignoradas;
  if (base.errors.length) return base;

  const { IND_BY, CARG_BY } = catalogIndex(o.catalogModel);
  const unitFor = (id: string) => {
    const rows = o.active.params.metas[id];
    return rows && rows[0] ? rows[0].unidad : CARG_BY[id] && IND_BY[id] ? IND_BY[id].unidad : "por definir";
  };

  let rows = f.rows;
  let evid = f.evid;
  if (!o.allowExample) {
    const ejemplo = rows.filter((r) => r.origen === "EJEMPLO").length;
    if (f.ejemplo || (rows.length && ejemplo === rows.length)) {
      base.errors.push("Este archivo trae solo datos de EJEMPLO (inventados): no se guardan en la base. Para verlos, enciende el interruptor «Datos EJEMPLO»; para cargar datos reales, llena la plantilla con datos de la escuela.");
      base.ejemploDescartadas = rows.length;
      return base;
    }
    base.ejemploDescartadas = ejemplo;
    if (ejemplo) base.warns.push(`${ejemplo} fila(s) con origen EJEMPLO no se guardaron.`);
    rows = rows.filter((r) => r.origen !== "EJEMPLO");
    evid = evid.filter((e) => e.origen !== "EJEMPLO");
  }

  for (const r of rows) {
    const pinfo = periodInfo(r.periodo);
    const valor = calcValorRow(r, unitFor(r.indicador));
    let motivo = "";
    if (!pinfo || valor === null || !r.indicador || !ESC_BY[r.escuela]) motivo = !pinfo ? "Periodo no válido" : valor === null ? "Sin valor" : !ESC_BY[r.escuela] ? "Escuela no válida" : "Sin indicador";
    else if (!r.fuente_dato) motivo = "Sin fuente del dato: no se muestra como dato";
    if (motivo) base.rejected.push({ fila: r.fila ?? 0, escuela: r.escuela, area: r.area, indicador: r.indicador, periodo: r.periodo, motivo, fecha_carga: r.fecha_carga, row: { ...r, valor } });
    else base.valid.push(r);
  }
  base.evid = evid;
  base.alcance = f.alcance;
  base.respLocal = f.respLocal;
  base.autoeval = f.autoeval && !f.autoeval.errors.length ? f.autoeval : null;

  if (f.params) {
    if (can.editParams(o.actor)) {
      const r = applyParamsFrom(o.active.params, [{ name: filename, params: f.params }]);
      base.paramsMessage = r.message;
      base.paramsChanged = r.changed;
      base.nuevosParams = r.changed ? r.params : null;
    } else {
      base.paramsIgnored = true;
      base.warns.push("El archivo trae una hoja de parámetros, pero solo la Oficina de Calidad o la administración pueden cambiarlos: se ignoró.");
    }
  }
  return base;
}

/** Quién puede guardar este análisis; devuelve un mensaje si no. */
export function uploadDenied(a: Analysis, actor: Actor): string | null {
  if (a.tipo === "parametros") return can.uploadGlobal(actor) ? null : "Solo la Oficina de Calidad o la administración pueden cargar parámetros.";
  if (!a.escuela) return "No se pudo identificar la escuela del archivo.";
  if (!can.upload(actor, a.escuela)) return `Tu cuenta no puede cargar archivos de ${ESC_BY[a.escuela]?.nombre ?? a.escuela}.`;
  return null;
}

const safeName = (n: string) => n.normalize("NFKD").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").slice(0, 120) || "archivo.xlsx";
const chunk = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export interface CommitResult { uploadId: string; mensajes: string[]; guardadas: number; rechazadas: number; reemplazados: number }

export async function commit(db: Db, store: FileStore, buf: Buffer, a: Analysis, o: { actor: Actor; active: ActiveParams }): Promise<CommitResult> {
  const id = randomUUID();
  const now = new Date();
  const key = `cargas/${now.toISOString().slice(0, 7)}/${id}/${safeName(a.filename)}`;
  await store.put(key, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  return db.transaction(async (tx) => {
    // un archivo con el mismo nombre (y escuela) reemplaza al anterior, como en el tablero original
    const same = await tx.select({ id: uploads.id }).from(uploads).where(and(eq(uploads.filename, a.filename), eq(uploads.kind, a.tipo), a.escuela ? eq(uploads.escuela, a.escuela) : sql`${uploads.escuela} is null`));
    if (same.length) {
      const ids = same.map((s) => s.id);
      await tx.delete(autoevaluations).where(inArray(autoevaluations.uploadId, ids));
      await tx.delete(uploads).where(inArray(uploads.id, ids));
    }

    await tx.insert(uploads).values({
      id, filename: a.filename, sha256: a.sha256, size: a.size, storagePath: key, kind: a.tipo, escuela: a.escuela, versionPlantilla: a.version, responsable: a.responsable, entrega: a.entrega,
      resumen: { filas: a.valid.length + a.rejected.length, validas: a.valid.length, rechazadas: a.rejected.length, ignoradas: a.ignoradas, ejemploDescartadas: a.ejemploDescartadas, evidencias: a.evid.length, hojas: a.hojas },
      advertencias: a.warns, uploadedBy: o.actor.id,
    });

    for (const part of chunk(a.valid, 400))
      await tx.insert(measurements).values(
        part.map((r) => ({
          uploadId: id, fila: r.fila ?? 0, periodo: r.periodo, escuela: r.escuela, area: r.area, indicador: r.indicador, numerador: r.numerador, denominador: r.denominador, valorDirecto: r.valor_directo,
          metaPropuesta: r.meta_propuesta, fuenteMeta: r.fuente_meta, esperado: r.esperado, fuenteEsperado: r.fuente_esperado, fuenteDato: r.fuente_dato, ev: r.ev, evRef: r.ev_ref,
          cargadoPor: r.cargado_por, fechaCarga: r.fecha_carga, estadoVal: r.estado_val, validadoPor: r.validado_por, fechaVal: r.fecha_val, version: r.version, obs: r.obs, archivo: r.archivo,
        })),
      );
    for (const part of chunk(a.rejected, 400))
      await tx.insert(uploadRejections).values(part.map((r) => ({ uploadId: id, fila: r.fila, escuela: r.escuela, area: r.area, indicador: r.indicador, periodo: r.periodo, motivo: r.motivo, fechaCarga: r.fecha_carga, filaJson: r.row as any })));

    const evRows = new Map<string, (typeof a.evid)[number]>();
    a.evid.forEach((e) => evRows.set([e.escuela, e.area, e.ev].join("|"), e));
    for (const part of chunk(Array.from(evRows.values()), 400))
      await tx.insert(evidenceStatus).values(part.map((e) => ({ uploadId: id, escuela: e.escuela, area: e.area, ev: e.ev, estado: e.estado, ubicacion: e.ubicacion, responsable: e.responsable, fecha: e.fecha, observacion: e.observacion })));

    if (a.escuela && (a.alcance || a.respLocal)) {
      const ids = new Set([...Object.keys(a.alcance ?? {}), ...Object.keys(a.respLocal ?? {})]);
      const scope = Array.from(ids).map((k) => ({ uploadId: id, escuela: a.escuela as string, indicadorId: k, enSeguimiento: a.alcance?.[k] ?? "", responsableLocal: a.respLocal?.[k] ?? "" })).filter((s) => s.enSeguimiento || s.responsableLocal);
      for (const part of chunk(scope, 400)) await tx.insert(schoolScope).values(part);
    }

    const mensajes: string[] = [];
    if (a.autoeval) {
      const ae = { ...a.autoeval, fabrica: undefined };
      await tx.insert(autoevaluations).values({ escuela: ae.escuela, data: ae as any, fabrica: false, uploadId: id }).onConflictDoUpdate({ target: autoevaluations.escuela, set: { data: ae as any, fabrica: false, uploadId: id, updatedAt: now } });
      mensajes.push(`autoevaluación de ${ESC_BY[ae.escuela]?.nombre ?? ae.escuela} leída (${ae.criterios.length} criterios, ${ae.nPend} de ${ae.nMat || "—"} matrices pendientes, ${ae.indicadores.length} valores sin validar)`);
    }

    if (a.paramsChanged && a.nuevosParams) {
      const [last] = await tx.select({ v: sql<number>`coalesce(max(${parameterSets.version}), 0)` }).from(parameterSets);
      await tx.insert(parameterSets).values({ version: Number(last.v) + 1, fecha: a.nuevosParams.fecha, origen: a.nuevosParams.origen, gen: a.nuevosParams.gen, reglas: a.nuevosParams.reglas, metas: a.nuevosParams.metas, nota: `Tomados del archivo ${a.filename}`, createdBy: o.actor.id });
      mensajes.push(a.paramsMessage);
    } else if (a.paramsMessage) mensajes.push(a.paramsMessage);

    await audit(tx, o.actor.id, { accion: "Carga de archivo", clave: a.filename, esc: a.escuela ?? "", despues: { tipo: a.tipo, validas: a.valid.length, rechazadas: a.rejected.length, sha256: a.sha256 }, extra: { uploadId: id } });
    return { uploadId: id, mensajes, guardadas: a.valid.length, rechazadas: a.rejected.length, reemplazados: same.length };
  });
}
