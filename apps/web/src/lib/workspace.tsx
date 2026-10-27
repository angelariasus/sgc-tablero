"use client";
/**
 * Espacio de trabajo: carga el catálogo y lo guardado en el servidor, arma el motor de cálculo (el mismo que usa la API)
 * y guarda el estado de la pantalla (escuela elegida, datos EJEMPLO, fecha de corte, parámetros en edición…).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  DecisionBoard, Engine, clone, parseISO,
  type AutoEval, type DecisionInput, type EvidRow, type ExampleData, type Model, type NormRow, type Params, type ParamsDef,
} from "@sgc/engine";
import { ApiError, api, fetchCatalog } from "./api";

export type Rol = "admin" | "oficina" | "responsable" | "lectura";
export interface Me { id: string; email: string; nombre: string; rol: Rol; escuela: string | null }

export interface UploadInfo {
  id: string; filename: string; sha256: string; size: number; kind: "carga" | "consolidado" | "parametros"; escuela: string | null; versionPlantilla: string; responsable: string; entrega: string;
  resumen: { filas?: number; validas?: number; rechazadas?: number; ignoradas?: number; evidencias?: number; ejemploDescartadas?: number; hojas?: string[] };
  advertencias: string[]; uploadedBy: string | null; createdAt: string;
}

export interface ServerState {
  me: Me;
  serverTime: string;
  params: Params & { version: number; createdAt: string };
  decisionCorte: string;
  measurements: NormRow[];
  rejected: NormRow[];
  evidence: EvidRow[];
  scopes: Record<string, { alcance?: Record<string, string> | null; respLocal?: Record<string, string> | null }>;
  schoolsWithFiles: string[];
  autoeval: Record<string, AutoEval>;
  fileNames: string[];
  uploads: UploadInfo[];
  decision: DecisionInput;
  allowExampleUploads: boolean;
}

export interface Catalog { model: Model; example: ExampleData; pdef: ParamsDef }
export type EscSel = "TODAS" | "ENF" | "OBS" | "TM" | "FAC" | "NUT" | "POS";

export interface Toast { id: number; msg: string }

/** Estado de las vistas que se enlazan entre sí (por ejemplo, desde una alerta al reporte del POI). */
export interface ViewState {
  poiAnio: number;
  poiAoi: string | null;
  marco: "pefm" | "pei";
  estSel: string | null;
  procSel: { p: string; esc: string } | null;
  cmpInd: string;
  fInd: { tipo: string; proc: string; est: string; estado: string; q: string };
  fAl: { esc: string; sev: string; regla: string; touched: boolean };
  fPar: { q: string; soloSin: boolean };
}
const VS0: ViewState = {
  poiAnio: 2026, poiAoi: null, marco: "pefm", estSel: null, procSel: null, cmpInd: "ID1",
  fInd: { tipo: "", proc: "", est: "", estado: "", q: "" }, fAl: { esc: "", sev: "", regla: "", touched: false }, fPar: { q: "", soloSin: false },
};

export interface Workspace {
  catalog: Catalog;
  server: ServerState;
  me: Me;
  engine: Engine;
  board: DecisionBoard;
  /** hay parámetros editados sin guardar */
  paramsDirty: boolean;
  refresh(): Promise<void>;
  toast(msg: string): void;
  // pantalla
  escuela: EscSel; setEscuela(e: EscSel): void;
  ejemplo: boolean; setEjemplo(v: boolean): void;
  corte: string; setCorte(v: string): void;
  soloVal: boolean; setSoloVal(v: boolean): void;
  paramsDraft: Params | null; editParams(fn: (p: Params) => void): void; discardParams(): void; setParamsDraft(p: Params | null): void;
  ficha: { id: string; esc: string } | null; openFicha(id: string, esc?: string): void; closeFicha(): void; setFichaEsc(esc: string): void;
  vs: ViewState; setVs(patch: Partial<ViewState>): void;
  /** ir a otra vista */
  go(view: string): void;
  theme: "light" | "dark" | null; toggleTheme(): void; dark: boolean;
  /** lo que la persona puede hacer (solo para mostrar u ocultar botones; el servidor decide siempre) */
  can: {
    editDecision(esc: string): boolean; validate: boolean; editParams: boolean; upload(esc: string | null): boolean; manageTeam: boolean; readAudit: boolean;
  };
}

const Ctx = createContext<Workspace | null>(null);
export const useWs = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWs fuera de WorkspaceProvider");
  return c;
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ["catalog"], queryFn: fetchCatalog, staleTime: Infinity, retry: 1 });
  const st = useQuery({
    queryKey: ["state"], queryFn: () => api<ServerState>("/api/state"), refetchOnWindowFocus: true, refetchInterval: 60_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500 && e.status !== 0) && n < 2,
  });

  const [escuela, setEscuela] = useState<EscSel>("TODAS");
  const [ejemplo, setEjemplo] = useState(false);
  const [corte, setCorte] = useState("");
  const [soloVal, setSoloVal] = useState(false);
  const [paramsDraft, setParamsDraft] = useState<Params | null>(null);
  const [ficha, setFicha] = useState<{ id: string; esc: string } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [dark, setDark] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [vs, setVsState] = useState<ViewState>(VS0);
  const router = useRouter();
  const toastId = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("sgc-theme");
    setTheme(saved === "light" || saved === "dark" ? saved : null);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const calc = () => setDark(theme === "dark" || (theme !== "light" && mq.matches));
    calc();
    mq.addEventListener("change", calc);
    return () => mq.removeEventListener("change", calc);
  }, [theme]);

  const toast = useCallback((msg: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const refresh = useCallback(async () => { await qc.invalidateQueries({ queryKey: ["state"] }); }, [qc]);

  const catalog = cat.data as Catalog | undefined;
  const server = st.data;

  const engine = useMemo(() => {
    if (!catalog || !server) return null;
    return new Engine({
      model: catalog.model, pdef: catalog.pdef, example: catalog.example,
      params: paramsDraft ?? server.params,
      measurements: server.measurements, rejected: server.rejected, evidence: server.evidence, scopes: server.scopes, schoolsWithFiles: server.schoolsWithFiles, autoeval: server.autoeval, fileNames: server.fileNames,
      options: { ejemplo, corteOverride: corte ? parseISO(corte) : null, today: new Date() },
    });
  }, [catalog, server, paramsDraft, ejemplo, corte]);

  const board = useMemo(() => (engine && server ? new DecisionBoard(engine, server.decision, { corte: server.decisionCorte, soloVal }) : null), [engine, server, soloVal]);

  const value = useMemo<Workspace | null>(() => {
    if (!catalog || !server || !engine || !board) return null;
    const me = server.me;
    const staff = me.rol === "admin" || me.rol === "oficina";
    return {
      catalog, server, me, engine, board,
      paramsDirty: paramsDraft !== null,
      refresh, toast,
      escuela, setEscuela: (e) => { setEscuela(e); setVsState((v) => ({ ...v, fAl: { ...v.fAl, touched: false } })); }, ejemplo, setEjemplo, corte, setCorte, soloVal, setSoloVal,
      paramsDraft,
      setParamsDraft,
      editParams: (fn) => setParamsDraft((cur) => { const next = clone(cur ?? server.params); fn(next); return next; }),
      discardParams: () => setParamsDraft(null),
      ficha, openFicha: (id, esc) => setFicha((cur) => ({ id, esc: esc ?? cur?.esc ?? (escuela !== "TODAS" ? escuela : "TM") })), closeFicha: () => setFicha(null),
      setFichaEsc: (esc) => setFicha((cur) => (cur ? { ...cur, esc } : cur)),
      vs, setVs: (patch) => setVsState((cur) => ({ ...cur, ...patch })),
      go: (view) => router.push("/" + view),
      theme, dark,
      toggleTheme: () => { const next = dark ? "light" : "dark"; localStorage.setItem("sgc-theme", next); setTheme(next); },
      can: {
        editDecision: (esc) => staff || (me.rol === "responsable" && me.escuela === esc),
        validate: staff,
        editParams: staff,
        upload: (esc) => staff || (me.rol === "responsable" && !!esc && me.escuela === esc),
        manageTeam: me.rol === "admin",
        readAudit: staff,
      },
    };
  }, [catalog, server, engine, board, paramsDraft, refresh, toast, escuela, ejemplo, corte, soloVal, ficha, theme, dark, vs, router]);

  if (cat.isError || st.isError) {
    const e = (cat.error ?? st.error) as Error;
    const noAccess = e instanceof ApiError && e.code === "no_access";
    return (
      <div className="wrap" style={{ maxWidth: 640, margin: "10vh auto" }}>
        <div className="card">
          <h1 style={{ fontSize: "1.3rem" }}>{noAccess ? "Tu cuenta no tiene acceso" : "No se pudo cargar el tablero"}</h1>
          <p className="muted">{e.message}</p>
          <div className="filters" style={{ marginTop: 12 }}>
            {!noAccess && <button className="btn primary" onClick={() => { void cat.refetch(); void st.refetch(); }}>Reintentar</button>}
          </div>
        </div>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="wrap" style={{ maxWidth: 640, margin: "10vh auto" }} role="status" aria-live="polite">
        <div className="card"><h1 style={{ fontSize: "1.2rem" }}>Cargando el tablero…</h1><p className="muted small">Se está leyendo el catálogo del modelo y los datos guardados.</p></div>
      </div>
    );
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      <div id="toast-root" aria-live="polite" role="status">
        {toasts.slice(-1).map((t) => <div key={t.id} className="toast">{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  );
}
