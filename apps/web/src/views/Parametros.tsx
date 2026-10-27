"use client";
import { useEffect, useState } from "react";
import { REGLAS, isoD, reglaKey, type MetaRow } from "@sgc/engine";
import { api } from "@/lib/api";
import { exportParams, run } from "@/lib/actions";
import { useWs } from "@/lib/workspace";
import { Ic } from "@/components/Icon";
import { Banner, Note, PageHead, Sect } from "@/components/ui";

const LISTAS: Record<string, string[]> = {
  poi_frecuencia: ["Mensual", "Trimestral", "Semestral", "Anual"],
  poi_evaluar: ["Último reporte", "Todos"],
  sin_dato_en_agregado: ["Cuenta", "Excluye"],
  heredar_alias: ["Sí", "No"],
  evidencia_obligatoria: ["Sí", "No"],
  alcance_inicial: ["Piloto + 10.2 + SINEACE"],
};

/** Campo numérico que acepta vacío y coma decimal. */
function NumInput({ value, onCommit, width, label, step = "any" }: { value: number | null | undefined; onCommit: (v: number | null) => void; width: number; label: string; step?: string }) {
  const [txt, setTxt] = useState(value === null || value === undefined ? "" : String(value));
  useEffect(() => { setTxt(value === null || value === undefined ? "" : String(value)); }, [value]);
  return (
    <input
      type="number" step={step} value={txt} style={{ width }} aria-label={label}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => { const v = txt === "" ? null : parseFloat(txt.replace(",", ".")); if (v !== (value ?? null)) onCommit(v !== null && isFinite(v) ? v : null); }}
    />
  );
}

export default function Parametros() {
  const ws = useWs();
  const { engine } = ws;
  const P = engine.params;
  const f = ws.vs.fPar;
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ version: number; fecha: string; origen: string; nota: string; createdAt: string }[]>([]);
  const canEdit = ws.can.editParams;
  const serverV = ws.server.params.version;

  useEffect(() => { api("/api/params/history").then(setHistory).catch(() => {}); }, [serverV]);

  const touch = (fn: (p: typeof P) => void) => ws.editParams((p) => { fn(p); p.origen = "Editados en el tablero"; });
  const ids = engine.CARGABLES.filter((c) => (!f.q || (c.id + " " + c.nombre).toLowerCase().includes(f.q.toLowerCase())) && (!f.soloSin || !(P.metas[c.id] || []).some((r) => r.meta !== null && r.fuente_meta)));

  const save = async () => {
    const d = ws.paramsDraft;
    if (!d) return;
    setSaving(true);
    const ok = await run(ws, () => api("/api/params", { method: "PUT", body: { gen: d.gen, reglas: d.reglas, metas: d.metas, nota: "" } }), "Parámetros guardados: valen para todas las personas.");
    setSaving(false);
    if (ok) { ws.discardParams(); await ws.refresh(); }
  };
  const reset = async () => {
    if (!window.confirm("¿Restablecer todos los parámetros a los valores de fábrica? Se guarda como una versión nueva y se conserva el historial.")) return;
    setSaving(true);
    const ok = await run(ws, () => api("/api/params/reset", { method: "POST", body: {} }), "Parámetros restablecidos a los de fábrica.");
    setSaving(false);
    if (ok) { ws.discardParams(); await ws.refresh(); }
  };
  const restore = async (version: number) => {
    const r = await api<{ params: typeof P }>(`/api/params/${version}`).catch(() => null);
    if (r) { ws.setParamsDraft(r.params); ws.toast(`Se cargó la versión ${version} como borrador: revisa y guarda para aplicarla.`); }
  };

  return (
    <div>
      <PageHead title="Parámetros">Todo lo que decide un estado o una alerta está aquí y se puede editar: fecha de corte, gracia, reglas y metas con sus umbrales. Una meta o un umbral sin fuente no se aplica.</PageHead>
      <Banner ex>
        <div>
          Parámetros {ws.paramsDirty ? <b>en edición (sin guardar)</b> : <>guardados: <b>{P.origen}</b></>} (fecha {P.fecha || "—"}, versión {serverV}).{" "}
          {canEdit ? "Los cambios se ven al instante en esta pantalla; para que valgan para todas las personas, usa Guardar." : "Solo la Oficina de Calidad o la administración pueden cambiar los parámetros; puedes probar valores aquí, pero no se guardan."}
        </div>
      </Banner>
      <div className="filters">
        {canEdit && <button className="btn primary" disabled={!ws.paramsDirty || saving} onClick={save}><Ic n="i-upload" />Guardar parámetros</button>}
        {ws.paramsDirty && <button className="btn" onClick={() => { ws.discardParams(); ws.toast("Se descartaron los cambios."); }}>Descartar cambios</button>}
        <button className="btn" onClick={() => exportParams(ws)}><Ic n="i-download" />Exportar parámetros (Excel)</button>
        {canEdit && <button className="btn" disabled={saving} onClick={reset}>Restablecer los de fábrica</button>}
      </div>

      <Sect title="Parámetros generales" icon="i-grid" />
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Parámetro</th><th>Valor</th><th>Para qué sirve y fuente</th></tr></thead>
          <tbody>
            {ws.catalog.pdef.general.map(([k, , tipo, nota]) => {
              const v = P.gen[k];
              const set = (val: unknown) => {
                touch((p) => { p.gen[k] = val; p.fecha = isoD(new Date()); p.gen.fecha_parametros = p.fecha; });
                if (k === "fecha_corte") ws.setCorte("");
              };
              let ctl;
              if (LISTAS[k]) ctl = <select value={String(v)} disabled={k === "alcance_inicial"} aria-label={k} onChange={(e) => set(e.target.value)}>{LISTAS[k].map((o) => <option key={o}>{o}</option>)}</select>;
              else if (tipo === "fecha") ctl = <input type="date" value={v instanceof Date ? isoD(v) : v || ""} aria-label={k} onChange={(e) => set(e.target.value)} />;
              else if (tipo === "número") ctl = <NumInput value={v as number | null} width={100} label={k} onCommit={(n) => set(n)} />;
              else ctl = <input type="text" value={String(v ?? "")} aria-label={k} readOnly={k === "fecha_parametros"} onChange={(e) => set(e.target.value)} />;
              return (
                <tr key={k}>
                  <td className="id">{k}</td><td>{ctl}</td>
                  <td className="small">{nota}{k === "alcance_inicial" ? " El alcance real se define en la hoja Alcance de cada archivo." : ""}{k === "fecha_corte" ? " Vacía: con datos EJEMPLO se usa el 20-10-2026; sin ellos, la fecha de hoy." : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sect title="Reglas de alerta" icon="i-bell" />
      <p className="note">Dentro de los textos se pueden usar marcas entre llaves, como {"{indicador}"}, {"{valor}"}, {"{meta}"}, {"{periodo}"}, {"{escuela}"}; se reemplazan al generar la alerta.</p>
      <div className="grid g2">
        {P.reglas.map((r, i) => (
          <div key={r.id} className="card">
            <div className="pill-row" style={{ marginBottom: 8 }}><b>{r.id}</b> <span>{r.nombre}</span></div>
            <div className="filters">
              <label>Activa
                <select value={r.activa !== "No" ? "Sí" : "No"} onChange={(e) => touch((p) => { p.reglas[i].activa = e.target.value; })}><option>Sí</option><option>No</option></select>
              </label>
              <label>Severidad
                <select value={r.severidad} onChange={(e) => touch((p) => { p.reglas[i].severidad = e.target.value; })}>
                  {["Crítica", "En riesgo", "Aviso", ...(r.severidad === "Por banda" ? ["Por banda"] : [])].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>
            <p className="small muted" style={{ margin: "4px 0" }}>Condición: {r.condicion}</p>
            <label className="small muted">Qué ocurre<textarea value={r.que} onChange={(e) => touch((p) => { p.reglas[i].que = e.target.value; })} /></label>
            <label className="small muted">Por qué<textarea value={r.porque} onChange={(e) => touch((p) => { p.reglas[i].porque = e.target.value; })} /></label>
            <label className="small muted">Decisión o acción sugerida<textarea value={r.accion} onChange={(e) => touch((p) => { p.reglas[i].accion = e.target.value; })} /></label>
          </div>
        ))}
      </div>

      <Sect title="Metas y umbrales" icon="i-chart" />
      <p className="note">
        «Meta» y «Límite» se llenan <b>solo con fuente</b>: modelo CONEAU, PEI/POI o documento institucional. Límite meta: desde ahí es «En meta» (semáforo verde). Límite riesgo: debajo de ahí es «Crítico»; entre ambos «En riesgo». «Tipo de avance»: Puntual compara el valor con la meta; «Acumulado en el año» lo compara con lo esperado a la fecha de corte (el valor de esperado_a_fecha de la carga o, en los indicadores del PE FM, el programado acumulado al corte del POI mensual de la Facultad), para no dar falsos rojos con datos parciales. «Regla de cumplimiento»: por defecto es la razón al esperado; en los tiempos (ID25, ID26) cumple si el valor es menor o igual al referencial, y en las variaciones (ID6) si no es negativa. Sin los dos límites y su fuente, no hay semáforo: se compara con la meta y, bajo ella, queda «Bajo la meta» en gris.
      </p>
      <div className="filters">
        <label>Buscar indicador<input type="text" value={f.q} placeholder="código o palabra" onChange={(e) => ws.setVs({ fPar: { ...f, q: e.target.value } })} /></label>
        <label className="sw">
          <input type="checkbox" checked={f.soloSin} onChange={(e) => ws.setVs({ fPar: { ...f, soloSin: e.target.checked } })} />
          <span className="tr" aria-hidden="true" />
          <span>Solo sin meta con fuente</span>
        </label>
      </div>
      <div className="tblw" style={{ maxHeight: 560 }}>
        <table className="tbl">
          <thead>
            <tr><th>Indicador</th><th>Desde año</th><th>Meta</th><th>Unidad</th><th>Sentido</th><th>Fuente de la meta</th><th>Límite meta (%)</th><th>Límite riesgo (%)</th><th>Base</th><th>Tipo de avance</th><th>Regla de cumplimiento</th><th>Fuente del umbral</th></tr>
          </thead>
          <tbody>
            {ids.map((c) => (P.metas[c.id] || []).map((r, j) => {
              const sinF = r.meta !== null && !String(r.fuente_meta || "").trim();
              const upd = (patch: Partial<MetaRow>) => touch((p) => {
                const row = p.metas[c.id][j];
                Object.assign(row, patch);
                row.estado_meta = row.meta !== null && String(row.fuente_meta || "").trim() ? "Con fuente" : "Por definir";
                if (row.verde_min !== null && row.rojo_min !== null && row.verde_min < row.rojo_min) ws.toast("El límite meta debe ser mayor o igual que el límite riesgo.");
                else if (patch.meta !== undefined && row.meta !== null && !String(row.fuente_meta || "").trim()) ws.toast("Meta guardada en el borrador, pero sin fuente no se aplica.");
              });
              return (
                <tr key={c.id + j}>
                  <td><b>{c.id}</b><div className="small muted">{c.nombre.slice(0, 54)}</div></td>
                  <td><NumInput value={r.desde ?? 0} width={70} label={`Desde año ${c.id}`} onCommit={(v) => upd({ desde: v ?? 0 })} /></td>
                  <td><NumInput value={r.meta} width={80} label={`Meta ${c.id}`} onCommit={(v) => upd({ meta: v })} />{sinF && <div className="small" style={{ color: "var(--bad-t)" }}>sin fuente: no se aplica</div>}</td>
                  <td>{r.unidad}</td><td className="small">{r.sentido}</td>
                  <td><input type="text" value={r.fuente_meta || ""} style={{ width: 210 }} aria-label={`Fuente de la meta ${c.id}`} onChange={(e) => upd({ fuente_meta: e.target.value })} /></td>
                  <td><NumInput value={r.verde_min} width={70} label={`Límite meta ${c.id}`} onCommit={(v) => upd({ verde_min: v })} /></td>
                  <td><NumInput value={r.rojo_min} width={70} label={`Límite riesgo ${c.id}`} onCommit={(v) => upd({ rojo_min: v })} /></td>
                  <td><select value={r.base === "valor" ? "valor" : "cumplimiento"} aria-label={`Base ${c.id}`} onChange={(e) => upd({ base: e.target.value })}><option>cumplimiento</option><option>valor</option></select></td>
                  <td><select value={r.avance === "Acumulado en el año" ? r.avance : "Puntual"} aria-label={`Tipo de avance ${c.id}`} onChange={(e) => upd({ avance: e.target.value })}><option>Puntual</option><option>Acumulado en el año</option></select></td>
                  <td><select value={reglaKey(r.regla)} aria-label={`Regla de cumplimiento ${c.id}`} onChange={(e) => upd({ regla: e.target.value })}>{Object.keys(REGLAS).map((k) => <option key={k} value={k}>{REGLAS[k].nombre}</option>)}</select></td>
                  <td><input type="text" value={r.fuente_umbral || ""} style={{ width: 190 }} aria-label={`Fuente del umbral ${c.id}`} onChange={(e) => upd({ fuente_umbral: e.target.value })} /></td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>

      <Sect title="Historial de versiones" icon="i-doc" />
      <Note>Cada vez que se guardan los parámetros queda una versión nueva; nunca se pierde la anterior. Puedes cargar una versión vieja como borrador y guardarla de nuevo.</Note>
      <div className="tblw" style={{ maxHeight: 320 }}>
        <table className="tbl">
          <thead><tr><th>Versión</th><th>Fecha</th><th>Origen</th><th>Nota</th><th>Guardada</th><th /></tr></thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.version}>
                <td className="num"><b>{h.version}</b>{h.version === serverV && <> <span className="tag">vigente</span></>}</td>
                <td>{h.fecha}</td><td>{h.origen}</td><td className="small">{h.nota}</td><td className="small">{String(h.createdAt).slice(0, 16).replace("T", " ")}</td>
                <td>{canEdit && h.version !== serverV && <button className="btn small" onClick={() => restore(h.version)}>Cargar como borrador</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
