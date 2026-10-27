import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { profiles } from "@sgc/db";
import { TEMPLATE_FILES } from "@sgc/catalog";
import type { Ctx } from "../app";
import { HttpError, notFound, parse } from "../http";
import { getActiveParams, getDecisionCorte, listUploads, loadDecisionInput, loadStored } from "../services/state";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Carpeta de las plantillas Excel: variable TEMPLATES_DIR, la copia del build o el paquete del catálogo. */
export function templatesDir(): string {
  const cands = [process.env.TEMPLATES_DIR, path.resolve(here, "assets/files"), path.resolve(here, "../assets/files"), path.resolve(here, "../../../../packages/catalog/files")].filter(Boolean) as string[];
  const hit = cands.find((c) => fs.existsSync(c));
  if (!hit) throw new Error("No se encuentran las plantillas Excel (TEMPLATES_DIR).");
  return hit;
}

const TEMPLATE_INFO: Record<string, { titulo: string; descripcion: string }> = {
  "SGC_Plantilla_de_carga_por_escuela_v0.6.xlsx": { titulo: "Plantilla de carga (vacía)", descripcion: "La misma para las tres escuelas: listas desplegables, validaciones, catálogo, 53 criterios y 29 ID en «sin dato»." },
  "SGC_EJEMPLO_carga_ENF.xlsx": { titulo: "Ejemplo · Enfermería", descripcion: "Con datos EJEMPLO inventados y rotulados." },
  "SGC_EJEMPLO_carga_OBS.xlsx": { titulo: "Ejemplo · Obstetricia", descripcion: "Con datos EJEMPLO inventados y rotulados." },
  "SGC_EJEMPLO_carga_TM.xlsx": { titulo: "Ejemplo · Tecnología Médica", descripcion: "Con datos EJEMPLO inventados y rotulados." },
};

export async function registerCore(app: FastifyInstance, ctx: Ctx) {
  const { db, env } = ctx;

  app.get("/health", async () => ({ ok: true }));

  app.get("/api/me", async (req) => {
    const a = await ctx.actor(req);
    return { id: a.id, email: a.email, nombre: a.nombre, rol: a.rol, escuela: a.escuela };
  });

  /** Catálogo del modelo: cambia solo con una nueva versión de la aplicación, así que se guarda en caché. */
  app.get("/api/catalog", async (req, reply) => {
    await ctx.actor(req);
    const c = await ctx.catalog();
    reply.header("ETag", c.etag).header("Cache-Control", "private, max-age=0, must-revalidate");
    if (req.headers["if-none-match"] === c.etag) return reply.status(304).send();
    return reply.type("application/json").send(c.json);
  });

  /** Todo lo guardado que necesita el navegador para calcular las vistas. */
  app.get("/api/state", async (req, reply) => {
    const me = await ctx.actor(req);
    const [st, active, decision, corte, ups] = await Promise.all([loadStored(db), getActiveParams(db), loadDecisionInput(db), getDecisionCorte(db), null]);
    void ups;
    const uploads = await listUploads(db);
    reply.header("Cache-Control", "no-store");
    return {
      me: { id: me.id, email: me.email, nombre: me.nombre, rol: me.rol, escuela: me.escuela },
      serverTime: new Date().toISOString(),
      params: { ...active.params, version: active.version, createdAt: active.createdAt },
      decisionCorte: corte,
      measurements: st.measurements,
      rejected: st.rejected,
      evidence: st.evidence,
      scopes: st.scopes,
      schoolsWithFiles: st.schoolsWithFiles,
      autoeval: st.autoeval,
      fileNames: st.fileNames,
      uploads,
      decision,
      allowExampleUploads: env.ALLOW_EXAMPLE_UPLOADS,
    };
  });

  app.get("/api/templates", async (req) => {
    await ctx.actor(req);
    const dir = templatesDir();
    return TEMPLATE_FILES.filter((n) => fs.existsSync(path.join(dir, n)) && TEMPLATE_INFO[n]).map((n) => ({ nombre: n, ...TEMPLATE_INFO[n], size: fs.statSync(path.join(dir, n)).size }));
  });

  app.get("/api/templates/:name", async (req, reply) => {
    await ctx.actor(req);
    const { name } = req.params as { name: string };
    if (!(TEMPLATE_FILES as readonly string[]).includes(name)) throw notFound("Ese archivo no está incluido.");
    const file = path.join(templatesDir(), name);
    if (!fs.existsSync(file)) throw notFound("Ese archivo no está incluido.");
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${name}"`)
      .send(fs.readFileSync(file));
  });

  if (env.DEV_AUTH && ctx.devSigner) {
    const signer = ctx.devSigner;
    // Solo desarrollo local: inicia sesión con una cuenta que ya existe. Nunca se registra en producción.
    app.get("/api/dev/users", async () => (await db.select({ email: profiles.email, nombre: profiles.nombre, rol: profiles.rol }).from(profiles).where(eq(profiles.activo, true))));
    app.post("/api/dev/login", async (req) => {
      const { email } = parse(z.object({ email: z.string().email() }), req.body);
      const [p] = await db.select().from(profiles).where(eq(profiles.email, email.toLowerCase())).limit(1);
      if (!p || !p.activo) throw new HttpError(403, "No hay una cuenta activa con ese correo.", "no_access");
      return { token: await signer(p.id, p.email) };
    });
  }
}
