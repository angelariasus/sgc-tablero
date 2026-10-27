import { createHash } from "node:crypto";
import { catalogDocs, type Db } from "@sgc/db";
import { catalogExample, catalogModel, catalogParamsDef } from "@sgc/catalog";
import type { ExampleData, Model, ParamsDef } from "@sgc/engine";

export interface Catalog {
  model: Model;
  example: ExampleData;
  pdef: ParamsDef;
  etag: string;
  /** JSON ya serializado para responder sin volver a armarlo */
  json: string;
}

const EXAMPLE_KEY = "__example";
const PDEF_KEY = "__params_def";

/** Carga el catálogo del modelo en la base si todavía no está (una fila por colección). */
export async function seedCatalog(db: Db): Promise<boolean> {
  const existing = await db.select({ key: catalogDocs.key }).from(catalogDocs).limit(1);
  if (existing.length) return false;
  const rows = [
    ...Object.entries(catalogModel as Record<string, unknown>).map(([key, data]) => ({ key, data: data as any })),
    { key: EXAMPLE_KEY, data: catalogExample as any },
    { key: PDEF_KEY, data: catalogParamsDef as any },
  ];
  await db.insert(catalogDocs).values(rows);
  return true;
}

export async function loadCatalog(db: Db): Promise<Catalog> {
  const rows = await db.select().from(catalogDocs);
  if (!rows.length) throw new Error("El catálogo no está cargado en la base de datos. Ejecuta «pnpm seed».");
  const model: Record<string, unknown> = {};
  let example: unknown = null;
  let pdef: unknown = null;
  for (const r of rows) {
    if (r.key === EXAMPLE_KEY) example = r.data;
    else if (r.key === PDEF_KEY) pdef = r.data;
    else model[r.key] = r.data;
  }
  if (!example || !pdef) throw new Error("El catálogo está incompleto (faltan los datos de ejemplo o la definición de parámetros).");
  const json = JSON.stringify({ model, example, pdef });
  const etag = '"' + createHash("sha1").update(json).digest("hex").slice(0, 20) + '"';
  return { model: model as unknown as Model, example: example as ExampleData, pdef: pdef as ParamsDef, etag, json };
}
