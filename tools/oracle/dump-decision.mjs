// Fixtures de equivalencia de la vista «Decisión» (semáforo verde/amarillo/rojo/gris).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadOriginal } from "./load.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../packages/engine/test/fixtures");
fs.mkdirSync(OUT, { recursive: true });

const EX_FILES = ["SGC_EJEMPLO_carga_ENF.xlsx", "SGC_EJEMPLO_carga_OBS.xlsx", "SGC_EJEMPLO_carga_TM.xlsx"];
const LOAD = `(async () => {
  const mk = (n) => ({ name: n, arrayBuffer: async () => { const bin = atob(FILES_B64[n]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; } });
  await loadFiles(${JSON.stringify(EX_FILES)}.map(mk));
  S.files.forEach(f => { f.ejemplo = false; f.rows.forEach(r => { r.origen = 'Real'; }); }); S.ejemplo = false;
  S.corteOverride = parseISO('2026-10-22'); recompute();
})()`;

// ediciones, validaciones y roles de prueba
const EDITS = `(() => {
  const T = (n) => '2026-10-2' + n + 'T10:00:00.000Z';
  DS.roster = { u1: { rol: 'oficina', escuela: '' }, u2: { rol: 'responsable', escuela: 'ENF' }, u3: { rol: 'responsable', escuela: 'TM' }, u4: { rol: 'responsable', escuela: 'OBS' } };
  DS.prof = { u1: { name: 'Ana Oficina' }, u2: { name: 'Beto ENF' }, u3: { name: 'Carla TM' }, u4: { name: 'Dani OBS' } };
  const v = (esc, area, ind, per, val, ts, anulado = false, nota = '') => ({ t: 'v', key: decKey.v(esc, area, ind, per), esc, area, ind, per, val, fuente: 'Fuente de prueba ' + ind, corte: '2026-10-2' + ts, nota, anulado, ts: T(ts) });
  const p = (esc, proc, ficha, dueno, ts) => ({ t: 'p', key: decKey.p(esc, proc), esc, proc, ficha, dueno, fuente: 'Acta de prueba', ts: T(ts) });
  const k = (o) => [o.key, o];
  DS.entries = {
    u1: Object.fromEntries([v('ENF', '', 'ID1', '2026', 82, 1), v('TM', 'RAD', 'ID19', '2026-S2', 91, 2), v('OBS', '', 'ID6', '2026', -2, 3), p('TM', 'P1', 'aprobada', 'Dra. Prueba', 4), v('TM', '', 'ID13', '2026-S2', 10, 5)].map(k)),
    u2: Object.fromEntries([v('ENF', '', 'ID14', '2026-S1', 30, 1), v('ENF', '', 'ID14', '2026-S2', 22, 2), v('TM', '', 'ID14', '2026-S2', 99, 3), p('ENF', 'P2', 'borrador', '', 4), v('ENF', '', 'ID13', '2026-S1', 14, 6, true)].map(k)),
    u3: Object.fromEntries([v('TM', 'TF', 'ID19', '2026-S2', 78, 2), v('TM', 'RAD', 'ID19', '2026-S2', 95, 5), p('TM', 'P3', 'sin ficha', 'Ing. Z', 6)].map(k)),
    u4: Object.fromEntries([v('OBS', '', 'ID1', '2026', 70, 1), v('OBS', '', 'ID1', '2025', 60, 2), v('TM', '', 'ID14', '2026-S2', 5, 7)].map(k)),
    u9: Object.fromEntries([v('ENF', '', 'ID1', '2026', 1, 9)].map(k)),
  };
  DS.vals = {
    u1: { [decKey.v('ENF', '', 'ID1', '2026')]: { key: decKey.v('ENF', '', 'ID1', '2026'), entryTs: T(1), estado: 'Validado', nota: '', by: 'u1', ts: T(5) },
      [decKey.v('TM', 'RAD', 'ID19', '2026-S2')]: { key: decKey.v('TM', 'RAD', 'ID19', '2026-S2'), entryTs: T(2), estado: 'Observado', nota: 'revisar', by: 'u1', ts: T(5) },
      [decKey.v('TM', '', 'ID14', '2026-S2')]: { key: decKey.v('TM', '', 'ID14', '2026-S2'), entryTs: T(3), estado: 'Validado', nota: '', by: 'u1', ts: T(5) },
      [decKey.p('TM', 'P1')]: { key: decKey.p('TM', 'P1'), entryTs: T(4), estado: 'Validado', nota: '', by: 'u1', ts: T(6) } },
    u2: { [decKey.v('ENF', '', 'ID14', '2026-S2')]: { key: decKey.v('ENF', '', 'ID14', '2026-S2'), entryTs: T(2), estado: 'Validado', nota: 'no es oficina', by: 'u2', ts: T(8) } },
  };
  DS.events = { u1: { a: { ts: T(1), by: 'u1', accion: 'Alta de valor', clave: 'v_ENF_PROG_ID1_2026', antes: null, despues: { val: 82 }, nota: '' } }, u2: { b: { ts: T(2), by: 'u2', accion: 'Cambio del proceso', clave: 'p_ENF_P2', antes: { ficha: 'sin ficha' }, despues: { ficha: 'borrador' }, nota: 'Acta' } } };
  decBuild();
})()`;

const SUMMARY = `(() => {
  const strip = (it) => ({ id: it.id, tipo: it.tipo, esc: it.esc, area: it.area, cod: it.cod, nombre: it.nombre, c: it.c, motivo: it.motivo, valorTxt: it.valorTxt, refTxt: it.refTxt, fuente: it.fuente,
    corte: it.corte, accion: it.accion, resp: it.resp, brecha: it.brecha, measured: it.measured, kind: it.kind, mini: it.mini || null, nprob: it.nprob ?? null, estandares: it.estandares, procesos: it.procesos, porArea: it.porArea,
    comps: it.comps || null, rec: it.rec ? { ficha: it.rec.ficha, dueno: it.rec.dueno || '', vestado: it.rec.vestado } : null,
    ev: it.ev ? { c: it.ev.c, vacio: !!it.ev.vacio, defPend: !!it.ev.defPend, prov: it.ev.prov || null, stale: !!it.ev.stale, expected: it.ev.expected || null, corto: it.ev.corto, mini: it.ev.mini || null,
      last: it.ev.last ? { val: it.ev.last.val, per: it.ev.last.per, vestado: it.ev.last.vestado, vpor: it.ev.last.vpor, vnota: it.ev.last.vnota, origen: it.ev.last.origen, autor: it.ev.last.autor } : null, prevPer: it.ev.prev ? it.ev.prev.per : null } : null,
    npts: it.pts ? it.pts.length : null });
  const items = DS.items.map(strip);
  const counts = {}; DEC_ESC.forEach(e => { counts[e] = decCounts(DS.items.filter(i => i.esc === e)); });
  const ranking = {}; DEC_ESC.forEach(e => { ranking[e] = decRanking(DS.items.filter(i => i.esc === e)).map(i => i.id); });
  const sc = DS.items; S.escuela = 'TODAS';
  const rows = { alertas: decRowsAlertas(sc), valores: decRowsValores(), procesos: decRowsProcesos(sc), bitacora: decRowsBitacora() };
  const pts = DS.model.pts.map(p => ({ key: p.key, esc: p.esc, area: p.area, ind: p.ind, per: p.per, val: p.val, origen: p.origen, vestado: p.vestado, vpor: p.vpor, ts: p.ts }));
  return JSON.stringify({ items, counts, ranking, rows, pts });
})()`;

const INPUT = `(() => {
  const strip = ['pinfo', 'valor', 'id', 'motivo', 'reemplaza'];
  const rows = S.files.flatMap(f => f.rows).map(r => { const o = { ...r }; strip.forEach(k => delete o[k]); return o; });
  const scopes = {};
  S.files.forEach(f => { if (!f.escuela) return; const s = scopes[f.escuela] = scopes[f.escuela] || { alcance: {}, respLocal: {} };
    if (f.alcance) Object.keys(f.alcance).forEach(k => { if (f.alcance[k]) s.alcance[k] = f.alcance[k]; });
    if (f.respLocal) Object.keys(f.respLocal).forEach(k => { if (f.respLocal[k]) s.respLocal[k] = f.respLocal[k]; }); });
  const entries = Object.entries(DS.entries).flatMap(([uid, o]) => Object.values(o).map(e => ({ ...e, autor: uid })));
  const validations = Object.values(DS.vals).flatMap(o => Object.values(o));
  const events = Object.values(DS.events).flatMap(o => Object.values(o));
  const names = Object.fromEntries(Object.entries(DS.prof).map(([k, v]) => [k, v.name]));
  return JSON.stringify({ params: S.params, ejemplo: S.ejemplo, corteOverride: S.corteOverride ? isoD(S.corteOverride) : null, measurements: rows,
    evidence: S.files.flatMap(f => f.evid), scopes, schoolsWithFiles: Array.from(new Set(S.files.map(f => f.escuela).filter(Boolean))), autoeval: S.autoeval, fileNames: S.files.map(f => f.name),
    decision: { roster: DS.roster, entries, validations, events, names }, soloVal: DS.soloVal });
})()`;

async function scenario(name, fn) {
  const { window, errors } = loadOriginal();
  if (errors.length) console.warn(name, errors.slice(0, 2));
  const ev = (s) => window.eval(s);
  await fn(ev);
  const input = JSON.parse(ev(INPUT));
  const expected = JSON.parse(ev(SUMMARY));
  fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify({ name, input, expected }));
  const c = expected.counts;
  console.log(name.padEnd(14), "items", expected.items.length, "TM", JSON.stringify(c.TM), "ENF", JSON.stringify(c.ENF));
}

await scenario("dec-base", async (ev) => { ev("decBuild();"); });
await scenario("dec-archivos", async (ev) => { await ev(LOAD); ev("decBuild();"); });
await scenario("dec-ediciones", async (ev) => { await ev(LOAD); ev(EDITS); });
await scenario("dec-solo-val", async (ev) => { await ev(LOAD); ev(EDITS); ev("DS.soloVal = true; decBuild();"); });
