import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import type { FastifyInstance } from "fastify";
import { connectPglite, profiles, type DbHandle, type Rol } from "@sgc/db";
import { AuthError, type AuthAdmin, type TokenVerifier } from "../src/auth";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { seedAll } from "../src/seed";
import { memoryStore } from "../src/storage";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FILES = path.resolve(here, "../../../packages/catalog/files");
export const FIX = path.resolve(here, "../../../packages/engine/test/fixtures");
export const readFile = (n: string) => fs.readFileSync(path.join(FILES, n));
export const fixture = (n: string) => JSON.parse(fs.readFileSync(path.join(FIX, n + ".json"), "utf8"));

/** Sesiones de prueba: el token es el id del usuario. */
export function fakeVerifier(): TokenVerifier & { register(id: string, email: string): void } {
  const m = new Map<string, string>();
  return {
    register: (id, email) => void m.set(id, email),
    async verify(token) {
      const email = m.get(token);
      if (email === undefined) throw new AuthError("Sesión inválida o vencida");
      return { sub: token, email };
    },
  };
}

export function fakeAdmin() {
  const created: { id: string; email: string; password: string }[] = [];
  const banned = new Set<string>();
  const passwords = new Map<string, string>();
  const admin: AuthAdmin = {
    async createUser({ email, password }) { const id = randomUUID(); created.push({ id, email, password }); verifier.register(id, email); return { id }; },
    async setPassword(id, pw) { passwords.set(id, pw); },
    async setBanned(id, b) { if (b) banned.add(id); else banned.delete(id); },
  };
  return { admin, created, banned, passwords };
}
const verifier = fakeVerifier();

export interface Harness {
  app: FastifyInstance;
  handle: DbHandle;
  store: ReturnType<typeof memoryStore>;
  verifier: typeof verifier;
  adm: ReturnType<typeof fakeAdmin>;
  /** crea una persona y devuelve su token */
  person(rol: Rol, opts?: { escuela?: string; email?: string; nombre?: string }): Promise<string>;
  req(token: string | null, method: string, url: string, body?: unknown): Promise<{ status: number; json: any; raw: Buffer; headers: Record<string, any> }>;
  upload(token: string | null, file: { name: string; data: Buffer }, confirm?: boolean): Promise<{ status: number; json: any }>;
  close(): Promise<void>;
}

export async function harness(extraEnv: Record<string, string> = {}): Promise<Harness> {
  const env = loadEnv({ NODE_ENV: "test", DEV_AUTH: "true", DEV_JWT_SECRET: "x".repeat(32), ...extraEnv });
  const handle = await connectPglite();
  await handle.migrate();
  await seedAll(handle.db);
  const store = memoryStore();
  const adm = fakeAdmin();
  const app = await buildApp({ env, db: handle.db, store, verifier, admin: adm.admin });
  await app.ready();
  let n = 0;
  const h: Harness = {
    app, handle, store, verifier, adm,
    async person(rol, opts = {}) {
      n++;
      const id = randomUUID();
      const email = opts.email ?? `persona${n}@unmsm.test`;
      await handle.db.insert(profiles).values({ id, email, nombre: opts.nombre ?? `Persona ${n} (${rol})`, rol, escuela: rol === "responsable" ? opts.escuela ?? "ENF" : null });
      verifier.register(id, email);
      return id;
    },
    async req(token, method, url, body) {
      const res = await app.inject({ method: method as any, url, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, payload: body !== undefined ? JSON.stringify(body) : undefined });
      let json: any = null;
      try { json = res.body ? JSON.parse(res.body) : null; } catch { /* binario */ }
      return { status: res.statusCode, json, raw: res.rawPayload, headers: res.headers };
    },
    async upload(token, file, confirm = false) {
      const boundary = "----sgc" + randomUUID();
      const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`);
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
      const res = await app.inject({ method: "POST", url: `/api/uploads${confirm ? "?confirm=1" : ""}`, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([head, file.data, tail]) });
      let json: any = null;
      try { json = JSON.parse(res.body); } catch { /* */ }
      return { status: res.statusCode, json };
    },
    async close() { await app.close(); await handle.close(); },
  };
  return h;
}

/** Convierte un archivo de EJEMPLO en uno «real»: cambia la columna origen. */
export function realize(data: Buffer, sheets: string[] = ["Carga_Indicadores"]): Buffer {
  const wb = XLSX.read(data, { type: "buffer" });
  for (const sheet of sheets) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    let col = -1, hdr = -1;
    for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 15) && col < 0; r++)
      for (let c = range.s.c; c <= range.e.c; c++) { const cell = ws[XLSX.utils.encode_cell({ r, c })]; if (cell && String(cell.v).trim() === "origen") { col = c; hdr = r; break; } }
    if (col < 0) continue;
    for (let r = hdr + 1; r <= range.e.r; r++) { const cell = ws[XLSX.utils.encode_cell({ r, c: col })]; if (cell && String(cell.v).trim() === "EJEMPLO") { cell.v = "Real"; cell.w = "Real"; cell.t = "s"; } }
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
