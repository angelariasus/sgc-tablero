import type { FastifyReply } from "fastify";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly code = "error", readonly extra?: Record<string, unknown>) { super(message); }
}
export const badRequest = (m: string, extra?: Record<string, unknown>) => new HttpError(400, m, "bad_request", extra);
export const forbidden = (m = "Tu rol no permite esta operación.") => new HttpError(403, m, "forbidden");
export const notFound = (m = "No encontrado.") => new HttpError(404, m, "not_found");
export const conflict = (m: string) => new HttpError(409, m, "conflict");

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      const i = e.issues[0];
      const where = i.path.length ? ` (${i.path.join(".")})` : "";
      throw badRequest(`${i.message}${where}`, { issues: e.issues.slice(0, 5).map((x) => ({ path: x.path.join("."), message: x.message })) });
    }
    throw e;
  }
}

/** Respuesta con archivo adjunto (nombre ASCII y UTF-8). */
export function sendFile(reply: FastifyReply, file: { filename: string; mime: string; body: Buffer }) {
  const ascii = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return reply
    .header("Content-Type", file.mime)
    .header("Content-Disposition", `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`)
    .header("Cache-Control", "no-store")
    .send(file.body);
}
