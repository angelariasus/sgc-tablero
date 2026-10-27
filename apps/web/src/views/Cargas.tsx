"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ESC_BY, SCH, TM_AREAS, fmtN } from "@sgc/engine";
import { ApiError, api, download, uploadFile, type UploadReport } from "@/lib/api";
import { run } from "@/lib/actions";
import { useWs } from "@/lib/workspace";
import { Ic } from "@/components/Icon";
import { ExBadge, Note, PageHead, Sect } from "@/components/ui";

interface Pending { id: number; file: File; report: UploadReport | null; error: string | null; saving: boolean }
interface TemplateInfo { nombre: string; titulo: string; descripcion: string; size: number }

export default function Cargas() {
  const ws = useWs();
  const { engine, server } = ws;
  const [pending, setPending] = useState<Pending[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const nombreDe = useCallback((uid: string | null) => (uid ? server.decision.names[uid] ?? "—" : "—"), [server.decision.names]);

  useEffect(() => { api<TemplateInfo[]>("/api/templates").then(setTemplates).catch(() => {}); }, []);

  const analyze = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const rows: Pending[] = list.map((file) => ({ id: ++seq.current, file, report: null, error: null, saving: false }));
    setPending((p) => [...rows, ...p]);
    for (const r of rows) {
      try {
        const report = await uploadFile(r.file, false);
        setPending((p) => p.map((x) => (x.id === r.id ? { ...x, report } : x)));
      } catch (e) {
        setPending((p) => p.map((x) => (x.id === r.id ? { ...x, error: e instanceof ApiError ? e.message : "No se pudo leer el archivo." } : x)));
      }
    }
  };

  const confirm = async (r: Pending) => {
    setPending((p) => p.map((x) => (x.id === r.id ? { ...x, saving: true } : x)));
    try {
      const rep = await uploadFile(r.file, true);
      ws.toast(`${rep.archivo}: guardado (${rep.filasValidas} mediciones válidas${rep.filasRechazadas ? `, ${rep.filasRechazadas} no se muestran` : ""}). ${(rep.mensajes ?? []).join(" ")}`.trim());
      setPending((p) => p.filter((x) => x.id !== r.id));
      await ws.refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "No se pudo guardar el archivo.";
      setPending((p) => p.map((x) => (x.id === r.id ? { ...x, saving: false, error: msg } : x)));
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`¿Quitar el archivo «${name}»? Se borran sus mediciones, evidencias y alcance (el original queda en el almacenamiento solo hasta que se borre el registro).`)) return;
    if (await run(ws, () => api(`/api/uploads/${id}`, { method: "DELETE" }), "Archivo quitado.")) await ws.refresh();
  };
  const removeAutoeval = async (esc: string, name: string) => {
    if (!window.confirm(`¿Quitar el consolidado «${name}»?`)) return;
    if (await run(ws, () => api(`/api/autoeval/${esc}`, { method: "DELETE" }), "Consolidado quitado.")) await ws.refresh();
  };

  const rej = engine.DB.rejected.filter((r) => (r.archivo && !/^EJEMPLO/.test(r.archivo)) || ws.ejemplo);
  const aes = Object.values(engine.autoeval);

  return (
    <div>
      <PageHead title="Cargas">Cada escuela llena su plantilla de Excel y el tablero consolida los archivos. Primero se revisa el archivo (vista previa) y solo se guarda cuando confirmas. Los datos de ejemplo no se guardan: se ven con el interruptor «Datos EJEMPLO».</PageHead>

      <Sect title="Orden de implementación" icon="i-flow" />
      <div className="grid g3">
        {SCH.map((e) => {
          const fl = server.uploads.filter((u) => u.escuela === e && u.kind === "carga" && (u.resumen.validas ?? 0) + (u.resumen.rechazadas ?? 0) > 0);
          const act = engine.enImplementacion(e);
          return (
            <div key={e} className="card">
              <div className="pill-row">
                <span className="tag">{ESC_BY[e].faseTxt}</span>
                {fl.length ? <span className="chip st-ok"><Ic n="i-ok" /><span>Con archivo</span></span> : act ? <span className="chip st-risk"><Ic n="i-risk" /><span>Debe cargar</span></span> : <span className="tag gap">aún no exigido</span>}
              </div>
              <h3 style={{ marginTop: 6 }}>{ESC_BY[e].nombre}</h3>
              <p className="small muted" style={{ margin: "4px 0 0" }}>{e === "TM" ? <>Subfases por área: {TM_AREAS.join(" · ")}.</> : "Programa de pregrado."}</p>
            </div>
          );
        })}
      </div>
      <p className="note">Orden definido por Robert: 1.º Enfermería, 2.º Obstetricia, 3.º Tecnología Médica por áreas. El tablero y la plantilla están listos para las tres desde el inicio; solo las escuelas «en implementación» generan alertas por falta de datos (parámetro escuelas_en_implementacion). Fechas de cada fase: por confirmar.</p>

      <div
        className={"drop" + (over ? " over" : "")} role="button" tabIndex={0} aria-label="Soltar archivos Excel o presionar para elegirlos"
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); void analyze(e.dataTransfer.files); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      >
        <p style={{ margin: "0 0 8px" }}><b>Suelta aquí los archivos Excel de las escuelas</b> (.xlsx) o</p>
        <button className="btn primary" onClick={() => input.current?.click()}><Ic n="i-upload" />Elegir archivos</button>
        <input ref={input} type="file" accept=".xlsx" multiple className="sr" tabIndex={-1} aria-hidden="true" onChange={(e) => { if (e.target.files?.length) void analyze(e.target.files); e.target.value = ""; }} />
        <p className="small muted" style={{ margin: "8px 0 0" }}>Los archivos se envían a la API, se revisan en el servidor y no se guarda nada hasta que confirmes.{ws.can.upload(null) ? "" : ` Tu cuenta solo puede cargar archivos de ${ws.me.escuela ? ESC_BY[ws.me.escuela]?.nombre : "ninguna escuela"}.`}</p>
      </div>

      {pending.length > 0 && (
        <>
          <Sect title={`Por confirmar (${pending.length})`} icon="i-doc" />
          <div className="grid">
            {pending.map((r) => <PreviewCard key={r.id} r={r} onConfirm={() => confirm(r)} onDiscard={() => setPending((p) => p.filter((x) => x.id !== r.id))} />)}
          </div>
        </>
      )}

      <Sect title="Plantilla y archivos de ejemplo" icon="i-download" />
      <div className="grid g4">
        {templates.map((t) => (
          <div key={t.nombre} className="card">
            <h3 style={{ fontSize: "1rem" }}>{t.titulo}</h3>
            <p className="small muted">{t.descripcion}</p>
            <button className="btn" onClick={() => run(ws, async () => { await download("/api/templates/" + encodeURIComponent(t.nombre)); })}><Ic n="i-download" />Descargar</button>
          </div>
        ))}
      </div>

      <Sect title={`Archivos cargados (${server.uploads.filter((u) => u.kind !== "consolidado").length})`} icon="i-doc" />
      {!server.uploads.filter((u) => u.kind !== "consolidado").length ? (
        <div className="empty">Todavía no hay archivos cargados. {ws.ejemplo ? "Se están mostrando los datos EJEMPLO incrustados." : "Sin archivos ni ejemplo, no hay datos que mostrar."}</div>
      ) : (
        <div className="tblw">
          <table className="tbl">
            <thead><tr><th>Archivo</th><th>Escuela</th><th>Plantilla</th><th>Mediciones</th><th>Resultado</th><th /></tr></thead>
            <tbody>
              {server.uploads.filter((u) => u.kind !== "consolidado").map((u) => {
                const nIn = engine.DB.vis.filter((r) => r.archivo === u.filename).length;
                const nRej = engine.DB.rejected.filter((r) => r.archivo === u.filename).length;
                const puede = u.escuela ? ws.can.upload(u.escuela) : ws.can.editParams;
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.filename}</b>
                      <div className="small muted">Cargado el {u.createdAt.slice(0, 16).replace("T", " ")} por {nombreDe(u.uploadedBy)}{u.kind === "parametros" ? " · solo parámetros" : ""}</div>
                      <div className="small muted">SHA-256 {u.sha256.slice(0, 12)}…</div>
                    </td>
                    <td>{u.escuela ? ESC_BY[u.escuela]?.nombre || u.escuela : "—"}</td>
                    <td>{u.versionPlantilla || "—"}</td>
                    <td className="num">{u.resumen.filas ?? 0} leídas<br />{nIn} válidas · {nRej} no se muestran{u.resumen.ignoradas ? <><br />{u.resumen.ignoradas} ignoradas</> : null}</td>
                    <td>
                      <span className="chip st-ok"><Ic n="i-ok" /><span>Guardado</span></span>
                      {u.advertencias.map((x, i) => <div key={i} className="small muted">{x}</div>)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn small" onClick={() => run(ws, async () => { await download(`/api/uploads/${u.id}/file`); })}>Original</button>{" "}
                      {puede && <button className="btn small" onClick={() => remove(u.id, u.filename)}>Quitar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aes.length > 0 && (
        <>
          <Sect title={`Consolidados de autoevaluación (${aes.length})`} icon="i-doc" />
          <Note>Archivo con las hojas Consolidado y Matrices (y, si las trae, Indicadores). Alimenta las alertas R12 (criterio sin evidencia exigida) y R13 (criterio con matriz pendiente). Sus valores de indicadores se guardan como «sin dato validado» y no definen estados.</Note>
          <div className="tblw">
            <table className="tbl">
              <thead><tr><th>Archivo</th><th>Escuela</th><th>Criterios</th><th>Matrices pendientes</th><th>Valores sin validar</th><th /></tr></thead>
              <tbody>
                {aes.map((a) => (
                  <tr key={a.escuela}>
                    <td><b>{a.name}</b><div className="small muted">{a.fabrica ? "Incluido de fábrica" : "Leído " + a.cargadoEn}</div></td>
                    <td>{ESC_BY[a.escuela].nombre}</td><td className="num">{a.criterios.length}</td><td className="num">{a.nPend} de {a.nMat}</td><td className="num">{a.indicadores.length}</td>
                    <td>{ws.can.upload(a.escuela) && <button className="btn small" onClick={() => removeAutoeval(a.escuela, a.name)}>Quitar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Sect title={`Filas que no se muestran como dato (${rej.length})`} icon="i-diamond" />
      <Note>Una fila sin fuente del dato, con periodo inválido o sin valor no entra al tablero. Se avisa con la alerta R11.</Note>
      {rej.length ? (
        <div className="tblw" style={{ maxHeight: 340 }}>
          <table className="tbl">
            <thead><tr><th>Archivo</th><th>Fila</th><th>Periodo</th><th>Escuela</th><th>Indicador</th><th>Motivo</th></tr></thead>
            <tbody>{rej.slice(0, 200).map((r, i) => <tr key={i}><td>{r.archivo}</td><td>{r.fila || "—"}</td><td>{r.periodo}</td><td>{r.escuela}</td><td>{r.indicador}</td><td>{r.motivo}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <div className="empty">Ninguna fila rechazada.</div>}

      <Sect title="Cobertura por escuela" icon="i-chart" />
      <div className="tblw">
        <table className="tbl">
          <thead><tr><th>Escuela</th><th>Archivo</th><th>Indicadores vigilados</th><th>Con dato</th><th>Con evidencia</th><th>Validados</th><th>Vencidos</th></tr></thead>
          <tbody>
            {[...SCH, "FAC"].map((e) => {
              const c = engine.coverageStats(e);
              const fl = server.uploads.filter((u) => u.escuela === e && u.kind === "carga");
              return (
                <tr key={e}>
                  <td><b>{ESC_BY[e].nombre}</b></td>
                  <td>{fl.length ? fl.map((u) => u.filename).join(", ") : ws.ejemplo ? "EJEMPLO incrustado" : <span className="tag gap">sin archivo</span>}</td>
                  <td className="num">{c.n}</td><td className="num">{c.dato}</td><td className="num">{c.evi}</td><td className="num">{c.val}</td><td className="num">{c.venc}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewCard({ r, onConfirm, onDiscard }: { r: Pending; onConfirm: () => void; onDiscard: () => void }) {
  const rep = r.report;
  return (
    <article className="card">
      <div className="pill-row">
        <b>{r.file.name}</b>
        <span className="small muted">{fmtN(r.file.size / 1024, 0)} KB</span>
        {!rep && !r.error && <span className="chip st-info"><Ic n="i-clock" /><span>Revisando…</span></span>}
        {rep && !rep.errores.length && rep.permitido && <span className="chip st-ok"><Ic n="i-ok" /><span>Listo para guardar</span></span>}
        {rep && rep.errores.length > 0 && <span className="chip st-crit"><Ic n="i-crit" /><span>Con errores</span></span>}
        {rep && !rep.errores.length && !rep.permitido && <span className="chip st-risk"><Ic n="i-risk" /><span>No permitido</span></span>}
      </div>
      {r.error && <p className="small" style={{ color: "var(--bad-t)", margin: "8px 0 0" }}>{r.error}</p>}
      {rep && (
        <>
          <dl className="kv" style={{ marginTop: 8 }}>
            <dt>Tipo</dt><dd>{rep.tipo === "carga" ? "Plantilla de carga" : rep.tipo === "consolidado" ? "Consolidado de autoevaluación" : "Solo parámetros"}{rep.plantilla ? ` · plantilla ${rep.plantilla}` : ""}</dd>
            <dt>Escuela</dt><dd>{rep.escuelaNombre ?? "—"}{rep.responsable ? ` · responsable de calidad: ${rep.responsable}` : ""}{rep.entrega ? ` · entrega ${rep.entrega}` : ""}</dd>
            {rep.tipo === "carga" && <><dt>Mediciones</dt><dd><b>{rep.filasValidas}</b> válidas · <b>{rep.filasRechazadas}</b> no se mostrarían como dato{rep.ignoradas ? ` · ${rep.ignoradas} ignoradas (indicador desconocido)` : ""}{rep.ejemploDescartadas ? ` · ${rep.ejemploDescartadas} de EJEMPLO no se guardan` : ""}</dd><dt>Evidencias y alcance</dt><dd>{rep.evidencias} filas de evidencia · {rep.alcance} indicadores con alcance definido</dd></>}
            {rep.autoevaluacion && <><dt>Autoevaluación</dt><dd>{rep.autoevaluacion.criterios} criterios · {rep.autoevaluacion.matricesPendientes} de {rep.autoevaluacion.matrices || "—"} matrices pendientes · {rep.autoevaluacion.valoresSinValidar} valores sin validar (solo referencia)</dd></>}
            {rep.parametros && <><dt>Parámetros</dt><dd>{rep.parametros}{rep.parametrosCambian ? " Al guardar, pasan a ser los vigentes." : ""}</dd></>}
          </dl>
          {rep.errores.map((x, i) => <p key={i} className="small" style={{ color: "var(--bad-t)", margin: "6px 0 0" }}>{x}</p>)}
          {rep.motivoNoPermitido && <p className="small" style={{ color: "var(--warn-t)", margin: "6px 0 0" }}>{rep.motivoNoPermitido}</p>}
          {rep.advertencias.map((x, i) => <p key={i} className="small muted" style={{ margin: "4px 0 0" }}>{x}</p>)}
          {rep.muestraRechazadas.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary className="small">Ver las filas que no se mostrarían ({rep.filasRechazadas})</summary>
              <div className="tblw" style={{ maxHeight: 200, marginTop: 6 }}>
                <table className="tbl">
                  <thead><tr><th>Fila</th><th>Periodo</th><th>Indicador</th><th>Motivo</th></tr></thead>
                  <tbody>{rep.muestraRechazadas.map((m, i) => <tr key={i}><td>{m.fila}</td><td>{m.periodo}</td><td>{m.indicador}</td><td>{m.motivo}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          )}
          {rep.ejemploDescartadas > 0 && rep.errores.length > 0 && <p className="small" style={{ marginTop: 6 }}><ExBadge /></p>}
        </>
      )}
      <div className="filters" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={!rep || r.saving || rep.errores.length > 0 || !rep.permitido} onClick={onConfirm}><Ic n="i-upload" />{r.saving ? "Guardando…" : "Guardar en la base"}</button>
        <button className="btn" disabled={r.saving} onClick={onDiscard}>Descartar</button>
      </div>
    </article>
  );
}
