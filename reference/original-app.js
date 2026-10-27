
/* ===================== Utilidades ===================== */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad2 = n => String(n).padStart(2, '0');
const isoD = d => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const dUTC = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const parseISO = s => { if (!s) return null; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? dUTC(+m[1], +m[2], +m[3]) : null; };
const fmtDate = d => d ? `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}` : '—';
const fmtMonth = d => d ? `${MESES[d.getUTCMonth()]}-${d.getUTCFullYear()}` : '—';
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const num = v => { if (v === null || v === undefined || v === '') return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
const fmtN = (v, dec = 1) => v === null || v === undefined || !isFinite(v) ? '—' : (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(dec)).replace('.', ',');
const clone = o => JSON.parse(JSON.stringify(o));
const uniq = a => Array.from(new Set(a));

/* ===================== Periodos ===================== */
function periodInfo(p) {
  p = String(p ?? '').trim();
  let m;
  if ((m = p.match(/^(\d{4})$/))) { const y = +m[1]; return { p, y, tipo: 'A', start: dUTC(y, 1, 1), end: dUTC(y, 12, 31), label: `Año ${y}` }; }
  if ((m = p.match(/^(\d{4})-S([12])$/))) { const y = +m[1], k = +m[2]; return { p, y, tipo: 'S', start: k === 1 ? dUTC(y, 1, 1) : dUTC(y, 7, 1), end: k === 1 ? dUTC(y, 6, 30) : dUTC(y, 12, 31), label: `${y} · semestre ${k}` }; }
  if ((m = p.match(/^(\d{4})-T([1-4])$/))) { const y = +m[1], q = +m[2]; return { p, y, tipo: 'T', start: dUTC(y, q * 3 - 2, 1), end: new Date(Date.UTC(y, q * 3, 0)), label: `${y} · trimestre ${q}` }; }
  if ((m = p.match(/^(\d{4})-(0[1-9]|1[0-2])$/))) { const y = +m[1], mo = +m[2]; return { p, y, tipo: 'M', start: dUTC(y, mo, 1), end: new Date(Date.UTC(y, mo, 0)), label: `${MESES[mo - 1]}-${y}` }; }
  return null;
}
const FREQ_MONTHS = { 'Mensual': 1, 'Trimestral': 3, 'Semestral': 6, 'Anual': 12 };
/** ultimo periodo cuyo cierre + gracia ya paso a la fecha de corte, segun la periodicidad */
function expectedEnd(freq, corte, gracia) {
  const mths = FREQ_MONTHS[freq] || 12;
  let y = corte.getUTCFullYear();
  const ends = [];
  for (let yy = y - 2; yy <= y; yy++) {
    for (let mo = mths; mo <= 12; mo += mths) ends.push(new Date(Date.UTC(yy, mo, 0)));
  }
  const ok = ends.filter(e => addDays(e, gracia) <= corte);
  return ok.length ? ok[ok.length - 1] : null;
}
function periodLabelFromEnd(freq, end) {
  if (!end) return '—';
  const y = end.getUTCFullYear(), mo = end.getUTCMonth() + 1;
  if (freq === 'Anual') return String(y);
  if (freq === 'Semestral') return `${y}-S${mo <= 6 ? 1 : 2}`;
  if (freq === 'Trimestral') return `${y}-T${Math.ceil(mo / 3)}`;
  return `${y}-${pad2(mo)}`;
}
/** fin del primer periodo de esa periodicidad posterior a una fecha */
function nextEndAfter(freq, d) {
  const mths = FREQ_MONTHS[freq] || 12;
  for (let yy = d.getUTCFullYear(); yy <= d.getUTCFullYear() + 2; yy++)
    for (let mo = mths; mo <= 12; mo += mths) { const e = new Date(Date.UTC(yy, mo, 0)); if (e > d) return e; }
  return null;
}

/* ===================== Estados ===================== */
const ST = {
  CRIT: { rank: 6, label: 'Crítico', cls: 'crit', icon: 'i-crit' },
  RIESGO: { rank: 5, label: 'En riesgo', cls: 'risk', icon: 'i-risk' },
  BAJO: { rank: 4, label: 'Bajo la meta', cls: 'low', icon: 'i-low', sub: 'umbral por definir' },
  SD: { rank: 3, label: 'Sin dato', cls: 'nodata', icon: 'i-nodata' },
  SEG: { rank: 2, label: 'En seguimiento', cls: 'info', icon: 'i-clock', sub: 'medición parcial' },
  OK: { rank: 1, label: 'En meta', cls: 'ok', icon: 'i-ok' },
  DEF: { rank: 0, label: 'Por definir', cls: 'def', icon: 'i-def', sub: 'meta sin fuente' },
  NA: { rank: -1, label: 'No aplica', cls: 'na', icon: 'i-na' },
};
const chip = (code, extra = '') => { const s = ST[code]; return `<span class="chip st-${s.cls}" title="${esc(s.label + (s.sub ? ' · ' + s.sub : ''))}"><svg class="ic" aria-hidden="true"><use href="#${s.icon}"/></svg><span>${esc(s.label)}</span>${extra}</span>`; };
const SEV = { 'Crítica': { rank: 3, cls: 'crit', icon: 'i-crit' }, 'En riesgo': { rank: 2, cls: 'risk', icon: 'i-risk' }, 'Aviso': { rank: 1, cls: 'info', icon: 'i-info' } };
const sevChip = s => { const v = SEV[s] || SEV['Aviso']; return `<span class="chip st-${v.cls}"><svg class="ic" aria-hidden="true"><use href="#${v.icon}"/></svg><span>${esc(s)}</span></span>`; };

/* ===================== Modelo y parametros ===================== */
const M = JSON.parse(document.getElementById('model-json').textContent);
const EXJ = JSON.parse(document.getElementById('example-json').textContent);
const PDEF = JSON.parse(document.getElementById('params-json').textContent);
const TM_AREAS = ['Radiología', 'Terapia Física', 'Terapia Ocupacional', 'Laboratorio Clínico y Anatomía Patológica'];
const AREA_LEGACY = { 'tm-a1': TM_AREAS[0], 'tm-a2': TM_AREAS[1], 'tm-a3': TM_AREAS[2], 'tm-a4': TM_AREAS[3], 'tm-rad': TM_AREAS[0], 'tm-tf': TM_AREAS[1], 'tm-to': TM_AREAS[2], 'tm-lcap': TM_AREAS[3] };
const noAcc = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** area de TM: acepta el nombre (con o sin tildes) o los códigos de la plantilla 0.1 (TM-A1 a TM-A4) */
function normArea(v) {
  const t = String(v ?? '').trim(); if (!t) return '';
  const k = noAcc(t); if (AREA_LEGACY[k]) return AREA_LEGACY[k];
  const hit = TM_AREAS.find(a => noAcc(a) === k); return hit || t;
}
const ESC_LIST = [
  { id: 'ENF', nombre: 'Enfermería', corto: 'Enfermería', areas: [], fase: 1, faseTxt: 'Fase 1 · piloto' },
  { id: 'OBS', nombre: 'Obstetricia', corto: 'Obstetricia', areas: [], fase: 2, faseTxt: 'Fase 2' },
  { id: 'TM', nombre: 'Tecnología Médica', corto: 'Tec. Médica', areas: TM_AREAS, fase: 3, faseTxt: 'Fase 3 · por áreas' },
  { id: 'FAC', nombre: 'Facultad (marco común)', corto: 'Facultad', areas: [] },
];
const ESC_BY = Object.fromEntries(ESC_LIST.map(e => [e.id, e]));
const SCH = ['ENF', 'OBS', 'TM'];
const ORD = ['ENF', 'OBS', 'TM', 'FAC'];
const IND_BY = Object.fromEntries(M.indicadores.map(i => [i.id, i]));
const SIN_BY = Object.fromEntries(M.sineace.map(s => [s.id, s]));
const FICHA_BY = Object.fromEntries(M.fichas.map(f => [f.id, f]));
const P102_BY = Object.fromEntries(M.procesos102.map(p => [p.id, p]));
const EST_BY = Object.fromEntries(M.estandares.map(e => [e.id, e]));
const EV_BY = Object.fromEntries(M.evidencias.map(e => [e.id, e]));
const AOI_BY = Object.fromEntries(M.aoi.map(a => [a.id, a]));
const FUENTE_BY = Object.fromEntries(M.fuentes.map(f => [f.id, f]));
const POI_IND = ['PE01-I3', 'PE01-P6', 'PE01-P7', 'PE01-P8'];

/** Cargables: 29 SINEACE + indicadores de proceso que no miden lo mismo que un SINEACE */
const CARGABLES = [
  ...M.sineace.map(s => ({ id: s.id, tipo: 'SINEACE', nombre: s.nombre, frecuencia: s.frecuencia, ambito: 'Escuela' })),
  ...M.indicadores.filter(i => !i.alias_sineace).map(i => ({ id: i.id, tipo: i.ficha === 'PE FM' ? 'PE FM' : 'Proceso', nombre: i.nombre, frecuencia: i.frecuencia, ambito: i.ambito, piloto: i.piloto })),
];
const CARG_BY = Object.fromEntries(CARGABLES.map(c => [c.id, c]));
const PROC_IND_IN_102 = new Set(M.rel_proceso_indicador.map(r => r[1]));
function defaultScope(c) { return c.tipo === 'SINEACE' || c.piloto || PROC_IND_IN_102.has(c.id); }

function buildParams(src) {
  const gen = {}; src.general.forEach(g => gen[g[0]] = g[1]);
  const reglas = src.reglas.map(r => ({ id: r[0], nombre: r[1], activa: r[2], severidad: r[3], condicion: r[4], que: r[5], porque: r[6], accion: r[7] }));
  return { gen, reglas, metas: src.metas || null, origen: 'Por defecto (tablero)', fecha: src.general.find(g => g[0] === 'fecha_parametros')[1] };
}
function defaultMetas() {
  const out = {};
  CARGABLES.forEach(c => {
    const src = c.tipo === 'SINEACE' ? SIN_BY[c.id] : IND_BY[c.id];
    const rows = c.tipo === 'SINEACE'
      ? [{ desde: 0, meta: src.ref, sentido: src.sentido, unidad: src.unidad, fuente_meta: 'Valor de referencia del modelo CONEAU 2026, ' + c.id + ' [A4]', estado_meta: 'Con fuente', verde_min: null, rojo_min: null, base: 'cumplimiento', avance: src.avance || 'Puntual', regla: src.regla || 'razon', fuente_umbral: '', nota: ('Referencia del modelo; no equivale a una meta aprobada por la Facultad. ' + (src.regla_nota || '')).trim() }]
      : (src.metas.length ? src.metas.map(m => ({ desde: m.desde, meta: m.meta, sentido: src.sentido, unidad: src.unidad, fuente_meta: m.fuente, estado_meta: 'Con fuente', verde_min: null, rojo_min: null, base: 'cumplimiento', avance: src.avance || 'Puntual', regla: 'razon', fuente_umbral: '', nota: src.meta_nota }))
        : [{ desde: 0, meta: null, sentido: src.sentido, unidad: src.unidad, fuente_meta: '', estado_meta: src.estado_meta === 'En conflicto' ? 'En conflicto' : 'Por definir', verde_min: null, rojo_min: null, base: 'cumplimiento', avance: src.avance || 'Puntual', regla: 'razon', fuente_umbral: '', nota: src.meta_nota }]);
    out[c.id] = rows;
  });
  // PE01-I3: umbral por banda no se aplica (el avance de las AOI es lo que tiene bandas, no el promedio frente a la meta del MAGPROF)
  return out;
}
const PARAMS0 = (() => { const p = buildParams(PDEF); p.metas = defaultMetas(); return p; })();

/* ===================== Estado global ===================== */
const S = {
  ejemplo: false,
  escuela: 'TODAS',
  view: 'decision',
  files: [],            // archivos cargados
  params: clone(PARAMS0),
  paramsEdit: false,
  logo: null, escudo: null,
  fichaId: null, fichaEsc: null,
  filtroEstado: '', filtroSev: '', filtroRegla: '', filtroEsc: '',
  poiAnio: 2026, poiAoi: null,
  cmpInd: 'ID1', trendInd: 'ID1',
  estSel: null,
};

const EJ_CORTE = '2026-10-20';
function corteDate() {
  const g = S.params.gen.fecha_corte;
  const d = g ? parseISO(g instanceof Date ? isoD(g) : g) : null;
  if (S.corteOverride) return S.corteOverride;
  if (d) return d;
  if (S.ejemplo) return parseISO(EJ_CORTE);
  const n = new Date();
  return dUTC(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/* ===================== Medidas: construccion de la base ===================== */
function normRow(r, origenArchivo) {
  const o = {
    periodo: String(r.periodo ?? '').trim(), escuela: String(r.escuela ?? '').trim().toUpperCase(), area: normArea(r.area),
    indicador: String(r.indicador ?? '').trim(), numerador: num(r.numerador), denominador: num(r.denominador), valor_directo: num(r.valor),
    meta_propuesta: num(r.meta_propuesta), fuente_meta: String(r.fuente_meta ?? '').trim(), esperado: num(r.esperado), fuente_esperado: String(r.fuente_esperado ?? '').trim(), fuente_dato: String(r.fuente_dato ?? '').trim(),
    ev: String(r.evidencia_ev ?? '').trim(), ev_ref: String(r.evidencia_ref ?? '').trim(), cargado_por: String(r.responsable_carga ?? '').trim(),
    fecha_carga: r.fecha_carga ? String(r.fecha_carga).slice(0, 10) : '', estado_val: String(r.estado_validacion ?? '').trim() || 'Borrador',
    validado_por: String(r.validado_por ?? '').trim(), fecha_val: r.fecha_validacion ? String(r.fecha_validacion).slice(0, 10) : '',
    version: num(r.version_dato) || 1, obs: String(r.observacion ?? '').trim(), origen: String(r.origen ?? '').trim() === 'EJEMPLO' ? 'EJEMPLO' : 'Real',
    archivo: origenArchivo || '',
  };
  return o;
}
function unitFor(id) { const rows = S.params.metas[id]; return rows && rows[0] ? rows[0].unidad : (CARG_BY[id] && IND_BY[id] ? IND_BY[id].unidad : 'por definir'); }
function calcValor(m) {
  if (m.valor_directo !== null) return m.valor_directo;
  if (m.numerador !== null && m.denominador !== null && m.denominador > 0) return m.numerador / m.denominador * (unitFor(m.indicador) === '%' ? 100 : 1);
  if (m.numerador !== null) return m.numerador;
  return null;
}

/** Hechos del POI de la Facultad (reportes A14 A15 A16): datos reales con fuente y pagina */
let POI_CACHE = null;
function poiCompute(anio, mesCorte) {
  // agrupa por AOI del año
  const byAoi = {};
  M.poi_hecho.forEach(([a, mes, aoi, act, prog, ejec, pag]) => {
    if (a !== anio) return;
    (byAoi[aoi] = byAoi[aoi] || { aoi, act, pag, meses: [] }).meses.push({ mes, prog, ejec });
  });
  const out = [];
  Object.values(byAoi).forEach(o => {
    o.meses.sort((x, y) => x.mes - y.mes);
    let pa = 0, ea = 0; const acum = [];
    o.meses.forEach(m => { if (m.mes <= mesCorte) { pa += m.prog; ea += m.ejec; } acum.push({ mes: m.mes, prog: o.meses.filter(z => z.mes <= m.mes).reduce((s, z) => s + z.prog, 0), ejec: o.meses.filter(z => z.mes <= m.mes).reduce((s, z) => s + z.ejec, 0) }); });
    o.prog = pa; o.ejec = ea; o.acum = acum;
    o.avance = pa > 0 ? Math.min(100, ea / pa * 100) : null;
    o.ratio = pa > 0 ? ea / pa * 100 : null;
    out.push(o);
  });
  return out;
}
function poiAll() {
  if (POI_CACHE) return POI_CACHE;
  const res = {};
  M.poi_reportes.forEach(rep => {
    const lst = poiCompute(rep.anio, rep.mes_corte);
    const conProg = lst.filter(x => x.prog > 0);
    const sobre = +S.params.gen.umbral_sobreejecucion || 120;
    const vinc = conProg.filter(x => { const a = AOI_BY[x.act]; return a && a.en_alcance_sgc && ['Directo', 'Relacionado'].includes(a.vinculo); });
    res[rep.anio] = {
      rep, lista: lst, conProg,
      i3: conProg.length ? conProg.reduce((s, x) => s + x.avance, 0) / conProg.length : null,
      p6: conProg.length ? conProg.filter(x => x.avance >= 95).length / conProg.length * 100 : null,
      p6n: conProg.filter(x => x.avance >= 95).length,
      p7: conProg.length ? conProg.filter(x => x.ratio > sobre).length / conProg.length * 100 : null,
      p7n: conProg.filter(x => x.ratio > sobre).length,
      p8: vinc.length ? vinc.filter(x => x.avance >= 95).length / vinc.length * 100 : null,
      p8n: vinc.filter(x => x.avance >= 95).length, p8d: vinc.length,
    };
  });
  POI_CACHE = res;
  return res;
}
function poiMeasurements() {
  const A = poiAll(); const out = [];
  M.poi_reportes.forEach(rep => {
    const r = A[rep.anio]; const per = rep.mes_corte === 12 ? String(rep.anio) : `${rep.anio}-${pad2(rep.mes_corte)}`;
    const src = `Reporte de seguimiento del POI ${rep.anio}, centro de costo 01.30 (${rep.reporte}), consultado el ${fmtDate(parseISO(rep.consulta))}`;
    const common = { periodo: per, escuela: 'FAC', area: '', fuente_dato: src, ev: '', ev_ref: `Reporte ${rep.reporte} (PDF, 4 páginas), páginas 1 a 4`, cargado_por: 'Carga inicial desde los reportes impresos', fecha_carga: rep.consulta, estado_val: 'Dato de reporte', validado_por: 'Reporte oficial del aplicativo CEPLAN', fecha_val: rep.consulta, version: 1, obs: '', origen: 'Real', archivo: 'Reporte POI ' + rep.reporte, numerador: null, denominador: null, meta_propuesta: null, fuente_meta: '' };
    out.push({ ...common, indicador: 'PE01-I3', valor_directo: r.i3, obs: `Promedio de ${r.conProg.length} AOI con programación; el reporte imprime ${fmtN(rep.impreso, 2)} %` });
    out.push({ ...common, indicador: 'PE01-P6', valor_directo: r.p6, obs: `${r.p6n} de ${r.conProg.length} AOI` });
    out.push({ ...common, indicador: 'PE01-P7', valor_directo: r.p7, obs: `${r.p7n} de ${r.conProg.length} AOI` });
    out.push({ ...common, indicador: 'PE01-P8', valor_directo: r.p8, obs: `${r.p8n} de ${r.p8d} AOI vinculadas al SGC` });
  });
  return out;
}

let DB = null;
/** Todas las mediciones normalizadas, filtradas por el interruptor EJEMPLO */
function buildDB() {
  POI_CACHE = null;
  const rows = []; const rejected = [];
  const addAll = (lst, fromEx) => lst.forEach(r => rows.push(fromEx ? r : r));
  const base = [];
  poiMeasurements().forEach(m => base.push(m));
  (M.real_mediciones || []).forEach(r => base.push(normRow(r, 'Matriz de la Facultad [A18]')));
  if (S.ejemplo) EXJ.mediciones.forEach(r => base.push(normRow(r, 'EJEMPLO (incrustado)')));
  S.files.forEach(f => f.rows.forEach(r => base.push(r)));
  // quita EJEMPLO si el interruptor esta apagado
  const filt = base.filter(r => S.ejemplo || r.origen !== 'EJEMPLO');
  // dedupe: llave periodo|escuela|area|indicador; gana la mayor version, luego la fecha de carga, luego el orden de entrada
  const byKey = new Map();
  filt.forEach((r, idx) => {
    const k = [r.periodo, r.escuela, r.area, r.indicador].join('|');
    const prev = byKey.get(k);
    if (!prev || r.version > prev.version || (r.version === prev.version && (r.fecha_carga || '') >= (prev.fecha_carga || ''))) {
      if (prev) r.reemplaza = (prev.reemplaza || 0) + 1;
      byKey.set(k, r);
    }
  });
  const vis = [];
  byKey.forEach(r => {
    r.pinfo = periodInfo(r.periodo);
    r.valor = calcValor(r);
    r.id = [r.periodo, r.escuela, r.area, r.indicador].join('|');
    if (!r.pinfo || r.valor === null || !r.indicador || !ESC_BY[r.escuela]) { r.motivo = !r.pinfo ? 'Periodo no válido' : r.valor === null ? 'Sin valor' : !ESC_BY[r.escuela] ? 'Escuela no válida' : 'Sin indicador'; rejected.push(r); return; }
    if (!CARG_BY[r.indicador] && !IND_BY[r.indicador]) { r.motivo = 'Indicador no existe en el catálogo'; rejected.push(r); return; }
    if (!r.fuente_dato) { r.motivo = 'Sin fuente del dato: no se muestra como dato'; rejected.push(r); return; }
    vis.push(r);
  });
  vis.sort((a, b) => a.pinfo.end - b.pinfo.end || a.version - b.version);
  DB = { vis, rejected };
  return DB;
}

/* ===================== Metas, bandas y evaluacion ===================== */
const effId = id => { const i = IND_BY[id]; return (i && i.alias_sineace && S.params.gen.heredar_alias !== 'No') ? i.alias_sineace : id; };
function metaRowFor(id, year) {
  const rows = (S.params.metas[id] || []).filter(r => r.meta !== null && r.meta !== undefined && String(r.fuente_meta || '').trim() && r.desde <= year);
  if (!rows.length) return null;
  return rows.reduce((a, b) => b.desde >= a.desde ? b : a);
}
function metaInfo(id) {
  const rows = S.params.metas[id] || [];
  const r0 = rows[0] || {};
  return { unidad: r0.unidad || 'por definir', sentido: r0.sentido || 'Por definir', estado: r0.estado_meta || 'Por definir', nota: r0.nota || '' };
}
/** fraccion del año transcurrida al cierre del periodo (1 si es anual); solo para cargas EJEMPLO sin POI vinculado */
function yearFraction(pinfo) { return Math.min(1, (pinfo.end.getUTCMonth() + 1) / 12); }
const REGLAS = {
  razon: { nombre: 'Razón al esperado', txt: '' },
  menor_igual: { nombre: 'Cumple si es menor o igual al referencial', txt: 'Es un tiempo: cumple si el valor es menor o igual al referencial.' },
  no_negativa: { nombre: 'Cumple si la variación es mayor o igual a 0', txt: 'Es una variación: cumple si no es negativa (mayor o igual a 0).' },
};
const REGLA_NOMBRES = { 'Razón al esperado': 'razon', 'Cumple si es menor o igual al referencial': 'menor_igual', 'Cumple si la variación es mayor o igual a 0': 'no_negativa' };
const reglaKey = v => { const t = String(v ?? '').trim(); return REGLAS[t] ? t : (REGLA_NOMBRES[t] || 'razon'); };
/** Programado acumulado al corte, tomado del POI mensual de la Facultad (reporte oficial en PDF) para la actividad (AOI) que se tomó como referencia
 *  del indicador [CP]. Devuelve la fraccion del programado anual que ya debia estar hecha al mes de cierre del periodo; null si no hay AOI de referencia
 *  con programacion mensual. */
function poiFraccion(id, pinfo) {
  const ind = IND_BY[id]; if (!ind || !ind.aoi_esperado) return null;
  const rep = M.poi_reportes.find(r => r.anio === pinfo.y); if (!rep) return null;
  const mesCierre = pinfo.end.getUTCMonth() + 1;
  const rows = M.poi_hecho.filter(r => r[0] === pinfo.y && r[3] === ind.aoi_esperado && !String(r[2]).startsWith('Sin código'));
  const tot = rows.reduce((t, r) => t + r[4], 0);
  if (!(tot > 0)) return null;
  const acum = rows.filter(r => r[1] <= mesCierre).reduce((t, r) => t + r[4], 0);
  return { f: acum / tot, det: [{ act: ind.aoi_esperado, tot, acum }], rep, mes: mesCierre };
}
function evalPoint(id, m) {
  const mi = metaInfo(id);
  const year = m.pinfo.y;
  let mr = metaRowFor(id, year);
  let meta = mr ? mr.meta : null, fuenteMeta = mr ? mr.fuente_meta : '';
  if (m.meta_propuesta !== null && m.fuente_meta) { meta = m.meta_propuesta; fuenteMeta = m.fuente_meta + ' (meta propuesta en la carga)'; mr = { ...(mr || {}), verde_min: mr ? mr.verde_min : null, rojo_min: mr ? mr.rojo_min : null, base: mr ? mr.base : 'cumplimiento', fuente_umbral: mr ? mr.fuente_umbral : '' }; }
  const regla = reglaKey(mr && mr.regla);
  const v = m.valor;
  const out = { valor: v, meta, ref: meta, esperado: null, espTxt: '', prorrata: false, espFuente: '', fuenteMeta, unidad: mi.unidad, sentido: mi.sentido, cumpl: null, state: 'DEF', bands: null, bandsSrc: '', pinfo: m.pinfo, m, regla, cumple: null };
  if (meta === null || mi.sentido === 'Por definir') return out;
  let esp = meta;
  if (m.esperado !== null && m.esperado !== undefined && m.fuente_esperado) { esp = m.esperado; out.espFuente = m.fuente_esperado; }
  else if (mr && mr.avance === 'Acumulado en el año') {
    const fp = poiFraccion(id, m.pinfo);
    if (fp) {
      esp = meta * fp.f; out.poiEsp = fp;
      out.espFuente = `Meta anual × ${fmtN(fp.f * 100, 1)} % programado acumulado al cierre de ${m.pinfo.p} según el POI mensual de la Facultad (actividad ${fp.det[0].act}: ${fmtN(fp.det[0].acum, 0)} de ${fmtN(fp.det[0].tot, 0)}; reporte ${fp.rep.reporte}); actividad de referencia elegida por criterio propio [CP]`;
    } else if (m.origen === 'EJEMPLO') {
      const f = yearFraction(m.pinfo);
      if (f < 1) { esp = meta * f; out.prorrata = true; out.espFuente = `EJEMPLO: meta anual × ${fmtN(f * 100, 0)} % del año transcurrido al cierre de ${m.pinfo.p}`; }
    } else if (m.pinfo.tipo !== 'A') {
      // sin POI mensual vinculado no hay esperado con fuente: se informa el valor, sin estado frente a la meta anual
      out.espTxt = 'sin programado acumulado en el POI mensual: no hay valor esperado con fuente'; out.parcial = true; out.state = 'SEG'; out.sinEsperado = true;
      return out;
    }
  }
  out.esperado = esp; out.ref = esp;
  out.espTxt = esp !== meta || out.espFuente ? `lo esperado a la fecha (${fmtVal(esp, mi.unidad)}; meta anual ${fmtVal(meta, mi.unidad)})` : `una meta de ${fmtVal(meta, mi.unidad)}`;
  let c;
  const menor = mi.sentido === 'Menor es mejor';
  if (esp === 0) c = menor ? (v <= 0 ? 100 : 0) : (v >= 0 ? 100 : 0);
  else c = menor ? (v > 0 ? esp / v * 100 : 100) : v / esp * 100;
  out.cumpl = c;
  const freqI = (CARG_BY[id] || {}).frecuencia;
  // regla binaria: el criterio es ser menor o igual (tiempos) o no negativo (variaciones); no hay bandas
  if (regla === 'menor_igual' || regla === 'no_negativa') {
    out.cumple = regla === 'menor_igual' ? v <= esp : v >= esp;
    out.espTxt = regla === 'menor_igual' ? `un máximo de ${fmtVal(esp, mi.unidad)} (cumple si es menor o igual)` : `una variación no negativa (cumple si es mayor o igual a ${fmtVal(esp, mi.unidad)})`;
  }
  if (!(mr && mr.avance === 'Acumulado en el año') && !out.espFuente && freqI === 'Anual' && m.pinfo.tipo !== 'A') { out.state = 'SEG'; out.parcial = true; return out; }
  if (out.cumple !== null) { out.state = out.cumple ? 'OK' : 'BAJO'; return out; }
  let vm = mr && mr.verde_min != null ? mr.verde_min : null, rm = mr && mr.rojo_min != null ? mr.rojo_min : null, base = (mr && mr.base) || 'cumplimiento', src = mr && mr.fuente_umbral || '';
  if (vm !== null && rm !== null && !String(src).trim()) { vm = rm = null; }
  if (vm === null || rm === null) {
    if (m.origen === 'EJEMPLO') { vm = 95; rm = 75; base = 'cumplimiento'; src = 'EJEMPLO: bandas de los reportes del POI aplicadas solo para demostrar el semáforo'; }
    else { vm = rm = null; }
  }
  if (vm !== null) {
    out.bands = { verde: vm, rojo: rm, base };
    out.bandsSrc = src;
    const x = base === 'valor' ? v : c;
    out.state = x >= vm ? 'OK' : x >= rm ? 'RIESGO' : 'CRIT';
  } else out.state = c >= 100 ? 'OK' : 'BAJO';
  return out;
}

/* Serie por escuela e indicador efectivo */
function seriesFor(esc, id) {
  const eid = effId(id);
  const rows = DB.vis.filter(r => r.escuela === esc && r.indicador === eid);
  // por periodo: fila de escuela o promedio de areas
  const byP = new Map();
  rows.forEach(r => { (byP.get(r.periodo) || byP.set(r.periodo, []).get(r.periodo)).push(r); });
  const pts = [];
  byP.forEach((lst, p) => {
    const escRow = lst.find(r => r.area === '');
    let rep;
    if (escRow) rep = escRow;
    else {
      const vals = lst.map(r => r.valor);
      rep = { ...lst[0], area: '(promedio de áreas)', valor: vals.reduce((a, b) => a + b, 0) / vals.length, promedioAreas: lst.length, ev: lst.every(r => r.ev || r.ev_ref) ? lst[0].ev : '', ev_ref: lst.every(r => r.ev || r.ev_ref) ? lst[0].ev_ref : '', estado_val: lst.every(r => r.estado_val === 'Validado' || r.estado_val === 'Dato de reporte') ? 'Validado' : lst.find(r => r.estado_val !== 'Validado').estado_val };
    }
    pts.push(rep);
  });
  pts.sort((a, b) => a.pinfo.end - b.pinfo.end);
  const ev = pts.map(m => evalPoint(eid, m));
  return { eid, id, pts, ev };
}
const _sc = new Map();
function status(esc, id) {
  const k = esc + '|' + id + '|' + (DB && DB.v);
  if (_sc.has(k)) return _sc.get(k);
  const sr = seriesFor(esc, id);
  const eid = sr.eid;
  const mi = metaInfo(eid);
  const freq = (CARG_BY[eid] || {}).frecuencia || 'Anual';
  const corte = corteDate();
  const gracia = +S.params.gen.dias_gracia || 0;
  const expEnd = expectedEnd(freq, corte, gracia);
  const res = { esc, id, eid, freq, sr, last: null, state: 'SD', desde: null, desdeTxt: '', vencido: false, expEnd, expLabel: periodLabelFromEnd(freq, expEnd), overdueSince: null, tendencia: null, mi };
  if (sr.ev.length) {
    const L = sr.ev[sr.ev.length - 1];
    res.last = L; res.state = L.state;
    // desde cuando esta en este estado
    let i = sr.ev.length - 1; while (i > 0 && sr.ev[i - 1].state === L.state) i--;
    res.desde = sr.ev[i].pinfo.end; res.desdePeriodo = sr.ev[i].pinfo.p; res.runLen = sr.ev.length - i;
    // vencido
    if (expEnd && L.pinfo.end < expEnd) {
      res.vencido = true;
      const nx = nextEndAfter(freq, L.pinfo.end);
      res.overdueSince = nx ? addDays(nx, gracia) : null;
    }
    // tendencia
    const n = Math.max(1, +S.params.gen.n_periodos_tendencia || 2);
    if (sr.ev.length >= n + 1) {
      const tail = sr.ev.slice(-(n + 1));
      const key = e => e.cumpl !== null ? e.cumpl : (mi.sentido === 'Mayor es mejor' ? e.valor : mi.sentido === 'Menor es mejor' ? -e.valor : null);
      const ks = tail.map(key);
      if (ks.every(k => k !== null) && ks.slice(1).every((k, j) => k < ks[j] - 1e-9)) res.tendencia = { n, serie: tail.map(e => `${e.pinfo.p}: ${fmtN(e.valor)}${e.unidad === '%' ? ' %' : ''}`).join(' → ') };
    }
  }
  _sc.set(k, res);
  return res;
}

/** indicadores vigilados por escuela */
function inScope(esc, id) {
  const c = CARG_BY[id]; if (!c) return false;
  // alcance explicito de un archivo cargado
  const f = S.files.filter(f => f.escuela === esc && f.alcance && f.alcance[id]);
  if (f.length) { const v = f[f.length - 1].alcance[id]; return v === 'Sí' || (v === 'Solo Facultad' && esc === 'FAC'); }
  if (esc === 'FAC') return c.ambito === 'Facultad';
  if (c.ambito === 'Facultad') return false;
  return defaultScope(c);
}
function scopeList(esc) { return CARGABLES.filter(c => inScope(esc, c.id)); }
function enImplementacion(esc) {
  if (esc === 'FAC') return true;
  const lst = String(S.params.gen.escuelas_en_implementacion ?? '').split(/[,;\s]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
  return lst.includes(esc) || schoolHasData(esc);
}
function schoolHasData(esc) { return DB.vis.some(r => r.escuela === esc) || S.files.some(f => f.escuela === esc); }
function responsableOf(esc, id) {
  const f = S.files.filter(f => f.escuela === esc && f.respLocal && f.respLocal[id]);
  if (f.length) return f[f.length - 1].respLocal[id];
  const eid = IND_BY[id] ? id : id;
  const i = IND_BY[id]; if (i) return i.responsable || 'Por confirmar';
  const s = SIN_BY[id]; if (s) { const fs = s.fichas.map(x => FICHA_BY[x]).filter(Boolean).map(f => f.responsable.replace(/\s*\(por confirmar\)/, '')); return (fs[0] || 'Por confirmar') + ' (por confirmar)'; }
  return 'Por confirmar';
}

/* proceso 10.2 por indicador efectivo */
function procsOfIndicator(id) {
  const ids = new Set([id]);
  Object.values(IND_BY).forEach(i => { if (i.alias_sineace === id) ids.add(i.id); });
  const ps = new Set();
  M.rel_proceso_indicador.forEach(([p, i]) => { if (ids.has(i)) ps.add(p); });
  if (SIN_BY[id]) SIN_BY[id].indicadores_proceso.forEach(i => M.rel_proceso_indicador.forEach(([p, ii]) => { if (ii === i) ps.add(p); }));
  return Array.from(ps).sort();
}
const STAND_OF = id => SIN_BY[id] ? SIN_BY[id].estandares : [];

/* ===================== Agregacion: peor indicador ===================== */
function rankOf(code) {
  if (code === 'SD' && S.params.gen.sin_dato_en_agregado === 'Excluye') return 0;
  return ST[code].rank;
}
function worstOf(items) {
  // items: [{code, id, gap, ...}]
  let best = null;
  items.forEach(it => { const r = rankOf(it.code); if (r <= 0) return; if (!best || r > rankOf(best.code) || (r === rankOf(best.code) && (it.gap || 0) > (best.gap || 0))) best = it; });
  if (best) return { code: best.code, item: best };
  const hasDef = items.some(it => it.code === 'DEF');
  const hasOk = items.some(it => it.code === 'OK');
  return { code: hasOk ? 'OK' : (hasDef ? 'DEF' : 'NA'), item: null };
}
const gapOf = st => st.last && st.last.cumpl !== null ? Math.max(0, 100 - st.last.cumpl) : 0;

function aggregateIndicators(esc, ids) {
  const items = ids.filter(id => inScope(esc, effId(id)) || inScope(esc, id)).map(id => {
    const st = status(esc, id);
    return { id, code: st.state, st, gap: gapOf(st) };
  });
  const w = worstOf(items);
  const counts = { CRIT: 0, RIESGO: 0, BAJO: 0, SD: 0, SEG: 0, OK: 0, DEF: 0 };
  items.forEach(i => counts[i.code]++);
  return { items, worst: w, counts };
}

/** actividades del POI de la Facultad que alimentan un proceso del 10.2: ultimo reporte con programacion al corte */
function poiProcItems(pid) {
  const A = poiAll(); const out = [];
  (M.proc_poi || []).filter(r => r[0] === pid).forEach(([, act]) => {
    for (let k = M.poi_reportes.length - 1; k >= 0; k--) {
      const rep = M.poi_reportes[k]; const x = A[rep.anio].lista.find(z => z.act === act && z.prog > 0);
      if (!x) continue;
      const vg = +S.params.gen.banda_poi_verde || 95, rg = +S.params.gen.banda_poi_rojo || 75;
      const code = x.avance >= vg ? 'OK' : x.avance >= rg ? 'RIESGO' : 'CRIT';
      const a = AOI_BY[act];
      out.push({ id: 'POI ' + act, poi: true, act, nombre: a ? a.actividad : act, rep, x, code, gap: Math.max(0, 100 - x.avance), scoped: true,
        st: { state: code, esc: 'FAC', last: { cumpl: x.avance, valor: x.ejec, meta: x.prog, unidad: '', pinfo: { p: rep.etiqueta }, m: { origen: 'Real' } }, desde: null } });
      return;
    }
  });
  return out;
}
function processState(esc, pid) {
  const ids = M.rel_proceso_indicador.filter(r => r[0] === pid).map(r => r[1]);
  let list = ids;
  if (esc === 'FAC') list = ids.filter(i => IND_BY[i] && (IND_BY[i].ambito === 'Facultad' || DB.vis.some(r => r.escuela === 'FAC' && r.indicador === effId(i))));
  const items = list.map(id => {
    const eid = effId(id);
    const scoped = inScope(esc, eid) || inScope(esc, id);
    const st = status(esc, id);
    return { id, eid, code: scoped ? st.state : 'NA', st, gap: gapOf(st), scoped };
  }).filter(i => i.scoped);
  poiProcItems(pid).forEach(i => items.push(i));
  if (!items.length) return { code: 'NA', items: [], counts: {}, worst: { code: 'NA', item: null } };
  const w = worstOf(items);
  const counts = { CRIT: 0, RIESGO: 0, BAJO: 0, SD: 0, SEG: 0, OK: 0, DEF: 0 };
  items.forEach(i => counts[i.code]++);
  return { code: w.code, items, counts, worst: w };
}

/* ===================== Alertas ===================== */
function fillTpl(t, ctx) { return String(t || '').replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined && ctx[k] !== null && ctx[k] !== '') ? ctx[k] : '—'); }
const fmtVal = (v, u) => v === null || v === undefined ? '—' : fmtN(v, 2) + (u === '%' ? ' %' : u && u !== 'por definir' && u !== 'número' ? ' ' + (u === 'años' && Math.abs(v) === 1 ? 'año' : u) : '');
function ruleOf(id) { return S.params.reglas.find(r => r.id === id); }

function buildAlerts() {
  const out = [];
  const gen = S.params.gen;
  const corte = corteDate();
  const add = (reg, o) => {
    const r = ruleOf(reg); if (!r || r.activa === 'No') return;
    const sev = o.sev || r.severidad;
    out.push({ regla: reg, reglaNombre: r.nombre, severidad: sev, ...o, periodo: o.objeto === 'Indicador' ? String((o.ctx && o.ctx.periodo !== undefined && o.ctx.periodo !== '—') ? o.ctx.periodo : '') : (o.anio ? String(o.anio) : ''), que: fillTpl(r.que, o.ctx), porque: fillTpl(r.porque, o.ctx), accion: fillTpl(r.accion, o.ctx) });
  };
  const schoolsWithData = SCH.filter(schoolHasData);
  SCH.forEach(esc => {
    if (!schoolHasData(esc) && enImplementacion(esc)) {
      add('R10', { escuela: esc, objeto: 'Escuela', objetoId: esc, objetoNombre: ESC_BY[esc].nombre, desde: null, desdeTxt: 'Sin archivo de carga', responsable: 'Dirección de la escuela y coordinación de calidad (por confirmar)', ctx: { escuela: ESC_BY[esc].nombre } });
    }
  });
  ORD.forEach(esc => {
    if (esc !== 'FAC' && !schoolHasData(esc)) return;
    // R11 filas sin fuente
    const rej = DB.rejected.filter(r => r.escuela === esc && r.motivo && r.motivo.startsWith('Sin fuente'));
    if (rej.length) add('R11', { escuela: esc, objeto: 'Carga', objetoId: esc, objetoNombre: `${rej.length} fila(s) sin fuente`, desde: parseISO(rej[0].fecha_carga), desdeTxt: rej[0].fecha_carga ? fmtDate(parseISO(rej[0].fecha_carga)) : '—', responsable: 'Responsable de carga de la escuela', ctx: { n: rej.length, escuela: ESC_BY[esc].nombre } });
    scopeList(esc).forEach(c => {
      const st = status(esc, c.id);
      const nm = c.nombre;
      const label = `${c.id} ${nm}`;
      const respo = responsableOf(esc, c.id);
      const ctx0 = { indicador: label, escuela: ESC_BY[esc].nombre, frecuencia: st.freq.toLowerCase(), gracia: gen.dias_gracia, periodo_esperado: st.expLabel };
      const base = { escuela: esc, objeto: 'Indicador', objetoId: c.id, objetoNombre: nm, responsable: respo, proceso: procsOfIndicator(effId(c.id)) };
      if (!st.last) {
        if (st.expEnd && enImplementacion(esc)) add('R03', { ...base, desde: addDays(st.expEnd, +gen.dias_gracia || 0), desdeTxt: `vencido el ${fmtDate(addDays(st.expEnd, +gen.dias_gracia || 0))}`, ctx: ctx0 });
        return;
      }
      const L = st.last;
      const ctx = { ...ctx0, valor: fmtVal(L.valor, L.unidad), meta: L.meta !== null ? fmtVal(L.meta, L.unidad) : '—', esperado_txt: L.meta !== null ? L.espTxt : 'una meta por definir', cumpl: L.cumpl !== null ? fmtN(L.cumpl, 1) : '—', periodo: L.pinfo.p, desde: st.overdueSince ? fmtDate(st.overdueSince) : '—', sentido: st.mi.sentido.toLowerCase(), verde_min: L.bands ? L.bands.verde : '—', rojo_min: L.bands ? L.bands.rojo : '—', base_txt: L.bands && L.bands.base === 'valor' ? '% de avance' : '% de la meta', fuente_umbral: L.bandsSrc || 'los parámetros', estado_validacion: L.m.estado_val, n: st.tendencia ? st.tendencia.n : '', serie: st.tendencia ? st.tendencia.serie : '' };
      const dsd = st.desde ? `desde el periodo ${st.desdePeriodo} (${fmtDate(st.desde)})` : '';
      const exTag = L.m.origen === 'EJEMPLO';
      if (st.state === 'CRIT') add('R01', { ...base, desde: st.desde, desdeTxt: dsd, ctx, ejemplo: exTag });
      if (st.state === 'RIESGO') add('R02', { ...base, desde: st.desde, desdeTxt: dsd, ctx, ejemplo: exTag });
      if (st.state === 'BAJO') add('R09', { ...base, desde: st.desde, desdeTxt: dsd, ctx, ejemplo: exTag });
      if (st.vencido) add('R04', { ...base, desde: st.overdueSince, desdeTxt: st.overdueSince ? `plazo vencido el ${fmtDate(st.overdueSince)}` : '', ctx, ejemplo: exTag });
      if (st.tendencia) add('R05', { ...base, desde: st.sr.ev[st.sr.ev.length - 1 - st.tendencia.n].pinfo.end, desdeTxt: `desde el periodo ${st.sr.ev[st.sr.ev.length - 1 - st.tendencia.n].pinfo.p}`, ctx, ejemplo: exTag });
      if (gen.evidencia_obligatoria !== 'No' && !(L.m.ev || L.m.ev_ref)) add('R06', { ...base, desde: parseISO(L.m.fecha_carga) || L.pinfo.end, desdeTxt: `cargado el ${L.m.fecha_carga ? fmtDate(parseISO(L.m.fecha_carga)) : '—'}`, ctx, ejemplo: exTag });
      if (!['Validado', 'Dato de reporte'].includes(L.m.estado_val)) add('R07', { ...base, desde: parseISO(L.m.fecha_carga) || L.pinfo.end, desdeTxt: `cargado el ${L.m.fecha_carga ? fmtDate(parseISO(L.m.fecha_carga)) : '—'}`, ctx, ejemplo: exTag });
    });
  });
  // R08 POI
  const A = poiAll();
  const anios = (gen.poi_evaluar === 'Todos') ? M.poi_reportes.map(r => r.anio) : [M.poi_reportes[M.poi_reportes.length - 1].anio];
  const vg = +gen.banda_poi_verde || 95, rg = +gen.banda_poi_rojo || 75;
  anios.forEach(an => {
    const rep = A[an].rep;
    A[an].conProg.forEach(x => {
      if (x.avance >= vg) return;
      const a = AOI_BY[x.act];
      // desde: primer mes de la racha final por debajo del limite verde
      let desdeMes = null;
      for (let i = x.acum.length - 1; i >= 0; i--) { const z = x.acum[i]; if (z.mes > rep.mes_corte) continue; if (z.prog > 0 && Math.min(100, z.ejec / z.prog * 100) < vg) desdeMes = z.mes; else if (z.prog > 0) break; }
      const ctx = { aoi: x.aoi, actividad: a ? a.actividad : x.act, avance: fmtN(x.avance, 1), corte: rep.etiqueta, ejec: fmtN(x.ejec, 0), prog: fmtN(x.prog, 0), verde_min: vg, rojo_min: rg };
      add('R08', { escuela: 'FAC', objeto: 'AOI', objetoId: x.act, objetoNombre: `${x.aoi} · ${a ? a.actividad : ''}`, sev: x.avance < rg ? 'Crítica' : 'En riesgo', desde: desdeMes ? dUTC(an, desdeMes, 1) : null, desdeTxt: desdeMes ? `desde ${fmtMonth(dUTC(an, desdeMes, 1))}` : '', responsable: 'UPPR y responsable de la actividad (por confirmar); compartida por la Facultad', proceso: [], ctx, poi: true, anio: an });
    });
  });
  // R12 y R13: autoevaluacion por criterio (Consolidado de autoevaluacion)
  Object.values(S.autoeval || {}).forEach(ae => {
    const base = c => ({ escuela: ae.escuela, objeto: 'Criterio', objetoId: c.criterio, objetoNombre: `${c.criterio} ${c.resumen}`, responsable: 'Responsable del estándar ' + c.estandar.replace('E', '') + ' y Comité de Calidad de la escuela (por confirmar)', proceso: [], desde: null, desdeTxt: 'Consolidado ' + (ae.fabrica ? 'incluido de fábrica' : 'cargado ' + ae.cargadoEn.slice(0, 10)), estandarSel: c.estandar });
    ae.criterios.forEach(c => {
      if (c.evSin.length) add('R12', { ...base(c), ctx: { criterio: c.criterio, estandar: c.estandar, escuela: ESC_BY[ae.escuela].nombre, n_sin: c.evSin.length, n_exig: Math.max(c.evExig.length, c.evSin.length), evidencias: c.evSin.join(', '), ref: c.ref, valoracion: c.valoracion } });
      const pm = c.matrices.filter(x => /pendiente/i.test(x.estado));
      if (pm.length) { const nom = n => { const x = ae.matrices.find(y => y.n === n); return `M${n}${x ? ' ' + x.matriz.slice(0, 60) + (x.matriz.length > 60 ? '…' : '') : ''}`; };
        add('R13', { ...base(c), ctx: { criterio: c.criterio, estandar: c.estandar, escuela: ESC_BY[ae.escuela].nombre, n_pend_crit: pm.length, matriz: pm.map(x => nom(x.n)).join('; '), ref: ae.matrices.find(y => y.n === pm[0].n)?.ref || c.ref, n_pend: ae.nPend, n_mat: ae.nMat } }); }
    });
  });
  // R14: estandares sin indicadores del modelo (E10): evidencias exigidas sin disponibilidad
  M.estandares.filter(e => !M.sineace.some(x => x.estandares.includes(e.id))).forEach(e => {
    SCH.filter(enImplementacion).forEach(esc => {
      const r = evFaltantes(esc, e.id); if (!r.falt.length) return;
      add('R14', { escuela: esc, objeto: 'Estándar', objetoId: e.id, objetoNombre: `${e.id} ${e.nombre} (${r.evs[0]}–${r.evs[r.evs.length - 1]})`, responsable: 'Responsable del estándar ' + e.id.replace('E', '') + ' y Comité de Calidad de la escuela (por confirmar)', proceso: [], desde: null, desdeTxt: 'Hasta que se cargue la hoja Evidencias', estandarSel: e.id, ejemplo: r.ejemplo,
        ctx: { estandar: e.id + ' · ' + e.nombre, escuela: ESC_BY[esc].nombre, n_sin: r.falt.length, n_exig: r.evs.length, evidencias: r.falt.join(', '), nproc: M.procesos102.length } });
    });
  });
  // IDs y orden
  out.forEach((a, i) => { a.uid = `${a.regla}|${a.escuela}|${a.objetoId}|${a.anio || ''}`; });
  out.sort(cmpAlert);
  return out;
}

// orden de las alertas: escuela (Enfermería, Obstetricia, Tecnología Médica, Facultad) > gravedad > indicador > periodo
function natKey(id) { return String(id || '').replace(/\d+/g, m => m.padStart(4, '0')); }
function cmpAlert(a, b) {
  return ORD.indexOf(a.escuela) - ORD.indexOf(b.escuela)
    || (SEV[b.severidad]?.rank || 0) - (SEV[a.severidad]?.rank || 0)
    || natKey(a.objetoId).localeCompare(natKey(b.objetoId))
    || String(a.periodo || '').localeCompare(String(b.periodo || ''))
    || ((a.desde ? a.desde.getTime() : 9e15) - (b.desde ? b.desde.getTime() : 9e15))
    || String(a.regla).localeCompare(String(b.regla));
}
let ALERTS = [];
function recompute() {
  buildDB();
  DB.v = (DB.v || 0) + 1;
  _sc.clear();
  DB.v = Date.now() + Math.random();
  _sc.clear();
  ALERTS = buildAlerts();
}

/* ===================== Lectura de archivos Excel ===================== */
function serialToISO(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') { if (v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return isoD(d); } return String(v); }
  if (v instanceof Date) return isoD(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  const m2 = String(v).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if (m2) return `${m2[3]}-${pad2(+m2[2])}-${pad2(+m2[1])}`;
  return String(v);
}
function tableFrom(ws, key) {
  if (!ws) return null;
  const a = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  let hi = -1;
  for (let i = 0; i < Math.min(a.length, 15); i++) if (a[i] && a[i].some(c => String(c ?? '').trim() === key)) { hi = i; break; }
  if (hi < 0) return null;
  const head = a[hi].map(c => String(c ?? '').trim());
  const rows = [];
  for (let i = hi + 1; i < a.length; i++) {
    const r = a[i]; if (!r || r.every(c => c === null || c === '')) continue;
    const o = {}; head.forEach((h, j) => { if (h) o[h] = r[j] === undefined ? null : r[j]; });
    rows.push(o);
  }
  return { head, rows };
}

/* ===================== Consolidado de autoevaluacion (por criterio) ===================== */
S.autoeval = {};
const evNum = t => { const m = String(t ?? '').match(/EV\s*(\d+)/); return m ? +m[1] : null; };
/** Lista de EV de un texto; expande rangos tipo «EV40 – EV44» */
function evList(t) {
  const s = String(t ?? ''); const out = new Set();
  const re = /EV\s*(\d+)(?:\s*[–-]\s*EV\s*(\d+))?/g; let m;
  while ((m = re.exec(s))) { const a = +m[1], b = m[2] ? +m[2] : a; for (let k = a; k <= b; k++) out.add('EV' + k); }
  return Array.from(out);
}
function grid(ws) { return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true }) : []; }
const cellS = v => v === null || v === undefined ? '' : String(v).trim();
/** Lee un libro con las hojas Consolidado y Matrices (y, si las trae, Indicadores) */
function parseConsolidado(wb, fname) {
  const rec = { name: fname, tipo: 'Consolidado', escuela: '', criterios: [], matrices: [], indicadores: [], warns: [], errors: [], cargadoEn: new Date().toISOString().slice(0, 19).replace('T', ' ') };
  const title = cellS((grid(wb.Sheets.Consolidado)[0] || [])[0]) + ' ' + cellS((grid(wb.Sheets.Consolidado)[1] || [])[0]);
  rec.escuela = /EPTM|Tecnolog/i.test(title + fname) ? 'TM' : /Enfermer|EPE/i.test(title + fname) ? 'ENF' : /Obstetric/i.test(title + fname) ? 'OBS' : '';
  if (!rec.escuela) rec.errors.push('No reconozco la escuela del Consolidado (esperaba EPTM, Enfermería u Obstetricia en el título o en el nombre del archivo).');
  // matrices
  const gm = grid(wb.Sheets.Matrices); let hm = gm.findIndex(r => r && cellS(r[0]) === 'N.º' && cellS(r[2]) === 'Matriz');
  if (hm < 0) rec.errors.push('Hoja Matrices: no encuentro los encabezados (N.º, Matriz).');
  else for (let i = hm + 1; i < gm.length; i++) { const r = gm[i]; const n = parseInt(cellS(r && r[0]), 10); if (!n || !r[2]) continue; rec.matrices.push({ n, bloque: cellS(r[1]), matriz: cellS(r[2]), criterios: cellS(r[3]).split(/[,;]\s*/).filter(Boolean), estado: cellS(r[4]), detalle: cellS(r[5]), ref: `Consolidado, hoja Matrices, fila ${i + 1}` }); }
  // criterios
  const gc = grid(wb.Sheets.Consolidado); const hc = gc.findIndex(r => r && cellS(r[0]) === 'N.º estándar');
  if (hc < 0) rec.errors.push('Hoja Consolidado: no encuentro los encabezados (N.º estándar).');
  else for (let i = hc + 1; i < gc.length; i++) {
    const r = gc[i]; const c = cellS(r && r[2]); if (!/^\d+\.\d+$/.test(c)) continue;
    const mats = []; const re = /M(\d+)\s*\((\w+)\)/g; let m; const ht = cellS(r[7]); while ((m = re.exec(ht))) mats.push({ n: +m[1], estado: m[2] });
    rec.criterios.push({ estandar: 'E' + cellS(r[0]), criterio: c, resumen: cellS(r[3]), evExig: evList(r[4]), indicadoresGuia: cellS(r[5]), docs: cellS(r[6]), matrices: mats, valoracion: cellS(r[8]), nCitadas: +r[9] || 0, nEnlace: +r[10] || 0, evSin: evList(r[11]), debil: cellS(r[12]) === '—' ? '' : cellS(r[12]), falta: cellS(r[14]), prioridad: cellS(r[15]), ref: `Consolidado, hoja Consolidado, fila ${i + 1}` });
  }
  // la hoja Matrices manda para el estado de cada matriz
  const pend = new Map(rec.matrices.map(x => [x.n, x.estado]));
  rec.criterios.forEach(c => c.matrices.forEach(x => { if (pend.has(x.n)) x.estado = pend.get(x.n); }));
  // indicadores (valores del informe: sin dato validado)
  const gi = grid(wb.Sheets.Indicadores); const hi = gi.findIndex(r => r && cellS(r[0]) === 'ID');
  if (hi >= 0) for (let i = hi + 1; i < gi.length; i++) {
    const r = gi[i]; const id = cellS(r && r[0]).replace(/^ID0*(\d+)$/, 'ID$1'); if (!SIN_BY[id]) continue;
    rec.indicadores.push({ id, referencial: num(r[2]), valor: num(r[3]), estadoRef: cellS(r[4]), criteriosGuia: cellS(r[5]), evGuia: cellS(r[6]), variables: cellS(r[7]), obs: cellS(r[8]), ref: `Consolidado, hoja Indicadores, fila ${i + 1}` });
  }
  if (rec.escuela && !rec.criterios.length) rec.errors.push('No se leyó ningún criterio.');
  const nP = rec.matrices.filter(x => /pendiente/i.test(x.estado)).length;
  rec.nPend = nP; rec.nMat = rec.matrices.length;
  return rec;
}
function setAutoeval(rec) { if (rec.escuela && !rec.errors.length) S.autoeval[rec.escuela] = rec; }

/** Hojas Criterios y Valores_informe de la plantilla de carga: autoevaluacion de la escuela. Sin nada llenado no devuelve nada (no pisa un Consolidado ya leido). */
function parseCriteriosSheets(wb, f) {
  const tcr = tableFrom(wb.Sheets.Criterios, 'criterio'); const tvi = tableFrom(wb.Sheets.Valores_informe, 'indicador_id');
  if (!f.escuela || f.escuela === 'FAC' || (!tcr && !tvi)) return null;
  const rec = { name: f.name, tipo: 'Plantilla de carga', escuela: f.escuela, criterios: [], matrices: [], indicadores: [], warns: [], errors: [], cargadoEn: f.cargadoEn, nPend: 0, nMat: '' };
  let llenado = false;
  if (tcr) tcr.rows.forEach(r => {
    const c = cellS(r.criterio); if (!/^\d+\.\d+$/.test(c)) return;
    const val = cellS(r.valoracion_informe); const evSin = evList(r.ev_exigidas_sin_citar);
    const mats = (cellS(r.matrices_pendientes).match(/M\d+/g) || []).map(x => ({ n: +x.slice(1), estado: 'Pendiente' }));
    if ((val && !/^sin dato$/i.test(val)) || evSin.length || mats.length || cellS(r.prioridad) || cellS(r.evidencia_que_falta) || num(r.evidencias_citadas) !== null) llenado = true;
    rec.criterios.push({ estandar: cellS(r.estandar) || 'E' + c.split('.')[0], criterio: c, resumen: cellS(r.resumen), evExig: evList(r.ev_exigidas), indicadoresGuia: '', docs: '', matrices: mats, valoracion: /^sin dato$/i.test(val) ? '' : val, nCitadas: num(r.evidencias_citadas) ?? '', nEnlace: num(r.con_enlace) ?? '', evSin, debil: '', falta: cellS(r.evidencia_que_falta), prioridad: cellS(r.prioridad), ref: `${f.name}, hoja Criterios, criterio ${c}` });
  });
  if (tvi) tvi.rows.forEach(r => {
    const id = cellS(r.indicador_id).replace(/^ID0*(\d+)$/, 'ID$1'); if (!SIN_BY[id]) return;
    const v = num(r.valor_informe); if (v === null && !cellS(r.estado_que_declara_el_informe) && !cellS(r.calculo)) return;
    llenado = true; const k = SIN_BY[id].unidad === '%' ? 100 : 1; const rf = num(r.referencial_en_informe);
    rec.indicadores.push({ id, referencial: rf === null ? null : rf / k, valor: v === null ? null : v / k, estadoRef: cellS(r.estado_que_declara_el_informe), criteriosGuia: '', evGuia: '', variables: cellS(r.calculo), obs: cellS(r.observacion), ref: `${f.name}, hoja Valores_informe, ${id}` });
  });
  rec.nPend = new Set(rec.criterios.flatMap(c => c.matrices.map(m => m.n))).size;
  return llenado ? rec : null;
}

function parseWorkbookFile(buf, fname) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const f = { name: fname, escuela: '', version: '', rows: [], evid: [], alcance: null, respLocal: null, params: null, warns: [], errors: [], ignoradas: 0, nFilas: 0, ejemplo: false, cargadoEn: new Date().toISOString().slice(0, 19).replace('T', ' ') };
  f.soloParams = !wb.Sheets.Portada && !wb.Sheets.Carga_Indicadores && !!wb.Sheets.Parametros;
  if (!f.soloParams) ['Portada', 'Carga_Indicadores'].forEach(n => { if (!wb.Sheets[n]) f.errors.push(`Falta la hoja ${n}: no parece la plantilla de carga.`); });
  // Portada
  if (wb.Sheets.Portada) {
    const t = tableFrom(wb.Sheets.Portada, 'campo');
    const kv = {}; if (t) t.rows.forEach(r => kv[String(r.campo ?? '').trim()] = r.valor);
    f.version = String(kv.version_plantilla ?? '').trim();
    f.escuela = String(kv.escuela_id ?? '').trim().toUpperCase();
    f.responsable = String(kv.responsable_calidad ?? '').trim();
    f.entrega = serialToISO(kv.fecha_entrega);
    if (!ESC_BY[f.escuela]) f.errors.push('Portada: escuela_id vacío o inválido (TM, ENF, OBS o FAC).');
    if (f.version && f.version.split('.')[0] !== '0') f.warns.push(`Versión de plantilla ${f.version}: este tablero espera 0.x.`);
    if (!f.version) f.warns.push('Portada sin version_plantilla.');
  }
  if (f.errors.length && !ESC_BY[f.escuela] && !f.soloParams) return f;
  // Carga
  const tc = tableFrom(wb.Sheets.Carga_Indicadores, 'indicador_id');
  if (tc) {
    tc.rows.forEach(r => {
      if (r.indicador_id === null || String(r.indicador_id).trim() === '') return;
      f.nFilas++;
      const per = String(r.periodo ?? '').trim();
      const o = normRow({ periodo: per, escuela: f.escuela, area: r.area_id, indicador: r.indicador_id, numerador: r.numerador, denominador: r.denominador, valor: r.valor_directo, meta_propuesta: r.meta_propuesta, fuente_meta: r.fuente_meta, esperado: r.esperado_a_fecha, fuente_esperado: r.fuente_esperado, fuente_dato: r.fuente_dato, evidencia_ev: r.evidencia_ev, evidencia_ref: r.evidencia_ref, responsable_carga: r.responsable_carga, fecha_carga: serialToISO(r.fecha_carga), estado_validacion: r.estado_validacion, validado_por: r.validado_por, fecha_validacion: serialToISO(r.fecha_validacion), version_dato: r.version_dato, observacion: r.observacion, origen: r.origen }, fname);
      o.fila = f.nFilas;
      if (!CARG_BY[o.indicador] && !IND_BY[o.indicador]) { f.warns.push(`Fila con indicador desconocido «${o.indicador}»: ignorada.`); f.ignoradas++; return; }
      if (o.area && f.escuela === 'TM' && !TM_AREAS.includes(o.area)) f.warns.push(`Área «${o.area}» no reconocida en Tecnología Médica: se usa tal cual; revisa el nombre.`);
      f.rows.push(o);
    });
    f.ejemplo = f.rows.length > 0 && f.rows.every(r => r.origen === 'EJEMPLO');
  } else if (wb.Sheets.Carga_Indicadores) f.errors.push('Carga_Indicadores: no encuentro la fila de encabezados (indicador_id).');
  // Evidencias
  const te = tableFrom(wb.Sheets.Evidencias, 'ev_id');
  if (te) te.rows.forEach(r => { if (!r.ev_id || !r.estado) return; f.evid.push({ escuela: f.escuela, area: normArea(r.area_id), ev: String(r.ev_id).trim(), estado: String(r.estado).trim(), ubicacion: String(r.ubicacion ?? ''), responsable: String(r.responsable ?? ''), fecha: serialToISO(r.fecha_actualizacion), observacion: String(r.observacion ?? ''), origen: String(r.origen ?? '') === 'EJEMPLO' ? 'EJEMPLO' : 'Real' }); });
  // Alcance
  const ta = tableFrom(wb.Sheets.Alcance, 'en_seguimiento');
  if (ta) { f.alcance = {}; f.respLocal = {}; ta.rows.forEach(r => { if (!r.indicador_id) return; const k = String(r.indicador_id).trim(); f.alcance[k] = String(r.en_seguimiento ?? '').trim(); if (r.responsable_local) f.respLocal[k] = String(r.responsable_local); }); }
  // Parametros
  const tp = tableFrom(wb.Sheets.Parametros, 'clave');
  if (tp) {
    const gen = {}; tp.rows.forEach(r => { if (r.clave) gen[String(r.clave).trim()] = r.valor; });
    const tr = tableFrom(wb.Sheets.Reglas_alertas, 'regla_id');
    const tm = tableFrom(wb.Sheets.Metas_Umbrales, 'indicador_id');
    f.params = { gen, fecha: serialToISO(gen.fecha_parametros), version: String(gen.version_parametros ?? ''), reglas: tr ? tr.rows.filter(r => r.regla_id).map(r => ({ id: String(r.regla_id).trim(), nombre: String(r.nombre ?? ''), activa: String(r.activa ?? 'Sí').trim(), severidad: String(r['severidad'] ?? 'Aviso').trim(), condicion: String(r['condición (resumen)'] ?? ''), que: String(r['qué ocurre'] ?? ''), porque: String(r['por qué'] ?? ''), accion: String(r['decisión o acción sugerida'] ?? '') })) : null, metas: null };
    if (tm) {
      const metas = {};
      tm.rows.forEach(r => {
        if (!r.indicador_id) return; const k = String(r.indicador_id).trim();
        (metas[k] = metas[k] || []).push({ desde: num(r.desde_anio) ?? 0, meta: num(r.meta), sentido: String(r.sentido ?? 'Por definir').trim(), unidad: String(r.unidad ?? 'por definir').trim(), fuente_meta: String(r.fuente_meta ?? ''), estado_meta: String(r.estado_meta ?? 'Por definir').trim(), verde_min: num(r.verde_min_pct), rojo_min: num(r.rojo_min_pct), base: String(r.base_umbral ?? 'cumplimiento').trim() || 'cumplimiento', avance: String(r.tipo_avance ?? 'Puntual').trim() || 'Puntual', regla: reglaKey(r.regla_cumplimiento), fuente_umbral: String(r.fuente_umbral ?? ''), nota: String(r.nota ?? '') });
      });
      // meta sin fuente se ignora
      Object.values(metas).forEach(rows => rows.forEach(m => { if (m.meta !== null && !m.fuente_meta) { m.meta = null; m.estado_meta = 'Por confirmar'; f.warns.push('Una meta sin fuente_meta en Metas_Umbrales se ignoró.'); } }));
      f.params.metas = metas;
    }
  }
  f.warns = uniq(f.warns);
  try { f.autoeval = parseCriteriosSheets(wb, f); } catch (e) { f.warns.push('Hojas Criterios o Valores_informe: no se pudieron leer (' + e.message + ').'); }
  return f;
}
function applyParamsFrom(files) {
  // adopta la hoja de parametros con fecha mas reciente (si es mas nueva que la actual)
  let best = null;
  files.forEach(f => { if (f.params && f.params.fecha && (!best || f.params.fecha > best.params.fecha)) best = f; });
  const cur = S.params.fecha || '';
  if (best && (best.params.fecha > cur || (best.params.fecha === cur && /^Por defecto|^Editados/.test(S.params.origen)))) {
    const p = best.params;
    const n = clone(S.params);
    Object.keys(p.gen).forEach(k => { if (p.gen[k] !== null && p.gen[k] !== undefined) n.gen[k] = (k === 'fecha_corte' || k === 'fecha_parametros') ? serialToISO(p.gen[k]) : p.gen[k]; });
    if (p.reglas && p.reglas.length) n.reglas = p.reglas;
    if (p.metas) Object.keys(p.metas).forEach(k => { n.metas[k] = p.metas[k]; });
    n.origen = `Archivo ${best.name} (${p.version || 's/v'}, ${p.fecha})`;
    n.fecha = p.fecha;
    S.params = n;
    return `Parámetros tomados de ${best.name} (fecha ${p.fecha}).`;
  }
  const diffs = files.filter(f => f.params && f.params.fecha && f.params.fecha !== cur);
  return diffs.length ? 'Los parámetros de los archivos no son más recientes que los activos; se mantienen los activos.' : '';
}
async function loadFiles(fileList) {
  const msgs = [];
  for (const file of Array.from(fileList)) {
    try {
      if (!/\.xlsx?$/i.test(file.name)) { msgs.push(`${file.name}: no es un archivo Excel.`); continue; }
      const buf = await file.arrayBuffer();
      const wbx = XLSX.read(buf, { type: 'array', cellDates: false });
      if (wbx.Sheets.Consolidado && wbx.Sheets.Matrices) {
        const ae = parseConsolidado(wbx, file.name);
        if (ae.errors.length) { msgs.push(`${file.name}: ${ae.errors.join(' ')}`); continue; }
        setAutoeval(ae);
        msgs.push(`${file.name}: Consolidado de autoevaluación leído (${ae.criterios.length} criterios, ${ae.nPend} de ${ae.nMat} matrices pendientes, ${ae.indicadores.length} valores de indicadores sin validar).`);
        continue;
      }
      const rec = parseWorkbookFile(buf, file.name);
      S.files = S.files.filter(x => x.name !== rec.name);
      S.files.push(rec);
      if (rec.autoeval && !rec.errors.length) { setAutoeval(rec.autoeval); msgs.push(`${file.name}: autoevaluación de la escuela leída (${rec.autoeval.criterios.length} criterios y ${rec.autoeval.indicadores.length} valores del informe, solo referencia).`); }
      msgs.push(`${file.name}: ${rec.errors.length ? 'con errores' : 'leído'} (${rec.rows.length} mediciones${rec.escuela ? ', ' + rec.escuela : ''}).`);
    } catch (e) { msgs.push(`${file.name}: no se pudo leer (${e.message}).`); }
  }
  const pm = applyParamsFrom(S.files); if (pm) msgs.push(pm);
  if (!S.ejemplo && S.files.some(f => f.ejemplo && f.rows.length) && !S.files.some(f => !f.ejemplo && f.rows.length)) { S.ejemplo = true; msgs.push('Se encendió el interruptor de datos EJEMPLO porque cargaste archivos de ejemplo.'); }
  const real = S.files.some(f => !f.ejemplo && f.rows.length);
  if (real && S.ejemplo) { S.ejemplo = false; msgs.push('Se apagaron los datos EJEMPLO porque cargaste datos reales. Puedes volver a encenderlos con el interruptor.'); }
  recompute();
  return msgs;
}
/** Filas de evidencia por escuela, area y EV. modo 'EJ' = solo las de EJEMPLO, 'REAL' = solo las cargadas por archivo, sin modo = ambas (la real prevalece) */
function evidenceRows(modo) {
  const all = [];
  if (S.ejemplo) EXJ.evidencias.forEach(e => all.push({ ...e, origen: 'EJEMPLO' }));
  S.files.forEach(f => f.evid.forEach(e => all.push(e)));
  const map = new Map();
  all.filter(e => (S.ejemplo || e.origen !== 'EJEMPLO') && (modo === 'EJ' ? e.origen === 'EJEMPLO' : modo === 'REAL' ? e.origen !== 'EJEMPLO' : true)).forEach(e => map.set([e.escuela, e.area, e.ev].join('|'), e));
  return Array.from(map.values());
}
const EV_OK = r => r.estado === 'Validada' || r.estado === 'Disponible';
/** Evidencias de un estandar sin disponibilidad en una escuela (todas sus areas); las 'No aplica' no se exigen */
function evFaltantes(esc, std) {
  const evs = M.evidencias.filter(e => e.estandar === std).map(e => e.id);
  const areas = esc === 'TM' ? TM_AREAS : [''];
  const rows = evidenceRows(); const by = new Map(rows.map(r => [r.escuela + '|' + r.area + '|' + r.ev, r]));
  const falt = []; let ejemplo = false;
  evs.forEach(ev => {
    const rs = areas.map(a => by.get(esc + '|' + a + '|' + ev));
    rs.forEach(r => { if (r && r.origen === 'EJEMPLO') ejemplo = true; });
    if (rs.some(r => !r || (!EV_OK(r) && r.estado !== 'No aplica'))) falt.push(ev);
  });
  return { evs, falt, ejemplo };
}

/* ===================== Graficos SVG accesibles ===================== */
const SERIES = { ENF: { cls: 's2', shape: 'square', name: 'Enfermería' }, OBS: { cls: 's3', shape: 'triangle', name: 'Obstetricia' }, TM: { cls: 's1', shape: 'circle', name: 'Tec. Médica' }, FAC: { cls: 's4', shape: 'diamond', name: 'Facultad' } };
const NS = 'http://www.w3.org/2000/svg';
function h(tag, attrs = {}, kids = []) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => { if (v !== null && v !== undefined) e.setAttribute(k, v); });
  (Array.isArray(kids) ? kids : [kids]).forEach(c => { if (c === null || c === undefined) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return e;
}
function niceScale(min, max, n = 5) {
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (min === max) { max = min + 1; }
  const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag, step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10));
  return { lo, hi, ticks: t };
}
function marker(shape, x, y, r, cls, extra = {}) {
  const a = { class: cls, ...extra };
  if (shape === 'square') return h('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: 1.5, ...a });
  if (shape === 'triangle') return h('path', { d: `M${x},${y - r * 1.2} L${x + r * 1.1},${y + r * .9} L${x - r * 1.1},${y + r * .9} Z`, ...a });
  if (shape === 'diamond') return h('path', { d: `M${x},${y - r * 1.3} L${x + r * 1.2},${y} L${x},${y + r * 1.3} L${x - r * 1.2},${y} Z`, ...a });
  return h('circle', { cx: x, cy: y, r, ...a });
}
/* tooltip global */
let TIP = null;
function tipEl() { if (!TIP) { TIP = document.createElement('div'); TIP.className = 'tip'; TIP.setAttribute('role', 'tooltip'); TIP.hidden = true; document.body.append(TIP); } return TIP; }
function showTip(html, x, y) { const t = tipEl(); t.innerHTML = html; t.hidden = false; const r = t.getBoundingClientRect(); let l = x + 14, tp = y + 14; if (l + r.width > innerWidth - 8) l = x - r.width - 14; if (tp + r.height > innerHeight - 8) tp = y - r.height - 14; t.style.left = Math.max(8, l) + 'px'; t.style.top = Math.max(8, tp) + 'px'; }
function hideTip() { if (TIP) TIP.hidden = true; }
function bindTip(el, htmlFn) {
  el.addEventListener('mousemove', e => showTip(htmlFn(), e.clientX, e.clientY));
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); showTip(htmlFn(), r.left + r.width / 2, r.top + r.height / 2); });
  el.addEventListener('blur', hideTip);
}
const exBadge = '<span class="exb">EJEMPLO</span>';

/* contenedor con titulo, descripcion, boton tabla */
function chartBox(title, desc, opts = {}) {
  const box = document.createElement('figure');
  box.className = 'chart';
  const head = document.createElement('figcaption');
  head.innerHTML = `<div><h4>${esc(title)}</h4>${desc ? `<p class="muted small">${esc(desc)}</p>` : ''}</div>`;
  const body = document.createElement('div'); body.className = 'chart-body';
  const tbl = document.createElement('div'); tbl.className = 'chart-table'; tbl.hidden = true;
  const btn = document.createElement('button'); btn.className = 'btn ghost small'; btn.type = 'button'; btn.textContent = 'Ver como tabla'; btn.setAttribute('aria-pressed', 'false');
  btn.onclick = () => { const on = tbl.hidden; tbl.hidden = !on; body.hidden = on; btn.textContent = on ? 'Ver como gráfico' : 'Ver como tabla'; btn.setAttribute('aria-pressed', String(on)); };
  head.append(btn);
  box.append(head, body, tbl);
  if (opts.legend) box.append(opts.legend);
  box.setTable = (cols, rows) => {
    tbl.innerHTML = `<table class="tbl"><caption class="sr">${esc(title)}</caption><thead><tr>${cols.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  };
  box.body = body;
  return box;
}
function legendFor(items) {
  const d = document.createElement('div'); d.className = 'legend';
  d.innerHTML = items.map(it => `<span class="lg"><svg width="26" height="14" aria-hidden="true">${it.line ? `<line x1="1" y1="7" x2="25" y2="7" class="${it.cls}" ${it.dash ? `stroke-dasharray="${it.dash}"` : ''} stroke-width="2.2"/>` : ''}${it.shape ? marker(it.shape, 13, 7, 4.5, it.cls).outerHTML : ''}</svg>${esc(it.label)}</span>`).join('');
  return d;
}

/* ---- Tendencia: lineas por escuela, meta dorada punteada y bandas de umbral ---- */
const refLabel = e => e && e.espFuente ? 'Esperado' : 'Meta';
function trendChart(seriesList, opts = {}) {
  // seriesList: [{esc, st}] con st = status(); opts.unit
  const W = 820, H = 330, m = { l: 54, r: 150, t: 18, b: 56 };
  const labs = [];
  const cats = uniq(seriesList.flatMap(s => s.st.sr.ev.map(e => e.pinfo.p))).map(p => periodInfo(p)).sort((a, b) => a.end - b.end);
  const box = chartBox(opts.title || 'Tendencia por periodo', opts.desc || 'Cada línea es una escuela. La línea dorada punteada es la meta; las bandas muestran los umbrales cuando tienen fuente.', { legend: null });
  if (!cats.length) { box.body.innerHTML = '<p class="empty">Sin datos con fuente para este indicador. Carga la plantilla de la escuela o activa los datos EJEMPLO.</p>'; box.setTable(['Periodo'], []); return box; }
  const unit = opts.unit || '';
  const vals = seriesList.flatMap(s => s.st.sr.ev.map(e => e.valor)).concat(seriesList.flatMap(s => s.st.sr.ev.map(e => e.ref)).filter(v => v !== null));
  const bandVals = [];
  const first = seriesList[0].st.sr.ev;
  const bandAt = (ev) => {
    if (!ev.bands || ev.ref === null || ev.bands.base === 'valor') { if (ev.bands && ev.bands.base === 'valor') return { v: ev.bands.verde, r: ev.bands.rojo }; return null; }
    const menor = ev.sentido === 'Menor es mejor';
    return menor ? { v: ev.ref / (ev.bands.verde / 100), r: ev.ref / (ev.bands.rojo / 100) } : { v: ev.ref * ev.bands.verde / 100, r: ev.ref * ev.bands.rojo / 100 };
  };
  let anyBands = false;
  seriesList.forEach(s => s.st.sr.ev.forEach(e => { const b = bandAt(e); if (b) { anyBands = true; bandVals.push(b.v, b.r); } }));
  const all = vals.concat(bandVals);
  let ymin = Math.min(...all), ymax = Math.max(...all);
  const pad = (ymax - ymin) * 0.12 || 5; ymin = unit === '%' ? Math.max(0, ymin - pad) : ymin - pad; ymax = ymax + pad; if (unit === '%') ymax = Math.min(Math.max(ymax, 20), 110);
  const sc = niceScale(ymin, ymax, 5);
  const x = i => m.l + (cats.length === 1 ? (W - m.l - m.r) / 2 : (i * (W - m.l - m.r)) / (cats.length - 1));
  const y = v => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svgc', role: 'group', 'aria-label': `${opts.title || 'Tendencia'}. ${seriesList.map(s => SERIES[s.esc].name).join(', ')}. ${cats.length} periodos.` });
  svg.append(h('title', {}, opts.title || 'Tendencia por periodo'));
  // bandas
  if (anyBands) {
    const ref = seriesList[0].st.sr.ev; const seg = (W - m.l - m.r) / Math.max(1, cats.length - 1);
    cats.forEach((c, i) => {
      const ev = ref.find(e => e.pinfo.p === c.p) || seriesList.map(s => s.st.sr.ev.find(e => e.pinfo.p === c.p)).find(Boolean);
      const b = ev && bandAt(ev); if (!b) return;
      const x0 = cats.length === 1 ? m.l : Math.max(m.l, x(i) - seg / 2), x1 = cats.length === 1 ? W - m.r : Math.min(W - m.r, x(i) + seg / 2);
      const menor = ev.sentido === 'Menor es mejor';
      const yv = y(b.v), yr = y(b.r), top = m.t, bot = H - m.b;
      const rect = (ya, yb, cls) => h('rect', { x: x0, y: Math.min(ya, yb), width: x1 - x0, height: Math.abs(yb - ya), class: cls });
      if (!menor) { svg.append(rect(top, yv, 'band-ok'), rect(yv, yr, 'band-risk'), rect(yr, bot, 'band-crit')); }
      else { svg.append(rect(bot, yv, 'band-ok'), rect(yv, yr, 'band-risk'), rect(yr, top, 'band-crit')); }
    });
    const ev = first[first.length - 1] || seriesList[0].st.sr.ev.slice(-1)[0]; const b = ev && bandAt(ev);
    if (b) { const menor = ev.sentido === 'Menor es mejor'; const lab = (yy, t, ic) => svg.append(h('g', {}, [h('text', { x: m.l + 6, y: yy, class: 'bandlab' }, t)]));
      lab(menor ? y((b.v + sc.lo) / 2) : y((b.v + sc.hi) / 2) + 4, '▲ En meta'); lab(y((b.v + b.r) / 2) + 4, '◆ En riesgo'); lab(menor ? y((b.r + sc.hi) / 2) + 4 : y((b.r + sc.lo) / 2) + 4, '✖ Crítico'); }
  }
  // ejes
  sc.ticks.forEach(t => { svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'gridl' }), h('text', { x: m.l - 8, y: y(t) + 4, class: 'axt', 'text-anchor': 'end' }, fmtN(t, 1) + (unit === '%' ? ' %' : ''))); });
  cats.forEach((c, i) => { svg.append(h('text', { x: x(i), y: H - m.b + 18, class: 'axt', 'text-anchor': 'middle' }, c.p), h('line', { x1: x(i), x2: x(i), y1: H - m.b, y2: H - m.b + 4, class: 'axl' })); });
  svg.append(h('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axl' }), h('text', { x: m.l + (W - m.l - m.r) / 2, y: H - 6, class: 'axt', 'text-anchor': 'middle' }, 'Periodo (por fecha de cierre)'));
  // meta (escalon dorado punteado)
  const metaPath = (ev) => { const pts = cats.map((c, i) => { const e = ev.find(z => z.pinfo.p === c.p); return e && e.ref !== null ? [x(i), y(e.ref)] : null; }); return pts; };
  const refEv = seriesList.map(s => s.st.sr.ev).find(e => e.some(z => z.ref !== null));
  let hasMeta = false;
  if (refEv) {
    const pts = metaPath(refEv).filter(Boolean);
    if (pts.length) {
      hasMeta = true; let d = '';
      pts.forEach((p, k) => { d += k === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${pts[k - 1][1]}L${p[0]},${p[1]}`; });
      svg.append(h('path', { d, class: 'goal', fill: 'none' }));
      const lp = pts[pts.length - 1]; const mt = h('text', { x: W - m.r + 6, y: lp[1] + 4, class: 'goaltxt' }, `${refLabel(refEv.filter(z => z.ref !== null).slice(-1)[0])} ${fmtN(refEv.filter(z => z.ref !== null).slice(-1)[0].ref, 1)}${unit === '%' ? ' %' : ''}`); svg.append(mt); labs.push({ y: lp[1] + 4, el: mt });
    }
  }
  // lineas
  seriesList.forEach(s => {
    const S0 = SERIES[s.esc]; const pts = [];
    s.st.sr.ev.forEach(e => { const i = cats.findIndex(c => c.p === e.pinfo.p); pts.push({ i, e, X: x(i), Y: y(e.valor) }); });
    if (pts.length > 1) svg.append(h('path', { d: pts.map((p, k) => (k ? 'L' : 'M') + p.X + ',' + p.Y).join(''), class: 'ln ' + S0.cls, fill: 'none' }));
    pts.forEach(p => svg.append(marker(S0.shape, p.X, p.Y, 4.8, 'mk ' + S0.cls)));
    const lp = pts[pts.length - 1]; if (lp) { const t = h('text', { x: Math.min(W - m.r + 6, lp.X + 10), y: lp.Y + 4, class: 'dl ' + S0.cls }, S0.name + ' ' + fmtN(lp.e.valor, 1) + (unit === '%' ? ' %' : '')); svg.append(t); labs.push({ y: lp.Y + 4, el: t }); }
  });
  labs.sort((a, b) => a.y - b.y); labs.forEach((l, i) => { if (i && l.y < labs[i - 1].y + 15) l.y = labs[i - 1].y + 15; l.el.setAttribute('y', l.y); });
  // capa de interaccion por categoria
  const step = (W - m.l - m.r) / Math.max(1, cats.length - 1);
  const guide = h('line', { y1: m.t, y2: H - m.b, class: 'guide', visibility: 'hidden' }); svg.append(guide);
  cats.forEach((c, i) => {
    const r = h('rect', { x: x(i) - step / 2, y: m.t, width: step, height: H - m.t - m.b, fill: 'transparent', tabindex: '0', 'aria-label': `Periodo ${c.p}: ` + seriesList.map(s => { const e = s.st.sr.ev.find(z => z.pinfo.p === c.p); return e ? `${SERIES[s.esc].name} ${fmtN(e.valor)}` : ''; }).filter(Boolean).join('; ') });
    const html = () => `<strong>${esc(c.label)}</strong>` + seriesList.map(s => { const e = s.st.sr.ev.find(z => z.pinfo.p === c.p); if (!e) return ''; return `<div class="trow"><svg width="14" height="14"><g>${marker(SERIES[s.esc].shape, 7, 7, 4, 'mk ' + SERIES[s.esc].cls).outerHTML}</g></svg><span>${esc(SERIES[s.esc].name)}: <b>${fmtN(e.valor, 2)}${unit === '%' ? ' %' : ''}</b></span> ${chip(e.state)} ${e.m.origen === 'EJEMPLO' ? exBadge : ''}</div><div class="small muted">${refLabel(e)} ${e.ref !== null ? fmtN(e.ref, 2) + (unit === '%' ? ' %' : '') : 'por definir'} · ${esc(e.m.fuente_dato)}</div>`; }).join('');
    r.addEventListener('mouseenter', () => { guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('visibility', 'visible'); });
    r.addEventListener('focus', () => { guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('visibility', 'visible'); });
    r.addEventListener('mouseleave', () => guide.setAttribute('visibility', 'hidden'));
    r.addEventListener('blur', () => guide.setAttribute('visibility', 'hidden'));
    bindTip(r, html); svg.append(r);
  });
  box.body.append(svg);
  const lgItems = seriesList.map(s => ({ label: SERIES[s.esc].name, cls: 'ln ' + SERIES[s.esc].cls, shape: SERIES[s.esc].shape, line: true }));
  if (hasMeta) lgItems.push({ label: seriesList.some(q => q.st.sr.ev.some(e => e.espFuente)) ? 'Esperado a la fecha (con fuente)' : 'Meta (con fuente)', cls: 'goal', line: true, dash: '5 4' });
  const lg = legendFor(lgItems);
  if (anyBands) lg.insertAdjacentHTML('beforeend', '<span class="lg muted small">Bandas: ▲ En meta · ◆ En riesgo · ✖ Crítico (solo con umbral con fuente o EJEMPLO)</span>');
  if (!hasMeta) lg.insertAdjacentHTML('beforeend', '<span class="lg muted small">Sin meta con fuente: no hay línea de meta ni semáforo</span>');
  box.append(lg);
  const rows = []; cats.forEach(c => seriesList.forEach(s => { const e = s.st.sr.ev.find(z => z.pinfo.p === c.p); if (e) rows.push([esc(c.p), esc(SERIES[s.esc].name), fmtN(e.valor, 2), e.ref !== null ? fmtN(e.ref, 2) : 'por definir', chip(e.state), esc(e.m.fuente_dato)]); }));
  box.setTable(['Periodo', 'Escuela', 'Valor', 'Meta', 'Estado', 'Fuente del dato'], rows);
  return box;
}

/* ---- Comparacion entre escuelas para un mismo indicador ---- */
function compareChart(id, opts = {}) {
  const sts = ORD.map(e => ({ esc: e, st: status(e, id) })).filter(s => s.st.last);
  const box = chartBox(opts.title || 'Comparación entre escuelas', opts.desc || 'Último valor de cada escuela; la línea dorada punteada es la meta.');
  if (!sts.length) { box.body.innerHTML = '<p class="empty">Ninguna escuela tiene dato con fuente para este indicador.</p>'; box.setTable(['Escuela'], []); return box; }
  const unit = sts[0].st.last.unidad;
  const W = 640, H = 300, m = { l: 54, r: 24, t: 40, b: 56 };
  const vals = sts.map(s => s.st.last.valor).concat(sts.map(s => s.st.last.ref).filter(v => v !== null));
  const sc = niceScale(unit === '%' ? 0 : Math.min(0, ...vals), Math.max(...vals) * 1.15, 5);
  const bw = Math.min(90, (W - m.l - m.r) / sts.length * 0.55);
  const x = i => m.l + (W - m.l - m.r) * (i + 0.5) / sts.length;
  const y = v => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svgc', role: 'group', 'aria-label': `Comparación del indicador ${id} entre escuelas` });
  sc.ticks.forEach(t => svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'gridl' }), h('text', { x: m.l - 8, y: y(t) + 4, class: 'axt', 'text-anchor': 'end' }, fmtN(t, 1) + (unit === '%' ? ' %' : ''))));
  svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(sc.lo), y2: y(sc.lo), class: 'axl' }));
  const metas = sts.map(s => s.st.last.ref).filter(v => v !== null);
  sts.forEach((s, i) => {
    const L = s.st.last, S0 = SERIES[s.esc];
    const top = y(L.valor), base = y(Math.max(sc.lo, 0));
    const bar = h('rect', { x: x(i) - bw / 2, y: Math.min(top, base), width: bw, height: Math.max(2, Math.abs(base - top)), rx: 4, class: 'bar ' + S0.cls, tabindex: '0', 'aria-label': `${S0.name}: ${fmtN(L.valor, 2)}, ${ST[L.state].label}` });
    bindTip(bar, () => `<strong>${esc(S0.name)}</strong> ${L.m.origen === 'EJEMPLO' ? exBadge : ''}<div>Periodo ${esc(L.pinfo.p)}: <b>${fmtVal(L.valor, L.unidad)}</b></div><div>${refLabel(L)} ${L.ref !== null ? fmtVal(L.ref, L.unidad) : 'por definir'} · ${chip(L.state)}</div><div class="small muted">${esc(L.m.fuente_dato)}</div>`);
    svg.append(bar);
    svg.append(h('text', { x: x(i), y: top - 24, class: 'val', 'text-anchor': 'middle' }, fmtN(L.valor, 1) + (unit === '%' ? ' %' : '')));
    const g = h('g', { transform: `translate(${x(i) - 38},${top - 20})` }); g.innerHTML = `<use href="#${ST[L.state].icon}" width="12" height="12" class="ic-${ST[L.state].cls}"/><text x="16" y="10" class="stl">${esc(ST[L.state].label)}</text>`; svg.append(g);
    svg.append(h('text', { x: x(i), y: H - m.b + 20, class: 'axt', 'text-anchor': 'middle' }, S0.name), h('text', { x: x(i), y: H - m.b + 36, class: 'axt muted', 'text-anchor': 'middle' }, L.pinfo.p));
  });
  if (metas.length) { const mv = metas[0]; svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(mv), y2: y(mv), class: 'goal' }), h('text', { x: W - m.r, y: y(mv) - 6, class: 'goaltxt', 'text-anchor': 'end' }, `${refLabel(sts[0].st.last)} ${fmtN(mv, 1)}${unit === '%' ? ' %' : ''}`)); }
  box.body.append(svg);
  box.append(legendFor([...sts.map(s => ({ label: SERIES[s.esc].name, cls: 'bar ' + SERIES[s.esc].cls, shape: 'square' })), ...(metas.length ? [{ label: sts.some(q => q.st.last.espFuente) ? 'Esperado a la fecha (con fuente)' : 'Meta (con fuente)', cls: 'goal', line: true, dash: '5 4' }] : [])]));
  box.setTable(['Escuela', 'Periodo', 'Valor', 'Meta', 'Estado', 'Fuente'], sts.map(s => [esc(SERIES[s.esc].name), esc(s.st.last.pinfo.p), fmtN(s.st.last.valor, 2), s.st.last.ref !== null ? fmtN(s.st.last.ref, 2) : 'por definir', chip(s.st.last.state), esc(s.st.last.m.fuente_dato)]));
  return box;
}

/* ---- Brechas: indicadores mas lejos de la meta ---- */
function gapsChart(rowsIn, opts = {}) {
  // rowsIn: [{esc, id, nombre, st}]
  const rows = rowsIn.filter(r => r.st.last && r.st.last.cumpl !== null).sort((a, b) => a.st.last.cumpl - b.st.last.cumpl).slice(0, opts.n || 12);
  const box = chartBox(opts.title || 'Brechas: indicadores más lejos de la meta', 'Cumplimiento respecto de la meta con fuente (100 % = meta). Ordenados de mayor a menor distancia.');
  if (!rows.length) { box.body.innerHTML = '<p class="empty">No hay indicadores con meta con fuente y dato para medir brechas.</p>'; box.setTable(['Indicador'], []); return box; }
  const W = 760, rh = 30, m = { l: 300, r: 130, t: 12, b: 34 }, H = m.t + m.b + rows.length * rh;
  const mx = Math.max(120, Math.ceil(Math.max(...rows.map(r => r.st.last.cumpl)) / 20) * 20);
  const x = v => m.l + (W - m.l - m.r) * Math.min(v, mx) / mx;
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svgc', role: 'group', 'aria-label': 'Brechas respecto de la meta' });
  for (let t = 0; t <= mx; t += 20) { svg.append(h('line', { x1: x(t), x2: x(t), y1: m.t, y2: H - m.b, class: 'gridl' }), h('text', { x: x(t), y: H - m.b + 16, class: 'axt', 'text-anchor': 'middle' }, t + ' %')); }
  rows.forEach((r, i) => {
    const L = r.st.last, yy = m.t + i * rh, S0 = SERIES[r.esc];
    const label = `${r.id} · ${r.nombre}`; const tl = label.length > 46 ? label.slice(0, 45) + '…' : label;
    svg.append(h('text', { x: m.l - 10, y: yy + rh / 2 + 1, class: 'axt lab', 'text-anchor': 'end' }, tl), h('title', {}, label));
    svg.append(h('text', { x: m.l - 10, y: yy + rh / 2 + 13, class: 'axt muted tiny', 'text-anchor': 'end' }, S0.name));
    const bar = h('rect', { x: m.l, y: yy + 6, width: Math.max(2, x(L.cumpl) - m.l), height: rh - 14, rx: 3, class: 'bar ' + S0.cls, tabindex: '0', 'aria-label': `${label}, ${S0.name}: ${fmtN(L.cumpl, 1)} % de la meta, ${ST[L.state].label}` });
    bindTip(bar, () => `<strong>${esc(label)}</strong> ${L.m.origen === 'EJEMPLO' ? exBadge : ''}<div>${esc(S0.name)} · periodo ${esc(L.pinfo.p)}</div><div>Valor <b>${fmtVal(L.valor, L.unidad)}</b> · meta ${fmtVal(L.meta, L.unidad)} · <b>${fmtN(L.cumpl, 1)} %</b> de la meta</div><div>${chip(L.state)}</div>`);
    bar.addEventListener('click', () => openFicha(r.id, r.esc));
    svg.append(bar);
    const g = h('g', { transform: `translate(${W - m.r + 8},${yy + 7})` }); g.innerHTML = `<use href="#${ST[L.state].icon}" width="14" height="14" class="ic-${ST[L.state].cls}"/><text x="19" y="11" class="stl">${esc(fmtN(L.cumpl, 0))} % · ${esc(ST[L.state].label)}</text>`; svg.append(g);
  });
  svg.append(h('line', { x1: x(100), x2: x(100), y1: m.t - 4, y2: H - m.b, class: 'goal' }), h('text', { x: x(100), y: m.t - 2, class: 'goaltxt', 'text-anchor': 'middle' }, 'Meta'));
  box.body.append(svg);
  box.setTable(['Indicador', 'Escuela', 'Valor', 'Meta', 'Cumplimiento', 'Estado'], rows.map(r => [esc(r.id + ' ' + r.nombre), esc(SERIES[r.esc].name), fmtN(r.st.last.valor, 2), fmtN(r.st.last.meta, 2), fmtN(r.st.last.cumpl, 1) + ' %', chip(r.st.last.state)]));
  return box;
}

/* ---- Cobertura: dato, evidencia y validacion ---- */
function coverageStats(esc) {
  const list = scopeList(esc); const n = list.length;
  let dato = 0, evi = 0, val = 0, venc = 0;
  list.forEach(c => { const st = status(esc, c.id); if (st.last) { dato++; if (st.last.m.ev || st.last.m.ev_ref) evi++; if (['Validado', 'Dato de reporte'].includes(st.last.m.estado_val)) val++; if (st.vencido) venc++; } });
  return { n, dato, evi, val, venc };
}
function coverageChart(escs, opts = {}) {
  const box = chartBox(opts.title || 'Cobertura: dato, evidencia y validación', 'De los indicadores vigilados en cada escuela, cuántos tienen dato con fuente, evidencia y validación.');
  const W = 760, rowH = 22, gap = 18, m = { l: 110, r: 90, t: 8, b: 8 };
  const kinds = [['dato', 'Con dato'], ['evi', 'Con evidencia'], ['val', 'Validados']];
  const stats = escs.map(e => ({ e, c: coverageStats(e) }));
  const H = m.t + m.b + stats.length * (kinds.length * rowH + gap);
  const x = p => m.l + (W - m.l - m.r) * p / 100;
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svgc', role: 'group', 'aria-label': 'Cobertura de indicadores por escuela' });
  [0, 25, 50, 75, 100].forEach(t => svg.append(h('line', { x1: x(t), x2: x(t), y1: m.t, y2: H - m.b, class: 'gridl' })));
  stats.forEach((s, i) => {
    const y0 = m.t + i * (kinds.length * rowH + gap);
    svg.append(h('text', { x: 6, y: y0 + 16, class: 'axt strong' }, SERIES[s.e].name), h('text', { x: 6, y: y0 + 32, class: 'axt muted tiny' }, `${s.c.n} vigilados`));
    kinds.forEach(([k, lab], j) => {
      const p = s.c.n ? s.c[k] / s.c.n * 100 : 0; const yy = y0 + j * rowH;
      svg.append(h('rect', { x: m.l, y: yy + 3, width: W - m.l - m.r, height: rowH - 8, rx: 3, class: 'trk' }));
      const bar = h('rect', { x: m.l, y: yy + 3, width: Math.max(p ? 3 : 0, x(p) - m.l), height: rowH - 8, rx: 3, class: 'bar ' + (j === 0 ? 'c1' : j === 1 ? 'c2' : 'c3'), tabindex: '0', 'aria-label': `${SERIES[s.e].name}, ${lab}: ${s.c[k]} de ${s.c.n}` });
      bindTip(bar, () => `<strong>${esc(SERIES[s.e].name)}</strong><div>${esc(lab)}: <b>${s.c[k]} de ${s.c.n}</b> (${fmtN(p, 0)} %)</div>`);
      svg.append(bar, h('text', { x: W - m.r + 8, y: yy + 15, class: 'axt' }, `${lab} ${s.c[k]}/${s.c.n}`));
    });
  });
  box.body.append(svg);
  box.append(legendFor([{ label: 'Con dato', cls: 'bar c1', shape: 'square' }, { label: 'Con evidencia', cls: 'bar c2', shape: 'square' }, { label: 'Validados', cls: 'bar c3', shape: 'square' }]));
  box.setTable(['Escuela', 'Vigilados', 'Con dato', 'Con evidencia', 'Validados', 'Con dato vencido'], stats.map(s => [esc(SERIES[s.e].name), s.c.n, s.c.dato, s.c.evi, s.c.val, s.c.venc]));
  return box;
}

/* ---- POI: programado vs ejecutado acumulado mensual ---- */
function poiLinesChart(anio, aoiList, opts = {}) {
  const A = poiAll()[anio]; const rep = A.rep;
  const sel = A.lista.filter(x => aoiList.includes(x.aoi) && x.prog > 0);
  const box = chartBox(opts.title || `Programado vs ejecutado acumulado, ${rep.etiqueta}`, 'La línea dorada punteada es lo programado; la violeta es lo ejecutado. Suma de las AOI elegidas (unidades de medida distintas: úsalo con una o con actividades de la misma unidad).');
  if (!sel.length) { box.body.innerHTML = '<p class="empty">Elige al menos una AOI con programación en este reporte.</p>'; box.setTable(['Mes'], []); return box; }
  const months = Array.from({ length: rep.mes_corte }, (_, i) => i + 1);
  const prog = months.map(mo => sel.reduce((s, x) => s + (x.acum.find(z => z.mes === mo) || { prog: 0 }).prog, 0));
  const ejec = months.map(mo => sel.reduce((s, x) => s + (x.acum.find(z => z.mes === mo) || { ejec: 0 }).ejec, 0));
  const W = 700, H = 290, m = { l: 62, r: 100, t: 16, b: 44 };
  const sc = niceScale(0, Math.max(...prog, ...ejec) * 1.08, 5);
  const x = i => m.l + (months.length === 1 ? (W - m.l - m.r) / 2 : i * (W - m.l - m.r) / (months.length - 1));
  const y = v => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svgc', role: 'group', 'aria-label': `Programado y ejecutado acumulado ${rep.etiqueta}` });
  sc.ticks.forEach(t => svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'gridl' }), h('text', { x: m.l - 8, y: y(t) + 4, class: 'axt', 'text-anchor': 'end' }, fmtN(t, 0))));
  months.forEach((mo, i) => svg.append(h('text', { x: x(i), y: H - m.b + 18, class: 'axt', 'text-anchor': 'middle' }, MESES[mo - 1])));
  svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: 'axl' }));
  const path = arr => arr.map((v, i) => (i ? 'L' : 'M') + x(i) + ',' + y(v)).join('');
  svg.append(h('path', { d: path(prog), class: 'goal', fill: 'none' }), h('path', { d: path(ejec), class: 'ln s2', fill: 'none' }));
  months.forEach((mo, i) => svg.append(marker('circle', x(i), y(ejec[i]), 4.2, 'mk s2')));
  svg.append(h('text', { x: x(months.length - 1) + 8, y: y(prog[prog.length - 1]) - 4, class: 'goaltxt' }, 'Programado ' + fmtN(prog[prog.length - 1], 0)), h('text', { x: x(months.length - 1) + 8, y: y(ejec[ejec.length - 1]) + 14, class: 'dl s2' }, 'Ejecutado ' + fmtN(ejec[ejec.length - 1], 0)));
  const step = (W - m.l - m.r) / Math.max(1, months.length - 1);
  months.forEach((mo, i) => { const r = h('rect', { x: x(i) - step / 2, y: m.t, width: step, height: H - m.t - m.b, fill: 'transparent', tabindex: '0', 'aria-label': `${MESES[mo - 1]}: programado ${prog[i]}, ejecutado ${ejec[i]}` }); bindTip(r, () => `<strong>${MESES[mo - 1]} ${anio}</strong><div>Programado acumulado: <b>${fmtN(prog[i], 0)}</b></div><div>Ejecutado acumulado: <b>${fmtN(ejec[i], 0)}</b></div><div class="small muted">${esc(rep.reporte)} · actividad compartida por la Facultad</div>`); svg.append(r); });
  box.body.append(svg);
  box.append(legendFor([{ label: 'Programado acumulado', cls: 'goal', line: true, dash: '5 4' }, { label: 'Ejecutado acumulado', cls: 'ln s2', line: true, shape: 'circle' }]));
  box.setTable(['Mes', 'Programado acumulado', 'Ejecutado acumulado'], months.map((mo, i) => [MESES[mo - 1], fmtN(prog[i], 0), fmtN(ejec[i], 0)]));
  return box;
}

/* ---- POI: avance por AOI sobre bandas del reporte ---- */
function poiBulletChart(anio, opts = {}) {
  const A = poiAll()[anio]; const rep = A.rep;
  const vg = +S.params.gen.banda_poi_verde || 95, rg = +S.params.gen.banda_poi_rojo || 75;
  const rows = A.conProg.slice().sort((a, b) => a.avance - b.avance || b.ratio - a.ratio);
  const box = chartBox(opts.title || `Avance de cada AOI, ${rep.etiqueta}`, `Ejecutado sobre programado acumulado al corte (tope 100 %, como los reportes). Bandas de los reportes: menos de ${rg} %, de ${rg} a menos de ${vg} % y ${vg} % o más. El marcador ◆ muestra la ejecución sin tope.`);
  const rh = 24, W = 780, m = { l: 330, r: 70, t: 22, b: 8 }, H = m.t + m.b + rows.length * rh;
  const mx = 100; const x = v => m.l + (W - m.l - m.r) * Math.min(v, mx) / mx;
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svgc', role: 'group', 'aria-label': `Avance por AOI, ${rep.etiqueta}` });
  svg.append(h('rect', { x: x(0), y: m.t - 6, width: x(rg) - x(0), height: H - m.t - m.b + 6, class: 'band-crit' }), h('rect', { x: x(rg), y: m.t - 6, width: x(vg) - x(rg), height: H - m.t - m.b + 6, class: 'band-risk' }), h('rect', { x: x(vg), y: m.t - 6, width: x(100) - x(vg), height: H - m.t - m.b + 6, class: 'band-ok' }));
  [[0, ''], [rg, rg + ' %'], [vg, vg + ' %'], [100, '100 %']].forEach(([v, t]) => svg.append(h('text', { x: x(v), y: 12, class: 'axt', 'text-anchor': v === 0 ? 'start' : 'middle' }, t || '0 %')));
  rows.forEach((r, i) => {
    const a = AOI_BY[r.act]; const yy = m.t + i * rh; const code = r.avance >= vg ? 'OK' : r.avance >= rg ? 'RIESGO' : 'CRIT';
    const label = `${r.aoi.slice(-5)} · ${a ? a.actividad : r.act}`; const tl = label.length > 50 ? label.slice(0, 49) + '…' : label;
    svg.append(h('text', { x: m.l - 8, y: yy + 15, class: 'axt lab', 'text-anchor': 'end' }, tl));
    const bar = h('rect', { x: m.l, y: yy + 4, width: Math.max(2, x(r.avance) - m.l), height: rh - 10, rx: 3, class: 'bar s1', tabindex: '0', 'aria-label': `${label}: avance ${fmtN(r.avance, 1)} %, ${ST[code].label}` });
    bindTip(bar, () => `<strong>${esc(a ? a.actividad : r.act)}</strong><div class="small muted">${esc(r.aoi)} · compartida por la Facultad</div><div>Programado ${fmtN(r.prog, 0)} · ejecutado ${fmtN(r.ejec, 0)}</div><div>Avance <b>${fmtN(r.avance, 1)} %</b> (sin tope ${fmtN(r.ratio, 1)} %)</div><div>${chip(code)}</div><div class="small muted">${esc(rep.reporte)} · p. ${esc(r.pag || '')}</div>`);
    bar.addEventListener('click', () => { S.poiAoi = r.aoi; render(); });
    svg.append(bar);
    if (r.ratio > 100) svg.append(marker('diamond', x(100) + 6, yy + rh / 2, 4, 'mk s2'));
    const g = h('g', { transform: `translate(${W - m.r + 6},${yy + 5})` }); g.innerHTML = `<use href="#${ST[code].icon}" width="13" height="13" class="ic-${ST[code].cls}"/><text x="17" y="10.5" class="stl">${fmtN(r.avance, 0)} %</text>`; svg.append(g);
  });
  box.body.append(svg);
  box.append(legendFor([{ label: 'Avance (tope 100 %)', cls: 'bar s1', shape: 'square' }, { label: 'Ejecución mayor que lo programado', cls: 'mk s2', shape: 'diamond' }]));
  box.setTable(['AOI', 'Actividad', 'Programado', 'Ejecutado', 'Avance %', 'Banda'], rows.map(r => { const code = r.avance >= vg ? 'OK' : r.avance >= rg ? 'RIESGO' : 'CRIT'; return [esc(r.aoi), esc((AOI_BY[r.act] || {}).actividad || ''), fmtN(r.prog, 0), fmtN(r.ejec, 0), fmtN(r.avance, 1), chip(code)]; }));
  return box;
}

/* ---- POI: cumplimiento PE01-I3 por año frente a la meta del MAGPROF ---- */
function poiYearsChart() {
  const A = poiAll(); const years = M.poi_reportes.map(r => r.anio);
  const box = chartBox('Cumplimiento del POI de la Facultad por año (PE01-I3)', 'Promedio del avance de las AOI con programación. Dorado punteado: meta del MAGPROF por año. 2026 es parcial (febrero).');
  const W = 560, H = 270, m = { l: 54, r: 20, t: 34, b: 52 };
  const metas = years.map(a => { const r = metaRowFor('PE01-I3', a); return r ? r.meta : null; });
  const sc = niceScale(0, 110, 5); const x = i => m.l + (W - m.l - m.r) * (i + .5) / years.length; const y = v => m.t + (H - m.t - m.b) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
  const svg = h('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svgc', role: 'group', 'aria-label': 'Cumplimiento del POI por año' });
  sc.ticks.forEach(t => svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: 'gridl' }), h('text', { x: m.l - 8, y: y(t) + 4, class: 'axt', 'text-anchor': 'end' }, t + ' %')));
  const bw = 70;
  years.forEach((a, i) => {
    const v = A[a].i3, rep = A[a].rep; const st = (S.params.metas['PE01-I3'] && metas[i] !== null) ? (v >= metas[i] ? 'OK' : 'BAJO') : 'DEF';
    const bar = h('rect', { x: x(i) - bw / 2, y: y(v), width: bw, height: y(0) - y(v), rx: 4, class: 'bar s1', tabindex: '0', 'aria-label': `${rep.etiqueta}: ${fmtN(v, 2)} %` });
    bindTip(bar, () => `<strong>${esc(rep.etiqueta)}</strong><div>PE01-I3: <b>${fmtN(v, 2)} %</b> (${A[a].conProg.length} AOI con programación)</div><div>Meta MAGPROF: ${metas[i] !== null ? metas[i] + ' %' : 'por definir'} · ${chip(st)}</div><div class="small muted">${rep.reporte}, consultado el ${fmtDate(parseISO(rep.consulta))}</div>`);
    svg.append(bar, h('text', { x: x(i), y: y(v) - 24, class: 'val', 'text-anchor': 'middle' }, fmtN(v, 2) + ' %'));
    const g = h('g', { transform: `translate(${x(i) - 38},${y(v) - 20})` }); g.innerHTML = `<use href="#${ST[st].icon}" width="12" height="12" class="ic-${ST[st].cls}"/><text x="16" y="10" class="stl">${esc(ST[st].label)}</text>`; svg.append(g);
    if (metas[i] !== null) svg.append(h('line', { x1: x(i) - bw / 2 - 12, x2: x(i) + bw / 2 + 12, y1: y(metas[i]), y2: y(metas[i]), class: 'goal' }), h('text', { x: x(i) + bw / 2 + 14, y: y(metas[i]) + 4, class: 'goaltxt tiny' }, metas[i] + ' %'));
    svg.append(h('text', { x: x(i), y: H - m.b + 20, class: 'axt', 'text-anchor': 'middle' }, rep.etiqueta));
  });
  svg.append(h('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: 'axl' }));
  box.body.append(svg);
  box.append(legendFor([{ label: 'PE01-I3 (promedio de avance)', cls: 'bar s1', shape: 'square' }, { label: 'Meta MAGPROF', cls: 'goal', line: true, dash: '5 4' }]));
  box.setTable(['Reporte', 'AOI con programación', 'PE01-I3 %', 'Meta MAGPROF %', 'Impreso en el reporte %'], years.map((a, i) => [esc(A[a].rep.etiqueta), A[a].conProg.length, fmtN(A[a].i3, 2), metas[i] ?? 'por definir', fmtN(A[a].rep.impreso, 2)]));
  return box;
}

/* ---- barra apilada de estados ---- */
function stateBar(counts, total) {
  const order = ['CRIT', 'RIESGO', 'BAJO', 'SD', 'SEG', 'OK', 'DEF'];
  const t = total || order.reduce((s, k) => s + (counts[k] || 0), 0) || 1;
  const segs = order.filter(k => counts[k]).map(k => `<span class="seg st-${ST[k].cls}" style="flex:${counts[k]}" title="${esc(ST[k].label)}: ${counts[k]}"><svg class="ic" aria-hidden="true"><use href="#${ST[k].icon}"/></svg><b>${counts[k]}</b></span>`).join('');
  const lg = order.filter(k => counts[k]).map(k => `<span class="lgs"><svg class="ic" aria-hidden="true"><use href="#${ST[k].icon}"/></svg>${esc(ST[k].label)} ${counts[k]}</span>`).join('');
  return `<div class="sbar" role="img" aria-label="${order.filter(k => counts[k]).map(k => ST[k].label + ' ' + counts[k]).join(', ')}">${segs || '<span class="seg st-def" style="flex:1">Sin indicadores</span>'}</div><div class="sbar-lg">${lg}</div>`;
}
/* sparkline */
function spark(ev, w = 90, hgt = 26) {
  if (!ev || ev.length < 1) return '';
  const vs = ev.map(e => e.valor), mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn || 1;
  const X = i => 3 + (w - 6) * (ev.length === 1 ? .5 : i / (ev.length - 1)), Y = v => hgt - 4 - (hgt - 8) * (v - mn) / r;
  const d = ev.map((e, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(e.valor).toFixed(1)).join('');
  return `<svg class="spark" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Serie de ${ev.length} periodos, último ${fmtN(vs[vs.length - 1])}"><path d="${d}" class="ln s2" fill="none"/><circle cx="${X(ev.length - 1).toFixed(1)}" cy="${Y(vs[vs.length - 1]).toFixed(1)}" r="3" class="mk s2"/></svg>`;
}

/* ===================== Vistas: general, procesos, estandares ===================== */
const I = (n, c = '') => `<svg class="ic ${c}" aria-hidden="true"><use href="#${n}"/></svg>`;
const pageHead = (t, p) => `<div class="ph"><h1>${esc(t)}</h1><div class="gl"></div><p>${p}</p></div>`;
const sect = (t, icon = 'i-diamond') => `<div class="sect">${I(icon)}<h2>${esc(t)}</h2></div>`;
const nodeFrom = html => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const stChip = st => chip(st.state) + (st.vencido ? ` <span class="chip st-risk" title="El último dato es anterior al periodo esperado según la periodicidad">${I('i-clock')}<span>Vencido</span></span>` : '');
const exOf = st => st.last && st.last.m.origen === 'EJEMPLO' ? ' ' + exBadge : '';
const nm = id => (CARG_BY[id] || IND_BY[id] || { nombre: id }).nombre;
function schoolsSel() { return S.escuela === 'TODAS' ? SCH : S.escuela === 'FAC' ? ['FAC'] : [S.escuela]; }

function alertCard(a, compact = false) {
  const sev = SEV[a.severidad] || SEV.Aviso;
  const link = a.objeto === 'Indicador' ? `<button class="btn small" data-act="ficha" data-id="${esc(a.objetoId)}" data-esc="${esc(a.escuela)}">${I('i-doc')}Ver ficha</button>` : a.objeto === 'AOI' ? `<button class="btn small" data-act="go" data-view="poi" data-aoi="${esc(a.objetoNombre.split(' ')[0])}" data-anio="${a.anio}">${I('i-doc')}Ver en PEI y POI</button>` : (a.objeto === 'Criterio' || a.objeto === 'Estándar') ? `<button class="btn small" data-act="go" data-view="estandares" data-est="${esc(a.estandarSel)}">${I('i-doc')}Ver ${a.objeto === 'Criterio' ? 'el criterio' : 'el estándar'}</button>` : '';
  return `<article class="alert sev-${sev.cls}">
    <div class="hd">${sevChip(a.severidad)}<b>${esc(a.objetoId && a.objeto === 'Indicador' ? a.objetoId + ' · ' : '')}${esc(a.objetoNombre)}</b><span class="tag">${esc(ESC_BY[a.escuela]?.corto || a.escuela)}</span><span class="tag gap">${esc(a.regla)} ${esc(a.reglaNombre)}</span>${a.ejemplo ? exBadge : ''}</div>
    <dl><dt>Qué ocurre</dt><dd>${esc(a.que)}</dd>${compact ? '' : `<dt>Por qué</dt><dd>${esc(a.porque)}</dd>`}<dt>Desde cuándo</dt><dd>${esc(a.desdeTxt || '—')}</dd><dt>A quién corresponde</dt><dd>${esc(a.responsable)}</dd><dt>Decisión sugerida</dt><dd>${esc(a.accion)}</dd></dl>
    ${link ? `<div>${link}</div>` : ''}</article>`;
}

/** Autoevaluacion por criterio: tabla del Consolidado cargado (una por escuela con Consolidado) */
function autoevalSection(std) {
  const aes = Object.values(S.autoeval || {}).filter(a => S.escuela === 'TODAS' || S.escuela === a.escuela);
  if (!aes.length) return '';
  let h = '';
  aes.forEach(ae => {
    const cr = ae.criterios.filter(c => !std || c.estandar === std);
    const cnt = k => ae.criterios.filter(c => c.valoracion === k).length;
    const sinEv = ae.criterios.filter(c => c.evSin.length).length;
    const conMat = ae.criterios.filter(c => c.matrices.some(x => /pendiente/i.test(x.estado))).length;
    h += sect(`Autoevaluación por criterio · ${ESC_BY[ae.escuela].nombre}`, 'i-target');
    h += `<p class="note">Fuente: Consolidado de autoevaluación [A22] (${esc(ae.name)}${ae.fabrica ? ', incluido de fábrica' : ''}). ${ae.criterios.length} criterios: ${cnt('L')} en L, ${cnt('LP')} en LP, ${cnt('Por definir')} «Por definir» y ${cnt('No desarrollado')} sin desarrollar. ${sinEv} criterios con evidencias exigidas sin citar (alerta R12) y ${conMat} con alguna matriz pendiente (alerta R13); ${ae.nPend} de ${ae.nMat} matrices siguen pendientes. Las valoraciones son las del informe, no las calcula el tablero.</p>`;
    h += `<div class="tblw" style="max-height:520px"><table class="tbl"><thead><tr><th>Criterio</th><th>Valoración</th><th>EV exigidas sin citar</th><th>Matrices pendientes</th><th>Prioridad</th><th>Indicadores del Modelo que lo citan</th><th>Fuente</th></tr></thead><tbody>`;
    cr.forEach(c => {
      const pm = c.matrices.filter(x => /pendiente/i.test(x.estado));
      const inds = M.sineace.filter(x => x.criterios.includes(c.criterio)).map(x => x.id);
      h += `<tr><td><b>${esc(c.criterio)}</b> <span class="small muted">${esc(c.resumen)}</span></td><td>${esc(c.valoracion)}</td><td>${c.evSin.length ? c.evSin.map(e => `<span class="tag" title="${esc((M.evidencias.find(z => z.id === e) || {}).descripcion || '')}">${e}</span>`).join('') : '<span class="muted small">ninguna</span>'}</td><td>${pm.length ? pm.map(x => `<span class="tag">M${x.n}</span>`).join('') : '<span class="muted small">ninguna</span>'}</td><td>${esc(c.prioridad)}</td><td>${inds.map(i => `<button class="linkbtn tag" data-act="ficha" data-id="${i}" data-esc="${ae.escuela}">${i}</button>`).join('') || '<span class="muted small">ninguno</span>'}</td><td class="small">${esc(c.ref)}</td></tr>`;
    });
    h += '</tbody></table></div>';
  });
  return h;
}

function schoolSummary(ec) {
  const list = scopeList(ec);
  const items = list.map(c => { const st = status(ec, c.id); return { id: c.id, nombre: c.nombre, code: st.state, st, gap: gapOf(st) }; });
  const counts = { CRIT: 0, RIESGO: 0, BAJO: 0, SD: 0, OK: 0, DEF: 0 };
  items.forEach(i => counts[i.code]++);
  const w = worstOf(items);
  const al = ALERTS.filter(a => a.escuela === ec);
  return { items, counts, worst: w, alerts: al, cov: coverageStats(ec), has: schoolHasData(ec) };
}

function heatmap(cols, opts = {}) {
  const sel = opts.sel || {};
  let html = `<div style="overflow-x:auto"><table class="heat" role="grid" aria-label="Mapa de calor: procesos del criterio 10.2 por escuela"><thead><tr><th scope="col">Proceso del criterio 10.2</th>${cols.map(c => `<th scope="col" class="c">${esc(ESC_BY[c].corto)}</th>`).join('')}</tr></thead><tbody>`;
  M.procesos102.forEach(p => {
    html += `<tr><th scope="row" class="rowlab">P${p.n} ${esc(p.nombre)}<small>Ficha: ${esc(p.estado_ficha)}${p.ficha_propuesta && p.ficha_propuesta !== 'Ninguna' ? ' · ' + esc(p.ficha_propuesta.split(' ')[0]) + ' por aprobar' : ''}</small></th>`;
    cols.forEach(c => {
      const ps = processState(c, p.id); const code = ps.code;
      if (code === 'NA') { html += `<td><div class="hc st-na" title="Todavía no hay indicadores vigilados para este proceso en esta columna"><span class="l1">${I('i-nodata')}Sin indicador vigilado</span><span class="l2">pendiente de definir</span></div></td>`; return; }
      const w = ps.worst.item; const total = ps.items.length; const con = ps.items.filter(i => i.st.last).length;
      const l2 = w ? `Marca: ${esc(w.id)}${w.st.last && w.st.last.cumpl !== null ? ' · ' + fmtN(w.st.last.cumpl, 0) + ' % de la meta' : ''}` : `${con} de ${total} con dato`;
      const pressed = sel.p === p.id && sel.esc === c;
      html += `<td><button class="hc st-${ST[code].cls}" data-act="proc" data-p="${p.id}" data-esc="${c}" aria-pressed="${pressed}" aria-label="P${p.n} ${esc(p.nombre)}, ${esc(ESC_BY[c].corto)}: ${ST[code].label}. ${esc(l2)}"><span class="l1">${I(ST[code].icon)}${esc(ST[code].label)}</span><span class="l2">${l2}</span><span class="l2">${con}/${total} con dato</span></button></td>`;
    });
    html += '</tr>';
  });
  return html + '</tbody></table></div>';
}

function viewGeneral() {
  const root = document.createElement('div');
  const sums = Object.fromEntries(ORD.map(e => [e, schoolSummary(e)]));
  const all3 = SCH.flatMap(e => sums[e].items);
  const wAll = worstOf(all3.concat(sums.FAC.items));
  const tot = { CRIT: 0, RIESGO: 0, BAJO: 0, SD: 0, OK: 0, DEF: 0 };
  SCH.forEach(e => Object.keys(tot).forEach(k => tot[k] += sums[e].counts[k]));
  const nAl = { 'Crítica': 0, 'En riesgo': 0, 'Aviso': 0 }; ALERTS.forEach(a => nAl[a.severidad] = (nAl[a.severidad] || 0) + 1);
  const nVig = SCH.reduce((s, e) => s + sums[e].items.length, 0), nDato = SCH.reduce((s, e) => s + sums[e].cov.dato, 0);
  let h = pageHead('Vista general', 'Semáforo global y por escuela. Cada escuela carga su información; la Facultad es el marco común. El peor indicador marca el estado y se indica cuál es.');
  h += `<div class="card hl" style="margin-bottom:14px"><div style="display:flex;flex-wrap:wrap;gap:18px 34px;align-items:center">
    <div><div class="kpi"><span class="l">Semáforo global (peor indicador)</span><span class="v" style="font-size:1.5rem">${esc(ST[wAll.code].label)}</span></div><div style="margin-top:6px">${chip(wAll.code)}</div></div>
    <div class="kpis" style="flex:1;min-width:300px">
      <div class="kpi"><span class="v">${nVig}</span><span class="l">Indicadores vigilados (3 escuelas)</span></div>
      <div class="kpi"><span class="v">${nVig ? fmtN(nDato / nVig * 100, 0) : 0} %</span><span class="l">Con dato con fuente</span></div>
      <div class="kpi"><span class="v">${nAl['Crítica']}</span><span class="l">Alertas críticas</span></div>
      <div class="kpi"><span class="v">${nAl['En riesgo']}</span><span class="l">Alertas en riesgo</span></div>
      <div class="kpi"><span class="v">${nAl['Aviso']}</span><span class="l">Avisos</span></div></div></div>
    ${wAll.item ? `<p class="small" style="margin:12px 0 0">Marca el estado: <b>${esc(wAll.item.id)}</b> ${esc(wAll.item.nombre || nm(wAll.item.id))}${wAll.item.st.desde ? ' · ' + (wAll.item.st.state === 'SD' ? '' : 'desde ' + fmtDate(wAll.item.st.desde)) : ''}. <button class="linkbtn" style="color:#fff" data-act="ficha" data-id="${esc(wAll.item.id)}" data-esc="${esc(wAll.item.st.esc)}">Ver ficha</button></p>` : ''}</div>`;
  h += sect('Escuelas lado a lado', 'i-grid');
  h += '<div class="grid g4">';
  [...SCH, 'FAC'].forEach(e => {
    const s = sums[e]; const code = s.items.length ? s.worst.code : 'SD'; const w = s.worst.item;
    const na = { c: s.alerts.filter(a => a.severidad === 'Crítica').length, r: s.alerts.filter(a => a.severidad === 'En riesgo').length, a: s.alerts.filter(a => a.severidad === 'Aviso').length };
    h += `<section class="card scard ${e === 'FAC' ? 'fac' : ''}" aria-label="${esc(ESC_BY[e].nombre)}"><div><h3>${esc(ESC_BY[e].nombre)}</h3><div class="muted small">${e === 'FAC' ? 'Marco común: POI compartido, sin reparto por escuela' : e === 'TM' ? 'Cuatro áreas: Radiología, Terapia Física, Terapia Ocupacional, Lab. Clínico y Anat. Patológica' : 'Programa de pregrado'}</div>${e !== 'FAC' ? `<div style="margin-top:4px"><span class="tag" title="Orden de implementación definido por Robert">${esc(ESC_BY[e].faseTxt)}</span>${enImplementacion(e) ? '' : '<span class="tag gap">aún sin exigir carga</span>'}</div>` : ''}</div>
      <div class="big">${chip(code)}${!s.has && e !== 'FAC' ? '<span class="small muted">sin archivo cargado</span>' : ''}</div>
      ${stateBar(s.counts, s.items.length)}
      <div class="why">${w ? `<b>Marca el estado:</b> <button class="linkbtn" data-act="ficha" data-id="${esc(w.id)}" data-esc="${e}">${esc(w.id)}</button> ${esc(nm(w.id))}.${w.st.last && w.st.last.cumpl !== null ? ` ${fmtN(w.st.last.cumpl, 0)} % de la meta` : ''}${w.st.desde ? `, desde ${fmtDate(w.st.desde)}` : ''}.` : (s.items.length ? 'Ningún indicador con semáforo todavía.' : 'Sin indicadores vigilados.')}</div>
      <div class="small muted">Con dato ${s.cov.dato}/${s.cov.n} · evidencia ${s.cov.evi} · validados ${s.cov.val}</div>
      <div class="pill-row"><button class="btn small" data-act="alertas" data-esc="${e}">${I('i-bell')}Alertas ${na.c + na.r + na.a}</button><span class="small muted">${na.c} críticas · ${na.r} en riesgo · ${na.a} avisos</span></div></section>`;
  });
  h += '</div>';
  // POI marco comun
  const A = poiAll(); const last = M.poi_reportes[M.poi_reportes.length - 1]; const a25 = A[2025];
  h += `<div class="banner" style="margin-top:14px">${I('i-info')}<div><b>La Facultad es el marco común.</b> El POI disponible (reportes de seguimiento 2024, 2025 y febrero de 2026) es del centro de costo 01.30 de la Facultad y no distingue escuelas: se muestra como <b>compartido por la Facultad</b>. Cumplimiento promedio de las AOI: ${M.poi_reportes.map(r => `${r.anio === 2026 ? 'feb. 2026 (parcial)' : r.anio}: <b>${fmtN(A[r.anio].i3, 2)} %</b>`).join(' · ')}. La desagregación por escuela está <b>por confirmar</b>. <button class="linkbtn" data-act="go" data-view="poi">Ver PEI y POI</button></div></div>`;
  h += sect('Qué requiere una decisión', 'i-bell');
  const top = ALERTS.filter(a => a.severidad !== 'Aviso').slice(0, 6);
  h += top.length ? `<div class="grid g2">${top.map(a => alertCard(a, true)).join('')}</div><p style="margin-top:10px"><button class="btn" data-act="go" data-view="alertas">${I('i-bell')}Ver las ${ALERTS.length} alertas</button></p>` : '<div class="empty">No hay alertas críticas ni en riesgo. Revisa los avisos o carga más datos.</div>';
  h += sect('Mapa de calor: proceso × escuela', 'i-grid');
  h += `<div class="card">${heatmap(ORD, {})}<p class="note">Cada celda muestra el estado del proceso según su peor indicador y cuál es. Haz clic para ver los indicadores en <button class="linkbtn" data-act="go" data-view="procesos">Procesos 10.2</button>.</p></div>`;
  root.innerHTML = h;
  const slotRow = document.createElement('div'); slotRow.className = 'grid g2'; slotRow.style.marginTop = '14px';
  const gapRows = SCH.flatMap(e => scopeList(e).map(c => ({ esc: e, id: c.id, nombre: c.nombre, st: status(e, c.id) })));
  slotRow.append(gapsChart(gapRows, { n: 10 }), coverageChart(SCH));
  root.append(nodeFrom(sect('Brechas y cobertura', 'i-chart')).firstElementChild, slotRow);
  return root;
}

function processDetail(pid, ec) {
  const p = P102_BY[pid]; const cols = ec === 'FAC' ? ['FAC'] : (S.escuela === 'TODAS' || SCH.includes(ec) ? SCH : [ec]);
  const ids = M.rel_proceso_indicador.filter(r => r[0] === pid).map(r => r[1]);
  const sts = {}; cols.forEach(c => sts[c] = processState(c, pid));
  const fichas = M.rel_proceso_ficha.filter(r => r[0] === pid).map(r => r[1]);
  let h = `<div class="card"><h3>P${p.n} ${esc(p.nombre)}</h3>
   <p class="small muted">Ficha: <b>${esc(p.estado_ficha)}</b>${p.ficha_propuesta && p.ficha_propuesta !== 'Ninguna' ? ` · propuesta: ${esc(p.ficha_propuesta)} (por aprobar)` : ''} · Manual, capítulo ${esc(p.capitulo)} · Fichas SGC: ${fichas.map(f => `<span class="tag" title="${esc(FICHA_BY[f]?.nombre || '')}">${f}</span>`).join('')}</p>
   <div class="pill-row">${cols.map(c => `<span>${esc(ESC_BY[c].corto)}: ${chip(sts[c].code)}</span>`).join('')}</div>
   <div class="tblw" style="margin-top:10px"><table class="tbl"><thead><tr><th>Indicador de proceso</th>${cols.map(c => `<th>${esc(ESC_BY[c].corto)}</th>`).join('')}</tr></thead><tbody>`;
  ids.forEach(id => {
    const ind = IND_BY[id]; const eid = effId(id);
    h += `<tr><td><button class="linkbtn id" data-act="ficha" data-id="${esc(id)}" data-esc="${esc(cols[0])}">${esc(id)}</button> ${esc(ind.nombre)}<div class="small muted">${esc(ind.ficha)} · ${esc(ind.frecuencia)}${eid !== id ? ` · mide lo mismo que ${eid} (modelo CONEAU)` : ''}</div></td>`;
    cols.forEach(c => {
      const scoped = inScope(c, eid) || inScope(c, id);
      if (!scoped) { h += `<td>${chip('NA')}<div class="small muted">fuera de alcance</div></td>`; return; }
      const st = status(c, id); const mark = sts[c].worst.item && sts[c].worst.item.id === id;
      h += `<td>${mark ? '<span class="tag" title="Este indicador marca el estado del proceso">★ marca el estado</span><br>' : ''}${stChip(st)}${exOf(st)}<div class="small num">${st.last ? `${fmtVal(st.last.valor, st.last.unidad)} · meta ${st.last.meta !== null ? fmtVal(st.last.meta, st.last.unidad) : 'por definir'}` : 'sin dato'}</div></td>`;
    });
    h += '</tr>';
  });
  poiProcItems(pid).forEach(it => {
    const mark = cols.some(c => sts[c].worst.item && sts[c].worst.item.id === it.id);
    h += `<tr><td><button class="linkbtn id" data-act="go" data-view="poi" data-aoi="${esc(it.x.aoi)}" data-anio="${it.rep.anio}">${esc(it.id)}</button> ${esc(it.nombre)}<div class="small muted">Actividad del POI de la Facultad (compartida, sin reparto por escuela) · ${esc(it.rep.etiqueta)} · ejecutado ${fmtN(it.x.ejec, 0)} de ${fmtN(it.x.prog, 0)} programado al corte · ${esc(it.x.pag || '')}</div></td>`;
    cols.forEach(c => { h += `<td>${mark ? '<span class="tag">★ marca el estado</span><br>' : ''}${chip(it.code)}<div class="small num">${fmtN(it.x.avance, 1)} % del programado al corte</div></td>`; });
    h += '</tr>';
  });
  const exP = (M.poi2025_extra || []).filter(e => (M.proc_poi || []).some(r => r[0] === pid && r[1] === e.act));
  if (exP.length) h += `<tr><td colspan="${cols.length + 1}" class="small muted">Archivo de trabajo del POI 2025 [A19], no oficial y fuera del semáforo: ${exP.map(e => `${esc(e.act)} ${esc((AOI_BY[e.act] || {}).actividad || '')} ${fmtN(e.avance_recalculado, 1)} % (${esc(e.ref.replace(/^.*hoja '[^']*', /, ''))})`).join('; ')}. No están en el reporte anual en PDF.</td></tr>`;
  return h + '</tbody></table></div></div>';
}

function viewProcesos() {
  const root = document.createElement('div');
  let h = pageHead('Procesos del criterio 10.2', 'Los nueve procesos mínimos que exige el criterio 10.2 del modelo CONEAU 2026 [A4]. El estado de cada proceso es el del peor de sus indicadores; en cada celda se ve cuál es. Los indicadores SINEACE alimentan a los indicadores de proceso que miden lo mismo.');
  const cols = S.escuela === 'TODAS' ? ORD : [S.escuela];
  const sel = S.procSel || { p: 'P1', esc: cols[0] };
  h += `<div class="grid"><div class="card">${heatmap(cols, { sel })}</div><div id="pdetail">${processDetail(sel.p, sel.esc)}</div></div>`;
  h += sect('Cómo se relacionan procesos, fichas e indicadores', 'i-link');
  h += `<div class="card"><p class="small">Los <b>26 procesos del SGC</b> (fichas PE, PM, PS y ME, con PM09 y PM10 por aprobar) son la unidad de gestión. Los <b>9 procesos del criterio 10.2</b> son lo que CONEAU exige como mínimo; cada uno se apoya en una o más fichas (${M.rel_proceso_ficha.length} vínculos) y en sus indicadores de proceso (${M.rel_proceso_indicador.length} vínculos). Los <b>29 indicadores SINEACE</b> son los que fija el modelo; ${M.indicadores.filter(i => i.alias_sineace).length} indicadores de proceso miden exactamente lo mismo y toman su dato. Detalle en <button class="linkbtn" data-act="go" data-view="relaciones">Relaciones</button>.</p></div>`;
  root.innerHTML = h;
  return root;
}

function viewEstandares() {
  const root = document.createElement('div');
  const escs = schoolsSel();
  let h = pageHead('Estándares E1–E10 e indicadores ID01–ID29', 'Los 10 estándares y los 29 indicadores del modelo de acreditación CONEAU 2026 [A4]. Un indicador se asocia a un estándar por los criterios que cita su ficha; la numeración de criterios del texto plano está por confirmar.');
  const evRows = evidenceRows();
  const stdState = id => {
    const ids = M.sineace.filter(s => s.estandares.includes(id)).map(s => s.id);
    const items = []; escs.forEach(e => ids.forEach(i => { if (inScope(e, i)) { const st = status(e, i); items.push({ id: i, code: st.state, st, gap: gapOf(st), esc: e }); } }));
    return { ids, w: worstOf(items), n: items.length };
  };
  const evCov = (std, modo) => {
    const evs = M.evidencias.filter(e => e.estandar === std).map(e => e.id);
    const rows = evidenceRows(modo).filter(r => escs.includes(r.escuela) && evs.includes(r.ev));
    const ok = rows.filter(EV_OK).length;
    return { total: rows.length, ok, evs: evs.length };
  };
  const covBar = (c, lbl, ex) => `<span class="small muted">${ex ? '<span class="exb">EJEMPLO</span> ' : ''}${lbl}: ${c.total ? c.ok + ' de ' + c.total + ' disponibles' : 'sin estado cargado'}</span><span class="bar-s${ex ? ' ex' : ''}" aria-hidden="true"><i style="width:${c.total ? c.ok / c.total * 100 : 0}%"></i></span>`;
  h += `<div class="grid g-auto" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">`;
  M.estandares.forEach(e => {
    const s = stdState(e.id);
    const evTxt = `Evidencias EV${e.ev_desde.slice(2)}–${e.ev_hasta.slice(2)}`;
    const bars = S.ejemplo ? covBar(evCov(e.id, 'EJ'), evTxt, true) + covBar(evCov(e.id, 'REAL'), evTxt + ' · datos reales', false) : covBar(evCov(e.id, 'REAL'), evTxt, false);
    let head, line2;
    if (s.ids.length) { head = chip(s.w.code); line2 = `${s.ids.length} ${s.ids.length === 1 ? 'indicador' : 'indicadores'} del modelo · ${e.n_criterios} criterios`; }
    else {
      const al = ALERTS.filter(a => a.objeto === 'Estándar' && a.objetoId === e.id && escs.includes(a.escuela));
      head = al.length ? `<span class="chip st-risk">${I('i-risk')}<span>Sin evidencia exigida</span></span>` : `<span class="chip st-nodata">${I('i-nodata')}<span>Sin indicadores del modelo</span></span>`;
      line2 = e.id === 'E10' ? `Sin indicadores del modelo · ${M.procesos102.length} procesos del criterio 10.2 · ${e.n_criterios} criterios` : `Sin indicadores del modelo · ${e.n_criterios} criterios`;
    }
    h += `<button class="estc" data-act="est" data-e="${e.id}" aria-pressed="${S.estSel === e.id}"><span class="eid">${e.id}</span><span class="enm">${esc(e.nombre)}</span>${head}<span class="small muted">${line2}</span><span class="small">${s.w.item ? 'Marca: <b>' + esc(s.w.item.id) + '</b>' : '&nbsp;'}</span>${bars}</button>`;
  });
  h += '</div>';
  const std = S.estSel;
  const e10Sec = () => {
    let x = sect('Estándar 10 · procesos del criterio 10.2 y evidencias EV49–EV52', 'i-target');
    x += `<p class="note">El estándar 10 no tiene indicadores del modelo SINEACE: se vigila por los ${M.procesos102.length} procesos mínimos del criterio 10.2 y por las evidencias EV49 a EV52. Mientras no haya datos cargados, esas evidencias figuran con la alerta «sin evidencia exigida» (R14) y los procesos sin indicador vigilado quedan sin estado.</p>`;
    const al = ALERTS.filter(a => a.objeto === 'Estándar' && a.objetoId === 'E10' && escs.includes(a.escuela));
    x += al.length ? `<div class="grid g2">${al.map(a => alertCard(a, true)).join('')}</div>` : '<div class="empty">Las evidencias EV49 a EV52 están disponibles en las escuelas seleccionadas.</div>';
    x += `<div class="card" style="margin-top:12px">${heatmap(escs.filter(c => c !== 'FAC'), {})}</div>`;
    return x;
  };
  if (std === 'E10') h += e10Sec();
  h += sect('Indicadores ID01–ID29', 'i-grid');
  const list = M.sineace.filter(s => !std || s.estandares.includes(std));
  h += `<div class="filters"><span class="small muted">${std ? `Filtrado por <b>${std}</b> · ` : ''}${list.length} indicadores.</span>${std ? `<button class="btn small" data-act="est" data-e="">Quitar filtro</button>` : ''}</div>`;
  if (!list.length) h += '<p class="note">Este estándar no tiene indicadores del modelo SINEACE: se vigila con los procesos del criterio 10.2 y las evidencias que se muestran arriba y abajo.</p>';
  else {
    h += '<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(175px,1fr))">';
    list.forEach(s => {
      const items = escs.filter(e => inScope(e, s.id)).map(e => ({ id: s.id, code: status(e, s.id).state, st: status(e, s.id), gap: gapOf(status(e, s.id)), esc: e }));
      const w = worstOf(items); const code = items.length ? w.code : 'NA'; const it = w.item || items[0];
      h += `<button class="tile st-${ST[code].cls}" data-act="ficha" data-id="${s.id}" data-esc="${it ? it.esc : escs[0]}"><span class="idn"><span>${s.id.replace('ID', 'ID')}</span>${chip(code)}</span><span class="nm">${esc(s.nombre)}</span><span class="small">${it && it.st.last ? `<b>${fmtVal(it.st.last.valor, it.st.last.unidad)}</b> / ref. ${esc(s.ref_texto)}` : `ref. ${esc(s.ref_texto)}`}</span></button>`;
    });
    h += '</div>';
    h += `<div class="tblw" style="margin-top:12px"><table class="tbl"><thead><tr><th>ID</th><th>Indicador</th><th>Referencia</th><th>Estándar(es)</th>${SCH.map(e => `<th>${esc(ESC_BY[e].corto)}</th>`).join('')}</tr></thead><tbody>`;
    list.forEach(s => {
      h += `<tr class="clk" data-act="ficha" data-id="${s.id}" data-esc="${escs[0] === 'FAC' ? 'TM' : escs[0]}"><td class="id">${s.id}</td><td>${esc(s.nombre)}</td><td class="num">${esc(s.ref_texto)}</td><td>${s.estandares.map(x => `<span class="tag">${x}</span>`).join('') || '<span class="tag gap">por confirmar</span>'}</td>`;
      SCH.forEach(e => { const st = status(e, s.id); h += `<td>${inScope(e, s.id) ? stChip(st) + exOf(st) + `<div class="small num">${st.last ? fmtVal(st.last.valor, st.last.unidad) : ''}</div>` : chip('NA')}</td>`; });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
  }
  if (!std) h += e10Sec();
  h += autoevalSection(std);
  // evidencia por area
  h += sect('Evidencia por área', 'i-doc');
  const areas = [{ k: 'ENF|', l: 'Enfermería' }, { k: 'OBS|', l: 'Obstetricia' }, ...TM_AREAS.map(a => ({ k: 'TM|' + a, l: 'TM · ' + a }))];
  const evMap = new Map(evRows.map(r => [r.escuela + '|' + r.area + '|' + r.ev, r]));
  const noInd = id => { const st = (EV_BY[id] || {}).estandar; return st && !M.sineace.some(x => x.estandares.includes(st)); };
  const evChip = (r, evId) => {
    if (!r) return noInd(evId) ? `<span class="chip st-risk">${I('i-risk')}<span>Sin evidencia exigida</span></span>` : `<span class="chip st-nodata">${I('i-nodata')}<span>Sin estado</span></span>`;
    const m = { 'Validada': ['st-ok', 'i-ok'], 'Disponible': ['st-info', 'i-doc'], 'En elaboración': ['st-risk', 'i-risk'], 'No iniciada': ['st-crit', 'i-crit'], 'No aplica': ['st-na', 'i-na'] }[r.estado] || ['st-nodata', 'i-nodata'];
    return `<span class="chip ${m[0]}" title="${esc(r.ubicacion || '')}">${I(m[1])}<span>${esc(r.estado)}</span></span>${r.origen === 'EJEMPLO' ? ' <span class="exb">EJEMPLO</span>' : ''}`;
  };
  const stds = std ? [std] : M.estandares.map(e => e.id);
  if (S.ejemplo) h += `<div class="banner ex">${I('i-info')}<div><b>EJEMPLO.</b> Mientras el interruptor de datos de ejemplo esté activo, los estados de esta tabla y las barras de evidencias disponibles de arriba son de ejemplo (marcados EJEMPLO) y se muestran aparte de los datos reales cargados por archivo.</div></div>`;
  h += `<p class="note">Estado de cada evidencia del modelo (EV1–EV52) por área. Tecnología Médica se muestra por sus cuatro áreas: Radiología, Terapia Física, Terapia Ocupacional y Laboratorio Clínico y Anatomía Patológica. Los estados salen de la hoja Evidencias de cada archivo de carga.</p><div class="tblw"><table class="tbl"><thead><tr><th>Evidencia</th>${areas.map(a => `<th>${a.l}</th>`).join('')}</tr></thead><tbody>`;
  stds.forEach(sid => {
    h += `<tr><td colspan="${areas.length + 1}" style="background:var(--lila);font-weight:700">${sid} · ${esc(EST_BY[sid].nombre)}</td></tr>`;
    M.evidencias.filter(e => e.estandar === sid).forEach(e => {
      h += `<tr><td><b>${e.id}</b> <span class="small muted">${esc((e.descripcion || '').slice(0, 90))}${(e.descripcion || '').length > 90 ? '…' : ''}</span></td>${areas.map(a => { const [es, ar] = a.k.split('|'); return `<td>${evChip(evMap.get(es + '|' + ar + '|' + e.id), e.id)}</td>`; }).join('')}</tr>`;
    });
  });
  h += '</tbody></table></div>';
  root.innerHTML = h;
  return root;
}

/* ===================== Vistas: PEI y POI, indicadores, ficha, alertas ===================== */
function worstAcross(id, escs) {
  const items = escs.filter(e => inScope(e, effId(id)) || inScope(e, id)).map(e => { const st = status(e, id); return { id, code: st.state, st, gap: gapOf(st), esc: e }; });
  return items.length ? worstOf(items) : { code: 'NA', item: null };
}
const aoiForInd = id => uniq([...M.rel_indicador_aoi.filter(r => r[0] === id).map(r => r[1]), ...M.rel_sineace_aoi.filter(r => r[0] === id).map(r => r[1])]);

function viewPOI() {
  const root = document.createElement('div');
  const A = poiAll(); const anio = S.poiAnio; const R = A[anio]; const rep = R.rep;
  const vg = +S.params.gen.banda_poi_verde || 95, rg = +S.params.gen.banda_poi_rojo || 75;
  const escs = schoolsSel().filter(e => e !== 'FAC').length ? schoolsSel().filter(e => e !== 'FAC') : SCH;
  const metaR = metaRowFor('PE01-I3', anio);
  const pst = metaR ? (R.i3 >= metaR.meta ? 'OK' : 'BAJO') : 'DEF';
  const bandCount = { CRIT: R.conProg.filter(x => x.avance < rg).length, RIESGO: R.conProg.filter(x => x.avance >= rg && x.avance < vg).length, OK: R.conProg.filter(x => x.avance >= vg).length };
  let h = pageHead('PEI y POI', 'Indicadores vinculados a los objetivos y acciones estratégicas (OEI/AEI) y a las actividades operativas (AOI), con lo programado y lo ejecutado.');
  h += `<div class="banner ex">${I('i-info')}<div><b>POI compartido por la Facultad.</b> Los reportes de seguimiento (${M.poi_reportes.map(r => r.reporte).join(', ')}) son del centro de costo 01.30 de la Facultad de Medicina y no distinguen escuela ni área. Por eso las AOI no se reparten entre Tecnología Médica, Enfermería y Obstetricia. <b>Desagregación por escuela: por confirmar</b> con la UPPR (ver Pendientes). El POI formal aprobado tampoco está en el proyecto: los reportes muestran solo las AOI activas.</div></div>`;
  h += `<div class="banner">${I('i-info')}<div><b>Marco vigente.</b> Rige el PEI 2026-2030 (RR N.° 009248-2025-R, con opinión favorable del CEPLAN) [A12]; el PEI 2023-2027 queda como serie histórica de 2024 y 2025. Los documentos no dicen si el nuevo deja sin efecto al anterior ni cómo es la transición del PE FM 2024-2027: <b>por confirmar con la OGPL</b>. Las metas de la Facultad para 2026-2030 no figuran en la matriz [A18]: <b>por confirmar</b>.</div></div>`;
  h += `<div class="filters"><span class="small muted">Reporte:</span><div class="seg-btn" role="group" aria-label="Reporte del POI">${M.poi_reportes.map(r => `<button data-act="poi-anio" data-anio="${r.anio}" aria-pressed="${r.anio === anio}">${r.anio === 2026 ? 'Feb. 2026 (parcial)' : r.anio}</button>`).join('')}</div><span class="small muted">${esc(rep.reporte)} · consulta ${fmtDate(parseISO(rep.consulta))} · estructura ${anio === 2026 ? 'PEI 2026-2030' : 'PEI 2023-2027'}</span></div>`;
  h += `<div class="kpis" style="margin-bottom:14px">
    <div class="card kpi"><span class="l">Cumplimiento del POI (PE01-I3)</span><span class="v">${fmtN(R.i3, 2)} %</span>${anio === 2025 ? `<span class="small muted">Cifra oficial: reporte anual en PDF [A15], ${R.conProg.length} AOI, imprime ${fmtN(rep.impreso, 2)} %. El Excel de trabajo [A19] da 93,81 % con 33 y trae 91,00 % escrito: diferencia registrada.</span>` : ''}<span class="small muted">Meta MAGPROF ${metaR ? metaR.meta + ' %' : 'por definir'}</span><div>${chip(pst)}</div></div>
    <div class="card kpi"><span class="l">AOI con programación</span><span class="v">${R.conProg.length}</span><span class="small muted">de ${R.lista.length} en el reporte</span></div>
    <div class="card kpi"><span class="l">AOI con ${vg} % o más</span><span class="v">${R.p6n}</span><span class="small muted">${fmtN(R.p6, 1)} % (PE01-P6)</span></div>
    <div class="card kpi"><span class="l">AOI en riesgo / críticas</span><span class="v">${bandCount.RIESGO} / ${bandCount.CRIT}</span><span class="small muted">${rg}–${vg} % / menos de ${rg} %</span></div>
    <div class="card kpi"><span class="l">Sobreejecución (> ${S.params.gen.umbral_sobreejecucion} %)</span><span class="v">${R.p7n}</span><span class="small muted">${fmtN(R.p7, 1)} % (PE01-P7) · el reporte lo trunca a 100 %</span></div></div>`;
  h += '<div id="poi-ch1" class="grid g2"></div>';
  // selector de AOI para lineas
  const aoiList = R.conProg.slice().sort((a, b) => a.aoi.localeCompare(b.aoi));
  const cur = S.poiAoi && aoiList.find(x => x.aoi === S.poiAoi) ? S.poiAoi : (aoiList[0] && aoiList[0].aoi);
  h += sect('Programado vs ejecutado por actividad', 'i-chart');
  h += `<div class="filters"><label>AOI<select id="poi-aoi" aria-label="AOI">${aoiList.map(x => `<option value="${x.aoi}" ${x.aoi === cur ? 'selected' : ''}>${x.aoi.slice(-5)} · ${esc((AOI_BY[x.act] || {}).actividad || x.act)}</option>`).join('')}</select></label></div><div id="poi-ch2"></div>`;
  // tabla por AEI
  h += sect(`Actividades por acción estratégica (${anio === 2026 ? 'AEI del PEI 2026-2030' : 'AEI del PEI 2023-2027'})`, 'i-link');
  const groups = {}; R.lista.forEach(x => { const a = AOI_BY[x.act]; const aei = (a && a.aei[String(anio)]) || '—'; (groups[aei] = groups[aei] || []).push(x); });
  const aeiName = code => { if (anio === 2026) { const a = M.aoi.find(z => z.aei['2026'] === code && z.aei_2026_nombre); return a ? a.aei_2026_nombre : 'nombre en el PEI [A12]'; } const a = M.aoi.find(z => z.aei[String(anio)] === code && z.ae_pefm_nombre); return a ? `${a.ae_pefm_nombre} (AE del PE FM con el mismo código [CP])` : 'nombre por confirmar'; };
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>AEI</th><th>AOI y actividad</th><th>Programado</th><th>Ejecutado</th><th>Avance</th><th>Indicadores vinculados</th><th>Escuela</th></tr></thead><tbody>`;
  Object.keys(groups).sort().forEach(aei => {
    const g = groups[aei]; const cp = g.filter(x => x.prog > 0); const avg = cp.length ? cp.reduce((s, x) => s + x.avance, 0) / cp.length : null;
    h += `<tr><td colspan="7" style="background:var(--lila)"><b>${esc(aei)}</b> ${esc(aeiName(aei))} <span class="small muted">· ${cp.length} AOI con programación${avg !== null ? ' · avance promedio ' + fmtN(avg, 1) + ' %' : ''}</span></td></tr>`;
    g.forEach(x => {
      const a = AOI_BY[x.act]; const inds = a ? a.indicadores : []; const sn = a ? a.sineace : [];
      const code = x.prog > 0 ? (x.avance >= vg ? 'OK' : x.avance >= rg ? 'RIESGO' : 'CRIT') : 'NA';
      h += `<tr><td></td><td><b>${x.aoi.slice(-5)}</b> ${esc(a ? a.actividad : x.act)}<div class="small muted">${esc(x.aoi)} · p. ${esc(x.pag || '')}${a && !a.en_alcance_sgc ? ' · fuera del alcance del SGC' : ''}</div></td><td class="num">${fmtN(x.prog, 0)}</td><td class="num">${fmtN(x.ejec, 0)}</td><td>${x.prog > 0 ? chip(code, ` <b>${fmtN(x.avance, 0)} %</b>`) : '<span class="muted small">S.P. (sin programación)</span>'}</td><td>${[...sn, ...inds].map(i => `<button class="linkbtn tag" data-act="ficha" data-id="${i}" data-esc="${escs[0]}">${i}</button>`).join('') || '<span class="tag gap">sin indicador</span>'}</td><td><span class="tag gap">Compartida por la Facultad</span></td></tr>`;
    });
  });
  h += '</tbody></table></div>';
  if (anio === 2025 && (M.poi2025_extra || []).length) h += `<div class="banner">${I('i-info')}<div><b>Cifra oficial de 2025: el reporte anual en PDF [A15], con 30 actividades (${fmtN(M.poi2025_resumen.promedio_pdf_2025_30_aoi, 2)} %).</b> El Excel de seguimiento [A19] es un archivo de trabajo con 33. Las tres que solo trae el Excel no entran a las cifras: ${M.poi2025_extra.map(e => `${esc((AOI_BY[e.act] || {}).actividad || e.act)} (${esc(e.ref.replace(/^.*hoja '[^']*', /, ''))}, ${fmtN(e.ejec, 0)} de ${fmtN(e.prog, 0)}, ${fmtN(e.avance_recalculado, 1)} %)`).join('; ')}. Con las 33 la media sería ${fmtN(M.poi2025_resumen.promedio_recalculado, 2)} %. Decisión de Robert, 20-10-2026.</div></div>`;
  // plan operativo de Tecnologia Medica
  h += sect('Plan operativo 2026 de Tecnología Médica [A17]', 'i-doc');
  h += `<p class="note">Es el POI de escuela disponible, en formato UPPR (sin código visible en el archivo). Trae solo programación mensual, sin ejecución y sin desagregar por área. Los POI de Enfermería y Obstetricia están <b>por confirmar</b>: se pedirán a sus direcciones en el mismo formato.</p>`;
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>Actividad (AOI de la Facultad)</th><th>Unidad</th>${MESES.map(m => `<th>${m}</th>`).join('')}<th>Total EPTM</th><th>Total Facultad 2026</th><th>Fuente</th></tr></thead><tbody>${(M.eptm || []).map(e => `<tr><td><b>${esc(e.act_facultad)}</b> ${esc((AOI_BY[e.act_facultad] || {}).actividad || e.actividad)}<div class="small muted">${esc(e.aei_fac || '')}</div></td><td>${esc(e.unidad)}</td>${e.meses.map(v => `<td class="num">${v || ''}</td>`).join('')}<td class="num"><b>${e.total}</b></td><td class="num">${fmtN(e.total_fac, 0)}</td><td class="small">${esc(e.ref)}</td></tr>`).join('')}</tbody></table></div>`;
  h += `<p class="note">La programación de la escuela cabe dentro de la de la Facultad en cada mes: es coherente con que las AOI recaigan en las escuelas, pero no prueba el reparto. La escuela programa 1 currículo y 1 plan de mejora aunque tiene cuatro áreas, lo que sugiere que se trata como un solo programa (pendiente de programas ya existente).</p>`;
  // continuidad en el PEI 2026-2030
  const cont = M.pei_continua || [];
  if (cont.length) {
    const nR = cont.filter(c => c.tono === 'Rojo').length, nN = cont.length - nR;
    h += sect(`Indicadores que continúan en el PEI 2026-2030 (${cont.length})`, 'i-link');
    h += `<p class="note">La matriz de la Facultad [A18] marca con texto rojo (${nR}) o naranja oscuro (${nN}) los indicadores que «continúan en medición para el plan 2026-2030». Por indicación de Robert (20-10-2026) ambos significan «continúa», pero se mantienen como dos estados distintos; qué diferencia a cada tono está por confirmar.</p>`;
    h += `<div class="tblw" style="max-height:380px"><table class="tbl"><thead><tr><th>Código</th><th>Indicador del PE FM</th><th>Estado en el PEI 2026-2030</th><th>Fuente</th></tr></thead><tbody>${cont.map(c => { const i = IND_BY['PEFM-' + c.cod]; return `<tr><td><b>${esc(c.cod)}</b></td><td>${esc(i ? i.nombre : '')}</td><td><span class="tag">Continúa · marca ${esc(c.tono.toLowerCase())}</span></td><td class="small">${esc(c.ref)}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  // objetivos
  h += sect('Indicadores por objetivo estratégico', 'i-link');
  h += `<div class="filters"><span class="small muted">Marco:</span><div class="seg-btn" role="group" aria-label="Marco estratégico"><button data-act="marco" data-m="pefm" aria-pressed="${(S.marco || 'pefm') === 'pefm'}">PE FM 2024-2027</button><button data-act="marco" data-m="pei" aria-pressed="${S.marco === 'pei'}">PEI UNMSM 2026-2030</button></div></div>`;
  const marco = S.marco || 'pefm';
  const kO = marco === 'pefm' ? 'pe_oe' : 'pei_oei', kA = marco === 'pefm' ? 'pe_ae' : 'pei_aei', kInd = marco === 'pefm' ? 'pe_ind' : 'pei_ind', kV = marco === 'pefm' ? 'pe_vinculo' : 'pei_vinculo';
  const byO = {};
  M.indicadores.forEach(i => { const o = i[kO]; if (!o) return; (byO[o] = byO[o] || []).push(i); });
  h += '<div class="grid g2">';
  Object.keys(byO).sort().forEach(o => {
    const lst = byO[o]; const byA = {}; lst.forEach(i => (byA[i[kA] || 'Sin acción'] = byA[i[kA] || 'Sin acción'] || []).push(i));
    h += `<details class="fold" ${Object.keys(byO).length <= 4 ? 'open' : ''}><summary>${esc(o)} <span class="small muted">· ${lst.length} indicadores</span></summary><div>`;
    Object.keys(byA).sort().forEach(a => {
      h += `<p class="small" style="margin:8px 0 4px"><b>${esc(a)}</b></p><div class="pill-row">${byA[a].map(i => { const w = worstAcross(i.id, escs); return `<button class="chip st-${ST[w.code].cls}" data-act="ficha" data-id="${i.id}" data-esc="${escs[0]}" title="${esc(i.nombre)} · vínculo: ${esc(i[kV] || '')}">${I(ST[w.code].icon)}<span>${esc(i.id)}</span></button>`; }).join('')}</div>`;
    });
    h += '</div></details>';
  });
  h += '</div><p class="note">El vínculo de cada indicador con el objetivo es criterio propio [CP] (mismo indicador, relacionado o contribuye). El PE FM 2024-2027 sigue al PEI 2023-2027; el PEI vigente es el 2026-2030 y el texto no dice si deja sin efecto al anterior (Pendientes).</p>';
  root.innerHTML = h;
  const c1 = $('#poi-ch1', root); c1.append(poiYearsChart(), poiBulletChart(anio));
  const c2 = $('#poi-ch2', root); if (cur) c2.append(poiLinesChart(anio, [cur]));
  $('#poi-aoi', root).addEventListener('change', e => { S.poiAoi = e.target.value; render(); });
  return root;
}

/* ===================== Indicadores ===================== */
function indMeta(id) { return CARG_BY[id] ? (CARG_BY[id].tipo === 'SINEACE' ? SIN_BY[id] : IND_BY[id]) : IND_BY[id]; }
function viewIndicadores() {
  const root = document.createElement('div');
  const escs = S.escuela === 'TODAS' ? [...SCH, 'FAC'] : schoolsSel();
  const f = S.fInd || (S.fInd = { tipo: '', proc: '', est: '', estado: '', q: '' });
  let h = pageHead('Indicadores', 'Los 29 indicadores SINEACE y los indicadores de proceso que se cargan. Haz clic en una fila para ver su ficha de trazabilidad.');
  h += `<div class="filters">
   <label>Tipo<select data-f="tipo"><option value="">Todos</option><option ${f.tipo === 'SINEACE' ? 'selected' : ''}>SINEACE</option><option ${f.tipo === 'Proceso' ? 'selected' : ''}>Proceso</option><option ${f.tipo === 'PE FM' ? 'selected' : ''}>PE FM</option></select></label>
   <label>Proceso 10.2<select data-f="proc"><option value="">Todos</option>${M.procesos102.map(p => `<option value="${p.id}" ${f.proc === p.id ? 'selected' : ''}>P${p.n} ${esc(p.nombre.slice(0, 38))}</option>`).join('')}</select></label>
   <label>Estándar<select data-f="est"><option value="">Todos</option>${M.estandares.map(e => `<option value="${e.id}" ${f.est === e.id ? 'selected' : ''}>${e.id}</option>`).join('')}</select></label>
   <label>Estado<select data-f="estado"><option value="">Todos</option>${['CRIT', 'RIESGO', 'BAJO', 'SD', 'SEG', 'OK', 'DEF'].map(k => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${ST[k].label}</option>`).join('')}</select></label>
   <label>Buscar<input type="text" data-f="q" value="${esc(f.q)}" placeholder="código o palabra"></label></div>`;
  const rows = CARGABLES.filter(c => {
    if (f.tipo && c.tipo !== f.tipo) return false;
    if (f.proc && !procsOfIndicator(c.id).includes(f.proc)) return false;
    if (f.est && !(c.tipo === 'SINEACE' ? SIN_BY[c.id].estandares.includes(f.est) : (SIN_BY[effId(c.id)] ? SIN_BY[effId(c.id)].estandares.includes(f.est) : false))) return false;
    if (f.q && !(c.id + ' ' + c.nombre).toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.estado) { const w = worstAcross(c.id, escs); if (w.code !== f.estado) return false; }
    return escs.some(e => inScope(e, c.id)) || c.tipo === 'SINEACE';
  });
  h += `<p class="small muted">${rows.length} indicadores.</p><div class="tblw"><table class="tbl" id="tbl-ind"><thead><tr><th>ID</th><th>Indicador</th><th>Frecuencia</th><th>Meta</th>${escs.map(e => `<th>${esc(ESC_BY[e].corto)}</th>`).join('')}<th>Serie</th></tr></thead><tbody>`;
  rows.forEach(c => {
    const mi = metaInfo(c.id); const mr = metaRowFor(c.id, corteDate().getUTCFullYear()) || metaRowFor(c.id, 9999);
    const also = M.indicadores.filter(i => i.alias_sineace === c.id).map(i => i.id);
    h += `<tr class="clk" data-act="ficha" data-id="${c.id}" data-esc="${c.tipo === 'PE FM' ? 'FAC' : escs[0]}"><td class="id">${c.id}</td><td>${esc(c.nombre)}<div class="small muted">${c.tipo}${also.length ? ' · mide también ' + also.join(', ') : ''}${c.tipo === 'Proceso' ? ' · ' + esc(IND_BY[c.id].ficha) : ''}</div></td><td>${esc(c.frecuencia)}</td><td class="num">${mr ? fmtVal(mr.meta, mi.unidad) : mi.estado === 'En conflicto' ? '<span class="tag gap">en conflicto</span>' : '<span class="tag gap">por definir</span>'}</td>`;
    escs.forEach(e => { if (!inScope(e, c.id)) { h += `<td>${chip('NA')}</td>`; return; } const st = status(e, c.id); h += `<td>${stChip(st)}${exOf(st)}<div class="small num">${st.last ? fmtVal(st.last.valor, st.last.unidad) + ' · ' + esc(st.last.pinfo.p) : ''}</div></td>`; });
    const first = escs.map(e => status(e, c.id)).find(s => s.last);
    h += `<td>${first ? spark(first.sr.ev) : ''}</td></tr>`;
  });
  h += '</tbody></table></div>';
  // graficos para un indicador
  h += sect('Gráficos de un indicador', 'i-chart');
  h += `<div class="filters"><label>Indicador<select id="sel-ind">${CARGABLES.map(c => `<option value="${c.id}" ${c.id === S.cmpInd ? 'selected' : ''}>${c.id} · ${esc(c.nombre.slice(0, 70))}</option>`).join('')}</select></label></div><div class="grid g2" id="ind-charts"></div>`;
  root.innerHTML = h;
  const cid = S.cmpInd; const sts = ORD.map(e => ({ esc: e, st: status(e, cid) })).filter(s => s.st.last && (S.escuela === 'TODAS' || s.esc === S.escuela));
  const unit = metaInfo(cid).unidad === '%' ? '%' : '';
  $('#ind-charts', root).append(trendChart(sts, { unit, title: `Tendencia · ${cid}` }), compareChart(cid, { title: `Comparación entre escuelas · ${cid}` }));
  $$('[data-f]', root).forEach(el => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', e => { f[el.dataset.f] = e.target.value; const pos = e.target.selectionStart; render(); const nf = $(`[data-f="${el.dataset.f}"]`); if (nf && el.tagName === 'INPUT') { nf.focus(); nf.setSelectionRange(pos, pos); } }));
  $('#sel-ind', root).addEventListener('change', e => { S.cmpInd = e.target.value; render(); });
  return root;
}

/* ===================== Ficha de trazabilidad ===================== */
function openFicha(id, esc_) {
  S.fichaId = id; S.fichaEsc = esc_ || S.fichaEsc || 'TM';
  renderFicha();
}
function closeFicha() { S.fichaId = null; renderFicha(); }
function renderFicha() {
  const host = $('#drawer-root'); host.innerHTML = '';
  if (!S.fichaId) { document.body.style.overflow = ''; return; }
  const id = S.fichaId, eid = effId(id), meta = indMeta(id) || {}; const isS = !!SIN_BY[id]; const ind = IND_BY[id];
  const escs = ORD;
  const esc_ = S.fichaEsc;
  const mi = metaInfo(eid); const catE = CARG_BY[eid] || {};
  const st = status(esc_, id);
  const procs = procsOfIndicator(eid);
  const stds = SIN_BY[eid] ? SIN_BY[eid].estandares : [];
  const rows = (S.params.metas[eid] || []);
  const bg = document.createElement('div'); bg.className = 'drawer-bg'; bg.onclick = closeFicha;
  const dr = document.createElement('aside'); dr.className = 'drawer'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true'); dr.setAttribute('aria-label', 'Ficha del indicador ' + id);
  const nombre = isS ? SIN_BY[id].nombre : ind ? ind.nombre : id;
  const aois = uniq([...aoiForInd(id), ...(eid !== id ? aoiForInd(eid) : [])]);
  const evOfStd = stds.flatMap(sx => M.evidencias.filter(e => e.estandar === sx));
  let b = `<header><div style="flex:1"><div class="small" style="opacity:.85">${isS ? 'Indicador del modelo CONEAU 2026' : 'Indicador de proceso'} · ${esc(isS ? 'SINEACE' : ind ? ind.ficha : '')}</div><h2>${esc(id)} · ${esc(nombre)}</h2></div><button class="btn" data-act="close-ficha" aria-label="Cerrar ficha">${I('i-x')}Cerrar</button></header><div class="body">`;
  b += `<div class="filters"><span class="small muted">Escuela:</span><div class="seg-btn" role="group" aria-label="Escuela de la ficha">${escs.map(e => `<button data-act="ficha-esc" data-esc="${e}" aria-pressed="${e === esc_}">${esc(ESC_BY[e].corto)}</button>`).join('')}</div></div>`;
  b += `<div class="card"><div class="pill-row">${stChip(st)}${exOf(st)}${st.last ? `<span class="num"><b>${fmtVal(st.last.valor, st.last.unidad)}</b> en ${esc(st.last.pinfo.p)}</span>` : ''}${eid !== id ? `<span class="tag">dato tomado de ${eid} (mide lo mismo)</span>` : ''}</div>`;
  b += `<dl class="kv" style="margin-top:10px">
    <dt>Qué dice el estado</dt><dd>${st.last ? `${fmtVal(st.last.valor, st.last.unidad)} frente a ${st.last.meta !== null ? (st.last.sinEsperado ? 'una meta anual de ' + fmtVal(st.last.meta, st.last.unidad) + ' sin valor esperado al corte: ' + st.last.espTxt : st.last.espTxt + (st.last.cumple !== null ? (st.last.cumple ? ' (cumple)' : ' (no cumple)') : ' (' + fmtN(st.last.cumpl, 1) + ' % de lo esperado)')) : 'una meta por definir'}${st.desde ? `. En este estado desde el periodo ${esc(st.desdePeriodo)} (${fmtDate(st.desde)})` : ''}.` : 'No hay ninguna medición con fuente cargada para esta escuela.'}</dd>
    ${st.vencido ? `<dt>Dato vencido</dt><dd>Esperado: periodo ${esc(st.expLabel)}. Último: ${esc(st.last.pinfo.p)}. Plazo vencido el ${fmtDate(st.overdueSince)}.</dd>` : ''}
    ${st.tendencia ? `<dt>Tendencia</dt><dd>Se aleja de la meta ${st.tendencia.n} periodos seguidos: ${esc(st.tendencia.serie)}</dd>` : ''}</dl></div>`;
  const aeX = S.autoeval && S.autoeval[esc_]; const aeI = aeX && aeX.indicadores.find(x => x.id === eid);
  if (aeI) {
    const pc = (SIN_BY[eid] || {}).unidad === '%'; const fv = v => v === null ? '—' : pc ? fmtN(v * 100, 1) + ' %' : fmtN(v, 2) + (((SIN_BY[eid] || {}).unidad || '') === 'años' ? ' años' : '');
    b += `<div class="card"><div class="pill-row"><span class="chip st-nodata">${I('i-nodata')}<span>Sin dato validado</span></span><h3 style="margin:0">Valor del informe de autoevaluación</h3></div><dl class="kv" style="margin-top:8px">
      <dt>Valor del informe</dt><dd><b>${fv(aeI.valor)}</b> frente a un referencial de ${fv(aeI.referencial)} <span class="small muted">(el Consolidado dice: ${esc(aeI.estadoRef || '—')})</span></dd>
      <dt>Cálculo</dt><dd>${esc(aeI.variables || '—')}</dd>
      ${aeI.obs ? `<dt>Observación</dt><dd>${esc(aeI.obs)}</dd>` : ''}
      <dt>Fuente</dt><dd>${esc(aeX.name)} · ${esc(aeI.ref)}</dd></dl>
      <p class="small muted" style="margin:8px 0 0">Robert indicó que estos valores no son datos validados: solo ID1 trae sus variables. Se muestran para consulta, no definen el estado ni generan alertas de meta.</p></div>`;
  }
  b += `<div class="card"><h3>Definición</h3><dl class="kv" style="margin-top:8px">
    <dt>Nombre</dt><dd>${esc(nombre)}</dd>
    <dt>Fórmula</dt><dd>${esc(isS ? 'Según la ficha del indicador en el modelo CONEAU 2026 [A4]; porcentaje o tiempo de acuerdo con su unidad' : ind.formula)}</dd>
    <dt>Fuente del dato</dt><dd>${esc(isS ? 'Encuestas y registros de la escuela [CP]' : ind.fuente_dato)}</dd>
    <dt>Periodicidad</dt><dd>${esc(catE.frecuencia || '—')}${isS ? ' <span class="small muted">(tomada de los indicadores de proceso vinculados [CP])</span>' : ' <span class="small muted">(propuesta [CP])</span>'}</dd>
    <dt>Responsable</dt><dd>${esc(responsableOf(esc_, id))}</dd>
    <dt>Unidad y sentido</dt><dd>${esc(mi.unidad)} · ${esc(mi.sentido)}</dd>
    ${(() => { const rk = reglaKey((rows[0] || {}).regla); return rk !== 'razon' ? `<dt>Regla de cumplimiento</dt><dd>${esc(REGLAS[rk].nombre)}<div class="small muted">${esc(isS && SIN_BY[id].regla_nota ? SIN_BY[id].regla_nota : REGLAS[rk].txt)}</div></dd>` : ''; })()}
    <dt>Ámbito</dt><dd>${esc(ind ? ind.ambito : 'Escuela')}${ind && ind.ambito === 'Facultad' ? ' (cumplimiento del POI de la Facultad: no se reparte por escuela)' : ''}</dd></dl></div>`;
  const applied = st.last && st.last.bands ? `<p class="small" style="margin:8px 0 0"><b>Umbrales aplicados a este dato:</b> En meta desde ${st.last.bands.verde} % ${st.last.bands.base === 'valor' ? 'de avance' : 'de la meta'}; Crítico por debajo de ${st.last.bands.rojo} %. Fuente: ${esc(st.last.bandsSrc || 'parámetros')}.</p>` : '';
  b += `<div class="card"><h3>Meta y umbrales</h3><div class="tblw" style="margin-top:8px"><table class="tbl"><thead><tr><th>Desde</th><th>Meta</th><th>Fuente de la meta</th><th>Límite meta</th><th>Límite riesgo</th><th>Fuente del umbral</th></tr></thead><tbody>`;
  b += rows.map(r => `<tr><td>${r.desde ? r.desde : 'siempre'}</td><td class="num">${r.meta !== null ? fmtVal(r.meta, mi.unidad) : '<span class="tag gap">' + esc(r.estado_meta || 'por definir') + '</span>'}</td><td>${esc(r.fuente_meta || '—')}</td><td class="num">${r.verde_min != null ? r.verde_min + ' %' : '<span class="tag gap">por definir</span>'}</td><td class="num">${r.rojo_min != null ? r.rojo_min + ' %' : '<span class="tag gap">por definir</span>'}</td><td>${esc(r.fuente_umbral || (r.verde_min != null ? '' : 'Sin fuente: sin semáforo'))}</td></tr>`).join('') || '<tr><td colspan="6">Sin metas cargadas</td></tr>';
  b += `</tbody></table></div>${mi.nota ? `<p class="note" style="margin-top:8px">${esc(mi.nota)}</p>` : ''}${applied}${st.last && st.last.espFuente ? `<p class="small" style="margin:8px 0 0"><b>Esperado a la fecha de corte:</b> ${fmtVal(st.last.esperado, st.last.unidad)}${st.last.prorrata ? ' (prorrateo lineal de la meta anual)' : ''}. Fuente: ${esc(st.last.espFuente)}. La alerta compara contra este valor y no contra la meta anual.</p>` : ''}<p class="small muted">Sin umbral con fuente, el indicador no tiene semáforo: se compara con la meta y, si la supera, queda «En meta»; si no, «Bajo la meta, umbral por definir» en gris.</p></div>`;
  b += `<div class="card"><h3>Vínculos</h3><dl class="kv" style="margin-top:8px">
    <dt>Procesos del criterio 10.2</dt><dd>${procs.map(p => `<span class="tag">P${P102_BY[p].n} ${esc(P102_BY[p].nombre)}</span>`).join('') || '<span class="tag gap">ninguno de los nueve</span>'}</dd>
    <dt>Ficha(s) del SGC</dt><dd>${(isS ? SIN_BY[id].fichas : [ind.ficha]).map(f => `<span class="tag" title="${esc(FICHA_BY[f]?.nombre || '')}">${f} ${esc(FICHA_BY[f]?.nombre || '')}</span>`).join('')}</dd>
    <dt>Estándar(es) CONEAU</dt><dd>${stds.map(x => `<span class="tag">${x} ${esc(EST_BY[x].nombre)}</span>`).join('') || (isS ? '<span class="tag gap">por confirmar</span>' : '<span class="tag gap">vía el indicador SINEACE vinculado, si lo hay</span>')}${isS ? `<div class="small muted">Criterios que cita la ficha: ${esc(SIN_BY[id].criterios_texto)}${SIN_BY[id].criterios_fuente ? `. Fuente: ${esc(SIN_BY[id].criterios_fuente)}${SIN_BY[id].criterios_previos ? `; antes decía «${esc(SIN_BY[id].criterios_previos)}»` : ''}` : ''}</div>` : ''}</dd>
    ${isS ? `<dt>Indicadores de proceso</dt><dd>${SIN_BY[id].indicadores_proceso.map(i => `<button class="linkbtn tag" data-act="ficha" data-id="${i}" data-esc="${esc_}">${i}</button>`).join('') || '<span class="tag gap">sin indicador de proceso: se mide directo</span>'}</dd>` : `<dt>Indicador SINEACE</dt><dd>${ind.alias_sineace ? `<button class="linkbtn tag" data-act="ficha" data-id="${ind.alias_sineace}" data-esc="${esc_}">${ind.alias_sineace}</button> mide lo mismo` : (M.rel_sineace_indicador.filter(r => r[1] === id).map(r => `<button class="linkbtn tag" data-act="ficha" data-id="${r[0]}" data-esc="${esc_}">${r[0]}</button>`).join('') || '<span class="tag gap">sin referencia en el modelo</span>')}</dd>`}
    ${ind ? `<dt>PE FM 2024-2027</dt><dd>${esc(ind.pe_oe || '—')} · ${esc(ind.pe_ae || '')}<div class="small muted">${esc(ind.pe_ind || '')} · vínculo: ${esc(ind.pe_vinculo || '')} · ${esc(ind.pe_fuente || '')}</div></dd>
    ${ind && ind.continua_pei ? `<dt>Continuidad en el PEI 2026-2030</dt><dd><span class="tag cont-${ind.continua_tono === 'Rojo' ? 'r' : 'n'}">Continúa · marca ${esc(ind.continua_tono.toLowerCase())}</span><div class="small muted">${esc(M.pei_continua.find(c => c.cod === ind.cod_pe_fm)?.ref || '')}. Los dos tonos se mantienen como estados distintos: qué diferencia a cada uno está por confirmar.</div></dd>` : ''}
    <dt>PEI UNMSM 2026-2030</dt><dd>${esc(ind.pei_oei || '—')} · ${esc(ind.pei_aei || '')}<div class="small muted">${esc(ind.pei_ind || '')} · vínculo: ${esc(ind.pei_vinculo || '')} · ${esc(ind.pei_fuente || '')}</div></dd>` : ''}
    <dt>POI (AOI)</dt><dd>${aois.length ? aois.map(a => { const x = AOI_BY[a]; const A = poiAll(); const last = A[2026].lista.find(z => z.act === a && z.prog > 0) || A[2025].lista.find(z => z.act === a && z.prog > 0); return `<div><span class="tag gap">Compartida por la Facultad</span> <b>${a}</b> ${esc(x.actividad)}${last ? ` <span class="small muted">· avance ${fmtN(last.avance, 0)} % (${last.aoi.slice(-5)})</span>` : ''}</div>`; }).join('') : '<span class="tag gap">sin AOI en los reportes</span>'}<div class="small muted">POI formal aprobado y desagregación por escuela: por confirmar.</div></dd>
    <dt>Evidencias (EV) del estándar</dt><dd>${evOfStd.length ? evOfStd.slice(0, 14).map(e => `<span class="tag" title="${esc(e.descripcion)}">${e.id}</span>`).join('') + (evOfStd.length > 14 ? ' …' : '') : '<span class="tag gap">por confirmar</span>'}</dd></dl></div>`;
  // graficos
  b += '<div id="ficha-ch" class="grid"></div>';
  // historial
  const hist = st.sr.pts.slice().reverse();
  const all = DB.vis.concat(DB.rejected).filter(r => r.escuela === esc_ && r.indicador === eid);
  b += `<div class="card"><h3>Historial de valores y trazabilidad</h3>${all.length ? `<div class="tblw" style="margin-top:8px"><table class="tbl"><thead><tr><th>Periodo</th><th>Valor</th><th>Estado</th><th>Fuente del dato</th><th>Evidencia</th><th>Cargó</th><th>Versión</th><th>Validación</th><th>Origen</th></tr></thead><tbody>${all.sort((a, c) => (c.pinfo ? c.pinfo.end : 0) - (a.pinfo ? a.pinfo.end : 0)).map(r => { const ev = r.pinfo && !r.motivo ? evalPoint(eid, r) : null; return `<tr${r.motivo ? ' style="opacity:.7"' : ''}><td>${esc(r.periodo)}${r.area ? '<br><span class="small muted">' + esc(r.area) + '</span>' : ''}</td><td class="num">${r.valor !== null ? fmtVal(r.valor, mi.unidad) : '—'}</td><td>${r.motivo ? `<span class="chip st-info">${I('i-info')}<span>No se muestra</span></span><div class="small">${esc(r.motivo)}</div>` : chip(ev.state)}</td><td>${esc(r.fuente_dato || '—')}</td><td>${esc([r.ev, r.ev_ref].filter(Boolean).join(' · ') || 'sin evidencia')}</td><td>${esc(r.cargado_por || '—')}<div class="small muted">${r.fecha_carga ? fmtDate(parseISO(r.fecha_carga)) : '—'}</div></td><td class="num">${r.version}</td><td>${esc(r.estado_val)}${r.validado_por ? '<div class="small muted">' + esc(r.validado_por) + (r.fecha_val ? ' · ' + fmtDate(parseISO(r.fecha_val)) : '') + '</div>' : ''}</td><td>${r.origen === 'EJEMPLO' ? exBadge : 'Real'}<div class="small muted">${esc(r.archivo)}</div></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty" style="margin-top:8px">Sin mediciones de esta escuela.</div>'}</div>`;
  const als = ALERTS.filter(a => a.objetoId === id && a.escuela === esc_ || (eid !== id && a.objetoId === eid && a.escuela === esc_));
  b += `<div class="card"><h3>Alertas de este indicador (${als.length})</h3><div class="grid" style="margin-top:8px">${als.map(a => alertCard(a)).join('') || '<div class="empty">Sin alertas en esta escuela.</div>'}</div></div>`;
  b += '</div>';
  dr.innerHTML = b;
  host.append(bg, dr);
  document.body.style.overflow = 'hidden';
  const sts = escs.map(e => ({ esc: e, st: status(e, id) })).filter(s => s.st.last);
  const chs = $('#ficha-ch', dr);
  chs.append(trendChart(sts, { unit: mi.unidad === '%' ? '%' : '', title: `Tendencia · ${id}` }), compareChart(id, { title: `Comparación entre escuelas · ${id}` }));
  dr.querySelector('.btn').focus();
}

/* ===================== Alertas ===================== */
function viewAlertas() {
  const root = document.createElement('div');
  const f = S.fAl || (S.fAl = { esc: '', sev: '', regla: '' });
  if (S.escuela !== 'TODAS' && !f.touched) f.esc = S.escuela;
  let list = ALERTS.filter(a => (!f.esc || a.escuela === f.esc) && (!f.sev || a.severidad === f.sev) && (!f.regla || a.regla === f.regla));
  let h = pageHead('Alertas', 'Reglas explícitas y editables en Parámetros. Cada alerta dice qué ocurre, por qué, desde cuándo, a quién corresponde y qué decisión se sugiere.');
  const byRule = {}; ALERTS.forEach(a => byRule[a.regla] = (byRule[a.regla] || 0) + 1);
  h += `<div class="filters">
   <label>Escuela<select data-fa="esc"><option value="">Todas</option>${ORD.map(e => `<option value="${e}" ${f.esc === e ? 'selected' : ''}>${esc(ESC_BY[e].corto)}</option>`).join('')}</select></label>
   <label>Severidad<select data-fa="sev"><option value="">Todas</option>${['Crítica', 'En riesgo', 'Aviso'].map(e => `<option ${f.sev === e ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
   <label>Regla<select data-fa="regla"><option value="">Todas</option>${S.params.reglas.map(r => `<option value="${r.id}" ${f.regla === r.id ? 'selected' : ''}>${r.id} ${esc(r.nombre)} (${byRule[r.id] || 0})</option>`).join('')}</select></label>
   <span style="flex:1"></span><button class="btn" data-act="export" data-what="alertas" data-fmt="xlsx">${I('i-download')}Alertas (Excel)</button><button class="btn" data-act="export" data-what="alertas" data-fmt="csv">${I('i-download')}Alertas (CSV)</button></div>`;
  const cnt = L => ({ c: L.filter(x => x.severidad === 'Crítica').length, r: L.filter(x => x.severidad === 'En riesgo').length, a: L.filter(x => x.severidad === 'Aviso').length });
  const tot = cnt(ALERTS), vis = cnt(list);
  h += `<p class="small muted"><b>${tot.c + tot.r} críticas y en riesgo</b> de <b>${ALERTS.length} alertas en total</b> (${tot.c} críticas, ${tot.r} en riesgo y ${tot.a} avisos); la cifra de la barra lateral cuenta solo las críticas y en riesgo. ${f.esc || f.sev || f.regla ? `Con los filtros actuales se muestran <b>${list.length}</b> (${vis.c} críticas, ${vis.r} en riesgo y ${vis.a} avisos).` : 'Se muestran todas.'}${S.ejemplo ? ' Incluye alertas calculadas sobre datos EJEMPLO (marcadas).' : ''}</p>`;
  h += '<p class="small muted">Orden: por escuela (Enfermería, Obstetricia, Tecnología Médica y Facultad) y, dentro de cada una, por gravedad: crítica, en riesgo y aviso.</p>';
  if (!list.length) h += '<div class="empty">No hay alertas con estos filtros.</div>';
  ORD.forEach(e => {
    const L = list.filter(a => a.escuela === e); if (!L.length) return;
    const c = cnt(L);
    h += `<details class="alg" open><summary><b>${esc(ESC_BY[e].nombre)}</b>${ESC_BY[e].faseTxt ? ` <span class="tag">${esc(ESC_BY[e].faseTxt)}</span>` : ''} <span class="small muted">${L.length} alertas · ${c.c} críticas · ${c.r} en riesgo · ${c.a} avisos</span></summary><div class="grid">`;
    ['Crítica', 'En riesgo', 'Aviso'].forEach(sv => {
      const X = L.filter(a => a.severidad === sv); if (!X.length) return;
      h += `<h4 class="alsev">${sevChip(sv)} <span class="small muted">${X.length}</span></h4>${X.map(a => alertCard(a)).join('')}`;
    });
    h += '</div></details>';
  });
  root.innerHTML = h;
  $$('[data-fa]', root).forEach(el => el.addEventListener('change', e => { f[el.dataset.fa] = e.target.value; f.touched = true; render(); }));
  return root;
}

/* ===================== Vistas: relaciones, parametros, cargas, pendientes ===================== */
const FILES_B64 = (() => { try { return JSON.parse(document.getElementById('files-json').textContent); } catch (e) { return {}; } })();

function viewRelaciones() {
  const root = document.createElement('div');
  const alias = M.indicadores.filter(i => i.alias_sineace);
  const huerf = M.sineace.filter(s => !s.indicadores_proceso.length);
  let h = pageHead('Relaciones entre indicadores, procesos y estándares', 'Tres niveles que se miden distinto y se leen juntos: los 29 indicadores del modelo CONEAU, los indicadores de proceso del SGC y los procesos (26 del SGC, 9 del criterio 10.2).');
  h += `<div class="grid g3">
   <div class="card"><h3>${M.sineace.length} indicadores SINEACE</h3><p class="small">Los fija el modelo de acreditación [A4]. Son lo que CONEAU revisa. Se cargan por escuela y llevan su valor de referencia del modelo.</p></div>
   <div class="card"><h3>${M.indicadores.filter(i => i.ficha !== 'PE FM').length} indicadores de proceso</h3><p class="small">Los define cada ficha del SGC para gestionar el proceso. <b>${alias.length}</b> miden exactamente lo mismo que un indicador SINEACE: no se cargan dos veces, toman el dato del SINEACE. Los otros ${M.indicadores.filter(i => i.ficha !== 'PE FM').length - alias.length} se cargan aparte. Además hay ${M.indicadores.filter(i => i.ficha === 'PE FM').length} indicadores del plan estratégico de la Facultad (PE FM), que se cargan con la clave FAC.</p></div>
   <div class="card"><h3>26 procesos del SGC · 9 del criterio 10.2</h3><p class="small">Las fichas son la unidad de gestión. Los nueve procesos del criterio 10.2 son el mínimo que CONEAU exige; cada uno se apoya en una o más fichas y en sus indicadores.</p></div></div>`;
  h += `<div class="banner ex">${I('i-info')}<div><b>Cómo se lee.</b> Un indicador SINEACE cumple un estándar (E1 a E10) por los criterios que cita su ficha. Si un indicador de proceso mide lo mismo, su estado es el del SINEACE. El estado de un proceso del 10.2 es el del peor de sus indicadores. El vínculo indicador-estándar es por la numeración de criterios del modelo y está <b>por confirmar</b> donde el texto plano es ambiguo.</div></div>`;
  h += sect(`Indicadores SINEACE ↔ indicadores de proceso ↔ procesos 10.2`, 'i-link');
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>SINEACE</th><th>Estándares</th><th>Indicadores de proceso que lo miden o lo alimentan</th><th>Procesos 10.2</th><th>Fichas SGC</th></tr></thead><tbody>`;
  M.sineace.forEach(s => {
    const al = alias.filter(i => i.alias_sineace === s.id).map(i => i.id);
    const rel = uniq([...M.rel_sineace_indicador.filter(r => r[0] === s.id).map(r => r[1]), ...s.indicadores_proceso]);
    h += `<tr><td><button class="linkbtn id" data-act="ficha" data-id="${s.id}" data-esc="TM">${s.id}</button><div class="small">${esc(s.nombre)}</div></td>
     <td>${s.estandares.map(x => `<span class="tag">${x}</span>`).join('') || '<span class="tag gap">por confirmar</span>'}<div class="small muted">criterios ${esc(s.criterios_texto)}</div></td>
     <td>${rel.map(i => `<button class="linkbtn tag" data-act="ficha" data-id="${i}" data-esc="TM">${i}${al.includes(i) ? ' =' : ''}</button>`).join('') || '<span class="tag gap">sin indicador de proceso: se mide directo</span>'}${al.length ? `<div class="small muted">«=» mide lo mismo</div>` : ''}</td>
     <td>${procsOfIndicator(s.id).map(p => `<span class="tag">P${P102_BY[p].n}</span>`).join('') || '<span class="tag gap">ninguno</span>'}</td>
     <td>${s.fichas.map(f => `<span class="tag" title="${esc(FICHA_BY[f]?.nombre || '')}">${f}</span>`).join('')}</td></tr>`;
  });
  h += '</tbody></table></div>';
  h += sect(`Los ${alias.length} indicadores de proceso que heredan el dato SINEACE`, 'i-link');
  h += `<p class="note">Se puede desactivar en Parámetros («heredar_alias»). Si se desactiva, cada uno se carga por separado.</p><div class="tblw"><table class="tbl"><thead><tr><th>Indicador de proceso</th><th>Ficha</th><th>Mide lo mismo que</th></tr></thead><tbody>${alias.map(i => `<tr><td><b>${i.id}</b> ${esc(i.nombre)}</td><td>${i.ficha}</td><td><button class="linkbtn tag" data-act="ficha" data-id="${i.alias_sineace}" data-esc="TM">${i.alias_sineace}</button> ${esc(SIN_BY[i.alias_sineace].nombre)}</td></tr>`).join('')}</tbody></table></div>`;
  h += sect(`Indicadores SINEACE sin indicador de proceso (${huerf.length})`, 'i-diamond');
  h += `<div class="card"><p class="small">Ninguna ficha del SGC tiene hoy un indicador de proceso para estos. Se miden directo y quedan marcados como brecha de diseño para el comité.</p><div class="pill-row">${huerf.map(s => `<button class="linkbtn tag gap" data-act="ficha" data-id="${s.id}" data-esc="TM" title="${esc(s.nombre)}">${s.id} · ${esc(s.nombre.slice(0, 48))}</button>`).join('') || 'Ninguno.'}</div></div>`;
  h += sect('Procesos del criterio 10.2 y fichas', 'i-grid');
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>Proceso 10.2</th><th>Ficha del SGC</th><th>Indicadores de proceso</th><th>SINEACE vinculados</th><th>Estándares</th></tr></thead><tbody>${M.procesos102.map(p => {
    const fs = M.rel_proceso_ficha.filter(r => r[0] === p.id).map(r => r[1]); const is = M.rel_proceso_indicador.filter(r => r[0] === p.id).map(r => r[1]);
    const sn = uniq(is.map(i => effId(i)).filter(i => SIN_BY[i])); const std = uniq(sn.flatMap(i => SIN_BY[i].estandares)).sort((a, b) => +a.slice(1) - +b.slice(1));
    return `<tr><td><b>P${p.n}</b> ${esc(p.nombre)}<div class="small muted">Ficha: ${esc(p.estado_ficha)}${p.ficha_propuesta && p.ficha_propuesta !== 'Ninguna' ? ' · propuesta: ' + esc(p.ficha_propuesta) : ''}</div></td><td>${fs.map(f => `<span class="tag" title="${esc(FICHA_BY[f]?.nombre || '')}">${f}</span>`).join('')}</td><td>${is.length}</td><td>${sn.map(i => `<span class="tag">${i}</span>`).join('') || '—'}</td><td>${std.map(x => `<span class="tag">${x}</span>`).join('') || '—'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
  h += sect('Fichas del SGC (26 procesos)', 'i-doc');
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>Ficha</th><th>Proceso</th><th>Familia</th><th>Estado</th><th>Indicadores</th><th>Responsable</th></tr></thead><tbody>${M.fichas.map(f => `<tr><td><b>${f.id}</b></td><td>${esc(f.nombre)}</td><td>${esc(f.familia)}</td><td>${esc(f.estado)}</td><td class="num">${M.indicadores.filter(i => i.ficha === f.id).length}</td><td>${esc(f.responsable)}</td></tr>`).join('')}</tbody></table></div>`;
  root.innerHTML = h;
  return root;
}

/* ===================== Parametros ===================== */
const LISTAS = {
  poi_frecuencia: ['Mensual', 'Trimestral', 'Semestral', 'Anual'], poi_evaluar: ['Último reporte', 'Todos'], sin_dato_en_agregado: ['Cuenta', 'Excluye'],
  heredar_alias: ['Sí', 'No'], evidencia_obligatoria: ['Sí', 'No'], alcance_inicial: ['Piloto + 10.2 + SINEACE'],
};
function paramChanged(msg) { POI_CACHE = null; recompute(); S.paramsDirty = true; render(); if (msg) toast(msg); }
function viewParametros() {
  const root = document.createElement('div');
  const f = S.fPar || (S.fPar = { q: '', soloSin: false });
  let h = pageHead('Parámetros', 'Todo lo que decide un estado o una alerta está aquí y se puede editar: fecha de corte, gracia, reglas y metas con sus umbrales. Una meta o un umbral sin fuente no se aplica.');
  h += `<div class="banner ex">${I('i-info')}<div>Parámetros activos: <b>${esc(S.params.origen)}</b> (fecha ${esc(S.params.fecha || '—')}). Los cambios valen para esta sesión. Para conservarlos o repartirlos, usa <b>Exportar parámetros</b> y carga ese archivo en el tablero: se toma la hoja con la fecha más reciente.</div></div>`;
  h += `<div class="filters"><button class="btn primary" data-act="export-params">${I('i-download')}Exportar parámetros (Excel)</button><button class="btn" data-act="reset-params">Restablecer los de fábrica</button></div>`;
  h += sect('Parámetros generales', 'i-grid');
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>Parámetro</th><th>Valor</th><th>Para qué sirve y fuente</th></tr></thead><tbody>`;
  PDEF.general.forEach(([k, , tipo, nota]) => {
    const v = S.params.gen[k]; let ctl;
    if (LISTAS[k]) ctl = `<select data-pg="${k}" ${k === 'alcance_inicial' ? 'disabled' : ''} aria-label="${k}">${LISTAS[k].map(o => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (tipo === 'fecha') ctl = `<input type="date" data-pg="${k}" value="${esc(v instanceof Date ? isoD(v) : v || '')}" aria-label="${k}">`;
    else if (tipo === 'número') ctl = `<input type="number" step="any" data-pg="${k}" value="${esc(v ?? '')}" style="width:100px" aria-label="${k}">`;
    else ctl = `<input type="text" data-pg="${k}" value="${esc(v ?? '')}" aria-label="${k}" ${k === 'fecha_parametros' ? 'readonly' : ''}>`;
    h += `<tr><td class="id">${k}</td><td>${ctl}</td><td class="small">${esc(nota)}${k === 'alcance_inicial' ? ' El alcance real se define en la hoja Alcance de cada archivo.' : ''}${k === 'fecha_corte' ? ' Vacía: con datos EJEMPLO se usa el 20-10-2026; sin ellos, la fecha de hoy.' : ''}</td></tr>`;
  });
  h += '</tbody></table></div>';
  h += sect('Reglas de alerta', 'i-bell');
  h += `<p class="note">Dentro de los textos se pueden usar marcas entre llaves, como {indicador}, {valor}, {meta}, {periodo}, {escuela}; se reemplazan al generar la alerta.</p>`;
  h += '<div class="grid g2">';
  S.params.reglas.forEach((r, i) => {
    h += `<div class="card"><div class="pill-row" style="margin-bottom:8px"><b>${esc(r.id)}</b> <span>${esc(r.nombre)}</span></div>
    <div class="filters"><label>Activa<select data-pr="${i}" data-k="activa"><option ${r.activa !== 'No' ? 'selected' : ''}>Sí</option><option ${r.activa === 'No' ? 'selected' : ''}>No</option></select></label>
    <label>Severidad<select data-pr="${i}" data-k="severidad">${['Crítica', 'En riesgo', 'Aviso'].map(o => `<option ${r.severidad === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
    <p class="small muted" style="margin:4px 0">Condición: ${esc(r.condicion)}</p>
    <label class="small muted">Qué ocurre<textarea data-pr="${i}" data-k="que">${esc(r.que)}</textarea></label>
    <label class="small muted">Por qué<textarea data-pr="${i}" data-k="porque">${esc(r.porque)}</textarea></label>
    <label class="small muted">Decisión o acción sugerida<textarea data-pr="${i}" data-k="accion">${esc(r.accion)}</textarea></label></div>`;
  });
  h += '</div>';
  h += sect('Metas y umbrales', 'i-chart');
  h += `<p class="note">«Meta» y «Límite» se llenan <b>solo con fuente</b>: modelo CONEAU, PEI/POI o documento institucional. Límite meta: desde ahí es «En meta» (semáforo verde). Límite riesgo: debajo de ahí es «Crítico»; entre ambos «En riesgo». «Tipo de avance»: Puntual compara el valor con la meta; «Acumulado en el año» lo compara con lo esperado a la fecha de corte (el valor de esperado_a_fecha de la carga o, en los indicadores del PE FM, el programado acumulado al corte del POI mensual de la Facultad), para no dar falsos rojos con datos parciales. «Regla de cumplimiento»: por defecto es la razón al esperado; en los tiempos (ID25, ID26) cumple si el valor es menor o igual al referencial, y en las variaciones (ID6) si no es negativa. Sin los dos límites y su fuente, no hay semáforo: se compara con la meta y, bajo ella, queda «Bajo la meta» en gris.</p>`;
  h += `<div class="filters"><label>Buscar indicador<input type="text" id="par-q" value="${esc(f.q)}" placeholder="código o palabra"></label><label class="sw"><input type="checkbox" id="par-sin" ${f.soloSin ? 'checked' : ''}><span class="tr" aria-hidden="true"></span><span>Solo sin meta con fuente</span></label></div>`;
  const ids = CARGABLES.filter(c => (!f.q || (c.id + ' ' + c.nombre).toLowerCase().includes(f.q.toLowerCase())) && (!f.soloSin || !(S.params.metas[c.id] || []).some(r => r.meta !== null && r.fuente_meta)));
  h += `<div class="tblw" style="max-height:560px"><table class="tbl"><thead><tr><th>Indicador</th><th>Desde año</th><th>Meta</th><th>Unidad</th><th>Sentido</th><th>Fuente de la meta</th><th>Límite meta (%)</th><th>Límite riesgo (%)</th><th>Base</th><th>Tipo de avance</th><th>Regla de cumplimiento</th><th>Fuente del umbral</th></tr></thead><tbody>`;
  ids.forEach(c => {
    (S.params.metas[c.id] || []).forEach((r, j) => {
      const dk = `data-pm="${c.id}" data-j="${j}"`;
      const sinF = r.meta !== null && !String(r.fuente_meta || '').trim();
      h += `<tr><td><b>${c.id}</b><div class="small muted">${esc(c.nombre.slice(0, 54))}</div></td>
      <td><input type="number" ${dk} data-k="desde" value="${r.desde ?? 0}" style="width:70px" aria-label="Desde año ${c.id}"></td>
      <td><input type="number" step="any" ${dk} data-k="meta" value="${r.meta ?? ''}" style="width:80px" aria-label="Meta ${c.id}">${sinF ? '<div class="small" style="color:var(--bad-t)">sin fuente: no se aplica</div>' : ''}</td>
      <td>${esc(r.unidad)}</td><td class="small">${esc(r.sentido)}</td>
      <td><input type="text" ${dk} data-k="fuente_meta" value="${esc(r.fuente_meta || '')}" style="width:210px" aria-label="Fuente de la meta ${c.id}"></td>
      <td><input type="number" step="any" ${dk} data-k="verde_min" value="${r.verde_min ?? ''}" style="width:70px" aria-label="Límite meta ${c.id}"></td>
      <td><input type="number" step="any" ${dk} data-k="rojo_min" value="${r.rojo_min ?? ''}" style="width:70px" aria-label="Límite riesgo ${c.id}"></td>
      <td><select ${dk} data-k="base" aria-label="Base ${c.id}"><option ${r.base !== 'valor' ? 'selected' : ''}>cumplimiento</option><option ${r.base === 'valor' ? 'selected' : ''}>valor</option></select></td>
      <td><select ${dk} data-k="avance" aria-label="Tipo de avance ${c.id}"><option ${r.avance !== 'Acumulado en el año' ? 'selected' : ''}>Puntual</option><option ${r.avance === 'Acumulado en el año' ? 'selected' : ''}>Acumulado en el año</option></select></td>
      <td><select ${dk} data-k="regla" aria-label="Regla de cumplimiento ${c.id}">${Object.keys(REGLAS).map(k => `<option value="${k}" ${reglaKey(r.regla) === k ? 'selected' : ''}>${esc(REGLAS[k].nombre)}</option>`).join('')}</select></td>
      <td><input type="text" ${dk} data-k="fuente_umbral" value="${esc(r.fuente_umbral || '')}" style="width:190px" aria-label="Fuente del umbral ${c.id}"></td></tr>`;
    });
  });
  h += '</tbody></table></div>';
  root.innerHTML = h;
  $$('[data-pg]', root).forEach(el => el.addEventListener('change', e => {
    const k = el.dataset.pg; let v = e.target.value;
    if (e.target.type === 'number') v = v === '' ? null : +v;
    S.params.gen[k] = v;
    if (k === 'fecha_corte') S.corteOverride = null;
    S.params.fecha = isoD(new Date()); S.params.gen.fecha_parametros = S.params.fecha; S.params.origen = 'Editados en el tablero';
    paramChanged('Parámetro actualizado.');
  }));
  $$('[data-pr]', root).forEach(el => el.addEventListener('change', e => { S.params.reglas[+el.dataset.pr][el.dataset.k] = e.target.value; S.params.origen = 'Editados en el tablero'; paramChanged('Regla actualizada.'); }));
  $$('[data-pm]', root).forEach(el => el.addEventListener('change', e => {
    const r = S.params.metas[el.dataset.pm][+el.dataset.j]; const k = el.dataset.k; let v = e.target.value;
    if (['desde', 'meta', 'verde_min', 'rojo_min'].includes(k)) v = v === '' ? null : parseFloat(String(v).replace(',', '.'));
    if (k === 'desde' && v === null) v = 0;
    r[k] = v;
    if (r.verde_min !== null && r.rojo_min !== null && r.verde_min < r.rojo_min) { toast('El límite meta debe ser mayor o igual que el límite riesgo.'); }
    r.estado_meta = r.meta !== null && String(r.fuente_meta || '').trim() ? 'Con fuente' : 'Por definir';
    S.params.origen = 'Editados en el tablero';
    paramChanged(r.meta !== null && !String(r.fuente_meta || '').trim() ? 'Meta guardada, pero sin fuente no se aplica.' : 'Meta o umbral actualizado.');
  }));
  const q = $('#par-q', root); q.addEventListener('input', e => { f.q = e.target.value; const pos = e.target.selectionStart; render(); const n = $('#par-q'); n.focus(); n.setSelectionRange(pos, pos); });
  $('#par-sin', root).addEventListener('change', e => { f.soloSin = e.target.checked; render(); });
  return root;
}

/* ===================== Cargas ===================== */
function viewCargas() {
  const root = document.createElement('div');
  let h = pageHead('Cargas', 'Cada escuela llena su plantilla de Excel y el tablero consolida los archivos. Puedes cargar los tres a la vez. Los datos de ejemplo se apagan solos al cargar datos reales.');
  h += sect('Orden de implementación', 'i-flow');
  h += `<div class="grid g3">${SCH.map(e => { const fl = S.files.filter(f => f.escuela === e && f.rows.length); const act = enImplementacion(e); return `<div class="card"><div class="pill-row"><span class="tag">${esc(ESC_BY[e].faseTxt)}</span>${fl.length ? '<span class="chip st-ok">' + I('i-ok') + '<span>Con archivo</span></span>' : act ? '<span class="chip st-risk">' + I('i-risk') + '<span>Debe cargar</span></span>' : '<span class="tag gap">aún no exigido</span>'}</div><h3 style="margin-top:6px">${esc(ESC_BY[e].nombre)}</h3>${e === 'TM' ? `<p class="small muted" style="margin:4px 0 0">Subfases por área: ${TM_AREAS.map(a => esc(a)).join(' · ')}.</p>` : '<p class="small muted" style="margin:4px 0 0">Programa de pregrado.</p>'}</div>`; }).join('')}</div><p class="note">Orden definido por Robert: 1.º Enfermería, 2.º Obstetricia, 3.º Tecnología Médica por áreas. El tablero y la plantilla están listos para las tres desde el inicio; solo las escuelas «en implementación» generan alertas por falta de datos (parámetro escuelas_en_implementacion). Fechas de cada fase: por confirmar.</p>`;
  h += `<div class="drop" id="drop" role="button" tabindex="0" aria-label="Soltar archivos Excel o presionar para elegirlos"><p style="margin:0 0 8px"><b>Suelta aquí los archivos Excel de las escuelas</b> (.xlsx) o</p><button class="btn primary" data-act="pick-files">${I('i-upload')}Elegir archivos</button><p class="small muted" style="margin:8px 0 0">Todo se procesa en tu equipo: no se sube nada a ningún servidor.</p></div>`;
  h += sect('Plantilla y archivos de ejemplo', 'i-download');
  const dls = [['SGC_Plantilla_de_carga_por_escuela_v0.6.xlsx', 'Plantilla de carga (vacía)', 'La misma para las tres escuelas: listas desplegables, validaciones, catálogo, 53 criterios y 29 ID en «sin dato».'], ['SGC_EJEMPLO_carga_ENF.xlsx', 'Ejemplo · Enfermería', 'Con datos EJEMPLO inventados y rotulados.'], ['SGC_EJEMPLO_carga_OBS.xlsx', 'Ejemplo · Obstetricia', 'Con datos EJEMPLO inventados y rotulados.'], ['SGC_EJEMPLO_carga_TM.xlsx', 'Ejemplo · Tecnología Médica', 'Con datos EJEMPLO inventados y rotulados.']];
  h += `<div class="grid g4">${dls.map(([n, t, d]) => `<div class="card"><h3 style="font-size:1rem">${t}</h3><p class="small muted">${d}</p>${FILES_B64[n] ? `<button class="btn" data-act="dl-b64" data-n="${n}">${I('i-download')}Descargar</button>` : '<span class="tag gap">no incluido en esta versión</span>'}</div>`).join('')}</div>`;
  h += sect(`Archivos cargados (${S.files.length})`, 'i-doc');
  if (!S.files.length) h += `<div class="empty">Todavía no cargaste archivos. ${S.ejemplo ? 'Se están mostrando los datos EJEMPLO incrustados.' : 'Sin archivos ni ejemplo, no hay datos que mostrar.'}</div>`;
  else {
    h += `<div class="tblw"><table class="tbl"><thead><tr><th>Archivo</th><th>Escuela</th><th>Plantilla</th><th>Mediciones</th><th>Resultado</th><th></th></tr></thead><tbody>`;
    S.files.forEach(f => {
      const nIn = DB.vis.filter(r => r.archivo === f.name).length, nRej = DB.rejected.filter(r => r.archivo === f.name).length;
      h += `<tr><td><b>${esc(f.name)}</b><div class="small muted">Leído ${esc(f.cargadoEn)} ${f.ejemplo ? exBadge : ''}${f.soloParams ? ' · solo parámetros' : ''}</div></td><td>${esc(f.escuela ? ESC_BY[f.escuela]?.nombre || f.escuela : '—')}</td><td>${esc(f.version || '—')}</td><td class="num">${f.rows.length} leídas<br>${nIn} válidas · ${nRej} no se muestran${f.ignoradas ? '<br>' + f.ignoradas + ' ignoradas' : ''}</td>
       <td>${f.errors.length ? `<span class="chip st-crit">${I('i-crit')}<span>Con errores</span></span>` : `<span class="chip st-ok">${I('i-ok')}<span>Leído</span></span>`}${f.errors.map(x => `<div class="small" style="color:var(--bad-t)">${esc(x)}</div>`).join('')}${f.warns.map(x => `<div class="small muted">${esc(x)}</div>`).join('')}</td>
       <td><button class="btn small" data-act="rm-file" data-n="${esc(f.name)}">Quitar</button></td></tr>`;
    });
    h += '</tbody></table></div>';
  }
  const aes = Object.values(S.autoeval || {});
  if (aes.length) {
    h += sect(`Consolidados de autoevaluación (${aes.length})`, 'i-doc');
    h += `<p class="note">Archivo con las hojas Consolidado y Matrices (y, si las trae, Indicadores). Alimenta las alertas R12 (criterio sin evidencia exigida) y R13 (criterio con matriz pendiente). Sus valores de indicadores se guardan como «sin dato validado» y no definen estados.</p><div class="tblw"><table class="tbl"><thead><tr><th>Archivo</th><th>Escuela</th><th>Criterios</th><th>Matrices pendientes</th><th>Valores sin validar</th><th></th></tr></thead><tbody>${aes.map(a => `<tr><td><b>${esc(a.name)}</b><div class="small muted">${a.fabrica ? 'Incluido de fábrica' : 'Leído ' + esc(a.cargadoEn)}</div></td><td>${esc(ESC_BY[a.escuela].nombre)}</td><td class="num">${a.criterios.length}</td><td class="num">${a.nPend} de ${a.nMat}</td><td class="num">${a.indicadores.length}</td><td><button class="btn small" data-act="rm-file" data-n="${esc(a.name)}">Quitar</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  const rej = DB.rejected.filter(r => r.archivo && !/^EJEMPLO/.test(r.archivo) || S.ejemplo);
  h += sect(`Filas que no se muestran como dato (${rej.length})`, 'i-diamond');
  h += `<p class="note">Una fila sin fuente del dato, con periodo inválido o sin valor no entra al tablero. Se avisa con la alerta R11.</p>`;
  h += rej.length ? `<div class="tblw" style="max-height:340px"><table class="tbl"><thead><tr><th>Archivo</th><th>Fila</th><th>Periodo</th><th>Escuela</th><th>Indicador</th><th>Motivo</th></tr></thead><tbody>${rej.slice(0, 200).map(r => `<tr><td>${esc(r.archivo)}</td><td>${r.fila || '—'}</td><td>${esc(r.periodo)}</td><td>${esc(r.escuela)}</td><td>${esc(r.indicador)}</td><td>${esc(r.motivo)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Ninguna fila rechazada.</div>';
  h += sect('Cobertura por escuela', 'i-chart');
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>Escuela</th><th>Archivo</th><th>Indicadores vigilados</th><th>Con dato</th><th>Con evidencia</th><th>Validados</th><th>Vencidos</th></tr></thead><tbody>${[...SCH, 'FAC'].map(e => { const c = coverageStats(e); const fl = S.files.filter(f => f.escuela === e); return `<tr><td><b>${esc(ESC_BY[e].nombre)}</b></td><td>${fl.length ? fl.map(f => esc(f.name)).join(', ') : (S.ejemplo ? 'EJEMPLO incrustado' : '<span class="tag gap">sin archivo</span>')}</td><td class="num">${c.n}</td><td class="num">${c.dato}</td><td class="num">${c.evi}</td><td class="num">${c.val}</td><td class="num">${c.venc}</td></tr>`; }).join('')}</tbody></table></div>`;
  root.innerHTML = h;
  const drop = $('#drop', root);
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file-in').click(); } });
  return root;
}
async function handleFiles(list) {
  if (!list || !list.length) return;
  const msgs = await loadFiles(list);
  S.lastLoad = msgs; render(); toast(msgs.join(' '));
}

/* ===================== Pendientes y decisiones ===================== */
function nuevosPendientes() {
  const nConf = M.indicadores.filter(i => i.estado_meta === 'En conflicto').length;
  const nSinMeta = CARGABLES.filter(c => !(S.params.metas[c.id] || []).some(r => r.meta !== null && r.fuente_meta)).length;
  return [
    { ambito: 'Referencia visual', pendiente: 'El archivo «Tablero de Autoevaluación EPTM» que se mencionó como referencia no estaba en la carpeta del proyecto. Este tablero se construyó a partir de las funciones que se describieron (tarjetas de estado, estándares E1 a E10, indicadores ID01 a ID29, evidencia por área, exportación CSV y modo oscuro), sin copiar nada de ese archivo.', accion: 'Robert sube el archivo del tablero EPTM al proyecto; se compara y se ajusta lo que difiera.' },
    { ambito: 'Metas y umbrales', pendiente: `Solo hay umbrales con fuente para el POI (menos de 75 %, de 75 a menos de 95 %, 95 % o más, según los reportes de seguimiento). Para el resto no se inventan: ${nSinMeta} indicadores no tienen meta con fuente y los demás tienen meta pero no semáforo. Aparecen en gris como «Por definir» o «Bajo la meta».`, accion: 'El comité de calidad define, con fuente, los límites de «En meta» y «En riesgo» por indicador y los carga en Parámetros o en la hoja Metas_Umbrales.' },
    { ambito: 'Metas y umbrales', pendiente: 'Los valores de referencia de los 29 indicadores SINEACE vienen del modelo CONEAU 2026 [A4]. Son referencias del modelo, no metas aprobadas por la Facultad ni por cada escuela.', accion: 'Decidir si la Facultad adopta esas referencias como meta o fija las propias.' },
    { ambito: 'Metas y umbrales', pendiente: `${nConf} indicadores tienen metas en conflicto entre documentos (ver Contradicciones). El tablero usa la meta del documento que se indica en cada caso y la marca; los demás valores quedan sin semáforo.`, accion: 'Resolver con la unidad responsable qué fuente manda para cada indicador en conflicto.' },
    { ambito: 'Estructura', pendiente: 'Tecnología Médica se trata como una escuela con cuatro áreas: Radiología, Terapia Física, Terapia Ocupacional y Laboratorio Clínico y Anatomía Patológica (nombres dados por Robert). La plantilla 0.1 usaba los códigos TM-A1 a TM-A4: el tablero los sigue reconociendo.', accion: 'Confirmar con la dirección de la escuela si los nombres oficiales de las áreas coinciden con estos.' },
    { ambito: 'Estructura', pendiente: 'Sin hoja de área, la serie de una escuela de TM es el promedio simple de sus áreas y se marca «por confirmar». Si se prefiere ponderar por estudiantes, falta el dato de matrícula por área.', accion: 'Confirmar si el valor de TM es promedio simple, ponderado o un solo valor de la escuela.' },
    { ambito: 'Alcance', pendiente: 'Alcance inicial propuesto: los 29 indicadores SINEACE, los indicadores de los nueve procesos del 10.2 y los del piloto. Cada escuela lo ajusta en la hoja Alcance de su archivo.', accion: 'La escuela de cada fase confirma su alcance al recibir la plantilla.' },
    { ambito: 'Implementación', pendiente: 'Orden de implementación definido por Robert: 1.º Enfermería (piloto), 2.º Obstetricia, 3.º Tecnología Médica con subfases por área. Falta la fecha de inicio y cierre de cada fase.', accion: 'Robert o el comité fijan las fechas; el plan de implementación se ajusta a este orden.' },
    { ambito: 'POI de las escuelas', pendiente: 'El POI de escuela disponible es el de Tecnología Médica (formato UPPR). Los de Enfermería y Obstetricia están por confirmar.', accion: 'Pedirlos a las direcciones de escuela en el mismo formato UPPR.' },
    { ambito: 'Formatos oficiales', pendiente: 'La plantilla de carga es una propuesta y no lleva código de formato. Donde exista un formato oficial de la UNMSM o de la Facultad (por ejemplo, del Manual FM) se debe usar y citar su código; no se inventan códigos.', accion: 'Por confirmar con la UPPR qué formatos oficiales cubren la carga de indicadores y cuáles son sus códigos.' },
    { ambito: 'PEI vigente', pendiente: 'Rige el PEI 2026-2030 (RR N.° 009248-2025-R) [A12]; el PEI 2023-2027 queda como serie histórica. Ningún documento leído dice si lo deroga expresamente ni cómo es la transición del PE FM 2024-2027. Las metas de la Facultad para 2026-2030 no figuran en la matriz [A18].', accion: 'Confirmar con la OGPL y la UPPR la derogación y la transición; las metas 2026-2030 de la Facultad quedan por confirmar.' },
    { ambito: 'Indicadores del PE FM', pendiente: 'Los 29 indicadores del PE FM se cargaron desde la matriz [A18] con sus metas de 2024 y 2025 y su responsable. La clasificación de cada uno como «puntual» o «acumulado en el año» es criterio propio [CP], y «2025-I» se tomó como primer semestre calendario. AE.01.03-2 (tutoría) tiene sentido descendente en el PE FM pero el POI lo evalúa como ascendente: queda «Por definir».', accion: 'La unidad responsable confirma la clasificación, la fecha de corte de «2025-I» y el sentido de AE.01.03-2.' },
    { ambito: 'POI 2025', pendiente: 'Decidido por Robert (20-10-2026): la cifra oficial del POI 2025 es el reporte anual en PDF [A15], con 30 actividades y 94,64 %. El Excel de seguimiento [A19] es un archivo de trabajo con 33 (93,81 % recalculado, 91,00 % escrito). Las tres actividades que solo trae el Excel (publicaciones, mantenimiento y equipamiento) no entran a las cifras; la diferencia queda registrada en las incongruencias 1 y 2.', accion: 'Pedir a la UPPR el reporte completo oficial de 2025 con fecha de consulta y centro de costo, para ver si esas tres actividades pertenecen al POI.' },
    { ambito: 'Avance esperado', pendiente: 'Decidido por Robert (20-10-2026): «Avance 2025-I» y los demás datos parciales se comparan con el programado acumulado al corte del POI mensual, no con 0,5 del año. Cada indicador acumulado del PE FM se vincula a una actividad de referencia del POI [CP] (por ejemplo, AE.01.01 con ACT01) y el esperado es la meta anual por la fracción de su programación mensual que ya vencía al corte. Los acumulados sin actividad de referencia con programación mensual (AE.02.01, AE.02.02, AE.02.03, OE.03-2, AE.03.01-1, AE.03.02-2, AE.03.03-2, AE.04.01 y AE.04.02) no tienen esperado con fuente: quedan «En seguimiento» y no en rojo.', accion: 'La UPPR confirma qué actividad del POI mide cada indicador del PE FM; con eso se completan los que hoy quedan en seguimiento.' },
    { ambito: 'Continúa en el PEI', pendiente: 'El rojo (3 indicadores) y el naranja oscuro (11) de la matriz [A18] significan «continúa en medición para 2026-2030». Por indicación de Robert se mantienen como dos estados distintos en la ficha, aunque no se sabe qué diferencia a uno de otro.', accion: 'Confirmar con quien marcó la matriz el significado de cada tono.' },
    { ambito: 'Criterios SINEACE', pendiente: 'Criterios corregidos el 20-10-2026 por Robert, contrastados con las fichas del Modelo: ID4 = 3.1 a 3.4, 4.1, 8.2, 8.4; ID10 = 3.1, 6.1, 8.4; ID11 = 2.7, 9.3; ID23 = 7.4, 8.2; ID27 = 6.1, 6.2, 6.3, 8.2; ID29 = 6.1, 6.2, 6.3, 8.2, 8.5. ID9 sigue por confirmar: queda con 3.5, 7.4, 8.2.', accion: 'Confirmar el conjunto completo de ID9 con la ficha del Modelo.' },
    { ambito: 'Reglas de cumplimiento', pendiente: 'ID25 e ID26 son tiempos y cumplen si el valor es menor o igual al referencial; ID6 es una variación y cumple si no es negativa. La ficha del Modelo dice «menor a» en ID25 e ID26, sin el igual.', accion: 'Confirmar con la OCAA el caso en que el valor es exactamente igual al referencial.' },
    { ambito: 'ID13', pendiente: 'Se mantiene 15 % (ficha del Modelo). La guía de la UNMSM que cita Robert trae 25 %; ese documento no está en el proyecto.', accion: 'Confirmar con la OCAA cuál rige (ver Incongruencias).' },

    { ambito: 'Periodicidad', pendiente: 'La periodicidad de los indicadores SINEACE se tomó de los indicadores de proceso que los miden [CP]. Los días de gracia antes de marcar «dato vencido» (30) son una propuesta [CP].', accion: 'El comité confirma periodicidad y días de gracia.' },
    { ambito: 'Responsables', pendiente: 'El responsable de cada indicador SINEACE se toma de la ficha del SGC vinculada y está «por confirmar» en casi todos los casos. Las alertas lo muestran así.', accion: 'Cada escuela completa el responsable local en la hoja Alcance.' },
    { ambito: 'Flujo de entrega', pendiente: 'No está definido quién envía cada archivo, con qué calendario ni quién consolida y valida (una persona de la Facultad que junte los tres archivos o carga directa de cada escuela).', accion: 'Robert define el calendario y quién consolida; el tablero ya admite los tres archivos a la vez.' },
    { ambito: 'Identidad visual', pendiente: 'Los espacios de logotipo y escudo están vacíos a propósito. No se dibujaron ni se reprodujeron.', accion: 'Robert sube los archivos oficiales desde los recuadros de la barra lateral (se guardan solo en su navegador).' },
    { ambito: 'Herramienta', pendiente: 'El tablero es un archivo HTML que se abre sin instalar nada. Si la Facultad quiere una herramienta institucional (Power BI u otra), el modelo de datos y la plantilla de Excel se pueden reutilizar.', accion: 'Robert decide si se mantiene este formato o se migra.' },
    { ambito: 'Seguridad', pendiente: 'Para leer Excel el archivo incluye la librería SheetJS 0.18.5, que tiene avisos de seguridad públicos conocidos al abrir archivos manipulados. Se usa solo con archivos propios y no hay conexión a internet.', accion: 'Cargar solo archivos que vengan de las escuelas. Valorar actualizar la librería en una versión posterior.' },
    { ambito: 'Gráficos', pendiente: 'Las tres series de escuelas usan tonos violeta, como pide la identidad. En modo oscuro la separación entre tonos no pasa la validación automática de color; se compensa con marcadores distintos, etiquetas directas, leyenda y tabla alternativa. La línea de meta dorada se oscureció para tener contraste.', accion: 'Robert acepta esa desviación o prefiere otro color para una de las series.' },
  ].concat(M.pendientes_v3 || []);
}
const DECISIONES = [
  { t: 'Umbrales «En meta» y «En riesgo»', r: 'Fijarlos por indicador con fuente; no extender 75 % y 95 % del POI al resto sin sustento.', d: 'Mientras no existan, los indicadores solo se comparan con su meta y quedan en gris si no la cumplen.' },
  { t: 'Metas en conflicto entre documentos', r: 'Resolver con la unidad dueña de cada indicador (ver Contradicciones).', d: 'Cada conflicto sin resolver deja el indicador sin semáforo.' },
  { t: 'Referencias SINEACE como metas', r: 'Adoptarlas como meta provisional con la etiqueta «referencia del modelo».', d: 'Hoy se muestran así, sin darles carácter de meta aprobada.' },
  { t: 'POI por escuela', r: 'Usar el POI de Tecnología Médica ya recibido y pedir los de Enfermería y Obstetricia en formato UPPR; el de la Facultad queda como marco común.', d: 'Sin POI de escuela, sus actividades no se reparten.' },
  { t: 'Fechas de las fases de implementación', r: 'Fijar inicio y cierre de cada fase (Enfermería, Obstetricia y las cuatro áreas de Tecnología Médica).', d: 'Con las fechas, el tablero exige la carga a cada escuela desde su fase.' },
  { t: 'Esperado a la fecha en el PE FM', r: 'Mantener la actividad de referencia elegida por criterio propio hasta que la UPPR diga qué actividad mide cada indicador.', d: 'Evita falsos rojos con datos parciales, pero es una aproximación.' },
  { t: 'Un archivo por escuela y quién consolida', r: 'Un archivo por escuela, y una persona de calidad de la Facultad que los reúna cada trimestre.', d: 'Es lo que permite comparar escuelas con el mismo corte.' },
  { t: 'Herramienta definitiva', r: 'Usar este HTML como prototipo y decidir tras el piloto.', d: 'Si se pasa a una herramienta institucional, el modelo y la plantilla se reutilizan.' },
  { t: 'Desviación de color en modo oscuro', r: 'Aceptarla: hay marcadores, etiquetas y tabla alternativa.', d: 'Las tres series violeta son de la identidad y quedan muy cercanas en oscuro.' },
  { t: 'Logotipo, escudo y el tablero EPTM', r: 'Subir los tres archivos al proyecto.', d: 'Los recuadros están listos; el tablero EPTM permite contrastar funciones.' },
];
function viewPendientes() {
  const root = document.createElement('div');
  const nuevos = nuevosPendientes();
  const prev = M.pendientes_previos.filter(p => p.ambito !== 'Ámbito');
  let h = pageHead('Pendientes y decisiones', 'Lo que está «por confirmar» en el tablero, lo que quedó sin resolver en los documentos y las decisiones que le corresponden a Robert.');
  h += sect('Decisiones para Robert', 'i-diamond');
  h += `<div class="grid g2">${DECISIONES.map((d, i) => `<div class="card"><div class="pill-row"><span class="tag">${i + 1}</span><b>${esc(d.t)}</b></div><p class="small" style="margin:6px 0 2px"><b>Propuesta:</b> ${esc(d.r)}</p><p class="small muted" style="margin:0">${esc(d.d)}</p></div>`).join('')}</div>`;
  h += sect(`Pendientes de este tablero (${nuevos.length})`, 'i-bell');
  h += `<div class="tblw"><table class="tbl"><thead><tr><th>Ámbito</th><th>Pendiente</th><th>Acción</th></tr></thead><tbody>${nuevos.map(p => `<tr><td><b>${esc(p.ambito)}</b></td><td>${esc(p.pendiente)}</td><td>${esc(p.accion)}</td></tr>`).join('')}</tbody></table></div>`;
  h += sect(`Pendientes previos del SGC (${prev.length})`, 'i-doc');
  h += `<div class="tblw" style="max-height:460px"><table class="tbl"><thead><tr><th>Ámbito</th><th>Pendiente</th><th>Acción</th></tr></thead><tbody>${prev.map(p => `<tr><td><b>${esc(p.ambito)}</b></td><td>${esc(p.pendiente)}</td><td>${esc(p.accion)}</td></tr>`).join('')}</tbody></table></div>`;
  h += sect(`Contradicciones entre documentos (${M.contradicciones.length})`, 'i-risk');
  h += `<div class="tblw" style="max-height:460px"><table class="tbl"><thead><tr><th>N.º</th><th>Tema</th><th>Qué dicen las fuentes</th><th>Afecta</th><th>Estado</th></tr></thead><tbody>${M.contradicciones.map(c => `<tr><td>${c.n}</td><td><b>${esc(c.tema)}</b><div class="small muted">${esc(c.tipo)}</div></td><td>${esc(c.texto)}</td><td>${esc(c.afecta)}</td><td>${esc(c.estado)}</td></tr>`).join('')}</tbody></table></div>`;
  h += sect('Formatos oficiales de la UNMSM y de la Facultad', 'i-doc');
  h += `<p class="note">Se usan los formatos oficiales que existen y se cita su código. Donde la fuente no trae código no se inventa ninguno: queda «por confirmar con la UPPR». Los formatos que propone el SGC (plantilla de carga, registro de evidencia, fichas PM09 y PM10, acta del Comité de Calidad) tampoco llevan código hasta que la UPPR lo confirme.</p><div class="tblw" style="max-height:460px"><table class="tbl"><thead><tr><th>Uso</th><th>Formato oficial</th><th>Código en la fuente</th><th>Fuente</th></tr></thead><tbody>${(M.formatos || []).map(f => `<tr><td>${esc(f.uso)}</td><td>${esc(f.formato)}</td><td>${/^sin código/i.test(f.codigo) ? '<span class="tag gap">sin código: por confirmar con la UPPR</span>' : esc(f.codigo)}</td><td class="small">${esc(f.fuente)}</td></tr>`).join('')}</tbody></table></div>`;
  h += sect(`Incongruencias entre archivos y con los reportes PDF (${(M.incongruencias || []).length})`, 'i-risk');
  h += `<div class="tblw" style="max-height:520px"><table class="tbl"><thead><tr><th>N.º</th><th>Dónde</th><th>Qué ocurre</th><th>Acción</th></tr></thead><tbody>${(M.incongruencias || []).map(c => `<tr><td>${esc(c.n)}</td><td class="small">${esc(c.donde)}</td><td>${esc(c.que)}</td><td>${esc(c.accion)}</td></tr>`).join('')}</tbody></table></div>`;
  h += sect('Fuentes', 'i-link');
  h += `<div class="tblw" style="max-height:340px"><table class="tbl"><thead><tr><th>Código</th><th>Tipo</th><th>Nombre</th></tr></thead><tbody>${M.fuentes.map(f => `<tr><td><b>${f.id}</b></td><td>${esc(f.tipo)}</td><td>${esc(f.nombre)}</td></tr>`).join('')}</tbody></table></div><p class="note">[CP] marca un criterio propio del equipo, no una cifra de un documento.</p>`;
  root.innerHTML = h;
  return root;
}

/* ===================== Exportacion ===================== */
function downloadBlob(blob, name) {
  if (typeof DS !== 'undefined' && DS.cap && DS.cap.dl) { DS.cap.dl.save({ filename: name, data: blob }).then(() => toast('Archivo guardado: ' + name), e => { if (!e || e.code !== 'declined') toast('No se pudo guardar el archivo (' + ((e && e.code) || 'error') + ').'); }); return; }
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function b64ToBlob(b64, type) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); }
function downloadB64(name) { if (!FILES_B64[name]) return toast('Ese archivo no está incluido en esta versión.'); downloadBlob(b64ToBlob(FILES_B64[name], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), name); }
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const stamp = () => isoD(new Date());
const suffix = () => (S.ejemplo ? '_EJEMPLO' : '') + '_' + stamp();
const csvCell = v => { if (v === null || v === undefined) return ''; let s = typeof v === 'number' ? String(v) : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dOrBlank = d => d ? fmtDate(d) : '';

function rowsIndicadores() {
  const out = [];
  ORD.forEach(e => {
    scopeList(e).forEach(c => {
      const st = status(e, c.id); const L = st.last; const procs = procsOfIndicator(effId(c.id)).map(p => 'P' + P102_BY[p].n).join(' ');
      out.push({
        escuela: ESC_BY[e].nombre, indicador_id: c.id, nombre: c.nombre, tipo: c.tipo, dato_tomado_de: st.eid !== c.id ? st.eid : '', frecuencia: c.frecuencia,
        procesos_10_2: procs, estandares: STAND_OF(effId(c.id)).join(' '),
        estado: ST[st.state].label, periodo: L ? L.pinfo.p : '', valor: L ? round2(L.valor) : '', unidad: L ? L.unidad : metaInfo(st.eid).unidad,
        meta: L && L.meta !== null ? L.meta : '', esperado_a_la_fecha: L && L.esperado !== null ? round2(L.esperado) : '', fuente_esperado: L ? L.espFuente : '', fuente_meta: L ? L.fuenteMeta : '', cumplimiento_pct: L && L.cumpl !== null ? round2(L.cumpl) : '',
        limite_meta_pct: L && L.bands ? L.bands.verde : '', limite_riesgo_pct: L && L.bands ? L.bands.rojo : '', fuente_umbral: L ? L.bandsSrc : '',
        en_este_estado_desde: st.desde ? fmtDate(st.desde) : '', dato_vencido: st.vencido ? 'Sí' : 'No', periodo_esperado: st.expLabel || '',
        tendencia_a_la_baja: st.tendencia ? st.tendencia.serie : '',
        evidencia: L ? [L.m.ev, L.m.ev_ref].filter(Boolean).join(' · ') : '', validacion: L ? L.m.estado_val : '', fuente_dato: L ? L.m.fuente_dato : '',
        cargado_por: L ? L.m.cargado_por : '', fecha_carga: L ? L.m.fecha_carga : '', version_dato: L ? L.m.version : '', origen: L ? L.m.origen : '', archivo: L ? L.m.archivo : '',
      });
    });
  });
  return out;
}
const round2 = v => v === null || v === undefined ? '' : Math.round(v * 100) / 100;
function rowsAlertas() {
  return ALERTS.map(a => ({
    regla: a.regla, nombre_regla: a.reglaNombre, severidad: a.severidad, escuela: ESC_BY[a.escuela]?.nombre || a.escuela, objeto: a.objeto, objeto_id: a.objetoId, nombre: a.objetoNombre, periodo: a.periodo || '',
    que_ocurre: a.que, por_que: a.porque, desde: a.desdeTxt || '', a_quien_corresponde: a.responsable, accion_sugerida: a.accion, origen: a.ejemplo ? 'EJEMPLO' : 'Real',
    corte: fmtDate(corteDate()),
  }));
}
function rowsTraza() {
  const out = [];
  const add = (r, rej) => {
    const eid = r.indicador; const ev = !rej ? evalPoint(eid, r) : null; const aois = aoiForInd(eid).join(' ');
    out.push({
      escuela: ESC_BY[r.escuela]?.nombre || r.escuela, area: r.area, indicador_id: eid, nombre: (CARG_BY[eid] || IND_BY[eid] || {}).nombre || '', periodo: r.periodo, valor: round2(r.valor), numerador: r.numerador ?? '', denominador: r.denominador ?? '',
      estado: rej ? 'No se muestra' : ST[ev.state].label, motivo_si_no_se_muestra: r.motivo || '', meta_aplicada: ev && ev.meta !== null ? ev.meta : '', esperado_a_la_fecha: ev && ev.esperado !== null ? round2(ev.esperado) : '', fuente_esperado: ev ? ev.espFuente : '', fuente_meta: ev ? ev.fuenteMeta : '',
      fuente_dato: r.fuente_dato, evidencia_ev: r.ev, evidencia_ref: r.ev_ref, cargado_por: r.cargado_por, fecha_carga: r.fecha_carga, version_dato: r.version, estado_validacion: r.estado_val, validado_por: r.validado_por, fecha_validacion: r.fecha_val,
      procesos_10_2: procsOfIndicator(eid).map(p => 'P' + P102_BY[p].n).join(' '), estandares: STAND_OF(eid).join(' '), aoi_vinculadas: aois, origen: r.origen, archivo: r.archivo, observacion: r.obs,
    });
  };
  DB.vis.forEach(r => add(r, false)); DB.rejected.forEach(r => add(r, true));
  return out;
}
/* catalogo de criterios y de ID del modelo (se toma del Consolidado incluido; igual para las tres escuelas) */
let CRIT_CAT = null;
function critCatalog() {
  if (CRIT_CAT) return CRIT_CAT;
  const src = Object.values(S.autoeval || {}).find(a => a.fabrica) || Object.values(S.autoeval || {})[0];
  if (src) CRIT_CAT = src.criterios.map(c => ({ estandar: c.estandar, criterio: c.criterio, resumen: c.resumen, evExig: c.evExig }));
  return CRIT_CAT || [];
}
const SIN_DATO = 'sin dato';
function rowsCriterios() {
  const out = [];
  ORD.filter(e => e !== 'FAC').forEach(e => {
    const ae = (S.autoeval || {})[e];
    if (ae) ae.criterios.forEach(c => {
      const pm = c.matrices.filter(x => /pendiente/i.test(x.estado));
      out.push({ escuela: ESC_BY[e].nombre, estandar: c.estandar, criterio: c.criterio, resumen: c.resumen, valoracion_informe: c.valoracion || SIN_DATO, ev_exigidas: c.evExig.join(' '), ev_exigidas_sin_citar: c.evSin.join(' '), matrices_pendientes: pm.map(x => 'M' + x.n).join(' '), prioridad: c.prioridad || '', indicadores_que_lo_citan: M.sineace.filter(x => x.criterios.includes(c.criterio)).map(x => x.id).join(' '), evidencias_citadas: c.nCitadas ?? '', con_enlace: c.nEnlace ?? '', evidencia_que_falta: c.falta || '', archivo: ae.name, fuente: c.ref, origen: ae.fabrica ? 'Consolidado EPTM (incluido)' : 'Archivo cargado' });
    });
    else critCatalog().forEach(c => out.push({ escuela: ESC_BY[e].nombre, estandar: c.estandar, criterio: c.criterio, resumen: c.resumen, valoracion_informe: SIN_DATO, ev_exigidas: c.evExig.join(' '), ev_exigidas_sin_citar: '', matrices_pendientes: '', prioridad: '', indicadores_que_lo_citan: M.sineace.filter(x => x.criterios.includes(c.criterio)).map(x => x.id).join(' '), evidencias_citadas: '', con_enlace: '', evidencia_que_falta: '', archivo: '', fuente: 'Catálogo de criterios del modelo (sin informe cargado de la escuela)', origen: 'Sin dato' }));
  });
  return out;
}
const pctU = (id, v) => v === null || v === undefined ? '' : round2(SIN_BY[id].unidad === '%' ? v * 100 : v);
function rowsValoresInforme() {
  const out = [];
  ORD.filter(e => e !== 'FAC').forEach(e => {
    const ae = (S.autoeval || {})[e];
    M.sineace.forEach(sn => {
      const x = ae && ae.indicadores.find(z => z.id === sn.id);
      out.push({ escuela: ESC_BY[e].nombre, indicador_id: sn.id, nombre: sn.nombre, unidad_modelo: sn.unidad, valor_informe: x ? pctU(sn.id, x.valor) : '', referencial: sn.ref === null || sn.ref === undefined ? '' : sn.ref, referencial_texto: sn.ref_texto || '', fuente_referencial: 'Modelo CONEAU 2026 [A4]', referencial_en_informe: x ? pctU(sn.id, x.referencial) : '', estado_que_declara_el_informe: x ? x.estadoRef : '', calculo: x ? x.variables : '', observacion: x ? x.obs : '', estado: x ? 'Sin dato validado' : SIN_DATO, uso: 'Solo referencia: no interviene en semáforos, alertas ni gráficos', archivo: x ? ae.name : '', fuente: x ? x.ref : '', origen: x ? (ae.fabrica ? 'Consolidado EPTM (incluido)' : 'Archivo cargado') : 'Sin dato' });
    });
  });
  return out;
}

/* ---------- esquema de cada hoja y prueba automatica previa a exportar ----------
   tipos: t texto, n numero (o vacio), p periodo (YYYY, YYYY-S1, YYYY-T1, YYYY-MM), u unidad del catalogo */
const EXP_SCHEMA = {
  indicadores: { escuela: 't', indicador_id: 't', nombre: 't', tipo: 't', dato_tomado_de: 't', frecuencia: 't', procesos_10_2: 't', estandares: 't', estado: 't', periodo: 'p', valor: 'n', unidad: 'u', meta: 'n', esperado_a_la_fecha: 'n', fuente_esperado: 't', fuente_meta: 't', cumplimiento_pct: 'n', limite_meta_pct: 'n', limite_riesgo_pct: 'n', fuente_umbral: 't', en_este_estado_desde: 't', dato_vencido: 't', periodo_esperado: 'p', tendencia_a_la_baja: 't', evidencia: 't', validacion: 't', fuente_dato: 't', cargado_por: 't', fecha_carga: 't', version_dato: 'n', origen: 't', archivo: 't' },
  alertas: { regla: 't', nombre_regla: 't', severidad: 't', escuela: 't', objeto: 't', objeto_id: 't', nombre: 't', periodo: 'p', que_ocurre: 't', por_que: 't', desde: 't', a_quien_corresponde: 't', accion_sugerida: 't', origen: 't', corte: 't' },
  trazabilidad: { escuela: 't', area: 't', indicador_id: 't', nombre: 't', periodo: 'p', valor: 'n', numerador: 'n', denominador: 'n', estado: 't', motivo_si_no_se_muestra: 't', meta_aplicada: 'n', esperado_a_la_fecha: 'n', fuente_esperado: 't', fuente_meta: 't', fuente_dato: 't', evidencia_ev: 't', evidencia_ref: 't', cargado_por: 't', fecha_carga: 't', version_dato: 'n', estado_validacion: 't', validado_por: 't', fecha_validacion: 't', procesos_10_2: 't', estandares: 't', aoi_vinculadas: 't', origen: 't', archivo: 't', observacion: 't' },
  criterios: { escuela: 't', estandar: 't', criterio: 't', resumen: 't', valoracion_informe: 't', ev_exigidas: 't', ev_exigidas_sin_citar: 't', matrices_pendientes: 't', prioridad: 't', indicadores_que_lo_citan: 't', evidencias_citadas: 'n', con_enlace: 'n', evidencia_que_falta: 't', archivo: 't', fuente: 't', origen: 't' },
  valores_informe: { escuela: 't', indicador_id: 't', nombre: 't', unidad_modelo: 'u', valor_informe: 'n', referencial: 'n', referencial_texto: 't', fuente_referencial: 't', referencial_en_informe: 'n', estado_que_declara_el_informe: 't', calculo: 't', observacion: 't', estado: 't', uso: 't', archivo: 't', fuente: 't', origen: 't' },
};
const PER_RE = /^\d{4}(-(S[12]|T[1-4]|(0[1-9]|1[0-2])))?$/;
/** Devuelve la lista de problemas: cada fila debe traer exactamente las columnas del encabezado, en su orden, con el tipo de dato de la columna */
function validateRows(what, rows) {
  const sch = EXP_SCHEMA[what]; const cols = Object.keys(sch); const errs = [];
  const uni = new Set(['', '%', 'días', 'años', 'número', 'por definir']);
  rows.forEach((r, i) => {
    const keys = Object.keys(r);
    if (keys.length !== cols.length || keys.some((k, j) => k !== cols[j])) { errs.push(`${what} fila ${i + 2}: tiene ${keys.length} columnas y el encabezado ${cols.length}${keys.length === cols.length ? ' (distinto orden o nombre)' : ''}`); return; }
    cols.forEach(c => {
      const v = r[c]; const t = sch[c];
      if (v === undefined || v === null) errs.push(`${what} fila ${i + 2}, ${c}: celda sin valor (debe ir vacía como texto)`);
      else if (t === 'n' && !(v === '' || (typeof v === 'number' && Number.isFinite(v)))) errs.push(`${what} fila ${i + 2}, ${c}: se esperaba un número y llegó «${String(v).slice(0, 30)}»`);
      else if (t === 'p' && !(v === '' || (typeof v === 'string' && PER_RE.test(v)))) errs.push(`${what} fila ${i + 2}, ${c}: se esperaba un periodo (2025, 2025-S1, 2025-T1 o 2025-03) y llegó «${String(v).slice(0, 30)}»`);
      else if (t === 'u' && !(typeof v === 'string' && uni.has(v))) errs.push(`${what} fila ${i + 2}, ${c}: unidad fuera del catálogo «${String(v).slice(0, 30)}»`);
      else if ((t === 't' || t === 'u') && typeof v !== 'string') errs.push(`${what} fila ${i + 2}, ${c}: se esperaba texto y llegó ${typeof v}`);
    });
  });
  return errs;
}
/** Deja las filas tal como las generó el tablero (mismas claves y orden): vacío como texto vacío y números en columnas de texto como texto */
function normalizeRows(what, rows) {
  const sch = EXP_SCHEMA[what];
  return rows.map(r => { const o = {}; Object.keys(r).forEach(c => { const v = r[c]; const t = sch[c]; o[c] = (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) ? '' : ((t === 't' || t === 'p') && typeof v === 'number') ? String(v) : v; }); return o; });
}
/** Ordena las filas por escuela (Enfermería, Obstetricia, Tecnología Médica, Facultad); estable dentro de cada una */
const escIdx = name => { const i = ORD.findIndex(e => ESC_BY[e].nombre === name); return i < 0 ? 99 : i; };
function orderBySchool(rows) { return rows.map((r, i) => [r, i]).sort((x, y) => escIdx(x[0].escuela) - escIdx(y[0].escuela) || x[1] - y[1]).map(x => x[0]); }
function exportRows(what) {
  let rows = ({ indicadores: rowsIndicadores, alertas: rowsAlertas, trazabilidad: rowsTraza, criterios: rowsCriterios, valores_informe: rowsValoresInforme })[what]();
  rows = orderBySchool(rows);
  if (what === 'trazabilidad') rows = sortTraza(rows);
  return normalizeRows(what, rows);
}
function sortTraza(rows) {
  return rows.map((r, i) => [r, i]).sort((x, y) => escIdx(x[0].escuela) - escIdx(y[0].escuela) || stateRank(x[0].estado) - stateRank(y[0].estado) || natKey(x[0].indicador_id).localeCompare(natKey(y[0].indicador_id)) || String(x[0].periodo).localeCompare(String(y[0].periodo)) || x[1] - y[1]).map(x => x[0]);
}
/** gravedad del estado: crítico primero y, al final, lo que no se muestra */
const stateRank = lbl => { const code = Object.keys(ST).find(k => ST[k].label === lbl); return code === undefined ? 50 : -ST[code].rank; };
function toCSV(rows, what) { if (!rows.length) return ''; const cols = Object.keys(EXP_SCHEMA[what]); return '﻿' + [cols.map(csvCell).join(',')].concat(rows.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\r\n'); }
/** hoja de calculo con una celda explicita en cada columna de cada fila (sin celdas omitidas) */
function sheetFrom(what, rows) {
  const cols = Object.keys(EXP_SCHEMA[what]); const sch = EXP_SCHEMA[what];
  const aoa = [cols].concat(rows.map(r => cols.map(c => r[c])));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let i = 1; i < aoa.length; i++) cols.forEach((c, j) => { const ref = XLSX.utils.encode_cell({ r: i, c: j }); const cell = ws[ref] || (ws[ref] = { t: 's', v: '' }); if (sch[c] !== 'n') { cell.t = 's'; cell.v = String(aoa[i][j]); delete cell.w; } });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(aoa.length - 1, 1), c: cols.length - 1 } });
  ws['!cols'] = cols.map(c => ({ wch: Math.min(60, Math.max(c.length + 2, 14)) }));
  ws['!autofilter'] = { ref: ws['!ref'] };
  return ws;
}
const SHEET_NAMES = { indicadores: 'Indicadores', alertas: 'Alertas', trazabilidad: 'Trazabilidad', criterios: 'Criterios', valores_informe: 'Valores_informe' };
function doExport(what, fmt) {
  const meta = [
    { campo: 'Tablero', valor: 'SGC · Escuelas de Tecnología Médica, Enfermería y Obstetricia' },
    { campo: 'Generado el', valor: stamp() }, { campo: 'Fecha de corte', valor: fmtDate(corteDate()) },
    { campo: 'Orden de escuelas', valor: 'Enfermería (Fase 1, piloto), Obstetricia (Fase 2), Tecnología Médica (Fase 3, por áreas) y Facultad (marco común)' },
    { campo: 'Datos EJEMPLO incluidos', valor: S.ejemplo ? 'Sí: toda fila con origen EJEMPLO es inventada y no refleja a ninguna escuela' : 'No' },
    { campo: 'Parámetros', valor: `${S.params.origen} · fecha ${S.params.fecha}` },
    { campo: 'Archivos cargados', valor: S.files.map(f => f.name).join(', ') || 'Ninguno' },
    { campo: 'Hojas Criterios y Valores_informe', valor: 'Igual estructura para las tres escuelas: 53 criterios y 29 ID por escuela; sin informe cargado queda «sin dato». Los valores del informe son solo referencia y no intervienen en semáforos, alertas ni gráficos.' },
    { campo: 'Nota', valor: 'Los valores de referencia SINEACE son del Modelo CONEAU 2026 [A4], no metas aprobadas. Sin fuente no se muestra dato.' },
  ];
  const list = what === 'todo' ? ['indicadores', 'alertas', 'trazabilidad', 'criterios', 'valores_informe'] : [what];
  const data = {}; const errs = [];
  list.forEach(k => { data[k] = exportRows(k); errs.push(...validateRows(k, data[k])); });
  if (errs.length) { console.error('Exportación detenida: filas con columnas o tipos de dato incorrectos', errs.slice(0, 30)); return toast(`Exportación detenida: ${errs.length} problema(s) de columnas o tipos de dato. Primero: ${errs[0]}`); }
  if (fmt === 'csv') {
    const rows = data[what]; if (!rows.length) return toast('No hay filas para exportar.');
    downloadBlob(new Blob([toCSV(rows, what)], { type: 'text/csv;charset=utf-8' }), `SGC_${what}${suffix()}.csv`);
    return toast(`Se descargó SGC_${what}${suffix()}.csv (${rows.length} filas).`);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Leeme');
  list.forEach(k => XLSX.utils.book_append_sheet(wb, sheetFrom(k, data[k]), SHEET_NAMES[k]));
  wb.Workbook = { Sheets: wb.SheetNames.map(n => ({ name: n })) };
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', bookSST: true });
  const name = `SGC_${what === 'todo' ? 'tablero' : what}${suffix()}.xlsx`;
  downloadBlob(new Blob([buf], { type: XLSX_MIME }), name);
  toast(`Se descargó ${name}.`);
}
function exportParams() {
  const wb = XLSX.utils.book_new();
  const g = PDEF.general.map(([k, , tipo, nota]) => ({ clave: k, valor: S.params.gen[k] instanceof Date ? isoD(S.params.gen[k]) : (S.params.gen[k] ?? ''), tipo, 'fuente y nota': nota }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g), 'Parametros');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(S.params.reglas.map(r => ({ regla_id: r.id, nombre: r.nombre, activa: r.activa, severidad: r.severidad, 'condición (resumen)': r.condicion, 'qué ocurre': r.que, 'por qué': r.porque, 'decisión o acción sugerida': r.accion }))), 'Reglas_alertas');
  const mt = []; Object.keys(S.params.metas).forEach(k => S.params.metas[k].forEach(r => mt.push({ indicador_id: k, desde_anio: r.desde, meta: r.meta ?? '', sentido: r.sentido, unidad: r.unidad, fuente_meta: r.fuente_meta, estado_meta: r.estado_meta, verde_min_pct: r.verde_min ?? '', rojo_min_pct: r.rojo_min ?? '', base_umbral: r.base, fuente_umbral: r.fuente_umbral, nota: r.nota, tipo_avance: r.avance || 'Puntual', regla_cumplimiento: REGLAS[reglaKey(r.regla)].nombre })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mt), 'Metas_Umbrales');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const name = `SGC_Parametros_${stamp()}.xlsx`;
  downloadBlob(new Blob([buf], { type: XLSX_MIME }), name);
  toast(`Se descargó ${name}. Cárgalo en la vista Cargas para aplicarlo.`);
}

/* ===================== Arranque, navegacion y eventos ===================== */
/* ===================== DECISIÓN: ¿qué proceso o indicador está en riesgo? (v0.7) =====================
   Alerta de gestión PROPUESTA con la sección 9.1 del Modelo CONEAU-SINEACE (marzo 2026). No es una valoración oficial.
   Fuente de datos: base incrustada (EPTM, informada por Robert el 22-10-2026) + archivos de carga reales + ediciones de los responsables (db del artefacto). */
const DEC_CORTE = '2026-10-22';
const DEC_MODELO = 'Modelo de Acreditación CONEAU-SINEACE, edición de marzo de 2026';
const DEC_BASE_FUENTE = 'Dato informado por Robert para la EPTM en el proyecto (mensaje del 22-10-2026); documento de origen por confirmar';
const DEC_BASE_TS = '2026-10-22T00:00:00.000Z';
const DEC_AREA_COD = { 'Radiología': 'RAD', 'Terapia Física': 'TF', 'Terapia Ocupacional': 'TO', 'Laboratorio Clínico y Anatomía Patológica': 'LCAP' };
const DEC_COD_AREA = Object.fromEntries(Object.entries(DEC_AREA_COD).map(([a, c]) => [c, a]));
const DEC_AREA_CORTO = { RAD: 'Radiología', TF: 'Terapia Física', TO: 'Terapia Ocupacional', LCAP: 'Lab. Clínico y AP' };
const DEC_AREAS = ['RAD', 'TF', 'TO', 'LCAP'];
const DEC_ESC = ['ENF', 'OBS', 'TM'];
const DEC_ESC_NOM = { ENF: 'Enfermería', OBS: 'Obstetricia', TM: 'Tecnología Médica' };
/* frecuencia de cálculo según las fichas del Modelo (campo FRECUENCIA DE CÁLCULO) */
const DEC_FREQ = { ID1: 'Anual', ID2: 'Semestral', ID3: 'Semestral', ID4: 'Semestral', ID5: 'Semestral', ID6: 'Anual', ID7: 'Semestral', ID8: 'Semestral', ID9: 'Semestral', ID10: 'Semestral', ID11: 'Semestral', ID12: 'Cada tres años', ID13: 'Semestral', ID14: 'Semestral', ID15: 'Anual', ID16: 'Semestral', ID17: 'Semestral', ID18: 'Semestral', ID19: 'Semestral', ID20: 'Anual', ID21: 'Anual', ID22: 'Anual', ID23: 'Anual', ID24: 'Anual', ID25: 'Anual', ID26: 'Anual', ID27: 'Anual', ID28: 'Anual', ID29: 'Anual' };
/* Decisión de Robert (22-10-2026): ID4 = 70 %. El campo REFERENCIAL de la ficha dice 60 % (línea 2357 del texto del Modelo) y la INTERPRETACIÓN dice 70 % (línea 2358). */
const DEC_REF_OVERRIDE = { ID4: { ref: 70, nota: 'Decisión de Robert (22-10-2026): 70 %, según la interpretación de la ficha. El campo REFERENCIAL de la ficha dice 60 % (Modelo, texto plano, línea 2357); la interpretación dice 70 % (línea 2358). Por confirmar con la OCAA.' } };
const DEC_IND = {};
Object.keys(SIN_BY).forEach(id => {
  const s = SIN_BY[id]; const ov = DEC_REF_OVERRIDE[id];
  DEC_IND[id] = { id, nombre: s.nombre, ref: ov ? ov.ref : s.ref, refNota: ov ? ov.nota : '', unidad: s.unidad, menor: s.sentido === 'Menor es mejor', est: s.estandares || [], crit: s.criterios || [], frec: DEC_FREQ[id] || 'Anual' };
});
const DEC_IDS = Object.keys(DEC_IND).sort((a, b) => +a.slice(2) - +b.slice(2));
const DEC_PROC_IDS = {}; M.procesos102.forEach(p => { DEC_PROC_IDS[p.id] = []; });
DEC_IDS.forEach(id => procsOfIndicator(id).forEach(p => { if (DEC_PROC_IDS[p]) DEC_PROC_IDS[p].push(id); }));
const DEC_FICHA_TXT = { 'por confirmar': 'Por confirmar', 'sin ficha': 'Sin ficha', 'borrador': 'Ficha en borrador', 'aprobada': 'Ficha aprobada' };
const DEC_FICHA_COL = { 'por confirmar': 'gris', 'sin ficha': 'rojo', 'borrador': 'amarillo', 'aprobada': 'verde' };

/* ---- semáforo ---- */
const DC = {
  verde: { n: 3, rank: 0, label: 'Verde', short: 'Alcanza', cls: 'ok', icon: 'i-ok' },
  amarillo: { n: 2, rank: 2, label: 'Amarillo', short: 'Vigilar', cls: 'risk', icon: 'i-risk' },
  rojo: { n: 1, rank: 3, label: 'Rojo', short: 'En riesgo', cls: 'crit', icon: 'i-crit' },
  gris: { n: 0, rank: 1, label: 'Gris', short: 'Sin dato', cls: 'nodata', icon: 'i-nodata' },
};
const DC_ORDER = ['rojo', 'amarillo', 'gris', 'verde'];
const dcChip = (c, txt) => `<span class="chip st-${DC[c].cls}">${I(DC[c].icon)}<span>${esc(txt || (DC[c].label + ' · ' + DC[c].short))}</span></span>`;
const dcWorst = list => list.reduce((w, c) => (!w || DC[c].rank > DC[w].rank) ? c : w, null) || 'gris';

/* ---- datos base de la EPTM (corte 22-10-2026, informados por Robert) ---- */
const DEC_BASE_SERIES = [
  { ind: 'ID19', area: 'RAD', per: ['2024-S2', '2025-S1', '2025-S2', '2026-S1'], v: [89, 96, 60, 100] },
  { ind: 'ID19', area: 'TF', per: ['2024-S2', '2025-S1', '2025-S2', '2026-S1'], v: [74, 89, 88, 50] },
  { ind: 'ID19', area: 'TO', per: ['2024-S2', '2025-S1', '2025-S2', '2026-S1'], v: [69, 79, 93, 87] },
  { ind: 'ID19', area: 'LCAP', per: ['2024-S2', '2025-S1', '2025-S2', '2026-S1'], v: [57, 55, 52, 75] },
  { ind: 'ID13', area: '', per: ['2024-S2', '2025-S1', '2025-S2', '2026-S1'], v: [13, 13, 18, 14] },
  { ind: 'ID14', area: '', per: ['2024-S2', '2025-S1', '2025-S2', '2026-S1'], v: [25, 31, 28, 28] },
  { ind: 'ID6', area: '', per: ['2025', '2026'], v: [35.6, 3.9] },
  { ind: 'ID10', area: 'RAD', per: ['2024-S2', '2025-S1', '2025-S2'], v: [100, 100, 100], def: true },
  { ind: 'ID10', area: 'TF', per: ['2024-S2', '2025-S1', '2025-S2'], v: [83, 100, 100], def: true },
  { ind: 'ID10', area: 'TO', per: ['2024-S2', '2025-S1', '2025-S2'], v: [100, 100, 100], def: true },
  { ind: 'ID10', area: 'LCAP', per: ['2024-S2', '2025-S1', '2025-S2'], v: [100, 92, 94], def: true },
];
const DEC_DEF_NOTA = 'El dato informado es la proporción de asignaturas con ≥80 % de aprobados; la ficha del Modelo define ID10 como porcentaje de estudiantes aprobados por asignatura. Definición por confirmar: el semáforo queda en gris.';
const DEC_BASE_NOTA = {};
['ID1', 'ID2', 'ID3', 'ID4', 'ID5', 'ID7', 'ID8', 'ID9', 'ID12', 'ID16', 'ID17', 'ID18', 'ID20', 'ID21', 'ID22', 'ID23', 'ID24', 'ID26', 'ID27', 'ID29'].forEach(id => { DEC_BASE_NOTA[id] = { txt: 'Sin medir; encuesta OCCAA programada para 2026-II', acc: 'Aplicar la encuesta programada (OCCAA, 2026-II) y cargar el resultado con su fuente.' }; });
['ID15', 'ID25', 'ID28'].forEach(id => { DEC_BASE_NOTA[id] = { txt: 'Sin calcular', acc: 'Calcular el indicador con la fórmula de la ficha del Modelo y cargar el valor con su fuente.' }; });
DEC_BASE_NOTA.ID11 = { txt: 'Sin dato', acc: 'Obtener los registros de ejecución de los sílabos y cargar el valor con su fuente.' };
const DEC_BASE_PROC_FUENTE = 'Estado del SGC en la EPTM informado por Robert (22-10-2026): «en diseño»; Manual v0.1 y ficha piloto del proceso 1; faltan 8 fichas, la resolución de los comités de Calidad y de Gestión y la primera revisión por la Dirección (criterio 10.4)';
const DEC_BASE_PROC = {};
M.procesos102.forEach(p => { DEC_BASE_PROC['TM|' + p.id] = { esc: 'TM', proc: p.id, ficha: p.id === 'P1' ? 'borrador' : 'sin ficha', dueno: '', fuente: DEC_BASE_PROC_FUENTE, ts: DEC_BASE_TS, origen: 'Base' }; });

/* ---- periodos ---- */
function decPerLabel(p) { const m = String(p).match(/^(\d{4})-S([12])$/); return m ? m[1] + (m[2] === '1' ? '-I' : '-II') : String(p); }
function decPerEnd(p) { const i = periodInfo(p); return i ? i.end.getTime() : 0; }
function decPerPrevYear(p) { const m = String(p).match(/^(\d{4})(-S[12])?$/); return m ? (+m[1] - 1) + (m[2] || '') : null; }
function decExpectedLast(frec) {
  const y = +DEC_CORTE.slice(0, 4), mo = +DEC_CORTE.slice(5, 7);
  if (frec === 'Semestral') return mo >= 7 ? y + '-S1' : (y - 1) + '-S2';
  if (frec === 'Anual') return String(y - 1);
  return null;
}
function decPerOptions(ind) {
  const f = DEC_IND[ind].frec; const y = +DEC_CORTE.slice(0, 4); const out = []; const corte = parseISO(DEC_CORTE).getTime();
  if (f === 'Semestral') { for (let k = y; k >= y - 3; k--) { ['-S2', '-S1'].forEach(sf => { const i = periodInfo(k + sf); if (i.start.getTime() <= corte) out.push(k + sf); }); } return out; }
  for (let k = y; k >= y - 5; k--) out.push(String(k));
  return out;
}
function decFmt(ind, v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const u = DEC_IND[ind].unidad;
  if (u === '%') return (ind === 'ID6' && v > 0 ? '+' : '') + fmtN(v, 1) + ' %';
  if (u === 'años') return fmtN(v, 1) + (Math.abs(v - 1) < 1e-9 ? ' año' : ' años');
  return fmtN(v, 1);
}
const decRefTxt = ind => { const d = DEC_IND[ind]; return (d.menor ? '< ' : '≥ ') + (d.unidad === '%' ? fmtN(d.ref, 0) + ' %' : fmtN(d.ref, 0) + (d.ref === 1 ? ' año' : ' años')); };

/* ---- estado compartido de la vista ---- */
const DS = {
  cap: { db: null, user: null, dl: null }, me: { id: null, name: '', owner: false, edit: false }, dbState: 'esperando', dbErr: '',
  roster: {}, entries: {}, events: {}, vals: {}, subs: {}, unRoster: null, prof: {},
  soloVal: false, sel: null, f: { est: '', proc: '', nivel: '', tipo: '', q: '' }, model: null, edited: {}, saving: false, open: { eq: false, sup: false },
};
const decKey = {
  v: (ek, area, ind, per) => ['v', ek, area || 'PROG', ind, per].join('_'),
  p: (ek, proc) => ['p', ek, proc].join('_'),
};
const decNowISO = () => new Date().toISOString();
const decValidator = uid => { const r = DS.roster[uid]; return !!r && r.rol === 'oficina'; };

/* ---- armado del modelo de datos ---- */
function decCollect() {
  const pts = new Map(); const procs = new Map();
  const put = (m, k, v) => { const p = m.get(k); if (!p || v.ts >= p.ts) m.set(k, v); };
  // 1. base de la EPTM
  DEC_BASE_SERIES.forEach(s => s.per.forEach((per, i) => {
    const k = decKey.v('TM', s.area, s.ind, per);
    pts.set(k, { key: k, esc: 'TM', area: s.area, ind: s.ind, per, val: s.v[i], fuente: DEC_BASE_FUENTE, fuenteCorta: 'Informado por Robert (22-10-2026)', corte: DEC_CORTE, nota: s.def ? DEC_DEF_NOTA : '', def: !!s.def, origen: 'Base', autor: '', ts: DEC_BASE_TS, anulado: false });
  }));
  Object.keys(DEC_BASE_PROC).forEach(k => procs.set(k, DEC_BASE_PROC[k]));
  // 2. archivos de carga reales (sin EJEMPLO)
  try {
    (DB && DB.vis || []).forEach(r => {
      if (r.origen === 'EJEMPLO' || !DEC_IND[r.indicador] || !DEC_ESC.includes(r.escuela) || r.valor === null) return;
      const area = r.area ? (DEC_AREA_COD[r.area] || '') : '';
      const k = decKey.v(r.escuela, area, r.indicador, r.periodo);
      put(pts, k, { key: k, esc: r.escuela, area, ind: r.indicador, per: r.periodo, val: r.valor, fuente: r.fuente_dato, corte: r.fecha_carga || '', nota: r.obs || '', def: false, origen: 'Archivo de carga', autor: r.cargado_por || '', ts: (r.fecha_carga || '2026-01-01') + 'T00:00:00.000Z', anulado: false, valArchivo: r.estado_val });
    });
  } catch (e) { console.error(e); }
  // 3. ediciones guardadas en la db del artefacto
  Object.keys(DS.entries).forEach(uid => {
    const r = DS.roster[uid]; if (!r) return;
    Object.values(DS.entries[uid]).forEach(e => {
      if (!e || !e.key) return;
      if (!(r.rol === 'oficina' || r.escuela === e.esc)) return;
      if (e.t === 'v') { if (!DEC_IND[e.ind] || !DEC_ESC.includes(e.esc)) return; put(pts, e.key, { ...e, origen: 'Edición', autor: uid, def: false }); }
      else if (e.t === 'p') { if (!DEC_PROC_IDS[e.proc] || !DEC_ESC.includes(e.esc)) return; put(procs, e.key, { ...e, origen: 'Edición', autor: uid }); }
    });
  });
  // quitar anulados y fijar estado de validación
  const valid = [];
  Object.keys(DS.vals).forEach(uid => { if (decValidator(uid)) Object.values(DS.vals[uid]).forEach(v => valid.push(v)); });
  const stateOf = (key, ts, archivo) => {
    let best = null; valid.forEach(v => { if (v.key === key && v.entryTs === ts && (!best || v.ts > best.ts)) best = v; });
    if (best) return { estado: best.estado, por: best.by, cuando: best.ts, nota: best.nota || '' };
    if (archivo === 'Validado') return { estado: 'Validado', por: '', cuando: '', nota: 'Validado en el archivo de carga' };
    return { estado: 'Pendiente', por: '', cuando: '', nota: '' };
  };
  const outP = [];
  pts.forEach(p => { if (p.anulado) return; const st = stateOf(p.key, p.ts, p.valArchivo); outP.push({ ...p, vestado: st.estado, vpor: st.por, vcuando: st.cuando, vnota: st.nota }); });
  const outR = new Map(); procs.forEach((r, k) => { const st = stateOf(r.key || k, r.ts); outR.set(k, { ...r, key: r.key || ('p_' + r.esc + '_' + r.proc), vestado: st.estado }); });
  return { pts: outP, procs: outR };
}
function decSeries(m, ek, area, ind) {
  const lst = m.pts.filter(p => p.esc === ek && p.area === area && p.ind === ind && (!DS.soloVal || p.vestado === 'Validado'));
  return lst.sort((a, b) => decPerEnd(a.per) - decPerEnd(b.per));
}
function decPorArea(m, ek, ind) { return ek === 'TM' && m.pts.some(p => p.esc === 'TM' && p.ind === ind && p.area !== ''); }

/* ---- regla del semáforo (propuesta, sección 9.1 del Modelo) ---- */
function decEvalPts(ind, pts, ek) {
  const d = DEC_IND[ind]; const nota = ek === 'TM' ? DEC_BASE_NOTA[ind] : null;
  if (!pts.length) {
    return { c: 'gris', last: null, prev: null, ref: d.ref, razon: ek === 'TM' && nota ? nota.txt + ' (informado por Robert, 22-10-2026).' : 'Sin dato: no hay un valor cargado con fuente. Se muestra como riesgo de evidencia, no como verde.', corto: ek === 'TM' && nota ? nota.txt : 'Sin dato', mini: ek === 'TM' && nota ? nota.txt.split(';')[0].toLowerCase() : 'sin cargar', accion: nota ? nota.acc : 'Cargar el valor con su fuente y fecha de corte.', vacio: true };
  }
  const last = pts[pts.length - 1]; const pp = decPerPrevYear(last.per); const prev = pts.find(p => p.per === pp) || null;
  const v = last.val; const dif = v - d.ref; const margen = d.unidad === '%' ? 3 : 0;
  let c, razon, corto;
  const vt = decFmt(ind, v), rt = decRefTxt(ind);
  if (!d.menor ? v >= d.ref : v < d.ref) { c = 'verde'; razon = `Alcanza el referencial: ${vt} frente a ${rt}.`; corto = 'Alcanza el referencial'; }
  else if (!d.menor && margen && d.ref - v <= margen) { c = 'amarillo'; razon = `Queda ${fmtN(d.ref - v, 1)} punto${d.ref - v === 1 ? '' : 's'} bajo el referencial (${vt} frente a ${rt}), dentro del margen de ±3 puntos.`; corto = 'Dentro de ±3 puntos'; }
  else if (prev && (d.menor ? v < prev.val : v > prev.val)) { c = 'amarillo'; razon = `Está bajo el referencial (${vt} frente a ${rt}), pero mejora respecto al año anterior (${decPerLabel(prev.per)}: ${decFmt(ind, prev.val)}).`; corto = 'Mejora frente al año anterior'; }
  else {
    c = 'rojo';
    razon = d.menor ? `No cumple el referencial: ${vt} frente a ${rt}` : `Queda ${fmtN(d.ref - v, 1)} puntos bajo el referencial (${vt} frente a ${rt}), fuera del margen de ±3 puntos`;
    razon += prev ? ` y sin mejora respecto al año anterior (${decPerLabel(prev.per)}: ${decFmt(ind, prev.val)}).` : ' y sin dato del año anterior (n-1) para demostrar mejora.';
    corto = prev ? 'Sin mejora frente al año anterior' : 'Sin dato del año anterior';
  }
  let defPend = false, prov = null;
  if (last.def) { prov = c; c = 'gris'; defPend = true; razon = `${last.nota} Lectura provisional si la medida fuera la de la ficha: ${DC[prov].label.toLowerCase()} (${razon})`; corto = 'Definición por confirmar'; }
  const exp = decExpectedLast(d.frec); const stale = exp && decPerEnd(last.per) < decPerEnd(exp);
  return { c, last, prev, ref: d.ref, dif, razon, corto, defPend, prov, stale, expected: exp, accion: decAccion(c, ind, defPend), vacio: false };
}
function decAccion(c, ind, defPend) {
  if (defPend) return 'Confirmar con la Oficina de Calidad y la OCAA si el dato corresponde a la definición de la ficha; si no, calcular ID10 con la fórmula del Modelo.';
  if (c === 'rojo') return 'Analizar las causas con la Dirección de Escuela, registrar una acción de mejora con responsable y plazo, y volver a medir en el siguiente periodo.';
  if (c === 'amarillo') return 'Vigilar el indicador, confirmar la causa de la brecha y verificar el resultado en el siguiente periodo.';
  if (c === 'verde') return 'Mantener la medición y conservar la evidencia del dato.';
  return 'Cargar el valor con su fuente y fecha de corte.';
}

/* ---- armado de elementos (hojas de indicadores y procesos) ---- */
function decProcName(pid) { const p = P102_BY[pid]; return p ? 'P' + p.n + ' ' + p.nombre : pid; }
function decBuild() {
  const m = decCollect(); DS.model = m;
  const items = []; const byIndLeaf = {}; const byProc = {};
  DEC_ESC.forEach(ek => {
    DEC_IDS.forEach(ind => {
      const d = DEC_IND[ind]; const porArea = decPorArea(m, ek, ind);
      const areas = porArea ? DEC_AREAS : [''];
      areas.forEach(area => {
        const pts = decSeries(m, ek, area, ind); const ev = decEvalPts(ind, pts, ek);
        const it = {
          id: `${ek}|${area || 'PROG'}|${ind}`, tipo: 'Indicador', esc: ek, area, cod: ind, nombre: d.nombre, c: ev.c, ev, pts,
          estandares: d.est, procesos: procsOfIndicator(ind), porArea,
          motivo: ev.razon, valorTxt: ev.last ? `${decFmt(ind, ev.last.val)} (${decPerLabel(ev.last.per)})` : '—', refTxt: decRefTxt(ind),
          fuente: ev.last ? ev.last.fuente : (ek === 'TM' && DEC_BASE_NOTA[ind] ? 'Mensaje de Robert del 22-10-2026 (indicador sin medir, sin calcular o sin dato)' : 'Sin fuente: no hay dato cargado'), corte: ev.last ? ev.last.corte : (ek === 'TM' ? DEC_CORTE : ''),
          accion: ev.accion, resp: responsableOf(ek, ind),
          brecha: ev.last ? (ev.dif) : null, measured: !ev.vacio, kind: 0,
        };
        items.push(it); (byIndLeaf[`${ek}|${ind}`] = byIndLeaf[`${ek}|${ind}`] || []).push(it);
      });
    });
  });
  DEC_ESC.forEach(ek => {
    M.procesos102.forEach(p => {
      const rec = m.procs.get(`${ek}|${p.id}`) || null;
      const fichaE = rec ? rec.ficha : 'por confirmar'; const dueno = rec ? (rec.dueno || '') : '';
      const comps = [];
      comps.push({ n: 'Ficha del proceso', c: DEC_FICHA_COL[fichaE], t: DEC_FICHA_TXT[fichaE] });
      comps.push({ n: 'Dueño designado', c: dueno ? 'verde' : 'gris', t: dueno ? dueno : 'Por confirmar' });
      const ids = DEC_PROC_IDS[p.id] || []; const leaves = [];
      ids.forEach(id => (byIndLeaf[`${ek}|${id}`] || []).forEach(l => leaves.push(l)));
      let medidos = leaves.filter(l => l.measured && !l.ev.defPend).length;
      if (ids.length) {
        const cs = leaves.map(l => l.c); const w = dcWorst(cs);
        const nR = cs.filter(c => c === 'rojo').length, nA = cs.filter(c => c === 'amarillo').length, nG = cs.filter(c => c === 'gris').length;
        comps.push({ n: 'Indicadores medidos', c: w, t: `${medidos} de ${leaves.length} con dato · ${nR} en rojo, ${nA} en amarillo, ${nG} en gris` });
      } else comps.push({ n: 'Indicadores medidos', c: null, t: 'Sin indicador del Modelo vinculado a este proceso (vínculo del proyecto [CP])' });
      const c = dcWorst(comps.filter(x => x.c).map(x => x.c));
      const problemas = [];
      if (fichaE === 'sin ficha') problemas.push('sin ficha'); else if (fichaE === 'borrador') problemas.push('ficha en borrador'); else if (fichaE === 'por confirmar') problemas.push('estado de la ficha por confirmar');
      if (!dueno) problemas.push('dueño por confirmar');
      if (ids.length && medidos < leaves.length) problemas.push(medidos ? `solo ${medidos} de ${leaves.length} indicadores con dato` : 'ningún indicador con dato');
      if (comps[2] && comps[2].c === 'rojo') problemas.push('indicadores en rojo');
      const motivo = c === 'verde' ? 'Ficha aprobada, dueño designado e indicadores sin alerta.' : (problemas.length ? problemas[0][0].toUpperCase() + problemas[0].slice(1) + (problemas.length > 1 ? '; ' + problemas.slice(1).join('; ') : '') + '.' : 'Revisar el proceso.');
      let accion;
      if (fichaE === 'sin ficha') accion = 'Elaborar la ficha del proceso y designar a su dueño.';
      else if (fichaE === 'borrador') accion = 'Presentar la ficha a los comités de Calidad y de Gestión para su resolución y designar al dueño.';
      else if (fichaE === 'por confirmar') accion = 'Informar el estado de la ficha y el dueño del proceso en la escuela.';
      else if (!dueno) accion = 'Designar al dueño del proceso.';
      else accion = 'Atender los indicadores del proceso que están en alerta.';
      const respFicha = (M.rel_proceso_ficha.filter(r => r[0] === p.id).map(r => FICHA_BY[r[1]]).filter(f => f && f.responsable && !/^por confirmar$/i.test(f.responsable))[0] || {}).responsable;
      const it = {
        id: `${ek}|PROC|${p.id}`, tipo: 'Proceso', esc: ek, area: '', cod: p.id, nombre: p.nombre, c, comps, rec, mini: rec ? ('dueño ' + (dueno ? 'designado' : 'por confirmar') + (ids.length ? ' · ' + medidos + '/' + leaves.length + ' indicadores con dato' : '')) : 'sin dato de la escuela',
        estandares: Array.from(new Set(['E10', ...ids.flatMap(i => DEC_IND[i].est)])), procesos: [p.id], porArea: false,
        motivo, valorTxt: DEC_FICHA_TXT[fichaE], refTxt: 'Ficha aprobada y dueño designado',
        fuente: rec ? rec.fuente || '' : 'Sin dato de la escuela', fuenteCorta: rec ? (rec.origen === 'Base' ? 'Estado del SGC en la EPTM informado por Robert (22-10-2026)' : rec.fuente || '') : 'Sin dato de la escuela', corte: rec ? (rec.ts || '').slice(0, 10) : '',
        accion, resp: dueno || (respFicha ? respFicha.replace(/\s*\(por confirmar\)/, '') + ' (por confirmar)' : 'Por confirmar'),
        brecha: null, measured: fichaE !== 'por confirmar', nprob: problemas.length, kind: 1, leaves,
      };
      items.push(it); byProc[`${ek}|${p.id}`] = it;
    });
  });
  DS.items = items; DS.byProc = byProc; DS.byIndLeaf = byIndLeaf;
  DS.ver = (DS.ver || 0) + 1;
  return items;
}
const decItemsOf = esc => DS.items.filter(i => i.esc === esc);
function decCounts(items) { const c = { rojo: 0, amarillo: 0, verde: 0, gris: 0 }; items.forEach(i => c[i.c]++); return c; }
function decSevKey(it) { return DC[it.c].rank; }
function decRanking(items) {
  const arr = items.filter(i => i.c !== 'verde').slice();
  const gap = i => (i.tipo === 'Indicador' && i.brecha !== null) ? Math.abs(i.brecha) / (DEC_IND[i.cod].ref || 1) : 0;
  arr.sort((a, b) => decSevKey(b) - decSevKey(a) || (b.measured - a.measured) || gap(b) - gap(a) || (b.nprob || 0) - (a.nprob || 0) || DEC_ESC.indexOf(a.esc) - DEC_ESC.indexOf(b.esc) || natKey(a.cod).localeCompare(natKey(b.cod)));
  return arr;
}
const decEscSel = () => (DEC_ESC.includes(S.escuela) ? [S.escuela] : DEC_ESC);
const decScoped = () => DS.items.filter(i => decEscSel().includes(i.esc));
const decEscLabel = it => DEC_ESC_NOM[it.esc] + (it.area ? ' · ' + DEC_AREA_CORTO[it.area] : '');
const decPersona = uid => { const p = DS.prof[uid]; return (p && p.name) || (uid === DS.me.id && DS.me.name) || 'Persona sin nombre visible'; };
function decWho(uid) { return uid ? decPersona(uid) : '—'; }

/* ---- permisos de edición ---- */
function decRole() {
  const uid = DS.me.id; const r = uid ? DS.roster[uid] : null;
  if (DS.me.owner) return { k: 'dueno', t: 'Propietario del tablero', val: true, all: true, roster: true };
  if (r && r.rol === 'oficina') return { k: 'oficina', t: 'Oficina de Calidad', val: true, all: true, roster: false };
  if (r && r.rol === 'responsable' && DEC_ESC.includes(r.escuela)) return { k: 'resp', t: 'Responsable de ' + DEC_ESC_NOM[r.escuela], esc: r.escuela, val: false, all: false, roster: false };
  return { k: 'lectura', t: 'Solo lectura', val: false, all: false, roster: false };
}
function decCanEdit(ek) {
  if (!DS.cap.db || !DS.me.id) return false;
  const r = decRole(); if (r.k === 'lectura') return false;
  return r.all || r.esc === ek;
}

/* ---- conexión con las capacidades del artefacto (db, user, downloads) ---- */
async function decInit() {
  if (!(window.claude && typeof window.claude.use === 'function')) { DS.dbState = 'local'; return; }
  try { DS.cap.dl = await window.claude.use('downloads'); } catch (e) { DS.cap.dl = null; }
  try { DS.cap.user = await window.claude.use('user'); } catch (e) { DS.cap.user = null; }
  try { DS.cap.db = await window.claude.use('db'); } catch (e) { DS.cap.db = null; }
  const u = DS.cap.user;
  if (u) {
    try { const me = await u.me(); DS.me.id = me.id || null; DS.me.name = me.name || ''; DS.me.owner = !!me.isOwner; DS.me.edit = !!me.canEdit; } catch (e) { /* sin identidad */ }
    try { DS.me.canWrite = await u.can('data.write'); } catch (e) { DS.me.canWrite = null; }
  }
  if (!DS.cap.db) { DS.dbState = 'sin-db'; render._keep = true; if (S.view === 'decision') render(); return; }
  if (!DS.me.id) { DS.dbState = 'sin-id'; }
  try {
    DS.unRoster = DS.cap.db.collection('roster').onSnapshot(snap => {
      const r = {}; snap.docs.forEach(d => { if (d.exists) r[d.id] = d.data(); }); DS.roster = r; DS.dbState = 'activa'; decSubscribeUsers(); decRefreshProf(); decRedraw();
    }, err => { DS.dbState = 'error'; DS.dbErr = (err && err.code) || 'error'; decRedraw(); });
  } catch (e) { DS.dbState = 'error'; DS.dbErr = String(e && e.message || e); }
  decRedraw();
}
let decRedrawT = null;
function decBusy() {
  const root = $('#dec-root'); if (!root) return false; const a = document.activeElement;
  if (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox') return true;
  return $$('#dec-form input:not([type=date]), #dec-form textarea, #dec-roster input', root).some(x => x.value && x.value.trim());
}
function decRedraw() {
  clearTimeout(decRedrawT);
  decRedrawT = setTimeout(() => { decBuild(); if (S.view === 'decision' && !decBusy()) { render._keep = true; render(); DS.stale = false; } else { DS.stale = S.view === 'decision'; renderNav(); } decRefreshProf(); }, 60);
}
function decSubscribeUsers() {
  const want = new Set(Object.keys(DS.roster)); if (DS.me.id) want.add(DS.me.id);
  Object.keys(DS.subs).forEach(uid => { if (!want.has(uid)) { DS.subs[uid].forEach(u => { try { u(); } catch (e) { /* ya cerrada */ } }); delete DS.subs[uid]; delete DS.entries[uid]; delete DS.events[uid]; delete DS.vals[uid]; } });
  want.forEach(uid => {
    if (DS.subs[uid]) return; const db = DS.cap.db; const un = [];
    const sub = (path, store, shape) => un.push(db.collection(path).onSnapshot(snap => { const o = {}; snap.docs.forEach(d => { if (d.exists) o[d.id] = d.data(); }); DS[store][uid] = o; decRedraw(); }, () => { /* sin acceso a esa colección */ }));
    try { sub(`datos/${uid}/e`, 'entries'); sub(`bitacora/${uid}/ev`, 'events'); sub(`validaciones/${uid}/v`, 'vals'); } catch (e) { console.error(e); }
    DS.subs[uid] = un;
  });
}
async function decRefreshProf() {
  const u = DS.cap.user; if (!u) return;
  const ids = Array.from(new Set([...Object.keys(DS.roster), ...Object.values(DS.events).flatMap(o => Object.values(o).map(e => e.by)), DS.me.id].filter(Boolean)));
  const need = ids.filter(i => !DS.prof[i]); if (!need.length) return;
  try { const ps = await u.profiles(ids); let ch = false; ids.forEach(i => { if (ps[i] && (!DS.prof[i] || DS.prof[i].name !== ps[i].name)) { DS.prof[i] = ps[i]; ch = true; } }); if (ch) decRedraw(); } catch (e) { /* sin nombres */ }
}

/* ---- escritura: valores, procesos, validaciones y bitácora ---- */
async function decLog(ev) {
  const uid = DS.me.id; const id = decNowISO().replace(/[:.]/g, '-') + '_' + Math.random().toString(36).slice(2, 7);
  await DS.cap.db.doc(`bitacora/${uid}/ev/${id}`).set({ ...ev, by: uid, ts: decNowISO() });
}
async function decEnsureRoster() { if (DS.me.owner && !DS.roster[DS.me.id]) { await DS.cap.db.doc(`roster/${DS.me.id}`).set({ rol: 'oficina', escuela: '', por: DS.me.id, ts: decNowISO() }); DS.roster[DS.me.id] = { rol: 'oficina', escuela: '' }; } }
async function decSaveValue(f) {
  await decEnsureRoster(); const uid = DS.me.id; const ts = decNowISO();
  const key = decKey.v(f.esc, f.area, f.ind, f.per);
  const antes = DS.model.pts.find(p => p.key === key) || null;
  const doc = { t: 'v', key, esc: f.esc, area: f.area, ind: f.ind, per: f.per, val: f.val, fuente: f.fuente, corte: f.corte, nota: f.nota || '', anulado: !!f.anulado, ts };
  await DS.cap.db.doc(`datos/${uid}/e/${key}`).set(doc);
  await decLog({ accion: f.anulado ? 'Anulación de valor' : (antes ? 'Cambio de valor' : 'Alta de valor'), clave: key, esc: f.esc, area: f.area, ind: f.ind, per: f.per, antes: antes ? { val: antes.val, fuente: antes.fuente } : null, despues: f.anulado ? null : { val: f.val, fuente: f.fuente, corte: f.corte }, nota: f.nota || '' });
  DS.entries[uid] = { ...(DS.entries[uid] || {}), [key]: doc };
}
async function decSaveProc(f) {
  await decEnsureRoster(); const uid = DS.me.id; const ts = decNowISO(); const key = decKey.p(f.esc, f.proc);
  const antes = DS.model.procs.get(`${f.esc}|${f.proc}`) || null;
  const doc = { t: 'p', key, esc: f.esc, proc: f.proc, ficha: f.ficha, dueno: f.dueno || '', fuente: f.fuente, ts };
  await DS.cap.db.doc(`datos/${uid}/e/${key}`).set(doc);
  await decLog({ accion: 'Cambio del proceso', clave: key, esc: f.esc, proc: f.proc, antes: antes ? { ficha: antes.ficha, dueno: antes.dueno } : null, despues: { ficha: f.ficha, dueno: f.dueno || '' }, nota: f.fuente });
  DS.entries[uid] = { ...(DS.entries[uid] || {}), [key]: doc };
}
async function decValidate(key, entryTs, estado, nota) {
  await decEnsureRoster(); const uid = DS.me.id; const ts = decNowISO();
  const doc = { key, entryTs, estado, nota: nota || '', by: uid, ts };
  await DS.cap.db.doc(`validaciones/${uid}/v/${key}`).set(doc);
  await decLog({ accion: estado === 'Validado' ? 'Validación de la oficina' : 'Observación de la oficina', clave: key, nota: nota || '' });
  DS.vals[uid] = { ...(DS.vals[uid] || {}), [key]: doc };
}
async function decSetRoster(uid, doc) {
  const db = DS.cap.db;
  if (doc && doc.rol === 'responsable') {
    // un solo responsable por escuela: se retira a quien lo fuera antes
    for (const [u, r] of Object.entries(DS.roster)) { if (u !== uid && r.rol === 'responsable' && r.escuela === doc.escuela) await db.doc(`roster/${u}`).delete(); }
  }
  if (doc) await db.doc(`roster/${uid}`).set({ ...doc, por: DS.me.id, ts: decNowISO() }); else await db.doc(`roster/${uid}`).delete();
  await decLog({ accion: doc ? 'Asignación de persona' : 'Retiro de persona', clave: 'roster_' + uid, esc: doc ? doc.escuela : '', nota: doc ? doc.rol : '' });
}

/* ---- descargas: la capacidad del artefacto cuando existe; si no, descarga normal ---- */
async function decSave(name, data) {
  const dl = DS.cap.dl;
  if (dl && typeof dl.save === 'function') {
    try { const r = await dl.save({ filename: name, data }); toast(r && r.status === 'saved' || r === 'saved' ? 'Archivo guardado: ' + name : 'Archivo enviado: ' + name); return; }
    catch (e) { if (e && e.code === 'declined') return toast('No se guardó el archivo.'); toast('No se pudo guardar el archivo (' + ((e && e.code) || 'error') + ').'); return; }
  }
  downloadBlob(data instanceof Blob ? data : new Blob([data]), name);
}

/* ---- filas de exportación ---- */
function decRowsAlertas(items) {
  return items.map(i => ({
    Escuela: DEC_ESC_NOM[i.esc], 'Área': i.area ? DEC_AREA_CORTO[i.area] : (i.porArea ? 'Programa' : ''), Tipo: i.tipo, Código: i.cod, Elemento: i.nombre,
    Nivel: DC[i.c].label + ' (propuesta)', Motivo: i.motivo, Valor: i.valorTxt, Referencial: i.refTxt,
    'Brecha (puntos)': i.brecha === null || i.brecha === undefined ? '' : Math.round(i.brecha * 10) / 10,
    Estándares: i.estandares.join(', '), Procesos: i.procesos.map(p => 'P' + (P102_BY[p] ? P102_BY[p].n : p)).join(', '), Responsable: i.resp, 'Siguiente acción': i.accion,
    Fuente: i.fuente, 'Fecha de corte del dato': i.corte,
  }));
}
function decRowsValores() {
  return DS.model.pts.slice().sort((a, b) => natKey(a.ind).localeCompare(natKey(b.ind)) || DEC_ESC.indexOf(a.esc) - DEC_ESC.indexOf(b.esc) || a.area.localeCompare(b.area) || decPerEnd(a.per) - decPerEnd(b.per)).map(p => ({
    Escuela: DEC_ESC_NOM[p.esc], 'Área': p.area ? DEC_AREA_CORTO[p.area] : '', Indicador: p.ind, Nombre: DEC_IND[p.ind].nombre, Periodo: decPerLabel(p.per), Valor: p.val, Unidad: DEC_IND[p.ind].unidad, Referencial: decRefTxt(p.ind),
    Fuente: p.fuente, 'Fecha de corte del dato': p.corte, Origen: p.origen, 'Registrado por': p.autor ? decWho(p.autor) : '', 'Validación de la oficina': p.vestado, Nota: p.nota,
  }));
}
function decRowsProcesos(items) {
  return items.filter(i => i.tipo === 'Proceso').map(i => ({ Escuela: DEC_ESC_NOM[i.esc], Proceso: i.nombre, Nivel: DC[i.c].label, Ficha: i.valorTxt, 'Dueño designado': i.rec && i.rec.dueno ? i.rec.dueno : 'Por confirmar', Motivo: i.motivo, Responsable: i.resp, 'Siguiente acción': i.accion, Fuente: i.fuente }));
}
function decRowsBitacora() {
  const out = [{ Fecha: '2026-10-22', Quién: 'Carga inicial (datos informados por Robert)', Acción: 'Carga inicial', Elemento: 'EPTM: ID6, ID10, ID13, ID14, ID19 y estado de los 9 procesos', Antes: '', Después: '', Nota: DEC_BASE_FUENTE }];
  Object.values(DS.events).flatMap(o => Object.values(o)).sort((a, b) => String(a.ts).localeCompare(String(b.ts))).forEach(e => out.push({ Fecha: e.ts, Quién: decWho(e.by), Acción: e.accion, Elemento: e.clave || '', Antes: e.antes ? JSON.stringify(e.antes) : '', Después: e.despues ? JSON.stringify(e.despues) : '', Nota: e.nota || '' }));
  return out;
}
function decCSV(rows) { if (!rows.length) return ''; const cols = Object.keys(rows[0]); return '\uFEFF' + [cols.map(csvCell).join(',')].concat(rows.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\r\n'); }
async function decExport(what, fmt) {
  const items = decScoped(); const base = 'SGC_decision_' + DEC_CORTE;
  const sets = { alertas: () => decRowsAlertas(items), valores: () => decRowsValores(), procesos: () => decRowsProcesos(items), bitacora: () => decRowsBitacora() };
  if (fmt === 'csv') { const rows = sets[what](); if (!rows.length) return toast('No hay filas para exportar.'); return decSave(`${base}_${what}.csv`, new Blob([decCSV(rows)], { type: 'text/csv;charset=utf-8' })); }
  const wb = XLSX.utils.book_new();
  const supu = [['Alerta de gestión PROPUESTA con la sección 9.1 del ' + DEC_MODELO + '. No es una valoración oficial.'], ['Fecha de corte: ' + fmtDate(parseISO(DEC_CORTE))], ['Verde: alcanza el referencial. Amarillo: dentro de ±3 puntos del referencial o mejora respecto al año anterior. Rojo: fuera de ese margen y sin mejora. Gris: sin dato o por confirmar (riesgo de evidencia).'], ['Datos EPTM: ' + DEC_BASE_FUENTE], ['Enfermería y Obstetricia: sin datos cargados.'], ['Valores sin validar por la oficina: ' + DS.model.pts.filter(p => p.vestado !== 'Validado').length + ' de ' + DS.model.pts.length]];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(supu), 'Supuestos');
  [['Alertas', sets.alertas()], ['Valores', sets.valores()], ['Procesos', sets.procesos()], ['Bitácora', sets.bitacora()]].forEach(([n, rows]) => { XLSX.utils.book_append_sheet(wb, rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['Sin filas']]), n); });
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return decSave(`${base}.xlsx`, new Blob([buf], { type: XLSX_MIME }));
}

/* ---- dibujo ---- */
const decIcon = c => DC[c].icon;
function decCell(it, opts = {}) {
  const c = it.c; const txt = opts.txt !== undefined ? opts.txt : (it.ev && it.ev.last ? decFmt(it.cod, it.ev.last.val) : DC[c].short);
  const sub = opts.sub !== undefined ? opts.sub : (it.ev && it.ev.last ? decPerLabel(it.ev.last.per) + (it.ev.defPend ? ' · por confirmar' : '') : (it.ev && it.ev.mini) || '');
  const pressed = opts.pressed ? 'true' : 'false';
  return `<button class="hc dec-hc st-${DC[c].cls}" data-dec="open" data-id="${esc(it.id)}" aria-pressed="${pressed}" aria-label="${esc(it.cod + ' ' + decEscLabel(it) + ': ' + DC[c].label + '. ' + it.motivo)}"><span class="l1">${I(decIcon(c))}${esc(txt)}</span><span class="l2">${esc(sub)}${it.ev && it.ev.last && !it.ev.vacio && it.ev.last.vestado !== 'Validado' ? ' · sin validar' : ''}</span></button>`;
}
function decSpark(pts, ind, w = 110, h = 30) {
  if (!pts.length) return '';
  const last4 = pts.slice(-4); const vals = last4.map(p => p.val); const mn = Math.min(...vals, DEC_IND[ind].ref), mx = Math.max(...vals, DEC_IND[ind].ref); const span = (mx - mn) || 1;
  const x = i => 4 + (last4.length === 1 ? (w - 8) / 2 : i * (w - 8) / (last4.length - 1)); const y = v => h - 4 - (v - mn) / span * (h - 8);
  const ry = y(DEC_IND[ind].ref);
  return `<svg class="dec-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Últimos ${last4.length} periodos: ${last4.map(p => decPerLabel(p.per) + ' ' + decFmt(ind, p.val)).join(', ')}"><line x1="0" x2="${w}" y1="${ry}" y2="${ry}" class="rf"/><polyline fill="none" class="ln" points="${last4.map((p, i) => x(i) + ',' + y(p.val)).join(' ')}"/>${last4.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.val)}" r="${i === last4.length - 1 ? 3.6 : 2.4}" class="${i === last4.length - 1 ? 'pt last' : 'pt'}"/>`).join('')}</svg>`;
}
function decTrendChart(it) {
  const ind = it.cod; const d = DEC_IND[ind]; const pts = it.pts.slice(-6);
  if (!pts.length) return '<div class="empty">Sin valores cargados: no hay tendencia que mostrar.</div>';
  const W = 480, H = 240, L = 44, R = 16, T = 26, B = 40, PX = 22; const vals = pts.map(p => p.val);
  let mn = Math.min(0, ...vals, d.ref), mx = Math.max(...vals, d.ref); if (d.unidad === '%' && ind !== 'ID6') { mx = Math.max(mx, 100); mn = 0; } else { const pad = (mx - mn) * 0.1 || 1; mx += pad; if (mn < 0) mn -= pad; }
  const x = i => L + PX + (pts.length === 1 ? (W - L - R - 2 * PX) / 2 : i * (W - L - R - 2 * PX) / (pts.length - 1)); const y = v => T + (mx - v) / (mx - mn) * (H - T - B);
  const ticks = []; const step = (mx - mn) / 4; for (let k = 0; k <= 4; k++) ticks.push(mn + step * k);
  const band = d.unidad === '%' && !d.menor ? `<rect x="${L}" y="${y(d.ref)}" width="${W - L - R}" height="${Math.max(0, y(d.ref - 3) - y(d.ref))}" class="dec-band"/>` : '';
  return `<svg class="dec-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia de ${esc(ind)}: ${pts.map(p => decPerLabel(p.per) + ' ' + decFmt(ind, p.val)).join(', ')}. Referencial ${esc(decRefTxt(ind))}.">
    ${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="gr"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${esc(fmtN(t, 0))}</text>`).join('')}
    ${band}<line x1="${L}" x2="${W - R}" y1="${y(d.ref)}" y2="${y(d.ref)}" class="ref"/><text x="${L + 6}" y="${y(d.ref) + 15}" class="reft">Referencial ${esc(decRefTxt(ind))}</text>
    <polyline fill="none" class="ln" points="${pts.map((p, i) => x(i) + ',' + y(p.val)).join(' ')}"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.val)}" r="${i === pts.length - 1 ? 6 : 4}" class="${i === pts.length - 1 ? 'pt last st-' + DC[it.c].cls : 'pt'}"/><text x="${x(i)}" y="${y(p.val) - 10}" text-anchor="middle" class="vl">${esc(fmtN(p.val, 1))}</text><text x="${x(i)}" y="${H - 14}" text-anchor="middle" class="ax">${esc(decPerLabel(p.per))}</text>`).join('')}
  </svg>`;
}

/* ---- historial por área (indicadores que se miden por área) ---- */
const DEC_MARK = ['c', 's', 'd', 't'];
function decTrendMark(pts, ind) {
  if (!pts || pts.length < 2) return { a: '—', dd: null, txt: 'Un solo periodo: sin tendencia' };
  const a = pts[pts.length - 2], b = pts[pts.length - 1]; const dd = b.val - a.val; const u = DEC_IND[ind].unidad === '%' ? ' pts' : ' años';
  return { a: dd > 0 ? '↑' : dd < 0 ? '↓' : '→', dd, txt: `${dd > 0 ? 'Sube' : dd < 0 ? 'Baja' : 'Sin cambio'}${dd ? ' ' + fmtN(Math.abs(dd), 1) + u : ''} frente a ${decPerLabel(a.per)}` };
}
function decMarker(m, x, y, r) {
  if (m === 's') return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" class="mk"/>`;
  if (m === 'd') return `<polygon points="${x},${y - r * 1.35} ${x + r * 1.35},${y} ${x},${y + r * 1.35} ${x - r * 1.35},${y}" class="mk"/>`;
  if (m === 't') return `<polygon points="${x},${y - r * 1.3} ${x + r * 1.25},${y + r} ${x - r * 1.25},${y + r}" class="mk"/>`;
  return `<circle cx="${x}" cy="${y}" r="${r}" class="mk"/>`;
}
function decAreaHistory(o) {
  const ind = o.cod; const d = DEC_IND[ind]; const leaves = o.leaves.filter(l => l.pts.length);
  if (!leaves.length) return '';
  const pers = [...new Set(leaves.flatMap(l => l.pts.map(p => p.per)))].sort((a, b) => decPerEnd(a) - decPerEnd(b)).slice(-4);
  const W = 480, H = 250, L = 44, R = 16, T = 22, B = 40, PX = 26; const mn = 0, mx = 100;
  const x = i => L + PX + (pers.length === 1 ? (W - L - R - 2 * PX) / 2 : i * (W - L - R - 2 * PX) / (pers.length - 1)); const y = v => T + (mx - v) / (mx - mn) * (H - T - B);
  const ser = o.leaves.map((l, k) => ({ l, k, m: DEC_MARK[k % 4], pts: pers.map((p, i) => { const q = l.pts.find(z => z.per === p); return q ? { i, v: q.val, per: p } : null; }).filter(Boolean) })).filter(z => z.pts.length);
  const band = d.unidad === '%' && !d.menor ? `<rect x="${L}" y="${y(d.ref)}" width="${W - L - R}" height="${Math.max(0, y(d.ref - 3) - y(d.ref))}" class="dec-band"/>` : '';
  const desc = ser.map(z => `${DEC_AREA_CORTO[z.l.area]}: ${z.pts.map(q => decPerLabel(q.per) + ' ' + decFmt(ind, q.v)).join(', ')}`).join('. ');
  const svg = `<svg class="dec-chart dec-multi" viewBox="0 0 ${W} ${H}" role="img" aria-label="Historial de ${esc(ind)} por área. ${esc(desc)}. Referencial ${esc(decRefTxt(ind))}.">
    ${[0, 25, 50, 75, 100].map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="gr"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${t}</text>`).join('')}
    ${band}<line x1="${L}" x2="${W - R}" y1="${y(d.ref)}" y2="${y(d.ref)}" class="ref"/>
    ${ser.map(z => `<g class="s${z.k % 4}"><polyline fill="none" class="ln" points="${z.pts.map(q => x(q.i) + ',' + y(q.v)).join(' ')}"/>${z.pts.map(q => `<g><title>${esc(DEC_AREA_CORTO[z.l.area])} · ${esc(decPerLabel(q.per))}: ${esc(decFmt(ind, q.v))}</title>${decMarker(z.m, x(q.i), y(q.v), 4.4)}</g>`).join('')}</g>`).join('')}
    ${pers.map((p, i) => `<text x="${x(i)}" y="${H - 14}" text-anchor="middle" class="ax">${esc(decPerLabel(p))}</text>`).join('')}
  </svg>`;
  const legend = `<ul class="dec-leg" aria-label="Áreas">${ser.map(z => `<li class="s${z.k % 4}"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${decMarker(z.m, 8, 8, 4.4)}</svg>${esc(DEC_AREA_CORTO[z.l.area])}</li>`).join('')}<li class="refl"><svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><line x1="1" x2="21" y1="8" y2="8" class="refln"/></svg>Referencial ${esc(decRefTxt(ind))}</li></ul>`;
  const ico = v => (!d.menor ? v >= d.ref : v < d.ref) ? { i: 'i-ok', c: 'ok', t: 'alcanza' } : (!d.menor && d.unidad === '%' && d.ref - v <= 3) ? { i: 'i-risk', c: 'risk', t: 'dentro de ±3 puntos' } : { i: 'i-crit', c: 'crit', t: 'bajo el referencial' };
  const rows = o.leaves.map(l => { const t = decTrendMark(l.pts, ind); const first = l.pts.length > 1 ? l.pts[0] : null; const lastp = l.pts[l.pts.length - 1];
    const cells = pers.map(p => { const q = l.pts.find(z => z.per === p); if (!q) return '<td class="num muted">—</td>'; const f = ico(q.val); return `<td class="num"><span class="dec-v st-${f.c}" title="${esc(f.t)}">${I(f.i)}<b>${esc(decFmt(ind, q.val))}</b></span><span class="sr">${esc(f.t)}</span></td>`; }).join('');
    const w = l.pts.slice(-4); const net = w.length > 1 ? w[w.length - 1].val - w[0].val : null;
    return `<tr class="clk" data-dec="open" data-id="${esc(l.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(ind)} ${esc(DEC_AREA_CORTO[l.area])}"><th scope="row">${esc(DEC_AREA_CORTO[l.area])}</th>${cells}<td class="tr" title="${esc(t.txt)}"><b class="dec-tr">${t.a}</b> <span class="small">${t.dd === null ? 'sin tendencia' : (t.dd > 0 ? '+' : t.dd < 0 ? '−' : '') + fmtN(Math.abs(t.dd), 1)}</span>${net !== null ? `<div class="small muted">en ${w.length} periodos: ${net > 0 ? '+' : net < 0 ? '−' : ''}${fmtN(Math.abs(net), 1)}</div>` : ''}</td></tr>`; }).join('');
  return `<h4 class="dec-h4">Historial por área (últimos ${pers.length} periodos: ${esc(decPerLabel(pers[0]))} a ${esc(decPerLabel(pers[pers.length - 1]))})</h4>
    ${legend}${svg}
    <div class="tblw" style="margin-top:8px"><table class="tbl dec-hist4"><thead><tr><th>Área</th>${pers.map(p => `<th class="num">${esc(decPerLabel(p))}</th>`).join('')}<th>Tendencia</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted" style="margin:6px 0 0">Cada valor muestra si alcanza el referencial, queda dentro de ±3 puntos o queda por debajo. Tendencia: cambio frente al periodo anterior y neto en el tramo. Toca un área para abrir su ficha. Valores informados por Robert al 22-10-2026, sin validar.</p>`;
}

function decSchoolCard(esc_) {
  const items = DS.items.filter(i => i.esc === esc_); const cnt = decCounts(items); const g = dcWorst(items.map(i => i.c));
  const tot = items.length; const conDato = items.filter(i => i.measured && !(i.ev && i.ev.defPend)).length;
  const worst = decRanking(items)[0];
  const sinNada = cnt.gris === tot;
  const why = sinNada ? 'Sin datos cargados: todo el semáforo está en gris y es riesgo de evidencia. La escuela puede cargar sus valores con su responsable.' : (worst ? `Lo más crítico: ${worst.cod} ${worst.nombre}. ${worst.motivo}` : 'Todos los elementos alcanzan su referencial.');
  const seg = DC_ORDER.map(c => cnt[c] ? `<span class="seg st-${DC[c].cls}" style="flex:${cnt[c]}" title="${cnt[c]} ${DC[c].label.toLowerCase()}s">${I(DC[c].icon)}${cnt[c]}</span>` : '').join('');
  const pend = DS.model.pts.filter(p => p.esc === esc_ && p.vestado !== 'Validado').length;
  return `<article class="card dec-sc" aria-label="${esc(DEC_ESC_NOM[esc_])}">
    <div class="dec-sc-h"><h3>${esc(DEC_ESC_NOM[esc_])}</h3>${dcChip(g, 'Global: ' + DC[g].label)}</div>
    <div class="dec-cnt" role="list" aria-label="Alertas de ${esc(DEC_ESC_NOM[esc_])}">
      ${DC_ORDER.map(c => `<div class="dec-n st-${DC[c].cls}" role="listitem">${I(DC[c].icon)}<b class="num">${cnt[c]}</b><span>${c === 'rojo' ? 'rojas' : c === 'amarillo' ? 'amarillas' : c === 'verde' ? 'verdes' : 'grises'}</span></div>`).join('')}
    </div>
    <div class="sbar" aria-hidden="true">${seg}</div>
    <p class="small muted" style="margin:0">${conDato} de ${tot} elementos con dato · ${esc_ === 'TM' ? 'el indicador por área cuenta una vez por cada área' : 'indicadores del Modelo y 9 procesos'}${pend ? ` · ${pend} valor${pend === 1 ? '' : 'es'} sin validar` : ''}</p>
    <p class="why small">${esc(why)}</p>
  </article>`;
}
function decRankRows(list, n) {
  return list.slice(0, n).map((it, k) => `<tr class="clk" data-dec="open" data-id="${esc(it.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(it.cod)}">
    <td class="num strong">${k + 1}</td><td>${dcChip(it.c, DC[it.c].label)}</td>
    <td><span class="id">${esc(it.cod)}</span> ${esc(it.nombre)}<div class="small muted">${esc(decEscLabel(it))} · ${esc(it.tipo)}</div></td>
    <td>${esc(it.motivo)}</td><td>${esc(it.resp)}</td><td>${esc(it.accion)} <span class="exb" title="Propuesta del tablero, no una decisión oficial">PROPUESTA</span></td></tr>`).join('');
}

function decMapProc(escs) {
  let h = `<div class="tblw" style="padding:6px"><table class="heat" aria-label="Mapa de calor: procesos del criterio 10.2 por escuela"><thead><tr><th scope="col">Proceso del criterio 10.2</th>${escs.map(e => `<th scope="col" class="c">${esc(DEC_ESC_NOM[e])}</th>`).join('')}</tr></thead><tbody>`;
  M.procesos102.forEach(p => {
    h += `<tr><th scope="row" class="rowlab">${esc('P' + p.n + ' ' + p.nombre)}</th>`;
    escs.forEach(e => { const it = DS.byProc[`${e}|${p.id}`]; h += `<td>${decCell(it, { txt: it.valorTxt, sub: it.motivo.split(';')[0].replace(/\.$/, ''), pressed: DS.sel === it.id })}</td>`; });
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}
function decMapInd(escs) {
  const cols = [];
  escs.forEach(e => { cols.push({ e, area: '', lab: DEC_ESC_NOM[e] + (e === 'TM' ? ' · programa' : '') }); if (e === 'TM') DEC_AREAS.forEach(a => cols.push({ e, area: a, lab: DEC_AREA_CORTO[a], area_: true })); });
  let h = `<div class="tblw" style="padding:6px"><table class="heat dec-heat2" aria-label="Mapa de calor: indicadores por escuela y por área de Tecnología Médica"><thead><tr><th scope="col">Indicador</th>${cols.map(c => `<th scope="col" class="c">${esc(c.lab)}</th>`).join('')}</tr></thead><tbody>`;
  DEC_IDS.forEach(id => {
    h += `<tr><th scope="row" class="rowlab"><span class="id">${id}</span> ${esc(DEC_IND[id].nombre.replace(/^Porcentaje de /, '% de ').replace(/^Evolución del porcentaje de /, 'Evolución % de '))}<small>${esc(DEC_IND[id].frec)} · ${esc(decRefTxt(id))}</small></th>`;
    cols.forEach(col => {
      if (col.area_) { if (!decPorArea(DS.model, 'TM', id)) { h += `<td><div class="hc st-na dec-na" title="Este indicador se mide para el programa, no por área" aria-hidden="true"></div></td>`; return; } const it = DS.byIndLeaf[`TM|${id}`].find(x => x.area === col.area); const tm = decTrendMark(it.pts, id); const lastv = it.ev && it.ev.last && !it.ev.vacio; h += `<td>${decCell(it, { pressed: DS.sel === it.id, txt: lastv ? decFmt(id, it.ev.last.val) + (tm.dd === null ? '' : ' ' + tm.a) : undefined })}</td>`; return; }
      const leaves = DS.byIndLeaf[`${col.e}|${id}`];
      if (leaves.length > 1) { const w = dcWorst(leaves.map(l => l.c)); const wl = leaves.filter(l => l.c === w)[0]; const star = { ...wl, id: `${col.e}|ALL|${id}`, ev: wl.ev }; const hasData = leaves.some(l => !l.ev.vacio); const l1 = w === 'gris' ? (hasData ? 'Por confirmar' : 'Sin dato') : DC[w].short; h += `<td><button class="hc dec-hc st-${DC[w].cls}" data-dec="open" data-id="${esc(col.e + '|ALL|' + id)}" aria-label="${esc(id + ' ' + DEC_ESC_NOM[col.e] + ' programa: peor área, ' + DC[w].label)}"><span class="l1">${I(DC[w].icon)}${esc(l1)}</span><span class="l2">peor de las 4 áreas</span></button></td>`; return; }
      h += `<td>${decCell(leaves[0], { pressed: DS.sel === leaves[0].id })}</td>`;
    });
    h += '</tr>';
  });
  return h + '</tbody></table></div>';
}

function decFiltered() {
  const f = DS.f; const q = noAcc(f.q);
  return decScoped().filter(i => (!f.est || i.estandares.includes(f.est)) && (!f.proc || i.procesos.includes(f.proc)) && (!f.nivel || i.c === f.nivel) && (!f.tipo || i.tipo === f.tipo) && (!q || noAcc(i.cod + ' ' + i.nombre + ' ' + i.motivo).includes(q)));
}
function decAlertTable(list) {
  if (!list.length) return '<div class="empty">Ninguna alerta coincide con los filtros.</div>';
  const sorted = list.slice().sort((a, b) => decSevKey(b) - decSevKey(a) || DEC_ESC.indexOf(a.esc) - DEC_ESC.indexOf(b.esc) || natKey(a.cod).localeCompare(natKey(b.cod)) || a.area.localeCompare(b.area));
  const shown = sorted.slice(0, 120);
  return `<div class="tblw" style="max-height:540px"><table class="tbl dec-tbl"><thead><tr><th>Nivel</th><th>Escuela</th><th>Elemento</th><th>Motivo</th><th>Valor</th><th>Referencial</th><th>Fuente y corte</th></tr></thead><tbody>${shown.map(i => `<tr class="clk" data-dec="open" data-id="${esc(i.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(i.cod)} ${esc(decEscLabel(i))}"><td>${dcChip(i.c, DC[i.c].label)}</td><td>${esc(decEscLabel(i))}</td><td><span class="id">${esc(i.cod)}</span> ${esc(i.nombre)}</td><td>${esc(i.motivo)}</td><td class="num">${esc(i.valorTxt)}</td><td class="num">${esc(i.refTxt)}</td><td class="small">${esc(i.fuenteCorta || i.fuente)}${i.corte ? ' · corte ' + esc(i.corte) : ''}</td></tr>`).join('')}</tbody></table></div>${sorted.length > shown.length ? `<p class="small muted">Se muestran las ${shown.length} primeras de ${sorted.length} alertas; afina los filtros o exporta la lista completa.</p>` : ''}`;
}

/* ---- ficha (indicador o proceso) ---- */
function decItemById(id) {
  if (!id) return null; const m = id.match(/^(\w+)\|ALL\|(ID\d+)$/);
  if (m) { const leaves = DS.byIndLeaf[`${m[1]}|${m[2]}`]; return { all: true, esc: m[1], cod: m[2], leaves, nombre: DEC_IND[m[2]].nombre, id }; }
  return DS.items.find(i => i.id === id) || null;
}
function decFichaInd(it) {
  const d = DEC_IND[it.cod]; const ev = it.ev; const last = ev.last;
  let tendA = '—', tend = 'Un solo periodo: sin tendencia';
  if (it.pts.length > 1) { const a = it.pts[it.pts.length - 2], b = last; const dd = b.val - a.val; tendA = dd > 0 ? '↑' : dd < 0 ? '↓' : '→'; tend = `${dd > 0 ? 'Sube' : dd < 0 ? 'Baja' : 'Sin cambio'} ${dd ? fmtN(Math.abs(dd), 1) + (d.unidad === '%' ? ' puntos' : ' años') : ''} frente a ${decPerLabel(a.per)}`.replace(/\s+/g, ' ').trim(); }
  const can = decCanEdit(it.esc);
  const rows = it.pts.slice().reverse().map(p => `<tr><td>${esc(decPerLabel(p.per))}</td><td class="num strong">${esc(decFmt(it.cod, p.val))}</td><td class="small">${esc(p.fuenteCorta || p.fuente)}</td><td class="small">${esc(p.corte || '')}</td><td>${p.vestado === 'Validado' ? '<span class="chip st-ok">' + I('i-ok') + '<span>Validado</span></span>' : p.vestado === 'Observado' ? '<span class="chip st-risk">' + I('i-risk') + '<span>Observado</span></span>' : '<span class="chip st-info">' + I('i-clock') + '<span>Sin validar</span></span>'}</td><td class="small">${esc(p.origen)}${p.autor ? ' · ' + esc(decWho(p.autor)) : ''}</td></tr>`).join('');
  const hist = Object.values(DS.events).flatMap(o => Object.values(o)).filter(e => e.esc === it.esc && e.ind === it.cod && (e.area || '') === it.area).sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8);
  return `
    <div class="dec-kv">
      <div><span class="k">Último valor</span><b class="v num">${last ? esc(decFmt(it.cod, last.val)) : '—'}</b><span class="s">${last ? esc(decPerLabel(last.per)) : 'sin dato'}</span></div>
      <div><span class="k">Referencial</span><b class="v num">${esc(decRefTxt(it.cod))}</b><span class="s">Ficha ${esc(it.cod)} del Modelo</span></div>
      <div><span class="k">Brecha</span><b class="v num">${last ? esc((it.brecha >= 0 ? '+' : '−') + fmtN(Math.abs(it.brecha), 1) + (d.unidad === '%' ? ' pts' : ' años')) : '—'}</b><span class="s">${last ? (d.menor ? (it.brecha < 0 ? 'cumple' : 'no cumple') : (it.brecha >= 0 ? 'sobre el referencial' : 'bajo el referencial')) : 'sin valor'}</span></div>
      <div><span class="k">Tendencia</span><b class="v">${tendA}</b><span class="s">${esc(tend)}</span></div>
    </div>
    <p class="dec-why">${dcChip(it.c)} <span>${esc(ev.razon)}</span></p>
    ${ev.stale ? `<p class="small dec-warn">${I('i-clock')} Dato desactualizado: lo esperado al corte es ${esc(decPerLabel(ev.expected))} y el último valor es de ${esc(decPerLabel(last.per))}.</p>` : ''}
    <h4 class="dec-h4">Últimos periodos (hasta 4 semestres o años)</h4>
    ${decTrendChart(it)}
    ${it.pts.length ? `<div class="tblw" style="margin-top:8px"><table class="tbl"><thead><tr><th>Periodo</th><th>Valor</th><th>Fuente</th><th>Corte del dato</th><th>Validación</th><th>Origen</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    <h4 class="dec-h4">Fuente y fecha de corte</h4>
    <dl class="dec-dl"><dt>Fuente del último valor</dt><dd>${esc(last ? last.fuente : it.fuente)}</dd><dt>Fecha de corte</dt><dd>${esc(last ? last.corte : (it.esc === 'TM' ? DEC_CORTE : '—'))}</dd>
    <dt>Referencial</dt><dd>${esc(decRefTxt(it.cod))} · ${esc(DEC_MODELO)}, ficha ${esc(it.cod)}${d.refNota ? '. ' + esc(d.refNota) : ''}</dd>
    <dt>Frecuencia de cálculo</dt><dd>${esc(d.frec)} (campo de la ficha)</dd>
    <dt>Estándares y criterios</dt><dd>${esc(d.est.map(e => e.replace('E', 'Estándar ')).join(', '))} · criterios ${esc(d.crit.join(', '))}</dd>
    <dt>Procesos del 10.2 vinculados</dt><dd>${it.procesos.length ? esc(it.procesos.map(decProcName).join('; ')) : 'Ninguno vinculado en el proyecto'}</dd>
    <dt>Responsable</dt><dd>${esc(it.resp)}</dd><dt>Siguiente acción <span class="exb">PROPUESTA</span></dt><dd>${esc(it.accion)}</dd></dl>
    ${hist.length ? `<h4 class="dec-h4">Quién cambió qué y cuándo</h4><ul class="dec-hist">${hist.map(e => `<li><b>${esc(e.accion)}</b> · ${esc(decWho(e.by))} · ${esc(String(e.ts).slice(0, 16).replace('T', ' '))}${e.despues && e.despues.val !== undefined ? ' · ' + esc(decFmt(it.cod, e.despues.val)) : ''}</li>`).join('')}</ul>` : ''}
    ${decValBox(it, last)}
    ${decFormInd(it, can)}`;
}
function decValBox(it, last) {
  if (!last) return ''; const r = decRole(); if (!r.val || !DS.cap.db) return '';
  return `<div class="dec-box"><h4 class="dec-h4" style="margin-top:0">Validación de la oficina</h4><p class="small muted" style="margin:0 0 8px">Estado actual del último valor: <b>${esc(last.vestado)}</b>${last.vnota ? ' · ' + esc(last.vnota) : ''}. Si el valor cambia después de validarlo, la validación se pierde.</p>
    <label class="small" for="dec-vnota">Nota de la validación</label><input type="text" id="dec-vnota" style="width:100%" placeholder="Opcional">
    <div class="dec-actions"><button class="btn primary" data-dec="validar" data-key="${esc(last.key)}" data-ts="${esc(last.ts)}" data-estado="Validado">${I('i-ok')}Validar valor</button><button class="btn" data-dec="validar" data-key="${esc(last.key)}" data-ts="${esc(last.ts)}" data-estado="Observado">${I('i-risk')}Observar</button></div></div>`;
}
function decFormInd(it, can) {
  if (!can) return decWhyNoEdit(it.esc);
  const d = DEC_IND[it.cod]; const opts = decPerOptions(it.cod); const exp = decExpectedLast(d.frec);
  const nxt = DS.edited.per || (exp && opts.includes(exp) ? exp : opts[0]);
  return `<form class="dec-box dec-form" id="dec-form" data-kind="v" data-esc="${esc(it.esc)}" data-area="${esc(it.area)}" data-ind="${esc(it.cod)}" novalidate>
    <h4 class="dec-h4" style="margin-top:0">Cargar o corregir un valor · ${esc(decEscLabel(it))}</h4>
    <div class="dec-fg">
      <label for="dec-per">Periodo<select id="dec-per">${opts.map(p => `<option value="${esc(p)}"${p === nxt ? ' selected' : ''}>${esc(decPerLabel(p))}</option>`).join('')}</select></label>
      <label for="dec-val">Valor (${d.unidad === '%' ? '%' : 'años'})<input type="text" id="dec-val" inputmode="decimal" autocomplete="off" required placeholder="Ejemplo: 72,5"></label>
      <label for="dec-corte">Fecha de corte del dato<input type="date" id="dec-corte" value="${DEC_CORTE}" required></label>
    </div>
    <label for="dec-fuente">Fuente del dato (obligatoria)<textarea id="dec-fuente" required placeholder="Ejemplo: Registro de resultados de consulta dirigida a estudiantes, 2026-I, oficina de calidad"></textarea></label>
    <label for="dec-nota">Nota (opcional)<input type="text" id="dec-nota" style="width:100%"></label>
    <p class="small muted" id="dec-err" role="alert" style="margin:4px 0;color:var(--bad-t)"></p>
    <div class="dec-actions"><button class="btn primary" type="submit">${I('i-upload')}Guardar valor</button><button class="btn" type="button" data-dec="anular">Anular el valor de este periodo</button></div>
    <p class="small muted" style="margin:6px 0 0">El valor queda «sin validar» hasta que la oficina lo valide. Todo cambio queda en la bitácora con quién, qué y cuándo.</p></form>`;
}
function decWhyNoEdit(esc_) {
  const base = DS.dbState === 'sin-db' || DS.dbState === 'local' ? 'La edición compartida no está disponible en esta vista (se abre solo desde el artefacto publicado, con sesión iniciada).' : DS.dbState === 'sin-id' ? 'No se pudo identificar tu cuenta: la vista es de solo lectura.' : DS.dbState === 'error' ? 'No se pudo conectar con la base compartida (' + esc(DS.dbErr) + ').' : null;
  if (base) return `<p class="dec-box small">${I('i-info')} ${base}</p>`;
  const r = decRole();
  return `<p class="dec-box small">${I('i-info')} ${r.k === 'resp' ? `Eres responsable de ${esc(DEC_ESC_NOM[r.esc])}: solo editas esa escuela.` : 'Tu cuenta no está asignada como responsable de ninguna escuela, así que ves los datos sin editarlos.'} El propietario del tablero asigna un responsable por escuela en el panel «Equipo y bitácora».</p>`;
}
function decFichaProc(it) {
  const can = decCanEdit(it.esc); const rec = it.rec;
  const hist = Object.values(DS.events).flatMap(o => Object.values(o)).filter(e => e.esc === it.esc && e.proc === it.cod).sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8);
  const leaves = it.leaves || [];
  return `<p class="dec-why">${dcChip(it.c)} <span>${esc(it.motivo)}</span></p>
    <h4 class="dec-h4">Cómo sale el estado del proceso</h4>
    <ul class="dec-comp">${it.comps.map(c => `<li>${c.c ? `<span class="chip st-${DC[c.c].cls}">${I(DC[c.c].icon)}<span>${esc(DC[c.c].label)}</span></span>` : '<span class="chip st-na">' + I('i-na') + '<span>No aplica</span></span>'}<div><b>${esc(c.n)}</b><div class="small muted">${esc(c.t)}</div></div></li>`).join('')}</ul>
    <p class="small muted">Regla propuesta: el proceso toma el peor de sus componentes (rojo, amarillo, gris, verde). Sin ficha es rojo; ficha en borrador es amarillo; lo que falta informar queda gris y no se muestra como verde.</p>
    ${leaves.length ? `<h4 class="dec-h4">Indicadores vinculados</h4><div class="tblw"><table class="tbl"><thead><tr><th>Nivel</th><th>Indicador</th><th>Área</th><th>Valor</th></tr></thead><tbody>${leaves.map(l => `<tr class="clk" data-dec="open" data-id="${esc(l.id)}" tabindex="0" role="button"><td>${dcChip(l.c, DC[l.c].label)}</td><td><span class="id">${esc(l.cod)}</span> ${esc(l.nombre)}</td><td>${esc(l.area ? DEC_AREA_CORTO[l.area] : '—')}</td><td class="num">${esc(l.valorTxt)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h4 class="dec-h4">Fuente y responsable</h4>
    <dl class="dec-dl"><dt>Fuente del estado</dt><dd>${esc(it.fuente || 'Sin dato de la escuela')}</dd><dt>Fecha</dt><dd>${esc(it.corte || '—')}</dd>
    <dt>Dueño o responsable</dt><dd>${esc(it.resp)}</dd><dt>Siguiente acción <span class="exb">PROPUESTA</span></dt><dd>${esc(it.accion)}</dd>
    <dt>Estándar</dt><dd>Estándar 10, criterio 10.2: el SGC cubre como mínimo los nueve procesos del Modelo</dd></dl>
    ${hist.length ? `<h4 class="dec-h4">Quién cambió qué y cuándo</h4><ul class="dec-hist">${hist.map(e => `<li><b>${esc(e.accion)}</b> · ${esc(decWho(e.by))} · ${esc(String(e.ts).slice(0, 16).replace('T', ' '))}</li>`).join('')}</ul>` : ''}
    ${can ? `<form class="dec-box dec-form" id="dec-form" data-kind="p" data-esc="${esc(it.esc)}" data-proc="${esc(it.cod)}" novalidate><h4 class="dec-h4" style="margin-top:0">Actualizar el proceso · ${esc(DEC_ESC_NOM[it.esc])}</h4>
      <div class="dec-fg"><label for="dec-ficha">Estado de la ficha<select id="dec-ficha">${Object.keys(DEC_FICHA_TXT).map(k => `<option value="${k}"${(rec ? rec.ficha : 'por confirmar') === k ? ' selected' : ''}>${esc(DEC_FICHA_TXT[k])}</option>`).join('')}</select></label>
      <label for="dec-dueno">Dueño designado<input type="text" id="dec-dueno" value="${esc(rec ? rec.dueno : '')}" placeholder="Nombre y cargo"></label></div>
      <label for="dec-fuente">Fuente (resolución, acta o documento)<textarea id="dec-fuente" required placeholder="Ejemplo: Resolución del Comité de Calidad N.º …"></textarea></label>
      <p class="small muted" id="dec-err" role="alert" style="margin:4px 0;color:var(--bad-t)"></p>
      <div class="dec-actions"><button class="btn primary" type="submit">${I('i-upload')}Guardar</button></div></form>` : decWhyNoEdit(it.esc)}`;
}
function decFichaAll(o) {
  return `<p class="small muted">Indicador medido por área. Elige un área para ver su tendencia y cargar valores.</p>
    ${decAreaHistory(o)}
    <h4 class="dec-h4">Estado actual por área</h4><div class="tblw"><table class="tbl"><thead><tr><th>Área</th><th>Nivel</th><th>Último valor</th><th>Motivo</th></tr></thead><tbody>${o.leaves.map(l => `<tr class="clk" data-dec="open" data-id="${esc(l.id)}" tabindex="0" role="button"><td>${esc(DEC_AREA_CORTO[l.area])}</td><td>${dcChip(l.c, DC[l.c].label)}</td><td class="num">${esc(l.valorTxt)}</td><td class="small">${esc(l.motivo)}</td></tr>`).join('')}</tbody></table></div>
    <dl class="dec-dl" style="margin-top:10px"><dt>Referencial</dt><dd>${esc(decRefTxt(o.cod))} · ficha ${esc(o.cod)} del Modelo</dd><dt>Valor del programa</dt><dd>No se calcula: el promedio de porcentajes por área no equivale al indicador del programa sin el número de docentes de cada área. Se muestra el peor de los cuatro.</dd></dl>`;
}
function decDrawer() {
  const o = decItemById(DS.sel); if (!o) return '';
  let title, body, chipHtml = '';
  if (o.all) { title = `${o.cod} · ${o.nombre}`; body = decFichaAll(o); }
  else if (o.tipo === 'Proceso') { title = `${o.cod} · ${o.nombre}`; body = decFichaProc(o); chipHtml = dcChip(o.c); }
  else { title = `${o.cod} · ${o.nombre}`; body = decFichaInd(o); chipHtml = dcChip(o.c); }
  const sub = o.all ? `${DEC_ESC_NOM[o.esc]} · programa` : decEscLabel(o);
  return `<div class="dec-bk" data-dec="close"></div><aside class="dec-dr" role="dialog" aria-modal="true" aria-labelledby="dec-dr-t" tabindex="-1">
    <header><div><div class="small muted">${esc(sub)} · alerta de gestión propuesta, corte ${esc(fmtDate(parseISO(DEC_CORTE)))}</div><h2 id="dec-dr-t">${esc(title)}</h2></div><button class="btn" data-dec="close" aria-label="Cerrar la ficha">${I('i-x')}Cerrar</button></header>
    <div class="dec-dr-b">${body}</div></aside>`;
}

/* ---- equipo y bitácora ---- */
function decEquipo() {
  const r = decRole(); const rows = Object.entries(DS.roster);
  const estado = { activa: 'Edición compartida activa', esperando: 'Conectando…', local: 'Vista local: sin edición compartida', 'sin-db': 'Sin edición compartida en esta vista', 'sin-id': 'Sin identidad: solo lectura', error: 'Error de conexión (' + DS.dbErr + ')' }[DS.dbState] || DS.dbState;
  const mine = DEC_ESC.map(e => { const u = rows.find(([, x]) => x.rol === 'responsable' && x.escuela === e); return `<tr><td>${esc(DEC_ESC_NOM[e])}</td><td>${u ? esc(decPersona(u[0])) : '<span class="muted">Sin responsable asignado</span>'}</td><td>${DS.me.owner && u ? `<button class="btn small" data-dec="quitar" data-uid="${esc(u[0])}">Quitar</button>` : ''}</td></tr>`; }).join('');
  const of = rows.filter(([, x]) => x.rol === 'oficina').map(([u]) => `<li>${esc(decPersona(u))}${DS.me.owner ? ` <button class="btn small" data-dec="quitar" data-uid="${esc(u)}">Quitar</button>` : ''}</li>`).join('');
  const evs = Object.values(DS.events).flatMap(o => Object.values(o)).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  const evRows = evs.slice(0, 25).map(e => `<tr><td class="num small">${esc(String(e.ts).slice(0, 16).replace('T', ' '))}</td><td>${esc(decWho(e.by))}</td><td>${esc(e.accion)}</td><td class="small">${esc(e.clave || '')}</td><td class="small">${e.antes ? esc(JSON.stringify(e.antes)) : ''}${e.antes && e.despues ? ' → ' : ''}${e.despues ? esc(JSON.stringify(e.despues)) : ''}</td></tr>`).join('');
  return `<details class="alg" id="dec-eq" ${DS.open.eq ? 'open' : ''}><summary><b>Equipo, permisos y bitácora</b><span class="small muted">${esc(estado)} · tu rol: ${esc(r.t)}</span></summary><div class="dec-eq">
    <p class="small">Un responsable por escuela puede cargar y corregir lo suyo; las demás personas solo ven. La oficina valida los valores antes del corte. Cada cambio queda en la bitácora con quién, qué y cuándo.</p>
    <div class="tblw"><table class="tbl"><thead><tr><th>Escuela</th><th>Responsable con permiso de edición</th><th></th></tr></thead><tbody>${mine}</tbody></table></div>
    <p class="small" style="margin:8px 0 0"><b>Oficina de Calidad (valida):</b> ${of ? '' : '<span class="muted">sin personas asignadas</span>'}</p>${of ? `<ul class="small" style="margin:4px 0 8px">${of}</ul>` : ''}
    ${DS.me.id ? `<p class="small">Tu código para que el propietario te asigne: <code id="dec-myid">${esc(DS.me.id)}</code> <button class="btn small" data-dec="copyid">Copiar</button></p>` : ''}
    ${DS.me.owner && DS.cap.db ? decAdminForm() : ''}
    <h4 class="dec-h4">Bitácora (últimos 25 movimientos)</h4>
    <div class="tblw" style="max-height:320px"><table class="tbl"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Elemento</th><th>Antes → después</th></tr></thead><tbody>
      ${evRows}<tr><td class="num small">2026-10-22</td><td>Carga inicial</td><td>Carga inicial</td><td class="small">EPTM</td><td class="small">ID6, ID10, ID13, ID14, ID19 y estado de los 9 procesos, informados por Robert</td></tr></tbody></table></div>
    <div class="dec-actions" style="margin-top:8px"><button class="btn" data-dec="export" data-what="bitacora" data-fmt="csv">${I('i-download')}Bitácora en CSV</button></div></div></details>`;
}
function decAdminForm() {
  return `<form class="dec-box dec-form" id="dec-roster" novalidate><h4 class="dec-h4" style="margin-top:0">Asignar una persona (solo el propietario)</h4>
    <div class="dec-fg"><label for="dec-rq">Buscar por nombre<input type="text" id="dec-rq" placeholder="Nombre de la persona" autocomplete="off"></label>
    <label for="dec-ruid">…o pegar su código<input type="text" id="dec-ruid" placeholder="Código de la persona"></label>
    <label for="dec-rrol">Rol<select id="dec-rrol"><option value="responsable">Responsable de una escuela</option><option value="oficina">Oficina de Calidad (valida)</option></select></label>
    <label for="dec-resc">Escuela<select id="dec-resc">${DEC_ESC.map(e => `<option value="${e}">${esc(DEC_ESC_NOM[e])}</option>`).join('')}</select></label></div>
    <div id="dec-hits" class="small"></div><p class="small muted" id="dec-err2" role="alert" style="margin:4px 0;color:var(--bad-t)"></p>
    <div class="dec-actions"><button class="btn primary" type="submit">Asignar</button>${DS.roster[DS.me.id] ? '' : '<button class="btn" type="button" data-dec="yo-oficina">Agregarme a la oficina</button>'}</div>
    <p class="small muted" style="margin:6px 0 0">Asignar a alguien como responsable de una escuela retira al anterior: hay uno por escuela.</p></form>`;
}

/* ---- vista ---- */
function viewDecision() {
  decBuild();
  const escs = decEscSel(); const scoped = decScoped(); const cnt = decCounts(scoped);
  const rank = decRanking(scoped); const list = decFiltered(); const pend = DS.model.pts.filter(p => decEscSel().includes(p.esc) && p.vestado !== 'Validado').length;
  const f = DS.f;
  const html = `
  ${pageHead('¿Qué proceso o indicador está en riesgo?', `Alerta de gestión para las escuelas de Tecnología Médica, Enfermería y Obstetricia, con corte al ${esc(fmtDate(parseISO(DEC_CORTE)))}. Fuente de referenciales: ${esc(DEC_MODELO)}.`)}
  <div class="banner" role="note">${I('i-info')}<div><b>Semáforo propuesto, no valoración oficial.</b> Aplica la sección 9.1 del Modelo: verde si alcanza el referencial; amarillo si queda dentro de ±3 puntos o mejora respecto al año anterior; rojo si no; gris si no hay dato (riesgo de evidencia, nunca verde). La escala oficial No logrado, Logrado y Logrado plenamente se aplica a los estándares, no a los indicadores. Esta vista no usa datos EJEMPLO.${S.escuela === 'FAC' ? ' Facultad no entra en esta vista: se muestran las tres escuelas.' : ''}</div></div>
  <details class="alg"><summary><b>Reglas y supuestos</b><span class="small muted">qué hace el semáforo y qué quedó por confirmar</span></summary><div class="dec-sup">
    <ul>
      <li><b>Indicadores:</b> se evalúa el último periodo con dato. «Año anterior» es el mismo semestre del año previo (o el año previo, si es anual). El margen de ±3 puntos solo se aplica a porcentajes; en ID25 e ID26 (años) no hay margen y cumple si el valor es menor al referencial, como dice la ficha.</li>
      <li><b>Gris:</b> sin dato, sin medir, sin calcular o definición por confirmar. En la EPTM, ID10 queda en gris porque el dato informado (asignaturas con ≥80 % de aprobados) no es la medida de la ficha (estudiantes aprobados por asignatura).</li>
      <li><b>Procesos:</b> el estado sale de la ficha (sin ficha, borrador, aprobada), del dueño designado y de los indicadores vinculados con dato. Toma el peor de los tres. El vínculo proceso-indicador es del proyecto, no del Modelo.</li>
      <li><b>Semáforo global de la escuela:</b> el peor nivel entre sus elementos (rojo, amarillo, gris, verde). Criterio conservador, por confirmar.</li>
      <li><b>ID4:</b> referencial de 70 % por decisión de Robert (22-10-2026). La ficha del Modelo dice 60 % en el campo REFERENCIAL (línea 2357) y 70 % en la interpretación (línea 2358).</li>
      <li><b>Inconsistencias del Modelo que no se resuelven aquí:</b> ID29 figura en el criterio 8.5 y en el Estándar 6; las etiquetas EV40 a EV44 están desordenadas en el texto; la numeración EV49 a EV52 está por confirmar con la OCAA.</li>
      <li><b>Valores sin validar:</b> cuentan en el semáforo y se marcan «sin validar» hasta que la oficina los valide. El interruptor de abajo permite ver solo los validados.</li>
    </ul></div></details>
  <div class="filters"><label class="sw" for="dec-solo"><input type="checkbox" id="dec-solo" ${DS.soloVal ? 'checked' : ''}><span class="tr" aria-hidden="true"></span><span>Contar solo valores validados por la oficina (${pend} sin validar)</span></label>
    <span class="grow"></span>
    <details class="menu" id="dec-exp"><summary class="btn">${I('i-download')}Exportar</summary><div class="menu-p" role="menu">
      <button role="menuitem" data-dec="export" data-what="todo" data-fmt="xlsx">Excel completo (alertas, valores, procesos, bitácora)</button>
      <button role="menuitem" data-dec="export" data-what="alertas" data-fmt="csv">CSV · Alertas</button>
      <button role="menuitem" data-dec="export" data-what="valores" data-fmt="csv">CSV · Valores con fuente y corte</button>
      <button role="menuitem" data-dec="export" data-what="procesos" data-fmt="csv">CSV · Procesos</button>
      <button role="menuitem" data-dec="export" data-what="bitacora" data-fmt="csv">CSV · Bitácora</button></div></details></div>
  ${sect('Panel resumen', 'i-home')}
  <div class="dec-tot" role="list" aria-label="Alertas del conjunto visible">${DC_ORDER.map(c => `<div class="dec-n st-${DC[c].cls}" role="listitem">${I(DC[c].icon)}<b class="num">${cnt[c]}</b><span>${c === 'rojo' ? 'alertas rojas' : c === 'amarillo' ? 'amarillas' : c === 'verde' ? 'verdes' : 'grises (riesgo de evidencia)'}</span></div>`).join('')}</div>
  <div class="grid g3 dec-sc-g">${escs.map(decSchoolCard).join('')}</div>
  ${sect('Los 10 elementos más críticos', 'i-bell')}
  ${rank.length ? `<div class="tblw"><table class="tbl dec-tbl"><thead><tr><th>#</th><th>Nivel</th><th>Elemento</th><th>Motivo</th><th>Responsable</th><th>Siguiente acción</th></tr></thead><tbody>${decRankRows(rank, 10)}</tbody></table></div><p class="small muted">Orden: rojo, amarillo y gris; dentro de cada nivel, primero lo que tiene dato y la mayor brecha. Responsable y siguiente acción son propuestas; el responsable sale de las fichas del SGC y está por confirmar.</p>` : '<div class="empty">No hay elementos en alerta.</div>'}
  ${sect('Mapa de calor: procesos por escuela', 'i-flow')}
  ${decMapProc(escs)}
  ${sect('Mapa de calor: indicadores por escuela y por área', 'i-grid')}
  <p class="small muted">Los indicadores ID10 e ID19 de Tecnología Médica se miden por área; el resto, para el programa. Toca una celda para abrir su ficha.</p>
  ${decMapInd(escs)}
  ${sect('Alertas', 'i-bell')}
  <div class="filters">
    <label for="dec-fn">Nivel<select id="dec-fn"><option value="">Todos</option>${DC_ORDER.map(c => `<option value="${c}"${f.nivel === c ? ' selected' : ''}>${DC[c].label}</option>`).join('')}</select></label>
    <label for="dec-ft">Tipo<select id="dec-ft"><option value="">Indicadores y procesos</option><option value="Indicador"${f.tipo === 'Indicador' ? ' selected' : ''}>Indicadores</option><option value="Proceso"${f.tipo === 'Proceso' ? ' selected' : ''}>Procesos</option></select></label>
    <label for="dec-fe">Estándar<select id="dec-fe"><option value="">Todos</option>${M.estandares.map(e => `<option value="${e.id}"${f.est === e.id ? ' selected' : ''}>${esc(e.id.replace('E', 'Estándar ') + ' · ' + e.nombre)}</option>`).join('')}</select></label>
    <label for="dec-fp">Proceso<select id="dec-fp"><option value="">Todos</option>${M.procesos102.map(p => `<option value="${p.id}"${f.proc === p.id ? ' selected' : ''}>${esc('P' + p.n + ' ' + p.nombre)}</option>`).join('')}</select></label>
    <label for="dec-fq">Buscar<input type="text" id="dec-fq" value="${esc(f.q)}" placeholder="ID o palabra"></label>
    <span class="small muted">La escuela se elige arriba.</span></div>
  <p class="small" id="dec-count">${list.length} alerta${list.length === 1 ? '' : 's'} con los filtros actuales</p>
  <div id="dec-alerts">${decAlertTable(list)}</div>
  ${sect('Equipo y bitácora', 'i-link')}
  ${decEquipo()}
  ${DS.sel ? decDrawer() : ''}`;
  const root = document.createElement('div'); root.id = 'dec-root'; root.innerHTML = html;
  decBind(root); return root;
}

/* ---- eventos ---- */
function decOpen(id) { DS.sel = id; DS.edited = {}; render._keep = true; render(); const d = $('.dec-dr'); if (d) d.focus(); }
function decClose() { DS.sel = null; render._keep = true; render(); }
function decBind(root) {
  root.addEventListener('click', async e => {
    const t = e.target.closest('[data-dec]'); if (!t) return; const a = t.dataset.dec;
    if (a === 'open') decOpen(t.dataset.id);
    else if (a === 'close') decClose();
    else if (a === 'export') { await decExport(t.dataset.what, t.dataset.fmt); const m = $('#dec-exp'); if (m) m.open = false; }
    else if (a === 'copyid') { try { await navigator.clipboard.writeText(DS.me.id); toast('Código copiado.'); } catch (er) { const c = $('#dec-myid'); if (c) { const r = document.createRange(); r.selectNode(c); getSelection().removeAllRanges(); getSelection().addRange(r); } toast('Selecciona y copia el código.'); } }
    else if (a === 'validar') { try { await decValidate(t.dataset.key, t.dataset.ts, t.dataset.estado, ($('#dec-vnota') || {}).value); toast(t.dataset.estado === 'Validado' ? 'Valor validado.' : 'Valor marcado como observado.'); decRedraw(); } catch (er) { toast('No se pudo guardar la validación: ' + ((er && er.code) || 'error')); } }
    else if (a === 'quitar') { try { await decSetRoster(t.dataset.uid, null); toast('Persona retirada.'); } catch (er) { toast('No se pudo retirar: ' + ((er && er.code) || 'error')); } }
    else if (a === 'yo-oficina') { try { await decSetRoster(DS.me.id, { rol: 'oficina', escuela: '' }); toast('Quedaste en la oficina de calidad.'); } catch (er) { toast('No se pudo asignar: ' + ((er && er.code) || 'error')); } }
    else if (a === 'anular') {
      const fm = $('#dec-form'); if (!fm) return; const per = $('#dec-per').value; const key = decKey.v(fm.dataset.esc, fm.dataset.area, fm.dataset.ind, per);
      const cur = DS.model.pts.find(p => p.key === key); if (!cur) return ($('#dec-err').textContent = 'No hay un valor cargado en ese periodo.');
      if (!($('#dec-fuente').value || '').trim()) return ($('#dec-err').textContent = 'Escribe en «Fuente» el motivo de la anulación.');
      try { await decSaveValue({ esc: fm.dataset.esc, area: fm.dataset.area, ind: fm.dataset.ind, per, val: cur.val, fuente: $('#dec-fuente').value.trim(), corte: DEC_CORTE, nota: 'Anulado: ' + ($('#dec-nota').value || ''), anulado: true }); toast('Valor anulado.'); decRedraw(); } catch (er) { toast('No se pudo anular: ' + ((er && er.code) || 'error')); }
    }
  });
  root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-dec="open"]')) { e.preventDefault(); decOpen(e.target.dataset.id); } });
  root.addEventListener('change', e => {
    const id = e.target.id; const f = DS.f;
    if (id === 'dec-solo') { DS.soloVal = e.target.checked; decBuild(); render._keep = true; render(); }
    else if (id === 'dec-fn') { f.nivel = e.target.value; decRefreshList(); }
    else if (id === 'dec-ft') { f.tipo = e.target.value; decRefreshList(); }
    else if (id === 'dec-fe') { f.est = e.target.value; decRefreshList(); }
    else if (id === 'dec-fp') { f.proc = e.target.value; decRefreshList(); }
    else if (id === 'dec-per') { DS.edited.per = e.target.value; }
  });
  root.addEventListener('input', e => {
    if (e.target.id === 'dec-fq') { DS.f.q = e.target.value; decRefreshList(); }
    else if (e.target.id === 'dec-rq') decSearchPeople(e.target.value);
  });
  root.addEventListener('submit', async e => {
    e.preventDefault(); const fm = e.target;
    if (fm.id === 'dec-form') {
      const err = $('#dec-err'); err.textContent = ''; if (DS.saving) return;
      if (!DS.cap.db || !DS.me.id) { err.textContent = 'La edición compartida no está disponible.'; return; }
      const fuente = ($('#dec-fuente').value || '').trim(); if (!fuente) { err.textContent = 'La fuente es obligatoria: sin fuente el valor no se guarda.'; return; }
      DS.saving = true;
      try {
        if (fm.dataset.kind === 'v') {
          const val = parseFloat(String($('#dec-val').value).replace(',', '.')); if (!isFinite(val)) { err.textContent = 'Escribe un valor numérico.'; DS.saving = false; return; }
          const corte = $('#dec-corte').value; if (!corte) { err.textContent = 'Indica la fecha de corte del dato.'; DS.saving = false; return; }
          await decSaveValue({ esc: fm.dataset.esc, area: fm.dataset.area, ind: fm.dataset.ind, per: $('#dec-per').value, val, fuente, corte, nota: $('#dec-nota').value });
          toast('Valor guardado. Queda sin validar hasta que la oficina lo valide.');
        } else {
          await decSaveProc({ esc: fm.dataset.esc, proc: fm.dataset.proc, ficha: $('#dec-ficha').value, dueno: $('#dec-dueno').value.trim(), fuente });
          toast('Proceso actualizado.');
        }
        DS.saving = false; decBuild(); render._keep = true; render();
      } catch (er) { DS.saving = false; err.textContent = 'No se pudo guardar (' + ((er && er.code) || 'error') + '). Si el problema sigue, tu cuenta quizá no tiene permiso de edición en el tablero.'; }
    } else if (fm.id === 'dec-roster') {
      const err = $('#dec-err2'); err.textContent = ''; const uid = ($('#dec-ruid').value || '').trim(); if (!uid) { err.textContent = 'Busca a la persona o pega su código.'; return; }
      const rol = $('#dec-rrol').value; const escu = rol === 'oficina' ? '' : $('#dec-resc').value;
      try { await decSetRoster(uid, { rol, escuela: escu }); toast('Persona asignada.'); $('#dec-ruid').value = ''; } catch (er) { err.textContent = 'No se pudo asignar (' + ((er && er.code) || 'error') + ').'; }
    }
  });
  root.addEventListener('toggle', e => { if (e.target.id === 'dec-eq') DS.open.eq = e.target.open; }, true);
}
function decRefreshList() { const l = decFiltered(); const h = $('#dec-alerts'); if (h) h.innerHTML = decAlertTable(l); const c = $('#dec-count'); if (c) c.textContent = `${l.length} alerta${l.length === 1 ? '' : 's'} con los filtros actuales`; }
let decSearchT = null;
function decSearchPeople(q) {
  clearTimeout(decSearchT); const box = $('#dec-hits'); if (!box) return;
  decSearchT = setTimeout(async () => {
    const u = DS.cap.user; if (!u || !q.trim()) { box.innerHTML = ''; return; }
    try {
      const hits = await u.search(q.trim()); box.innerHTML = hits.length ? hits.map(h => `<button type="button" class="btn small" data-pick="${esc(h.id)}">${esc(h.name)}</button>`).join(' ') : '<span class="muted">Sin resultados. Pide a la persona su código y pégalo.</span>';
      $$('[data-pick]', box).forEach(b => b.addEventListener('click', () => { $('#dec-ruid').value = b.dataset.pick; DS.prof[b.dataset.pick] = hits.find(h => h.id === b.dataset.pick); box.innerHTML = '<span class="muted">Elegida: ' + esc(b.textContent) + '</span>'; }));
    } catch (er) { box.innerHTML = ''; }
  }, 250);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.view === 'decision' && DS.sel) decClose(); });

const VIEWS = [
  { id: 'decision', t: 'Decisión', i: 'i-target', f: () => viewDecision() },
  { id: 'general', t: 'Vista general', i: 'i-home', f: () => viewGeneral() },
  { id: 'procesos', t: 'Procesos 10.2', i: 'i-flow', f: () => viewProcesos() },
  { id: 'estandares', t: 'Estándares e indicadores', i: 'i-target', f: () => viewEstandares() },
  { id: 'poi', t: 'PEI y POI', i: 'i-chart', f: () => viewPOI() },
  { id: 'indicadores', t: 'Indicadores', i: 'i-grid', f: () => viewIndicadores() },
  { id: 'alertas', t: 'Alertas', i: 'i-bell', f: () => viewAlertas(), badge: true },
  { sep: true },
  { id: 'relaciones', t: 'Relaciones', i: 'i-link', f: () => viewRelaciones() },
  { id: 'cargas', t: 'Cargas', i: 'i-upload', f: () => viewCargas() },
  { id: 'parametros', t: 'Parámetros', i: 'i-sliders', f: () => viewParametros() },
  { id: 'pendientes', t: 'Pendientes', i: 'i-doc', f: () => viewPendientes() },
];
const VIEW_BY = Object.fromEntries(VIEWS.filter(v => v.id).map(v => [v.id, v]));
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

function toast(msg) {
  const root = $('#toast-root'); root.innerHTML = '';
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; root.append(t);
  clearTimeout(toast._t); toast._t = setTimeout(() => { root.innerHTML = ''; }, 6500);
}

function renderNav() {
  const nAl = ALERTS.filter(a => a.severidad !== 'Aviso').length, nTot = ALERTS.length;
  $('#nav').innerHTML = VIEWS.map(v => v.sep ? '<div class="sep"></div>' : `<a href="#/${v.id}" ${S.view === v.id ? 'aria-current="page"' : ''}>${I(v.i)}<span>${v.t}</span>${v.badge ? `<span class="nb" title="${nAl} alertas críticas y en riesgo, de ${nTot} en total" aria-label="${nAl} alertas críticas y en riesgo, de ${nTot} en total">${nAl}<small> de ${nTot}</small></span>` : ''}</a>`).join('');
}
function renderTop() {
  $('#seg-esc').innerHTML = [['TODAS', 'Todas'], ['ENF', 'Enfermería'], ['OBS', 'Obstetricia'], ['TM', 'Tec. Médica'], ['FAC', 'Facultad'], ['NUT', 'Nutrición'], ['POS', 'Posgrado']].map(([k, l]) => `<button data-act="esc" data-esc="${k}" aria-pressed="${S.escuela === k}">${l}</button>`).join('');
  const c = corteDate(); $('#in-corte').value = isoD(c);
  $('#sw-ej').checked = S.ejemplo;
  $('#ex-banner').innerHTML = S.ejemplo ? `<div class="banner ex" role="note">${I('i-info')}<div><b>Estás viendo datos EJEMPLO.</b> Son inventados y están rotulados <span class="exb">EJEMPLO</span>; no reflejan a ninguna escuela. Los datos del POI de la Facultad sí son reales (reportes de seguimiento). Fecha de corte de los ejemplos: ${fmtDate(parseISO(EJ_CORTE))}. Apaga el interruptor «Datos EJEMPLO» o carga los archivos reales de las escuelas.</div></div>` : '';
}
function render() {
  const v = VIEW_BY[S.view] || VIEW_BY.decision;
  const y = window.scrollY;
  const host = $('#view'); host.innerHTML = '';
  let node;
  if (S.escuela === 'NUT' || S.escuela === 'POS') { node = document.createElement('div'); node.innerHTML = `<div class="banner dec-reservada" role="note">${I('i-info')}<div>Pestaña reservada. Modelo de referencia y estado de acreditación por confirmar.</div></div>`; }
  else try { node = v.f(); } catch (e) { console.error(e); node = document.createElement('div'); node.innerHTML = `<div class="card"><h3>No se pudo dibujar esta vista</h3><p class="small">${esc(e.message)}</p></div>`; }
  host.append(node);
  $('#main').classList.toggle('reservada', S.escuela === 'NUT' || S.escuela === 'POS');
  renderNav(); renderTop(); renderFicha();
  document.title = `${v.t} · SGC · Tablero de decisiones`;
  if (render._keep) { window.scrollTo(0, y); } render._keep = false;
}
function go(view, keep) {
  if (!VIEW_BY[view]) view = 'decision';
  S.view = view; render._keep = !!keep;
  if (location.hash !== '#/' + view) history.replaceState(null, '', '#/' + view);
  render(); if (!keep) { window.scrollTo(0, 0); }
  $('#side').classList.remove('open');
}
function applyTheme(t) {
  const root = document.documentElement;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  $('#ic-theme').innerHTML = `<use href="#${dark ? 'i-sun' : 'i-moon'}"/>`; $('#t-theme').textContent = dark ? 'Claro' : 'Oscuro';
  $('#btn-theme').setAttribute('aria-pressed', String(dark));
}
function effectiveDark() { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); }
function slotImg(which, dataUrl) {
  const c = $('#slot-' + which + '-c');
  if (dataUrl) { c.innerHTML = `<img alt="${which === 'logo' ? 'Logotipo oficial' : 'Escudo oficial'}" src="${dataUrl}">`; }
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); const menu = $('#exp-menu');
  if (menu && menu.open && !e.target.closest('#exp-menu')) menu.open = false;
  if (!t) return;
  const a = t.dataset.act; const d = t.dataset;
  if (a === 'go') { if (d.est) S.estSel = d.est; if (d.aoi) S.poiAoi = d.aoi.length > 5 ? d.aoi : null; if (d.anio) S.poiAnio = +d.anio; if (d.aoi) { const x = poiAll()[S.poiAnio].lista.find(z => z.aoi === d.aoi || z.aoi.endsWith(d.aoi)); S.poiAoi = x ? x.aoi : S.poiAoi; } go(d.view); }
  else if (a === 'ficha') { S.fichaOpener = t; openFicha(d.id, d.esc && ESC_BY[d.esc] ? d.esc : 'TM'); }
  else if (a === 'close-ficha') { closeFicha(); if (S.fichaOpener && document.contains(S.fichaOpener)) S.fichaOpener.focus(); }
  else if (a === 'ficha-esc') { S.fichaEsc = d.esc; renderFicha(); }
  else if (a === 'proc') { S.procSel = { p: d.p, esc: d.esc }; if (S.view !== 'procesos') go('procesos'); else { render._keep = true; render(); } const pd = $('#pdetail'); if (pd) pd.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  else if (a === 'est') { S.estSel = d.e || null; render._keep = true; render(); }
  else if (a === 'alertas') { S.fAl = { esc: d.esc || '', sev: '', regla: '', touched: true }; go('alertas'); }
  else if (a === 'poi-anio') { S.poiAnio = +d.anio; S.poiAoi = null; render._keep = true; render(); }
  else if (a === 'marco') { S.marco = d.m; render._keep = true; render(); }
  else if (a === 'esc') { S.escuela = d.esc; if (S.fAl) S.fAl.touched = false; render._keep = true; render(); }
  else if (a === 'export') { doExport(d.what, d.fmt); if (menu) menu.open = false; }
  else if (a === 'export-params') exportParams();
  else if (a === 'reset-params') { S.params = clone(PARAMS0); S.files = S.files.map(f => f); S.corteOverride = null; recompute(); render(); toast('Parámetros restablecidos a los de fábrica.'); }
  else if (a === 'pick-files') $('#file-in').click();
  else if (a === 'dl-b64') downloadB64(d.n);
  else if (a === 'rm-file') { S.files = S.files.filter(f => f.name !== d.n); Object.keys(S.autoeval).forEach(k => { if (S.autoeval[k].name === d.n) delete S.autoeval[k]; }); recompute(); render(); toast('Archivo quitado.'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (S.fichaId) { closeFicha(); if (S.fichaOpener && document.contains(S.fichaOpener)) S.fichaOpener.focus(); } const m = $('#exp-menu'); if (m && m.open) m.open = false; }
  if (e.key === 'Tab' && S.fichaId) {
    const dr = $('.drawer'); if (!dr) return; const f = $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', dr).filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
window.addEventListener('hashchange', () => { const v = location.hash.replace(/^#\/?/, '') || 'decision'; if (v !== S.view) { S.view = VIEW_BY[v] ? v : 'decision'; render(); window.scrollTo(0, 0); } });

function bootAutoeval() {
  try {
    const b64 = FILES_B64['SGC_Consolidado_autoevaluacion_EPTM.xlsx']; if (!b64) return;
    const rec = parseConsolidado(XLSX.read(b64, { type: 'base64' }), 'Consolidado_Autoevaluacion_EPTM.xlsx');
    rec.fabrica = true; rec.cargadoEn = '2026-10-20 (adjunto de Robert)'; setAutoeval(rec);
  } catch (e) { console.error('Consolidado incluido: no se pudo leer', e); }
}
function boot() {
  bootAutoeval();
  recompute();
  const saved = lsGet('sgc-theme'); applyTheme(saved === 'light' || saved === 'dark' ? saved : null);
  $('#btn-theme').addEventListener('click', () => { const next = effectiveDark() ? 'light' : 'dark'; lsSet('sgc-theme', next); applyTheme(next); render._keep = true; render(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!lsGet('sgc-theme')) { applyTheme(null); render._keep = true; render(); } });
  $('#sw-ej').addEventListener('change', e => { S.ejemplo = e.target.checked; recompute(); render(); toast(S.ejemplo ? 'Datos EJEMPLO encendidos.' : 'Datos EJEMPLO apagados: solo se muestran datos reales (POI de la Facultad y archivos cargados).'); });
  $('#in-corte').addEventListener('change', e => { const d = parseISO(e.target.value); S.corteOverride = d || null; recompute(); render._keep = true; render(); });
  $('#btn-hoy').addEventListener('click', () => { S.corteOverride = null; recompute(); render._keep = true; render(); });
  $('#file-in').addEventListener('change', async e => { await handleFiles(e.target.files); e.target.value = ''; });
  $('#btn-menu').addEventListener('click', () => $('#side').classList.toggle('open'));
  ['logo', 'escudo'].forEach(w => {
    const sv = lsGet('sgc-' + w); if (sv) slotImg(w, sv);
    $('#in-' + w).addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return; if (f.size > 1.5e6) return toast('La imagen pesa más de 1,5 MB: usa una más liviana.');
      const r = new FileReader(); r.onload = () => { slotImg(w, r.result); lsSet('sgc-' + w, r.result); toast('Imagen puesta. Queda solo en este navegador.'); }; r.readAsDataURL(f);
    });
  });
  const h = location.hash.replace(/^#\/?/, ''); S.view = VIEW_BY[h] ? h : 'decision';
  render();
  decInit();
}
boot();

