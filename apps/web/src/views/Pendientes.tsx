"use client";
import { DECISIONES_APP, nuevosPendientesApp } from "@sgc/engine";
import { useWs } from "@/lib/workspace";
import { Tag } from "@/components/common";
import { Note, PageHead, Sect } from "@/components/ui";

export default function Pendientes() {
  const { engine } = useWs();
  const M = engine.M;
  const nuevos = nuevosPendientesApp(engine);
  const prev = M.pendientes_previos.filter((p) => p.ambito !== "Ámbito");
  const Tabla = ({ rows, max }: { rows: { ambito: string; pendiente: string; accion: string }[]; max?: number }) => (
    <div className="tblw" style={max ? { maxHeight: max } : undefined}>
      <table className="tbl">
        <thead><tr><th>Ámbito</th><th>Pendiente</th><th>Acción</th></tr></thead>
        <tbody>{rows.map((p, i) => <tr key={i}><td><b>{p.ambito}</b></td><td>{p.pendiente}</td><td>{p.accion}</td></tr>)}</tbody>
      </table>
    </div>
  );
  return (
    <div>
      <PageHead title="Pendientes y decisiones">Lo que está «por confirmar» en el tablero, lo que quedó sin resolver en los documentos y las decisiones que le corresponden a Robert.</PageHead>
      <Sect title="Decisiones para Robert" icon="i-diamond" />
      <div className="grid g2">
        {DECISIONES_APP.map((d, i) => (
          <div key={d.t} className="card">
            <div className="pill-row"><span className="tag">{i + 1}</span><b>{d.t}</b></div>
            <p className="small" style={{ margin: "6px 0 2px" }}><b>Propuesta:</b> {d.r}</p>
            <p className="small muted" style={{ margin: 0 }}>{d.d}</p>
          </div>
        ))}
      </div>
      <Sect title={`Pendientes de este tablero (${nuevos.length})`} icon="i-bell" />
      <Tabla rows={nuevos} />
      <Sect title={`Pendientes previos del SGC (${prev.length})`} icon="i-doc" />
      <Tabla rows={prev} max={460} />
      <Sect title={`Contradicciones entre documentos (${M.contradicciones.length})`} icon="i-risk" />
      <div className="tblw" style={{ maxHeight: 460 }}>
        <table className="tbl">
          <thead><tr><th>N.º</th><th>Tema</th><th>Qué dicen las fuentes</th><th>Afecta</th><th>Estado</th></tr></thead>
          <tbody>
            {M.contradicciones.map((c: any) => (
              <tr key={c.n}><td>{c.n}</td><td><b>{c.tema}</b><div className="small muted">{c.tipo}</div></td><td>{c.texto}</td><td>{c.afecta}</td><td>{c.estado}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sect title="Formatos oficiales de la UNMSM y de la Facultad" icon="i-doc" />
      <p className="note">Se usan los formatos oficiales que existen y se cita su código. Donde la fuente no trae código no se inventa ninguno: queda «por confirmar con la UPPR». Los formatos que propone el SGC (plantilla de carga, registro de evidencia, fichas PM09 y PM10, acta del Comité de Calidad) tampoco llevan código hasta que la UPPR lo confirme.</p>
      <div className="tblw" style={{ maxHeight: 460 }}>
        <table className="tbl">
          <thead><tr><th>Uso</th><th>Formato oficial</th><th>Código en la fuente</th><th>Fuente</th></tr></thead>
          <tbody>
            {(M.formatos || []).map((f: any, i: number) => (
              <tr key={i}><td>{f.uso}</td><td>{f.formato}</td><td>{/^sin código/i.test(f.codigo) ? <Tag gap>sin código: por confirmar con la UPPR</Tag> : f.codigo}</td><td className="small">{f.fuente}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sect title={`Incongruencias entre archivos y con los reportes PDF (${(M.incongruencias || []).length})`} icon="i-risk" />
      <div className="tblw" style={{ maxHeight: 520 }}>
        <table className="tbl">
          <thead><tr><th>N.º</th><th>Dónde</th><th>Qué ocurre</th><th>Acción</th></tr></thead>
          <tbody>
            {(M.incongruencias || []).map((c: any) => (
              <tr key={c.n}><td>{c.n}</td><td className="small">{c.donde}</td><td>{c.que}</td><td>{c.accion}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Sect title="Fuentes" icon="i-link" />
      <div className="tblw" style={{ maxHeight: 340 }}>
        <table className="tbl">
          <thead><tr><th>Código</th><th>Tipo</th><th>Nombre</th></tr></thead>
          <tbody>{M.fuentes.map((f) => <tr key={f.id}><td><b>{f.id}</b></td><td>{f.tipo}</td><td>{f.nombre}</td></tr>)}</tbody>
        </table>
      </div>
      <Note>[CP] marca un criterio propio del equipo, no una cifra de un documento.</Note>
    </div>
  );
}
