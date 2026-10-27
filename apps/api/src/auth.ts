import { SignJWT, createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Env } from "./env";
import { serviceHeaders } from "./supabaseKey";

export interface VerifiedToken { sub: string; email: string }
export interface TokenVerifier { verify(token: string): Promise<VerifiedToken> }

export class AuthError extends Error {
  constructor(message: string, readonly status = 401, readonly code = "unauthorized") { super(message); }
}

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Verifica sesiones de Supabase Auth: claves asimétricas (JWKS) o secreto heredado HS256. */
export function supabaseVerifier(env: Pick<Env, "SUPABASE_URL" | "SUPABASE_JWT_SECRET">): TokenVerifier {
  const base = env.SUPABASE_URL ? env.SUPABASE_URL.replace(/\/$/, "") : "";
  const jwks: JWTVerifyGetKey | null = base ? createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`), { cooldownDuration: 30_000 }) : null;
  const secret = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : null;
  return {
    async verify(token) {
      try {
        const { alg } = decodeProtectedHeader(token);
        const opts = { audience: "authenticated", ...(base ? { issuer: `${base}/auth/v1` } : {}) };
        let payload;
        if (alg === "HS256") {
          if (!secret) throw new AuthError("Sesión HS256 sin secreto configurado");
          payload = (await jwtVerify(token, secret, { ...opts, algorithms: ["HS256"] })).payload;
        } else {
          if (!jwks) throw new AuthError("Sin JWKS configurado");
          payload = (await jwtVerify(token, jwks, opts)).payload;
        }
        const sub = String(payload.sub ?? "");
        if (!uuidRe.test(sub)) throw new AuthError("Sesión sin identificador válido");
        return { sub, email: String(payload.email ?? "").toLowerCase() };
      } catch (e) {
        if (e instanceof AuthError) throw e;
        throw new AuthError("Sesión inválida o vencida");
      }
    },
  };
}

const DEV_ISSUER = "sgc-dev";
/** Solo desarrollo: tokens firmados con un secreto local. */
export function devVerifier(secret: string): TokenVerifier & { sign(sub: string, email: string): Promise<string> } {
  const key = new TextEncoder().encode(secret);
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { issuer: DEV_ISSUER, audience: "authenticated", algorithms: ["HS256"] });
        return { sub: String(payload.sub), email: String(payload.email ?? "").toLowerCase() };
      } catch {
        throw new AuthError("Sesión inválida o vencida");
      }
    },
    sign(sub, email) {
      return new SignJWT({ email }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuer(DEV_ISSUER).setAudience("authenticated").setIssuedAt().setExpirationTime("12h").sign(key);
    },
  };
}

/** Administración de cuentas (Supabase Auth Admin API). Se reemplaza por una versión falsa en las pruebas. */
export interface AuthAdmin {
  createUser(input: { email: string; password: string; nombre: string }): Promise<{ id: string }>;
  setPassword(id: string, password: string): Promise<void>;
  setBanned(id: string, banned: boolean): Promise<void>;
}

export function supabaseAdmin(env: Pick<Env, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">): AuthAdmin {
  const base = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}/auth/v1/admin${path}`, { method, headers: { ...serviceHeaders(key), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const txt = await res.text();
    const json = txt ? JSON.parse(txt) : {};
    if (!res.ok) throw new AuthError(json.msg || json.message || json.error_description || `Supabase respondió ${res.status}`, res.status === 422 ? 422 : 502, "supabase_error");
    return json;
  };
  return {
    async createUser({ email, password, nombre }) {
      const u = await call("POST", "/users", { email, password, email_confirm: true, user_metadata: { nombre } });
      return { id: u.id };
    },
    async setPassword(id, password) { await call("PUT", `/users/${id}`, { password }); },
    async setBanned(id, banned) { await call("PUT", `/users/${id}`, { ban_duration: banned ? "876000h" : "none" }); },
  };
}

/** Versión local: no hay Supabase, solo se genera un identificador. */
export function devAdmin(): AuthAdmin {
  return {
    async createUser() { return { id: crypto.randomUUID() }; },
    async setPassword() {},
    async setBanned() {},
  };
}
