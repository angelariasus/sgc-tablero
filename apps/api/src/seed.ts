import fs from "node:fs";
import path from "node:path";
import { autoevaluations, parameterSets, settings, type Db } from "@sgc/db";
import { catalogModel, catalogParamsDef } from "@sgc/catalog";
import { defaultParams } from "@sgc/engine";
import { parseConsolidado, readWorkbook } from "@sgc/excel";
import { seedCatalog } from "./services/catalog";
import { templatesDir } from "./routes/core";

const SEED_KEY = "seed_version";
const SEED_VERSION = 1;

export interface SeedResult { catalogo: boolean; parametros: boolean; autoevaluacion: boolean; yaEstaba: boolean }

/**
 * Datos iniciales: catálogo del modelo, parámetros de fábrica y el Consolidado de autoevaluación de la EPTM que traía el tablero.
 * Es seguro ejecutarlo varias veces: lo que ya está no se vuelve a cargar.
 */
export async function seedAll(db: Db): Promise<SeedResult> {
  const catalogo = await seedCatalog(db);
  const [marker] = await db.select().from(settings).limit(1000).then((r) => r.filter((s) => s.key === SEED_KEY));
  if (marker) return { catalogo, parametros: false, autoevaluacion: false, yaEstaba: true };

  const p = defaultParams(catalogModel, catalogParamsDef);
  await db.insert(parameterSets).values({ version: 1, fecha: p.fecha, origen: p.origen, gen: p.gen, reglas: p.reglas, metas: p.metas, nota: "Valores de fábrica del tablero v0.9" }).onConflictDoNothing();

  let autoevaluacion = false;
  const file = path.join(templatesDir(), "SGC_Consolidado_autoevaluacion_EPTM.xlsx");
  if (fs.existsSync(file)) {
    const wb = readWorkbook(new Uint8Array(fs.readFileSync(file)));
    const ae = parseConsolidado(wb, "Consolidado_Autoevaluacion_EPTM.xlsx", catalogModel);
    if (!ae.errors.length && ae.escuela) {
      ae.fabrica = true;
      ae.cargadoEn = "2026-10-20 (adjunto de Robert)";
      await db.insert(autoevaluations).values({ escuela: ae.escuela, data: ae as any, fabrica: true }).onConflictDoNothing();
      autoevaluacion = true;
    }
  }
  await db.insert(settings).values({ key: SEED_KEY, value: SEED_VERSION }).onConflictDoNothing();
  return { catalogo, parametros: true, autoevaluacion, yaEstaba: false };
}
