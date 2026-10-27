import type { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { auditLog, profiles, type Rol } from "@sgc/db";
import type { Ctx } from "../app";
import { badRequest, conflict, forbidden, notFound, parse } from "../http";
import { can } from "../perm";
import { audit } from "../services/audit";

const rolEnum = z.enum(["admin", "oficina", "responsable", "lectura"]);
const escEnum = z.enum(["ENF", "OBS", "TM"]);
const password = z.string().min(10, "La contraseña debe tener al menos 10 caracteres.").max(128);

const Create = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido."),
  nombre: z.string().trim().min(2, "Escribe el nombre de la persona.").max(120),
  rol: rolEnum,
  escuela: escEnum.nullable().optional(),
  password,
});
const Patch = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  rol: rolEnum.optional(),
  escuela: escEnum.nullable().optional(),
  activo: z.boolean().optional(),
});

const publicProfile = (p: typeof profiles.$inferSelect) => ({ id: p.id, email: p.email, nombre: p.nombre, rol: p.rol, escuela: p.escuela, activo: p.activo, createdAt: p.createdAt.toISOString() });

/** Un responsable necesita escuela; los demás roles no la llevan. */
function normalize(rol: Rol, escuela: string | null | undefined): string | null {
  if (rol === "responsable") {
    if (!escuela) throw badRequest("Elige la escuela de la persona responsable.");
    return escuela;
  }
  return null;
}

export async function registerTeam(app: FastifyInstance, ctx: Ctx) {
  const { db, admin } = ctx;

  const requireAdmin = async (req: Parameters<Ctx["actor"]>[0]) => {
    const a = await ctx.actor(req);
    if (!can.manageTeam(a)) throw forbidden("Solo la administración gestiona al equipo.");
    return a;
  };

  /** Nombres visibles de todo el equipo (para mostrar «quién hizo qué»); el detalle completo es solo para la administración. */
  app.get("/api/team", async (req) => {
    const a = await ctx.actor(req);
    const rows = await db.select().from(profiles).orderBy(profiles.nombre);
    if (can.manageTeam(a)) return rows.map(publicProfile);
    return rows.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol, escuela: p.escuela }));
  });

  app.post("/api/team", async (req, reply) => {
    const a = await requireAdmin(req);
    const b = parse(Create, req.body);
    const escuela = normalize(b.rol, b.escuela);
    const dup = await db.select({ id: profiles.id }).from(profiles).where(sql`lower(${profiles.email}) = ${b.email}`).limit(1);
    if (dup.length) throw conflict("Ya existe una persona con ese correo.");
    if (b.rol === "responsable") {
      const [ya] = await db.select({ nombre: profiles.nombre }).from(profiles).where(sql`${profiles.rol} = 'responsable' and ${profiles.escuela} = ${escuela} and ${profiles.activo}`).limit(1);
      if (ya) throw conflict(`${ya.nombre} ya es responsable de esa escuela: hay uno por escuela. Cámbiale el rol primero.`);
    }
    const { id } = await admin.createUser({ email: b.email, password: b.password, nombre: b.nombre });
    try {
      await db.transaction(async (tx) => {
        await tx.insert(profiles).values({ id, email: b.email, nombre: b.nombre, rol: b.rol, escuela });
        await audit(tx, a.id, { accion: "Persona agregada", clave: b.email, esc: escuela ?? "", despues: { rol: b.rol, escuela }, extra: { ambito: "decision" } });
      });
    } catch (e) {
      await admin.setBanned(id, true).catch(() => {});
      throw e;
    }
    reply.status(201);
    return { id };
  });

  app.patch("/api/team/:id", async (req) => {
    const a = await requireAdmin(req);
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const b = parse(Patch, req.body);
    const [cur] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (!cur) throw notFound("No existe esa persona.");
    const rol = b.rol ?? cur.rol;
    const escuela = normalize(rol, b.escuela === undefined ? cur.escuela : b.escuela);
    const activo = b.activo ?? cur.activo;
    // siempre debe quedar al menos una administración activa
    if (cur.rol === "admin" && cur.activo && (rol !== "admin" || !activo)) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(profiles).where(sql`${profiles.rol} = 'admin' and ${profiles.activo}`);
      if (Number(n) <= 1) throw conflict("Debe quedar al menos una cuenta de administración activa.");
    }
    await db.transaction(async (tx) => {
      // un solo responsable por escuela: el anterior pasa a solo lectura
      if (rol === "responsable" && activo) {
        const prev = await tx.select().from(profiles).where(sql`${profiles.rol} = 'responsable' and ${profiles.escuela} = ${escuela} and ${profiles.activo} and ${profiles.id} <> ${id}`);
        for (const p of prev) {
          await tx.update(profiles).set({ rol: "lectura", escuela: null, updatedAt: new Date() }).where(eq(profiles.id, p.id));
          await audit(tx, a.id, { accion: "Persona retirada como responsable", clave: p.email, esc: escuela ?? "", antes: { rol: p.rol, escuela: p.escuela }, despues: { rol: "lectura" }, extra: { ambito: "decision" } });
        }
      }
      await tx.update(profiles).set({ nombre: b.nombre ?? cur.nombre, rol, escuela, activo, updatedAt: new Date() }).where(eq(profiles.id, id));
      await audit(tx, a.id, { accion: "Persona modificada", clave: cur.email, esc: escuela ?? "", antes: { rol: cur.rol, escuela: cur.escuela, activo: cur.activo }, despues: { rol, escuela, activo }, extra: { ambito: "decision" } });
    });
    if (b.activo !== undefined && b.activo !== cur.activo) await admin.setBanned(id, !b.activo).catch((e) => ctx.env.NODE_ENV !== "test" && app.log.warn({ err: e }, "no se pudo actualizar el bloqueo en Supabase"));
    return { ok: true };
  });

  app.post("/api/team/:id/password", async (req) => {
    const a = await requireAdmin(req);
    const { id } = parse(z.object({ id: z.string().uuid() }), req.params);
    const { password: pw } = parse(z.object({ password }), req.body);
    const [cur] = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (!cur) throw notFound("No existe esa persona.");
    await admin.setPassword(id, pw);
    await audit(db, a.id, { accion: "Contraseña restablecida", clave: cur.email });
    return { ok: true };
  });

  app.get("/api/audit", async (req) => {
    const a = await ctx.actor(req);
    if (!can.readAudit(a)) throw forbidden("Solo la Oficina de Calidad o la administración ven la bitácora completa.");
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
    const rows = await db.select().from(auditLog).orderBy(desc(auditLog.ts)).limit(limit);
    return rows.map((r) => ({ id: r.id, ts: r.ts.toISOString(), actor: r.actor, accion: r.accion, clave: r.clave, esc: r.esc, antes: r.antes, despues: r.despues, nota: r.nota }));
  });
}
