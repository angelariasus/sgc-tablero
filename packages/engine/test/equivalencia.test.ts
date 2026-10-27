import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { Engine, defaultParams } from "../src";
import { catalogModel, catalogParamsDef } from "@sgc/catalog";
import { FIX, collect, inputFromFixture, loadFixture } from "./helpers";

const names = fs.readdirSync(FIX).filter((f) => f.endsWith(".json") && !f.startsWith("dec-")).map((f) => f.replace(/\.json$/, ""));

describe("equivalencia con el tablero original v0.9", () => {
  it("hay escenarios de referencia", () => expect(names.length).toBeGreaterThanOrEqual(6));

  it("los parámetros por defecto coinciden con los del original", () => {
    const fx = loadFixture("base-real");
    expect(JSON.parse(JSON.stringify(defaultParams(catalogModel, catalogParamsDef)))).toEqual(fx.input.params);
  });

  for (const name of names) {
    describe(name, () => {
      const fx = loadFixture(name);
      const E = new Engine(inputFromFixture(fx));
      const got = collect(E);
      const exp = fx.expected;
      it("fecha de corte y conteos de la base", () => {
        expect(got.corte).toBe(exp.corte);
        expect(got.vis).toBe(exp.vis);
        expect(got.rejected).toBe(exp.rejected);
      });
      it("estado de cada indicador por escuela", () => {
        for (const esc of Object.keys(exp.states)) {
          for (const id of Object.keys(exp.states[esc])) {
            expect({ esc, id, ...got.states[esc][id] }).toEqual({ esc, id, ...exp.states[esc][id] });
          }
        }
      });
      it("estado de cada proceso 10.2", () => expect(got.procs).toEqual(exp.procs));
      it("alertas (R01 a R14)", () => {
        expect(got.alerts.length).toBe(exp.alerts.length);
        expect(got.alerts).toEqual(exp.alerts);
      });
      it("POI, cobertura y evidencias faltantes", () => {
        expect(got.poi).toEqual(exp.poi);
        expect(got.cover).toEqual(exp.cover);
        expect(got.evf).toEqual(exp.evf);
      });
      for (const k of Object.keys(exp.exports)) {
        it(`exportación ${k}`, () => expect(got.exports[k]).toEqual(exp.exports[k]));
      }
      it("pendientes", () => expect(got.pendientes).toEqual(exp.pendientes));
    });
  }
});

import { nuevosPendientes, nuevosPendientesApp, DECISIONES, DECISIONES_APP } from "../src";
describe("pendientes de la aplicación web", () => {
  it("solo cambian los pendientes que hablaban del archivo HTML", () => {
    const fx = loadFixture("ejemplo");
    const E = new Engine(inputFromFixture(fx));
    const a = nuevosPendientes(E), b = nuevosPendientesApp(E);
    expect(b.length).toBe(a.length);
    const cambiados = a.map((x, i) => (JSON.stringify(x) !== JSON.stringify(b[i]) ? x.ambito : null)).filter(Boolean);
    expect(cambiados.sort()).toEqual(["Herramienta", "Seguridad"]);
    expect(DECISIONES_APP.length).toBe(DECISIONES.length);
    expect(DECISIONES_APP.filter((d, i) => d !== DECISIONES[i]).length).toBe(1);
  });
});
