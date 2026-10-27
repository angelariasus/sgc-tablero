import { ApiError, download } from "./api";
import type { Workspace } from "./workspace";

/** Ejecuta una acción de red y avisa del resultado; devuelve true si salió bien. */
export async function run(ws: Pick<Workspace, "toast">, fn: () => Promise<unknown>, ok?: string): Promise<boolean> {
  try {
    await fn();
    if (ok) ws.toast(ok);
    return true;
  } catch (e) {
    ws.toast(e instanceof ApiError ? e.message : "No se pudo completar la operación.");
    return false;
  }
}

/** Exportación del tablero (CSV o Excel): la genera la API con los mismos cálculos de la pantalla. */
export async function exportTablero(ws: Workspace, what: string, fmt: "csv" | "xlsx") {
  const q = new URLSearchParams({ what, fmt, ejemplo: ws.ejemplo ? "1" : "0" });
  if (ws.corte) q.set("corte", ws.corte);
  await run(ws, async () => { const name = await download("/api/export?" + q.toString()); ws.toast(`Se descargó ${name}.`); });
}

export async function exportDecision(ws: Workspace, what: string, fmt: "csv" | "xlsx") {
  const q = new URLSearchParams({ what, fmt, esc: ws.escuela === "FAC" ? "TODAS" : ws.escuela, solo_validados: ws.soloVal ? "1" : "0" });
  await run(ws, async () => { const name = await download("/api/export/decision?" + q.toString()); ws.toast(`Se descargó ${name}.`); });
}

export async function exportParams(ws: Workspace) {
  await run(ws, async () => { const name = await download("/api/export/params"); ws.toast(`Se descargó ${name}. Cárgalo en la vista Cargas para aplicarlo.`); });
}

export const fmtDateTime = (iso: string) => String(iso).slice(0, 16).replace("T", " ");
