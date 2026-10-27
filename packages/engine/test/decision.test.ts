import { describe, expect, it } from "vitest";
import { DEC_ESC, DecisionBoard, Engine, DC, type DcCode } from "../src";
import { inputFromFixture, loadFixture } from "./helpers";

const rt = <T>(x: T): T => JSON.parse(JSON.stringify(x));

function board(name: string) {
  const fx = loadFixture(name);
  const E = new Engine(inputFromFixture(fx));
  const B = new DecisionBoard(E, fx.input.decision, { soloVal: !!fx.input.soloVal });
  return { fx, E, B };
}

const stripItem = (it: any) => ({
  id: it.id, tipo: it.tipo, esc: it.esc, area: it.area, cod: it.cod, nombre: it.nombre, c: it.c, motivo: it.motivo, valorTxt: it.valorTxt, refTxt: it.refTxt, fuente: it.fuente,
  corte: it.corte, accion: it.accion, resp: it.resp, brecha: it.brecha, measured: it.measured, kind: it.kind, mini: it.mini || null, nprob: it.nprob ?? null, estandares: it.estandares, procesos: it.procesos, porArea: it.porArea,
  comps: it.comps || null, rec: it.rec ? { ficha: it.rec.ficha, dueno: it.rec.dueno || "", vestado: it.rec.vestado } : null,
  ev: it.ev ? {
    c: it.ev.c, vacio: !!it.ev.vacio, defPend: !!it.ev.defPend, prov: it.ev.prov || null, stale: !!it.ev.stale, expected: it.ev.expected || null, corto: it.ev.corto, mini: it.ev.mini || null,
    last: it.ev.last ? { val: it.ev.last.val, per: it.ev.last.per, vestado: it.ev.last.vestado, vpor: it.ev.last.vpor, vnota: it.ev.last.vnota, origen: it.ev.last.origen, autor: it.ev.last.autor } : null,
    prevPer: it.ev.prev ? it.ev.prev.per : null,
  } : null,
  npts: it.pts ? it.pts.length : null,
});

for (const name of ["dec-base", "dec-archivos", "dec-ediciones", "dec-solo-val"]) {
  describe(`Decisión: ${name}`, () => {
    const { fx, B } = board(name);
    const exp = fx.expected;
    it("cada indicador y proceso tiene el mismo semáforo y la misma explicación", () => {
      const got = rt(B.items.map(stripItem));
      expect(got.length).toBe(exp.items.length);
      got.forEach((g: any, i: number) => expect(g).toEqual(exp.items[i]));
    });
    it("conteos y ranking por escuela", () => {
      DEC_ESC.forEach((e) => {
        expect(DecisionBoard.counts(B.items.filter((i) => i.esc === e))).toEqual(exp.counts[e]);
        expect(DecisionBoard.ranking(B.items.filter((i) => i.esc === e)).map((i: any) => i.id)).toEqual(exp.ranking[e]);
      });
    });
    it("valores vigentes y su estado de validación", () => {
      const got = rt(B.model.pts.map((p) => ({ key: p.key, esc: p.esc, area: p.area, ind: p.ind, per: p.per, val: p.val, origen: p.origen, vestado: p.vestado, vpor: p.vpor, ts: p.ts })));
      expect(got).toEqual(exp.pts);
    });
    it("filas de exportación", () => {
      expect(rt(B.rowsAlertas(B.items))).toEqual(exp.rows.alertas);
      expect(rt(B.rowsValores())).toEqual(exp.rows.valores);
      expect(rt(B.rowsProcesos(B.items))).toEqual(exp.rows.procesos);
      expect(rt(B.rowsBitacora())).toEqual(exp.rows.bitacora);
    });
  });
}

describe("Decisión: reglas propias", () => {
  it("los códigos de semáforo tienen rango de gravedad coherente", () => {
    const order: DcCode[] = ["verde", "gris", "amarillo", "rojo"];
    order.reduce((prev, c) => { expect(DC[c].rank).toBeGreaterThanOrEqual(prev); return DC[c].rank; }, -1);
  });
});
