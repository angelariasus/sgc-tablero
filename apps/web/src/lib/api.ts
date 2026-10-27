import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code = "error", readonly body: any = null) { super(message); }
}

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;
let onUnauthorized: () => void = () => {};
export function configureApi(g: TokenGetter, unauth: () => void) { getToken = g; onUnauthorized = unauth; }

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...init, headers });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.", "network");
  }
  if (res.status === 401) onUnauthorized();
  return res;
}

async function fail(res: Response): Promise<never> {
  let body: any = null;
  try { body = await res.json(); } catch { /* sin cuerpo */ }
  throw new ApiError(res.status, body?.message ?? `Error ${res.status}`, body?.error ?? "error", body);
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await request(path, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) return fail(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Catálogo con ETag: si no cambió, se reutiliza la copia guardada. */
let catalogCache: { etag: string; data: any } | null = null;
export async function fetchCatalog(): Promise<any> {
  const res = await request("/api/catalog", { headers: catalogCache ? { "If-None-Match": catalogCache.etag } : undefined });
  if (res.status === 304 && catalogCache) return catalogCache.data;
  if (!res.ok) return fail(res);
  const data = await res.json();
  const etag = res.headers.get("ETag");
  if (etag) catalogCache = { etag, data };
  return data;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Descarga un archivo de la API (con la sesión) y lo guarda en el equipo. Devuelve el nombre del archivo. */
export async function download(path: string): Promise<string> {
  const res = await request(path);
  if (!res.ok) return fail(res);
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  const name = star ? decodeURIComponent(star[1]) : plain ? plain[1] : "archivo";
  saveBlob(await res.blob(), name);
  return name;
}

export interface UploadReport {
  guardado: boolean;
  archivo: string; tipo: "carga" | "consolidado" | "parametros"; escuela: string | null; escuelaNombre: string | null; plantilla: string; responsable: string; entrega: string;
  filasValidas: number; filasRechazadas: number; ignoradas: number; ejemploDescartadas: number; evidencias: number; alcance: number; parametros: string; parametrosCambian: boolean;
  autoevaluacion: { escuela: string; criterios: number; matricesPendientes: number; matrices: number | string; valoresSinValidar: number } | null;
  muestraRechazadas: { fila: number; periodo: string; escuela: string; indicador: string; motivo: string }[];
  advertencias: string[]; errores: string[]; hojas: string[]; sha256: string; size: number; permitido: boolean; motivoNoPermitido: string | null;
  uploadId?: string; mensajes?: string[]; reemplazados?: number;
}

export async function uploadFile(file: File, confirm: boolean): Promise<UploadReport> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await request(`/api/uploads${confirm ? "?confirm=1" : ""}`, { method: "POST", body: form });
  if (!res.ok) return fail(res);
  return (await res.json()) as UploadReport;
}
