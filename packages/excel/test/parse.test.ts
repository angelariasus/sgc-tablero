import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { catalogModel, catalogParamsDef } from "@sgc/catalog";
import { defaultParams } from "@sgc/engine";
import { applyParamsFrom, parseAny, parseConsolidado, parseWorkbookFile } from "../src";

const here = path.dirname(fileURLToPath(import.meta.url));
const filesDir = path.resolve(here, "../../catalog/files");
const fixDir = path.resolve(here, "../../engine/test/fixtures");
const read = (n: string) => new Uint8Array(fs.readFileSync(path.join(filesDir, n)));
const fix = (n: string) => JSON.parse(fs.readFileSync(path.join(fixDir, n + ".json"), "utf8"));
const rt = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const EX = ["SGC_EJEMPLO_carga_ENF.xlsx", "SGC_EJEMPLO_carga_OBS.xlsx", "SGC_EJEMPLO_carga_TM.xlsx"];
const M = catalogModel;

const parsed = EX.map((n) => {
  const r = parseAny(read(n), n, M, new Date("2026-10-27T12:00:00Z"));
  if (r.tipo !== "plantilla") throw new Error("se esperaba una plantilla");
  return r.file;
});

describe("lectura de Excel equivalente al tablero original", () => {
  const fx = fix("archivos-ejemplo");
  it("las mediciones de los tres archivos coinciden fila por fila", () => {
    expect(rt(parsed.flatMap((f) => f.rows))).toEqual(fx.input.measurements);
  });
  it("las evidencias coinciden", () => {
    expect(rt(parsed.flatMap((f) => f.evid))).toEqual(fx.input.evidence);
  });
  it("alcance y responsables locales por escuela coinciden", () => {
    const scopes: any = {};
    parsed.forEach((f) => {
      if (!f.escuela) return;
      const s = (scopes[f.escuela] = scopes[f.escuela] || { alcance: {}, respLocal: {} });
      if (f.alcance) Object.keys(f.alcance).forEach((k) => { if (f.alcance![k]) s.alcance[k] = f.alcance![k]; });
      if (f.respLocal) Object.keys(f.respLocal).forEach((k) => { if (f.respLocal![k]) s.respLocal[k] = f.respLocal![k]; });
    });
    expect(rt(scopes)).toEqual(fx.input.scopes);
  });
  it("los parámetros que traen los archivos se aplican igual que en el original", () => {
    const base = defaultParams(M, catalogParamsDef);
    const r = applyParamsFrom(base, parsed);
    expect(rt(r.params)).toEqual(fx.input.params);
  });
  it("sin archivos más nuevos se conservan los parámetros activos", () => {
    const base = defaultParams(M, catalogParamsDef);
    const r = applyParamsFrom(base, []);
    expect(r.changed).toBe(false);
    expect(r.params).toBe(base);
  });
  it("la autoevaluación de las hojas Criterios y Valores_informe coincide", () => {
    const got: any = {};
    const fab = parseConsolidado(XLSX.read(read("SGC_Consolidado_autoevaluacion_EPTM.xlsx"), { type: "array" }), "Consolidado_Autoevaluacion_EPTM.xlsx", M);
    fab.fabrica = true;
    got[fab.escuela] = fab;
    parsed.forEach((f) => { if (f.autoeval && !f.errors.length) got[f.autoeval.escuela] = f.autoeval; });
    const norm = (o: any) => { const c = rt(o); Object.values<any>(c).forEach((a) => { a.cargadoEn = ""; }); return c; };
    expect(norm(got)).toEqual(norm(fx.input.autoeval));
  });
});

describe("Consolidado de autoevaluación", () => {
  it("lee criterios, matrices e indicadores igual que el original (el título EPTM manda sobre el nombre del archivo)", () => {
    const fx = fix("consolidado");
    const wb = XLSX.read(read("SGC_Consolidado_autoevaluacion_EPTM.xlsx"), { type: "array" });
    const ae = parseConsolidado(wb, "Consolidado Obstetricia.xlsx", M);
    expect(ae.errors).toEqual([]);
    expect(ae.escuela).toBe("TM");
    const exp = fx.input.autoeval.TM;
    expect(exp.fabrica).toBeUndefined();
    expect(rt({ ...ae, cargadoEn: "" })).toEqual({ ...exp, cargadoEn: "" });
  });
  it("avisa si no reconoce la escuela", () => {
    const wb = XLSX.read(read("SGC_Consolidado_autoevaluacion_EPTM.xlsx"), { type: "array" });
    const ae = parseConsolidado(wb, "archivo.xlsx", M);
    expect(ae.escuela).toBe("TM"); // el título del libro dice EPTM
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([["Otro"], ["título"]]), "Consolidado");
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([["x"]]), "Matrices");
    const ae2 = parseConsolidado(wb2, "otro.xlsx", M);
    expect(ae2.errors.join(" ")).toMatch(/No reconozco la escuela/);
  });
});

describe("archivos inválidos", () => {
  it("un libro cualquiera no se acepta como plantilla de carga", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a", "b"]]), "Hoja1");
    const f = parseWorkbookFile(wb, "x.xlsx", M);
    expect(f.errors.join(" ")).toMatch(/Falta la hoja Portada/);
    expect(f.rows).toEqual([]);
  });
  it("la plantilla en blanco se lee sin errores y sin mediciones", () => {
    const r = parseAny(read("SGC_Plantilla_de_carga_por_escuela_v0.6.xlsx"), "plantilla.xlsx", M);
    expect(r.tipo).toBe("plantilla");
    if (r.tipo === "plantilla") expect(r.file.rows.length).toBe(0);
  });
});
