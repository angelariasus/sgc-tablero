import { connectPglite, connectPostgres, profiles, type DbHandle } from "@sgc/db";
import { sql } from "drizzle-orm";
import { devAdmin, devVerifier, supabaseAdmin, supabaseVerifier, type AuthAdmin, type TokenVerifier } from "./auth";
import type { Env } from "./env";
import { localStore, supabaseStore, type FileStore } from "./storage";
import { seedAll } from "./seed";
import type { AppDeps } from "./app";

export interface Assembled { deps: AppDeps; handle: DbHandle; log: string[] }

/** Conecta la base, aplica las migraciones y los datos iniciales, y arma las dependencias de la API. */
export async function assemble(env: Env): Promise<Assembled> {
  const log: string[] = [];
  const handle = env.DATABASE_URL ? await connectPostgres(env.DATABASE_URL, { max: env.DB_POOL_MAX }) : await connectPglite(env.PGLITE_DIR);
  if (handle.kind === "pglite") log.push(`Base local PostgreSQL embebida (PGlite) en «${env.PGLITE_DIR}». Para Supabase, define DATABASE_URL.`);
  await handle.migrate();
  const seed = await seedAll(handle.db);
  if (!seed.yaEstaba) log.push("Datos iniciales cargados (catálogo, parámetros y autoevaluación de fábrica).");

  const supa = !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  let store: FileStore;
  if (supa) {
    const s = supabaseStore(env);
    await s.ensureBucket();
    store = s;
  } else {
    store = localStore(env.LOCAL_STORAGE_DIR);
    log.push(`Archivos guardados en la carpeta local «${env.LOCAL_STORAGE_DIR}» (sin Supabase Storage).`);
  }

  let verifier: TokenVerifier;
  let devSigner: AppDeps["devSigner"];
  let admin: AuthAdmin = supa ? supabaseAdmin(env) : devAdmin();
  if (env.DEV_AUTH) {
    const dv = devVerifier(env.DEV_JWT_SECRET);
    verifier = dv;
    devSigner = dv.sign;
    log.push("DEV_AUTH activo: inicio de sesión local sin Supabase (solo desarrollo).");
    if (!supa) admin = devAdmin();
    // en local no hay Supabase que cree la primera cuenta: se crea aquí
    const boot = env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
    const [{ n }] = await handle.db.select({ n: sql<number>`count(*)::int` }).from(profiles);
    if (boot && Number(n) === 0) {
      await handle.db.insert(profiles).values({ id: crypto.randomUUID(), email: boot, nombre: boot.split("@")[0], rol: "admin" });
      log.push(`Cuenta administradora local creada: ${boot}`);
    }
  } else verifier = supabaseVerifier(env);

  return { deps: { env, db: handle.db, store, verifier, admin, devSigner }, handle, log };
}
