import { z } from "zod";

const bool = z.preprocess((v) => (typeof v === "string" ? ["1", "true", "yes", "si", "sí"].includes(v.toLowerCase()) : v), z.boolean());

const Schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.string().default("info"),

  /** Cadena de conexión de Supabase (pooler). Sin ella, el modo local usa una base PostgreSQL embebida (PGlite). */
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().default(".pglite"),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),

  /** Orígenes permitidos (el dominio de Vercel), separados por coma. */
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  SUPABASE_URL: z.string().url().optional(),
  /** Solo para proyectos con la clave JWT heredada (HS256). Con claves asimétricas no hace falta. */
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("sgc-archivos"),

  /** Correo de la primera cuenta administradora: se vuelve admin al iniciar sesión por primera vez. */
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),

  /** Solo desarrollo: entrar sin Supabase con una cuenta ya creada. Nunca en producción. */
  DEV_AUTH: bool.default(false),
  DEV_JWT_SECRET: z.string().min(16).default("desarrollo-local-no-usar-en-produccion"),

  LOCAL_STORAGE_DIR: z.string().default(".storage"),
  /** Permite guardar filas con origen EJEMPLO (solo para probar localmente). */
  ALLOW_EXAMPLE_UPLOADS: bool.default(false),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(15),
});

export type Env = z.infer<typeof Schema> & { corsOrigins: string[]; isProd: boolean };

export function loadEnv(src: Record<string, string | undefined> = process.env): Env {
  const e = Schema.parse(src);
  const problems: string[] = [];
  if (e.NODE_ENV === "production") {
    if (!e.DATABASE_URL) problems.push("DATABASE_URL es obligatoria en producción (cadena del pooler de Supabase).");
    if (!e.SUPABASE_URL) problems.push("SUPABASE_URL es obligatoria en producción.");
    if (!e.SUPABASE_SERVICE_ROLE_KEY) problems.push("SUPABASE_SERVICE_ROLE_KEY es obligatoria en producción (crear cuentas y guardar archivos).");
    if (e.DEV_AUTH) problems.push("DEV_AUTH no puede estar activo en producción.");
    if (e.ALLOW_EXAMPLE_UPLOADS) problems.push("ALLOW_EXAMPLE_UPLOADS no puede estar activo en producción.");
    if (e.CORS_ORIGINS.includes("*")) problems.push("CORS_ORIGINS no puede ser «*» en producción.");
  }
  if (!e.DEV_AUTH && !e.SUPABASE_URL && !e.SUPABASE_JWT_SECRET) problems.push("Configura SUPABASE_URL (o DEV_AUTH=true en desarrollo) para poder verificar sesiones.");
  if (problems.length) throw new Error("Configuración inválida:\n- " + problems.join("\n- "));
  return { ...e, corsOrigins: e.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean), isProd: e.NODE_ENV === "production" };
}
