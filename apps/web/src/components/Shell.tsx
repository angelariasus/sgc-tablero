"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EJ_CORTE, fmtDate, isoD, parseISO } from "@sgc/engine";
import { useAuth } from "@/lib/auth";
import { exportTablero } from "@/lib/actions";
import { useWs, type EscSel } from "@/lib/workspace";
import FichaDrawer from "./FichaDrawer";
import { Ic } from "./Icon";
import { TipProvider } from "./ui";

export const VIEWS = [
  { id: "decision", t: "Decisión", i: "i-target" },
  { id: "general", t: "Vista general", i: "i-home" },
  { id: "procesos", t: "Procesos 10.2", i: "i-flow" },
  { id: "estandares", t: "Estándares e indicadores", i: "i-target" },
  { id: "poi", t: "PEI y POI", i: "i-chart" },
  { id: "indicadores", t: "Indicadores", i: "i-grid" },
  { id: "alertas", t: "Alertas", i: "i-bell", badge: true },
  { sep: true },
  { id: "relaciones", t: "Relaciones", i: "i-link" },
  { id: "cargas", t: "Cargas", i: "i-upload" },
  { id: "parametros", t: "Parámetros", i: "i-sliders" },
  { id: "pendientes", t: "Pendientes", i: "i-doc" },
  { id: "equipo", t: "Equipo", i: "i-link" },
] as const;

const ESCUELAS: [EscSel, string][] = [["TODAS", "Todas"], ["ENF", "Enfermería"], ["OBS", "Obstetricia"], ["TM", "Tec. Médica"], ["FAC", "Facultad"], ["NUT", "Nutrición"], ["POS", "Posgrado"]];

function ImageSlot({ which, label }: { which: "logo" | "escudo"; label: string }) {
  const ws = useWs();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { setSrc(localStorage.getItem("sgc-" + which)); }, [which]);
  return (
    <label className="slot" title={`Subir el ${label.toLowerCase()} oficial`}>
      <input
        type="file" accept="image/*" className="sr" aria-label={`Subir ${label.toLowerCase()} oficial`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 1.5e6) return ws.toast("La imagen pesa más de 1,5 MB: usa una más liviana.");
          const r = new FileReader();
          r.onload = () => { const url = String(r.result); setSrc(url); try { localStorage.setItem("sgc-" + which, url); } catch { /* sin espacio */ } ws.toast("Imagen puesta. Queda solo en este navegador."); };
          r.readAsDataURL(f);
        }}
      />
      <span>{src ? <img alt={`${label} oficial`} src={src} /> : (<><Ic n="i-upload" /><span>{label}</span></>)}</span>
    </label>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const ws = useWs();
  const auth = useAuth();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const exp = useRef<HTMLDetailsElement>(null);
  const cur = VIEWS.find((v) => "id" in v && path.startsWith("/" + v.id)) as { id: string; t: string } | undefined;
  const nAl = ws.engine.ALERTS.filter((a) => a.severidad !== "Aviso").length;
  const nTot = ws.engine.ALERTS.length;
  const reservada = ws.escuela === "NUT" || ws.escuela === "POS";

  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [path]);
  useEffect(() => { document.title = `${cur?.t ?? "Tablero"} · SGC · Tablero de decisiones`; }, [cur]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (exp.current?.open && !(e.target as Element).closest("#exp-menu")) exp.current.open = false; };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const doExport = async (what: string, fmt: "csv" | "xlsx") => { await exportTablero(ws, what, fmt); if (exp.current) exp.current.open = false; };
  const corte = ws.engine.corteDate();

  return (
    <TipProvider>
      <a className="skip" href="#main">Saltar al contenido</a>
      <div className="app">
        <aside className={"side" + (menu ? " open" : "")} id="side" aria-label="Navegación principal">
          <div className="brand">
            <div className="t1">SGC · Escuelas de Tecnología Médica, Enfermería y Obstetricia</div>
            <div className="t2">Tablero de decisiones · Facultad de Medicina San Fernando</div>
            <div className="gline" />
          </div>
          <div className="slots"><ImageSlot which="logo" label="Logotipo" /><ImageSlot which="escudo" label="Escudo" /></div>
          <nav className="nav" aria-label="Vistas">
            {VIEWS.map((v, i) =>
              "sep" in v ? <div key={i} className="sep" /> : (
                <Link key={v.id} href={"/" + v.id} aria-current={path.startsWith("/" + v.id) ? "page" : undefined}>
                  <Ic n={v.i} /><span>{v.t}</span>
                  {"badge" in v && v.badge && <span className="nb" title={`${nAl} alertas críticas y en riesgo, de ${nTot} en total`} aria-label={`${nAl} alertas críticas y en riesgo, de ${nTot} en total`}>{nAl}<small> de {nTot}</small></span>}
                </Link>
              ),
            )}
          </nav>
        </aside>
        <div className="main">
          <header className="top" id="top">
            <button className="btn small menu-btn" aria-label="Mostrar u ocultar el menú" onClick={() => setMenu((m) => !m)}><Ic n="i-menu" /></button>
            <div className="seg-btn" role="group" aria-label="Escuela">
              {ESCUELAS.map(([k, l]) => <button key={k} aria-pressed={ws.escuela === k} onClick={() => ws.setEscuela(k)}>{l}</button>)}
            </div>
            <label className="small muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              Fecha de corte <input type="date" value={isoD(corte)} aria-label="Fecha de corte" onChange={(e) => ws.setCorte(parseISO(e.target.value) ? e.target.value : "")} />
            </label>
            <button className="btn small" title="Volver a la fecha de corte de los parámetros" onClick={() => ws.setCorte("")}>Restablecer</button>
            <span className="grow" />
            <label className="sw" title="Datos inventados para ver cómo funciona el tablero">
              <input type="checkbox" checked={ws.ejemplo} onChange={(e) => { ws.setEjemplo(e.target.checked); ws.toast(e.target.checked ? "Datos EJEMPLO encendidos." : "Datos EJEMPLO apagados: solo se muestran datos reales (POI de la Facultad y archivos cargados)."); }} />
              <span className="tr" aria-hidden="true" /><span>Datos EJEMPLO</span>
            </label>
            <details className="menu" id="exp-menu" ref={exp}>
              <summary className="btn"><Ic n="i-download" />Exportar</summary>
              <div className="menu-p" role="menu">
                <button role="menuitem" onClick={() => doExport("todo", "xlsx")}>Excel completo (indicadores, alertas, trazabilidad)</button>
                <button role="menuitem" onClick={() => doExport("indicadores", "csv")}>CSV · Indicadores</button>
                <button role="menuitem" onClick={() => doExport("alertas", "csv")}>CSV · Alertas</button>
                <button role="menuitem" onClick={() => doExport("trazabilidad", "csv")}>CSV · Trazabilidad</button>
                <button role="menuitem" onClick={() => doExport("criterios", "csv")}>CSV · Criterios (autoevaluación)</button>
                <button role="menuitem" onClick={() => doExport("valores_informe", "csv")}>CSV · Valores del informe sin validar</button>
                <button role="menuitem" onClick={() => doExport("indicadores", "xlsx")}>Excel · Solo indicadores</button>
                <button role="menuitem" onClick={() => doExport("alertas", "xlsx")}>Excel · Solo alertas</button>
                <button role="menuitem" onClick={() => doExport("trazabilidad", "xlsx")}>Excel · Solo trazabilidad</button>
              </div>
            </details>
            <Link className="btn" href="/cargas"><Ic n="i-upload" />Cargar archivos</Link>
            <button className="btn" aria-pressed={ws.dark} aria-label="Cambiar entre modo claro y oscuro" onClick={ws.toggleTheme}><Ic n={ws.dark ? "i-sun" : "i-moon"} /><span>{ws.dark ? "Claro" : "Oscuro"}</span></button>
            <span className="small muted" title={ws.me.email}>{ws.me.nombre}</span>
            <button className="btn small" onClick={() => void auth.signOut()}>Salir</button>
          </header>
          <div className={"wrap" + (reservada ? " reservada" : "")} id="main" tabIndex={-1}>
            {ws.ejemplo && (
              <div className="banner ex" role="note">
                <Ic n="i-info" />
                <div><b>Estás viendo datos EJEMPLO.</b> Son inventados y están rotulados <span className="exb">EJEMPLO</span>; no reflejan a ninguna escuela. Los datos del POI de la Facultad sí son reales (reportes de seguimiento). Fecha de corte de los ejemplos: {fmtDate(parseISO(EJ_CORTE))}. Apaga el interruptor «Datos EJEMPLO» o carga los archivos reales de las escuelas.</div>
              </div>
            )}
            {reservada ? (
              <div className="banner dec-reservada" role="note"><Ic n="i-info" /><div>Pestaña reservada. Modelo de referencia y estado de acreditación por confirmar.</div></div>
            ) : children}
            <p className="note" style={{ marginTop: 28 }}>Cada dato muestra su fuente en la ficha del indicador. Sin fuente no se muestra como dato. Lo que está «por confirmar» se registra en Pendientes. [CP] indica un criterio propio, no una cifra de un documento.</p>
          </div>
        </div>
      </div>
      <FichaDrawer />
    </TipProvider>
  );
}
