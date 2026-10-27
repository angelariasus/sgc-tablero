import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export * from "./schema";
export { schema };

/** Cualquier base compatible (postgres.js en producción, PGlite en pruebas y modo local). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const here = path.dirname(fileURLToPath(import.meta.url));
/** Carpeta de migraciones: MIGRATIONS_DIR, la copia junto al ejecutable (despliegue) o la del paquete (desarrollo). */
export const migrationsFolder =
  [process.env.MIGRATIONS_DIR, path.resolve(here, "migrations"), path.resolve(here, "../migrations")].filter((c): c is string => !!c).find((c) => fs.existsSync(c)) ??
  path.resolve(here, "../migrations");

export interface DbHandle {
  db: Db;
  kind: "postgres" | "pglite";
  migrate(): Promise<void>;
  close(): Promise<void>;
}

/** Conexión a PostgreSQL (Supabase). Usa el pooler de Supabase: `prepare: false` es necesario con el pooler en modo transacción. */
export async function connectPostgres(url: string, opts: { max?: number } = {}): Promise<DbHandle> {
  const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
    import("postgres"),
    import("drizzle-orm/postgres-js"),
    import("drizzle-orm/postgres-js/migrator"),
  ]);
  const client = postgres(url, { max: opts.max ?? 10, prepare: false, idle_timeout: 20, connect_timeout: 15, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return {
    db: db as unknown as Db,
    kind: "postgres",
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => client.end({ timeout: 5 }),
  };
}

/** Base PostgreSQL embebida (PGlite): pruebas y modo local sin Supabase. `dataDir` vacío = en memoria. */
export async function connectPglite(dataDir?: string): Promise<DbHandle> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const client = new PGlite(dataDir || undefined);
  const db = drizzle(client, { schema });
  return {
    db: db as unknown as Db,
    kind: "pglite",
    migrate: () => migrate(db, { migrationsFolder }),
    close: () => client.close(),
  };
}
