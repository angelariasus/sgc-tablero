import fs from "node:fs/promises";
import path from "node:path";
import type { Env } from "./env";
import { serviceHeaders } from "./supabaseKey";

export interface FileStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

export function memoryStore(): FileStore & { keys(): string[] } {
  const m = new Map<string, Buffer>();
  return {
    async put(k, b) { m.set(k, b); },
    async get(k) { return m.get(k) ?? null; },
    keys: () => Array.from(m.keys()),
  };
}

export function localStore(dir: string): FileStore {
  const root = path.resolve(dir);
  const abs = (k: string) => {
    const p = path.resolve(root, k);
    if (!p.startsWith(root + path.sep)) throw new Error("Ruta de archivo no válida");
    return p;
  };
  return {
    async put(k, b) { const p = abs(k); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, b); },
    async get(k) { try { return await fs.readFile(abs(k)); } catch (e: any) { if (e.code === "ENOENT") return null; throw e; } },
  };
}

/** Supabase Storage (bucket privado) con la clave de servicio. */
export function supabaseStore(env: Pick<Env, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "SUPABASE_STORAGE_BUCKET">): FileStore & { ensureBucket(): Promise<void> } {
  const base = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const headers = serviceHeaders(key);
  const enc = (k: string) => k.split("/").map(encodeURIComponent).join("/");
  return {
    async ensureBucket() {
      const r = await fetch(`${base}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers });
      if (r.ok) return;
      const c = await fetch(`${base}/storage/v1/bucket`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: false }) });
      if (!c.ok && c.status !== 409) throw new Error(`No se pudo crear el bucket «${bucket}» (${c.status}): ${await c.text()}`);
    },
    async put(k, body, contentType) {
      const r = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${enc(k)}`, { method: "POST", headers: { ...headers, "Content-Type": contentType, "x-upsert": "true" }, body: new Uint8Array(body) });
      if (!r.ok) throw new Error(`No se pudo guardar el archivo en Storage (${r.status}): ${await r.text()}`);
    },
    async get(k) {
      const r = await fetch(`${base}/storage/v1/object/${encodeURIComponent(bucket)}/${enc(k)}`, { headers });
      if (r.status === 404 || r.status === 400) return null;
      if (!r.ok) throw new Error(`No se pudo leer el archivo de Storage (${r.status})`);
      return Buffer.from(await r.arrayBuffer());
    },
  };
}
