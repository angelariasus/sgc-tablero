import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { autoevaluations, uploads } from "@sgc/db";
import { DecisionBoard, ESC_BY, EXPORT_KINDS, parseISO, type ExportKind } from "@sgc/engine";
import { DECISION_KINDS, ExportError, exportCsv, exportDecisionCsv, exportDecisionXlsx, exportParamsXlsx, exportXlsx, type DecisionKind } from "@sgc/excel";
import type { Ctx } from "../app";
import { HttpError, badRequest, forbidden, notFound, parse, sendFile } from "../http";
import { can } from "../perm";
import { audit } from "../services/audit";
import { buildBoard, buildEngine, getActiveParams } from "../services/state";
import { analyze, commit, uploadDenied } from "../services/uploads";

const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04];

const ExportQuery = z.object({
  what: z.enum([...EXPORT_KINDS, "todo"] as unknown as [string, ...string[]]).default("todo"),
  fmt: z.enum(["csv", "xlsx"]).default("xlsx"),
  ejemplo: z.enum(["0", "1"]).default("0"),
  corte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const DecisionExportQuery = z.object({
  what: z.enum(["todo", ...DECISION_KINDS] as [string, ...string[]]).default("todo"),
  fmt: z.enum(["csv", "xlsx"]).default("xlsx"),
  esc: z.enum(["TODAS", "ENF", "OBS", "TM"]).default("TODAS"),
  solo_validados: z.enum(["0", "1"]).default("0"),
});

export async function registerFiles(app: FastifyInstance, ctx: Ctx) {
  const { db, store, env } = ctx;

  /* ---------------- cargas ---------------- */

  app.get("/api/uploads", async (req) => {
    await ctx.actor(req);
    const { listUploads } = await import("../services/state");
    return listUploads(db);
  });

  /**
   * Vista previa y guardado en dos pasos con el mismo archivo.
   * Sin `confirm=1` solo se analiza; con `confirm=1` se guarda (si no hay errores).
   */
  app.post("/api/uploads", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const actor = await ctx.actor(req);
    const confirm = (req.query as { confirm?: string }).confirm === "1";
    const file = await req.file();
    if (!file) throw badRequest("Adjunta un archivo Excel (.xlsx).");
    if (!/\.xlsx$/i.test(file.filename)) throw badRequest(`${file.filename}: no es un archivo Excel (.xlsx).`);
    const buf = await file.toBuffer();
    if (file.file.truncated) throw new HttpError(413, `El archivo supera el máximo de ${env.MAX_UPLOAD_MB} MB.`, "too_large");
    if (buf.length < 4 || XLSX_MAGIC.some((b, i) => buf[i] !== b)) throw badRequest(`${file.filename}: no parece un libro de Excel válido.`);

    const catalog = await ctx.catalog();
    const active = await getActiveParams(db);
    let a;
    try {
      a = analyze(buf, file.filename, { catalogModel: catalog.model, active, actor, allowExample: env.ALLOW_EXAMPLE_UPLOADS });
    } catch (e: any) {
      throw badRequest(`${file.filename}: no se pudo leer (${e?.message ?? "error"}).`);
    }
    const denied = uploadDenied(a, actor);
    const resumen = {
      archivo: a.filename, tipo: a.tipo, escuela: a.escuela, escuelaNombre: a.escuela ? ESC_BY[a.escuela]?.nombre ?? a.escuela : null, plantilla: a.version, responsable: a.responsable, entrega: a.entrega,
      filasValidas: a.valid.length, filasRechazadas: a.rejected.length, ignoradas: a.ignoradas, ejemploDescartadas: a.ejemploDescartadas, evidencias: a.evid.length,
      alcance: a.alcance ? Object.keys(a.alcance).length : 0, parametros: a.paramsMessage, parametrosCambian: a.paramsChanged,
      autoevaluacion: a.autoeval ? { escuela: a.autoeval.escuela, criterios: a.autoeval.criterios.length, matricesPendientes: a.autoeval.nPend, matrices: a.autoeval.nMat, valoresSinValidar: a.autoeval.indicadores.length } : null,
      muestraRechazadas: a.rejected.slice(0, 50).map((r) => ({ fila: r.fila, periodo: r.periodo, escuela: r.escuela, indicador: r.indicador, motivo: r.motivo })),
      advertencias: a.warns, errores: a.errors, hojas: a.hojas, sha256: a.sha256, size: a.size,
      permitido: !denied, motivoNoPermitido: denied,
    };
    if (!confirm) return { guardado: false, ...resumen };
    if (a.errors.length) throw new HttpError(422, `${a.filename}: ${a.errors.join(" ")}`, "invalid_file", { resumen });
    if (denied) throw forbidden(denied);
    const r = await commit(db, store, buf, a, { actor, active });
    reply.status(201);
    return { guardado: true, ...resumen, uploadId: r.uploadId, mensajes: r.mensajes, reemplazados: r.reemplazados };
  });

  /** Descarga del archivo original tal como se recibió. */
  app.get("/api/uploads/:id/file", async (req, reply) => {
    await ctx.actor(req);
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const [u] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
    if (!u) throw notFound("No existe ese archivo.");
    const body = await store.get(u.storagePath);
    if (!body) throw notFound("El archivo original no está en el almacenamiento.");
    return sendFile(reply, { filename: u.filename, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body });
  });

  app.delete("/api/uploads/:id", async (req) => {
    const actor = await ctx.actor(req);
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const [u] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
    if (!u) throw notFound("No existe ese archivo.");
    const ok = u.escuela ? can.upload(actor, u.escuela) : can.uploadGlobal(actor);
    if (!ok) throw forbidden("Tu cuenta no puede quitar este archivo.");
    await db.transaction(async (tx) => {
      await tx.delete(autoevaluations).where(eq(autoevaluations.uploadId, id));
      await tx.delete(uploads).where(eq(uploads.id, id));
      await audit(tx, actor.id, { accion: "Archivo quitado", clave: u.filename, esc: u.escuela ?? "", despues: { uploadId: id } });
    });
    return { ok: true };
  });

  /** Quita un Consolidado de autoevaluación (incluido el de fábrica, que no viene de un archivo cargado). */
  app.delete("/api/autoeval/:escuela", async (req) => {
    const actor = await ctx.actor(req);
    const { escuela } = parse(z.object({ escuela: z.enum(["ENF", "OBS", "TM"]) }), req.params);
    if (!can.upload(actor, escuela)) throw forbidden("Tu cuenta no puede quitar la autoevaluación de esa escuela.");
    const del = await db.delete(autoevaluations).where(eq(autoevaluations.escuela, escuela)).returning({ e: autoevaluations.escuela });
    if (!del.length) throw notFound("Esa escuela no tiene autoevaluación cargada.");
    await audit(db, actor.id, { accion: "Autoevaluación quitada", clave: escuela, esc: escuela });
    return { ok: true };
  });

  /* ---------------- exportaciones ---------------- */

  app.get("/api/export", async (req, reply) => {
    const actor = await ctx.actor(req);
    const q = parse(ExportQuery, req.query);
    const engine = await buildEngine(db, await ctx.catalog(), { ejemplo: q.ejemplo === "1", corteOverride: q.corte ? parseISO(q.corte) : null });
    const generado = new Date();
    try {
      const file = q.fmt === "csv" ? (() => { if (q.what === "todo") throw badRequest("El CSV se exporta de una hoja a la vez."); return exportCsv(engine, q.what as ExportKind, generado); })() : exportXlsx(engine, q.what as ExportKind | "todo", generado);
      await audit(db, actor.id, { accion: "Exportación", clave: `${q.what}.${q.fmt}`, despues: { ejemplo: q.ejemplo === "1" } });
      return sendFile(reply, file);
    } catch (e) {
      if (e instanceof ExportError) throw new HttpError(e.message.startsWith("No hay filas") ? 404 : 422, e.message, "export_failed", { problemas: e.problemas.slice(0, 20) });
      throw e;
    }
  });

  app.get("/api/export/params", async (req, reply) => {
    await ctx.actor(req);
    const engine = await buildEngine(db, await ctx.catalog(), { ejemplo: false });
    return sendFile(reply, exportParamsXlsx(engine, new Date()));
  });

  app.get("/api/export/decision", async (req, reply) => {
    const actor = await ctx.actor(req);
    const q = parse(DecisionExportQuery, req.query);
    const engine = await buildEngine(db, await ctx.catalog(), { ejemplo: false });
    const board: DecisionBoard = await buildBoard(db, engine, { soloVal: q.solo_validados === "1" });
    const items = q.esc === "TODAS" ? board.items : board.items.filter((i) => i.esc === q.esc);
    try {
      const file = q.fmt === "csv" ? (() => { if (q.what === "todo") throw badRequest("El CSV se exporta de una hoja a la vez."); return exportDecisionCsv(board, items, q.what as DecisionKind); })() : exportDecisionXlsx(board, items);
      await audit(db, actor.id, { accion: "Exportación de la vista Decisión", clave: `${q.what}.${q.fmt}` });
      return sendFile(reply, file);
    } catch (e) {
      if (e instanceof ExportError) throw new HttpError(404, e.message, "export_failed");
      throw e;
    }
  });
}
