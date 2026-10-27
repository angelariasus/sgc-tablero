import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { eq, sql } from "drizzle-orm";
import { ZodError } from "zod";
import { profiles, type Db } from "@sgc/db";
import { AuthError, type AuthAdmin, type TokenVerifier } from "./auth";
import type { Env } from "./env";
import { HttpError } from "./http";
import type { Actor } from "./perm";
import type { FileStore } from "./storage";
import { loadCatalog, type Catalog } from "./services/catalog";
import { audit } from "./services/audit";
import { registerCore } from "./routes/core";
import { registerDecision } from "./routes/decision";
import { registerFiles } from "./routes/files";
import { registerTeam } from "./routes/team";

export interface AppDeps {
  env: Env;
  db: Db;
  store: FileStore;
  verifier: TokenVerifier;
  admin: AuthAdmin;
  /** solo desarrollo: firma sesiones locales */
  devSigner?: (sub: string, email: string) => Promise<string>;
}

export interface Ctx extends AppDeps {
  catalog(): Promise<Catalog>;
  actor(req: FastifyRequest): Promise<Actor>;
}

declare module "fastify" {
  interface FastifyRequest { actorCache?: Actor }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { env, db } = deps;
  const app = Fastify({
    logger: env.NODE_ENV === "test" ? false : { level: env.LOG_LEVEL, redact: ["req.headers.authorization"] },
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["Content-Disposition", "ETag"],
    maxAge: 600,
  });
  await app.register(compress, { global: true, threshold: 1024 });
  await app.register(rateLimit, { global: true, max: 600, timeWindow: "1 minute", allowList: (req) => req.url === "/health" });
  await app.register(multipart, { limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 } });

  let catalogCache: Promise<Catalog> | null = null;
  const ctx: Ctx = {
    ...deps,
    catalog: () => (catalogCache ??= loadCatalog(db).catch((e) => { catalogCache = null; throw e; })),
    async actor(req) {
      if (req.actorCache) return req.actorCache;
      const h = req.headers.authorization ?? "";
      const m = /^Bearer\s+(.+)$/i.exec(h);
      if (!m) throw new AuthError("Falta iniciar sesión.");
      const v = await deps.verifier.verify(m[1]);
      let [p] = await db.select().from(profiles).where(eq(profiles.id, v.sub)).limit(1);
      if (!p) {
        // la primera cuenta administradora se crea al iniciar sesión con el correo indicado en BOOTSTRAP_ADMIN_EMAIL
        const boot = env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(profiles);
        if (boot && v.email === boot && Number(n) === 0) {
          [p] = await db.insert(profiles).values({ id: v.sub, email: v.email, nombre: v.email.split("@")[0], rol: "admin" }).onConflictDoNothing().returning();
          if (!p) [p] = await db.select().from(profiles).where(eq(profiles.id, v.sub)).limit(1);
          await audit(db, v.sub, { accion: "Primera cuenta administradora", clave: v.email });
        }
      }
      if (!p) throw new HttpError(403, "Tu cuenta no tiene acceso a este tablero. Pide a la administración que te cree un usuario.", "no_access");
      if (!p.activo) throw new HttpError(403, "Tu cuenta está desactivada.", "disabled");
      const a: Actor = { id: p.id, email: p.email, nombre: p.nombre, rol: p.rol, escuela: p.escuela };
      req.actorCache = a;
      return a;
    },
  };

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.code, message: err.message, ...(err.extra ?? {}) });
    if (err instanceof AuthError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err instanceof ZodError) return reply.status(400).send({ error: "bad_request", message: err.issues[0]?.message ?? "Datos inválidos" });
    if (err?.code === "FST_REQ_FILE_TOO_LARGE" || err?.code === "FST_FILES_LIMIT") return reply.status(413).send({ error: "too_large", message: `El archivo supera el máximo de ${env.MAX_UPLOAD_MB} MB.` });
    if (err?.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.code ?? "bad_request", message: err.message });
    // violaciones de restricciones de la base (por ejemplo, medición sin fuente)
    const pg = err?.cause?.code ?? err?.code;
    if (typeof pg === "string" && /^23/.test(pg)) {
      req.log.warn({ err }, "restricción de la base de datos");
      return reply.status(409).send({ error: "constraint", message: "La base de datos rechazó el dato porque incumple una regla (por ejemplo, falta la fuente)." });
    }
    req.log.error({ err }, "error no controlado");
    return reply.status(500).send({ error: "internal", message: "Ocurrió un error interno. Intenta de nuevo." });
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: "not_found", message: "Ruta no encontrada." }));

  await registerCore(app, ctx);
  await registerDecision(app, ctx);
  await registerFiles(app, ctx);
  await registerTeam(app, ctx);
  return app;
}
