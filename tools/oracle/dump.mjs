// Genera los "fixtures" de equivalencia: ejecuta el tablero original v0.9 (jsdom) en varios escenarios
// y guarda el estado de entrada y los resultados. Las pruebas del motor nuevo comparan contra estos archivos.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadOriginal } from "./load.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../packages/engine/test/fixtures");
fs.mkdirSync(OUT, { recursive: true });

const COLLECT = `(() => {
  const states = {};
  ORD.forEach(esc => { states[esc] = {}; CARGABLES.forEach(c => {
    const st = status(esc, c.id); const L = st.last;
    states[esc][c.id] = { state: st.state, freq: st.freq, expLabel: st.expLabel, vencido: st.vencido, desde: st.desde, desdePeriodo: st.desdePeriodo || null,
      overdueSince: st.overdueSince, tendencia: st.tendencia, inScope: inScope(esc, c.id), responsable: responsableOf(esc, c.id), nser: st.sr.ev.length,
      last: L && { valor: L.valor, meta: L.meta, ref: L.ref, esperado: L.esperado, cumpl: L.cumpl, state: L.state, espTxt: L.espTxt, espFuente: L.espFuente,
        fuenteMeta: L.fuenteMeta, bands: L.bands, bandsSrc: L.bandsSrc, periodo: L.pinfo.p, regla: L.regla, cumple: L.cumple, prorrata: L.prorrata } };
  }); });
  const procs = {};
  ORD.forEach(esc => { procs[esc] = {}; M.procesos102.forEach(p => { const ps = processState(esc, p.id); procs[esc][p.id] = { code: ps.code, counts: ps.counts, n: ps.items.length }; }); });
  const alerts = ALERTS.map(a => ({ uid: a.uid, regla: a.regla, reglaNombre: a.reglaNombre, severidad: a.severidad, escuela: a.escuela, objeto: a.objeto, objetoId: a.objetoId,
    objetoNombre: a.objetoNombre, desde: a.desde, desdeTxt: a.desdeTxt, responsable: a.responsable, proceso: a.proceso || [], periodo: a.periodo, que: a.que, porque: a.porque, accion: a.accion, ejemplo: !!a.ejemplo }));
  const poi = poiAll(); const poiOut = {};
  Object.keys(poi).forEach(y => { poiOut[y] = { i3: poi[y].i3, p6: poi[y].p6, p7: poi[y].p7, p8: poi[y].p8, n: poi[y].conProg.length }; });
  const cover = {}; ORD.forEach(esc => { cover[esc] = coverageStats(esc); });
  const exportsOut = {};
  ['indicadores', 'alertas', 'trazabilidad', 'criterios', 'valores_informe'].forEach(k => { exportsOut[k] = exportRows(k); });
  const evf = {}; ['ENF', 'OBS', 'TM'].forEach(esc => { evf[esc] = {}; M.estandares.forEach(e => { const r = evFaltantes(esc, e.id); evf[esc][e.id] = { n: r.falt.length, falt: r.falt, ejemplo: r.ejemplo }; }); });
  return JSON.stringify({ states, procs, alerts, poi: poiOut, cover, vis: DB.vis.length, rejected: DB.rejected.length, exports: exportsOut, evf,
    corte: isoD(corteDate()), pendientes: nuevosPendientes() });
})()`;

const STRIP = ["pinfo", "valor", "id", "motivo", "reemplaza"];
const INPUT = `(() => {
  const rows = S.files.flatMap(f => f.rows).map(r => { const o = { ...r }; ${JSON.stringify(STRIP)}.forEach(k => delete o[k]); return o; });
  const scopes = {};
  S.files.forEach(f => {
    if (!f.escuela) return;
    const s = scopes[f.escuela] = scopes[f.escuela] || { alcance: {}, respLocal: {} };
    if (f.alcance) Object.keys(f.alcance).forEach(k => { if (f.alcance[k]) s.alcance[k] = f.alcance[k]; });
    if (f.respLocal) Object.keys(f.respLocal).forEach(k => { if (f.respLocal[k]) s.respLocal[k] = f.respLocal[k]; });
  });
  return JSON.stringify({ params: S.params, ejemplo: S.ejemplo, corteOverride: S.corteOverride ? isoD(S.corteOverride) : null, measurements: rows,
    evidence: S.files.flatMap(f => f.evid), scopes, schoolsWithFiles: Array.from(new Set(S.files.map(f => f.escuela).filter(Boolean))),
    autoeval: S.autoeval, fileNames: S.files.map(f => f.name) });
})()`;

const LOAD_FILES = (names) => `(async () => {
  const mk = (n) => ({ name: n, arrayBuffer: async () => { const bin = atob(FILES_B64[n]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; } });
  const msgs = await loadFiles(${JSON.stringify(names)}.map(mk));
  return JSON.stringify(msgs);
})()`;

async function scenario(name, setup) {
  const { window, errors } = loadOriginal();
  if (errors.length) console.warn(name, "errores de carga:", errors.slice(0, 2));
  const ev = (s) => window.eval(s);
  const info = (await setup(ev, window)) || {};
  const input = JSON.parse(ev(INPUT));
  const expected = JSON.parse(ev(COLLECT));
  fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify({ name, info, input, expected }));
  console.log(name.padEnd(18), "alertas", expected.alerts.length, "vis", expected.vis, "rej", expected.rejected, "corte", expected.corte);
}

const EX_FILES = ["SGC_EJEMPLO_carga_ENF.xlsx", "SGC_EJEMPLO_carga_OBS.xlsx", "SGC_EJEMPLO_carga_TM.xlsx"];
const setCorte = (iso) => `S.corteOverride = parseISO('${iso}'); recompute();`;
// las filas de los archivos de ejemplo se marcan como reales para probar el motor con datos de archivo
const realize = `S.files.forEach(f => { f.ejemplo = false; f.rows.forEach(r => { r.origen = 'Real'; }); }); S.ejemplo = false; recompute();`;

await scenario("base-real", async (ev) => { ev(setCorte("2026-10-22")); });
await scenario("ejemplo", async (ev) => { ev("S.ejemplo = true; recompute();"); });
await scenario("ejemplo-corte-2027", async (ev) => { ev("S.ejemplo = true;"); ev(setCorte("2027-03-15")); });
await scenario("archivos-reales", async (ev) => {
  const msgs = JSON.parse(await ev(LOAD_FILES(EX_FILES)));
  ev(realize); ev(setCorte("2026-10-22"));
  return { msgs };
});
await scenario("archivos-ejemplo", async (ev) => {
  const msgs = JSON.parse(await ev(LOAD_FILES(EX_FILES)));
  ev(setCorte("2026-10-22"));
  return { msgs };
});
await scenario("params-variantes", async (ev) => {
  ev("S.ejemplo = true;");
  ev(`Object.assign(S.params.gen, { dias_gracia: 10, sin_dato_en_agregado: 'Excluye', heredar_alias: 'No', poi_evaluar: 'Todos', evidencia_obligatoria: 'No', escuelas_en_implementacion: 'ENF,OBS,TM', n_periodos_tendencia: 1, banda_poi_verde: 90, banda_poi_rojo: 60 }); S.params.reglas.find(r => r.id === 'R07').activa = 'No'; recompute();`);
});
await scenario("consolidado", async (ev) => {
  // el consolidado de autoevaluación cargado para Obstetricia (nombre con "Obstetric")
  const msgs = JSON.parse(await ev(`(async () => { const bin = atob(FILES_B64['SGC_Consolidado_autoevaluacion_EPTM.xlsx']); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const m = await loadFiles([{ name: 'Consolidado Obstetricia.xlsx', arrayBuffer: async () => u.buffer }]); return JSON.stringify(m); })()`));
  ev("S.ejemplo = true;"); ev(setCorte("2026-10-22"));
  return { msgs };
});
console.log("fixtures en", OUT);
