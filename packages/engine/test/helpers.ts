import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogExample, catalogModel, catalogParamsDef } from "@sgc/catalog";
import { Engine, ORD, exportRows, EXPORT_KINDS, nuevosPendientes, parseISO, isoD, type EngineInput } from "../src";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIX = path.join(here, "fixtures");

export function loadFixture(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIX, name + ".json"), "utf8"));
}

export function inputFromFixture(fx: any): EngineInput {
  const i = fx.input;
  return {
    model: catalogModel,
    pdef: catalogParamsDef,
    example: catalogExample,
    params: i.params,
    measurements: i.measurements,
    evidence: i.evidence,
    scopes: i.scopes,
    schoolsWithFiles: i.schoolsWithFiles,
    autoeval: i.autoeval,
    fileNames: i.fileNames,
    options: { ejemplo: i.ejemplo, corteOverride: i.corteOverride ? parseISO(i.corteOverride) : null, today: new Date(2026, 9, 27) },
  };
}

const rt = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** Mismo resumen que genera tools/oracle/dump.mjs sobre el tablero original. */
export function collect(E: Engine) {
  const states: any = {};
  ORD.forEach((esc) => {
    states[esc] = {};
    E.CARGABLES.forEach((c) => {
      const st = E.status(esc, c.id);
      const L = st.last;
      states[esc][c.id] = {
        state: st.state, freq: st.freq, expLabel: st.expLabel, vencido: st.vencido, desde: st.desde, desdePeriodo: st.desdePeriodo || null,
        overdueSince: st.overdueSince, tendencia: st.tendencia, inScope: E.inScope(esc, c.id), responsable: E.responsableOf(esc, c.id), nser: st.sr.ev.length,
        last: L && { valor: L.valor, meta: L.meta, ref: L.ref, esperado: L.esperado, cumpl: L.cumpl, state: L.state, espTxt: L.espTxt, espFuente: L.espFuente, fuenteMeta: L.fuenteMeta, bands: L.bands, bandsSrc: L.bandsSrc, periodo: L.pinfo.p, regla: L.regla, cumple: L.cumple, prorrata: L.prorrata },
      };
    });
  });
  const procs: any = {};
  ORD.forEach((esc) => {
    procs[esc] = {};
    E.M.procesos102.forEach((p) => { const ps = E.processState(esc, p.id); procs[esc][p.id] = { code: ps.code, counts: ps.counts, n: ps.items.length }; });
  });
  const alerts = E.ALERTS.map((a) => ({ uid: a.uid, regla: a.regla, reglaNombre: a.reglaNombre, severidad: a.severidad, escuela: a.escuela, objeto: a.objeto, objetoId: a.objetoId, objetoNombre: a.objetoNombre, desde: a.desde, desdeTxt: a.desdeTxt, responsable: a.responsable, proceso: a.proceso || [], periodo: a.periodo, que: a.que, porque: a.porque, accion: a.accion, ejemplo: !!a.ejemplo }));
  const poi = E.poiAll();
  const poiOut: any = {};
  Object.keys(poi).forEach((y) => { poiOut[y] = { i3: poi[+y].i3, p6: poi[+y].p6, p7: poi[+y].p7, p8: poi[+y].p8, n: poi[+y].conProg.length }; });
  const cover: any = {};
  ORD.forEach((esc) => { cover[esc] = E.coverageStats(esc); });
  const exportsOut: any = {};
  EXPORT_KINDS.forEach((k) => { exportsOut[k] = exportRows(E, k); });
  const evf: any = {};
  ["ENF", "OBS", "TM"].forEach((esc) => { evf[esc] = {}; E.M.estandares.forEach((e) => { const r = E.evFaltantes(esc, e.id); evf[esc][e.id] = { n: r.falt.length, falt: r.falt, ejemplo: r.ejemplo }; }); });
  return rt({ states, procs, alerts, poi: poiOut, cover, vis: E.DB.vis.length, rejected: E.DB.rejected.length, exports: exportsOut, evf, corte: isoD(E.corteDate()), pendientes: nuevosPendientes(E) });
}
