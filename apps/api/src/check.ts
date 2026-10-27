/**
 * Verifica la configuración de Supabase sin arrancar la API: conexión a la base, claves, inicio de sesión y Storage.
 * Uso: pnpm --filter @sgc/api check   (lee apps/api/.env.local)
 */
import { connectPostgres } from "@sgc/db";
import { sql } from "drizzle-orm";
import { loadEnv } from "./env";
import { serviceHeaders } from "./supabaseKey";

const ok = (m: string) => console.log("  ✔ " + m);
const bad = (m: string) => { console.log("  ✘ " + m); process.exitCode = 1; };

const env = loadEnv({ ...process.env, DEV_AUTH: "false" });
const base = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
console.log("\n1. Variables");
for (const k of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BOOTSTRAP_ADMIN_EMAIL"] as const) (env[k] ? ok : bad)(`${k} ${env[k] ? "definida" : "FALTA"}`);
if (env.DEV_AUTH) bad("DEV_AUTH está activo: no debe estarlo con Supabase");

console.log("\n2. Base de datos (PostgreSQL de Supabase)");
if (env.DATABASE_URL) {
  try {
    const h = await connectPostgres(env.DATABASE_URL, { max: 1 });
    const r: any = await h.db.execute(sql`select current_database() as db, version() as v`);
    const row = (r.rows ?? r)[0];
    ok(`Conectado a «${row.db}» (${String(row.v).split(",")[0]})`);
    await h.close();
  } catch (e: any) {
    bad("No se pudo conectar: " + (e.cause?.message ?? e.message) + " · Revisa la contraseña y que sea la cadena «Session pooler».");
  }
}

console.log("\n3. Supabase Auth");
if (base) {
  try {
    const r = await fetch(`${base}/auth/v1/.well-known/jwks.json`);
    const j: any = r.ok ? await r.json() : null;
    if (j?.keys?.length) ok(`Claves de firma asimétricas disponibles (${j.keys.length}): no necesitas SUPABASE_JWT_SECRET`);
    else if (env.SUPABASE_JWT_SECRET) ok("Sin claves asimétricas: se usará SUPABASE_JWT_SECRET (HS256)");
    else bad("El proyecto no publica claves asimétricas y falta SUPABASE_JWT_SECRET");
  } catch (e: any) { bad("No se pudo leer JWKS: " + e.message); }
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    const h = serviceHeaders(env.SUPABASE_SERVICE_ROLE_KEY);
    const u = await fetch(`${base}/auth/v1/admin/users?per_page=50`, { headers: h });
    if (u.ok) {
      const j: any = await u.json();
      const emails: string[] = (j.users ?? []).map((x: any) => String(x.email).toLowerCase());
      ok(`Clave service_role válida; hay ${emails.length} usuario(s)`);
      const boot = env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
      if (boot) (emails.includes(boot) ? ok : bad)(`La cuenta administradora ${boot} ${emails.includes(boot) ? "existe en Supabase" : "NO existe: créala en Authentication → Users"}`);
    } else bad(`La clave service_role fue rechazada (${u.status}). Revisa que sea la clave secreta (sb_secret_…) y no la publishable.`);
    const s = await fetch(`${base}/storage/v1/bucket`, { headers: h });
    s.ok ? ok("Storage accesible (el bucket se crea solo al arrancar la API)") : bad(`Storage respondió ${s.status}`);
  }
}
console.log(process.exitCode ? "\nHay problemas por corregir arriba.\n" : "\nTodo en orden. Siguiente paso: arrancar la API.\n");
