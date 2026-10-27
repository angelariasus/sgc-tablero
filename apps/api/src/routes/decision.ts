import type { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { decisionEntries, decisionValidations, parameterSets, settings } from "@sgc/db";
import { DEC_AREAS, DEC_ESC, DEC_FICHA_TXT, DecisionBoard, defaultParams, isoD, type Params } from "@sgc/engine";
import type { Ctx } from "../app";
import { badRequest, conflict, forbidden, notFound, parse } from "../http";
import { can } from "../perm";
import { audit } from "../services/audit";
import { buildBoard, buildEngine, getActiveParams } from "../services/state";

const esc = z.enum(["ENF", "OBS", "TM"]);
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (use AAAA-MM-DD).");

const ValueBody = z.object({
  esc,
  area: z.string().default(""),
  ind: z.string().regex(/^ID\d{1,2}$/, "Indicador inválido."),
  per: z.string().regex(/^\d{4}(-S[12])?$/, "Periodo inválido."),
  val: z.number().finite("Escribe un valor numérico."),
  fuente: z.string().trim().min(1, "La fuente es obligatoria: sin fuente el valor no se guarda.").max(2000),
  corte: fecha,
  nota: z.string().max(1000).default(""),
  anulado: z.boolean().default(false),
});

const ProcBody = z.object({
  esc,
  proc: z.string().regex(/^P\d{1,2}$/, "Proceso inválido."),
  ficha: z.enum(Object.keys(DEC_FICHA_TXT) as [string, ...string[]]),
  dueno: z.string().trim().max(300).default(""),
  fuente: z.string().trim().min(1, "La fuente es obligatoria (resolución, acta o documento).").max(2000),
});

const ValidationBody = z.object({
  key: z.string().min(1).max(200),
  entryTs: z.string().datetime({ offset: true }),
  estado: z.enum(["Validado", "Observado"]),
  nota: z.string().max(1000).default(""),
});

const MetaRow = z.object({
  desde: z.number().finite(),
  meta: z.number().finite().nullable(),
  sentido: z.string(),
  unidad: z.string(),
  fuente_meta: z.string().default(""),
  estado_meta: z.string(),
  verde_min: z.number().finite().nullable(),
  rojo_min: z.number().finite().nullable(),
  base: z.enum(["cumplimiento", "valor"]),
  avance: z.enum(["Puntual", "Acumulado en el año"]),
  regla: z.enum(["razon", "menor_igual", "no_negativa"]),
  fuente_umbral: z.string().default(""),
  nota: z.string().default(""),
});
const Regla = z.object({
  id: z.string().regex(/^R\d{2}$/), nombre: z.string(), activa: z.enum(["Sí", "No"]), severidad: z.enum(["Crítica", "En riesgo", "Aviso", "Por banda"]),
  condicion: z.string(), que: z.string().min(1), porque: z.string().min(1), accion: z.string().min(1),
});
const ParamsBody = z.object({
  gen: z.record(z.string(), z.any()),
  reglas: z.array(Regla).min(1),
  metas: z.record(z.string(), z.array(MetaRow)),
  nota: z.string().max(500).default(""),
});

export async function registerDecision(app: FastifyInstance, ctx: Ctx) {
  const { db } = ctx;

  /** Estado actual de la vista Decisión (para comprobar lo que se va a escribir). */
  const board = async () => {
    const engine = await buildEngine(db, await ctx.catalog(), { ejemplo: false });
    return buildBoard(db, engine);
  };

  app.post("/api/decision/values", async (req) => {
    const a = await ctx.actor(req);
    const b = parse(ValueBody, req.body);
    if (!can.editDecision(a, b.esc)) throw forbidden(`Tu cuenta no puede editar ${b.esc === "TM" ? "Tecnología Médica" : b.esc === "OBS" ? "Obstetricia" : "Enfermería"}.`);
    const B = await board();
    if (!B.IND[b.ind]) throw badRequest("Ese indicador no existe en el Modelo.");
    if (b.area && (b.esc !== "TM" || !DEC_AREAS.includes(b.area))) throw badRequest("El área solo aplica a Tecnología Médica (RAD, TF, TO o LCAP).");
    if (!B.perOptions(b.ind).includes(b.per)) throw badRequest(`El periodo ${b.per} no corresponde a un indicador ${B.IND[b.ind].frec.toLowerCase()} con corte al ${B.corte}.`);
    const key = DecisionBoard.keyV(b.esc, b.area, b.ind, b.per);
    const antes = B.model.pts.find((p) => p.key === key) || null;
    if (b.anulado && !antes) throw badRequest("No hay un valor cargado en ese periodo.");
    const ts = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(decisionEntries).values({ t: "v", key, esc: b.esc, area: b.area, ind: b.ind, per: b.per, val: b.val, fuente: b.fuente, corte: b.corte, nota: b.nota, anulado: b.anulado, ts, autor: a.id });
      await audit(tx, a.id, {
        accion: b.anulado ? "Anulación de valor" : antes ? "Cambio de valor" : "Alta de valor", clave: key, esc: b.esc,
        antes: antes ? { val: antes.val, fuente: antes.fuente } : null, despues: b.anulado ? null : { val: b.val, fuente: b.fuente, corte: b.corte }, nota: b.nota,
        extra: { ambito: "decision", area: b.area, ind: b.ind, per: b.per },
      });
    });
    return { ok: true, ts: ts.toISOString(), key };
  });

  app.post("/api/decision/processes", async (req) => {
    const a = await ctx.actor(req);
    const b = parse(ProcBody, req.body);
    if (!can.editDecision(a, b.esc)) throw forbidden("Tu cuenta no puede editar esa escuela.");
    const B = await board();
    if (!B.PROC_IDS[b.proc]) throw badRequest("Ese proceso no existe.");
    const key = DecisionBoard.keyP(b.esc, b.proc);
    const antes = B.model.procs.get(`${b.esc}|${b.proc}`) || null;
    const ts = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(decisionEntries).values({ t: "p", key, esc: b.esc, proc: b.proc, ficha: b.ficha, dueno: b.dueno, fuente: b.fuente, ts, autor: a.id });
      await audit(tx, a.id, { accion: "Cambio del proceso", clave: key, esc: b.esc, antes: antes ? { ficha: antes.ficha, dueno: antes.dueno } : null, despues: { ficha: b.ficha, dueno: b.dueno }, nota: b.fuente, extra: { ambito: "decision", proc: b.proc } });
    });
    return { ok: true, ts: ts.toISOString(), key };
  });

  app.post("/api/decision/validations", async (req) => {
    const a = await ctx.actor(req);
    if (!can.validate(a)) throw forbidden("Solo la Oficina de Calidad o la administración validan los valores.");
    const b = parse(ValidationBody, req.body);
    const B = await board();
    const entryTs = new Date(b.entryTs).toISOString();
    const pt = B.model.pts.find((p) => p.key === b.key);
    const pr = Array.from(B.model.procs.values()).find((p) => p.key === b.key);
    const target = pt ?? pr;
    if (!target) throw notFound("No existe ese valor o proceso.");
    if (target.ts !== entryTs) throw conflict("Ese valor cambió después de que lo abriste: vuelve a abrirlo antes de validarlo.");
    const ts = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(decisionValidations).values({ key: b.key, entryTs: new Date(entryTs), estado: b.estado, nota: b.nota, by: a.id, ts });
      await audit(tx, a.id, { accion: b.estado === "Validado" ? "Validación de la oficina" : "Observación de la oficina", clave: b.key, esc: target.esc, nota: b.nota, extra: { ambito: "decision", ind: (target as any).ind, area: (target as any).area, proc: (target as any).proc } });
    });
    return { ok: true };
  });

  /* ---------------- parámetros ---------------- */

  app.get("/api/params/history", async (req) => {
    await ctx.actor(req);
    const rows = await db.select({ id: parameterSets.id, version: parameterSets.version, fecha: parameterSets.fecha, origen: parameterSets.origen, nota: parameterSets.nota, createdBy: parameterSets.createdBy, createdAt: parameterSets.createdAt }).from(parameterSets).orderBy(desc(parameterSets.version)).limit(50);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  });

  /** Una versión guardada (para volver a verla o restaurarla). */
  app.get("/api/params/:version", async (req) => {
    await ctx.actor(req);
    const { version } = parse(z.object({ version: z.coerce.number().int().positive() }), req.params);
    const [p] = await db.select().from(parameterSets).where(eq(parameterSets.version, version)).limit(1);
    if (!p) throw notFound("No existe esa versión de parámetros.");
    return { version: p.version, params: { gen: p.gen, reglas: p.reglas, metas: p.metas, origen: p.origen, fecha: p.fecha } as Params };
  });

  const saveParams = async (actorId: string, p: Params, nota: string) => {
    return db.transaction(async (tx) => {
      const [last] = await tx.select({ v: sql<number>`coalesce(max(${parameterSets.version}), 0)` }).from(parameterSets);
      const version = Number(last.v) + 1;
      await tx.insert(parameterSets).values({ version, fecha: p.fecha, origen: p.origen, gen: p.gen, reglas: p.reglas, metas: p.metas, nota, createdBy: actorId });
      await audit(tx, actorId, { accion: "Cambio de parámetros", clave: `parametros v${version}`, nota: nota || p.origen, despues: { origen: p.origen, fecha: p.fecha } });
      return version;
    });
  };

  app.put("/api/params", async (req) => {
    const a = await ctx.actor(req);
    if (!can.editParams(a)) throw forbidden("Solo la Oficina de Calidad o la administración editan los parámetros.");
    const b = parse(ParamsBody, req.body);
    for (const [id, rows] of Object.entries(b.metas)) {
      for (const r of rows) {
        if (r.verde_min !== null && r.rojo_min !== null && r.verde_min < r.rojo_min) throw badRequest(`${id}: el límite meta debe ser mayor o igual que el límite riesgo.`);
        r.estado_meta = r.meta !== null && r.fuente_meta.trim() ? "Con fuente" : r.estado_meta === "En conflicto" && r.meta === null ? "En conflicto" : "Por definir";
      }
    }
    const hoy = isoD(new Date());
    const gen = { ...b.gen, fecha_parametros: hoy };
    const version = await saveParams(a.id, { gen, reglas: b.reglas, metas: b.metas, origen: "Editados en el tablero", fecha: hoy }, b.nota);
    return { ok: true, version };
  });

  app.post("/api/params/reset", async (req) => {
    const a = await ctx.actor(req);
    if (!can.editParams(a)) throw forbidden("Solo la Oficina de Calidad o la administración editan los parámetros.");
    const c = await ctx.catalog();
    const d = defaultParams(c.model, c.pdef);
    const hoy = isoD(new Date());
    const version = await saveParams(a.id, { ...d, gen: { ...d.gen, fecha_parametros: hoy }, fecha: hoy }, "Restablecidos a los valores de fábrica");
    return { ok: true, version };
  });

  /** Vigente hoy; sirve para que el navegador sepa si hay cambios sin guardar. */
  app.get("/api/params", async (req) => {
    await ctx.actor(req);
    const ap = await getActiveParams(db);
    return { version: ap.version, createdAt: ap.createdAt, params: ap.params };
  });

  /* ---------------- ajustes ---------------- */

  app.put("/api/settings/decision-corte", async (req) => {
    const a = await ctx.actor(req);
    if (!can.editParams(a)) throw forbidden("Solo la Oficina de Calidad o la administración cambian la fecha de corte de la vista Decisión.");
    const { fecha: f } = parse(z.object({ fecha }), req.body);
    await db.transaction(async (tx) => {
      await tx.insert(settings).values({ key: "decision_corte", value: f, updatedBy: a.id }).onConflictDoUpdate({ target: settings.key, set: { value: f, updatedAt: new Date(), updatedBy: a.id } });
      await audit(tx, a.id, { accion: "Cambio de la fecha de corte de la vista Decisión", clave: "decision_corte", despues: { fecha: f } });
    });
    return { ok: true };
  });

  void DEC_ESC;
}
