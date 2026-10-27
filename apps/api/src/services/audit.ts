import { auditLog, type Db } from "@sgc/db";

export interface AuditEvent {
  accion: string;
  clave?: string;
  esc?: string;
  antes?: unknown;
  despues?: unknown;
  nota?: string;
  /** ámbito «decision» muestra el evento en la bitácora de la vista Decisión; el resto de campos sirve para filtrar el historial de un elemento */
  extra?: Record<string, unknown>;
}

/** `tx` puede ser la base o una transacción. */
export async function audit(tx: Pick<Db, "insert">, actor: string | null, e: AuditEvent) {
  await tx.insert(auditLog).values({
    actor, accion: e.accion, clave: e.clave ?? "", esc: e.esc ?? "", antes: (e.antes ?? null) as any, despues: (e.despues ?? null) as any, nota: e.nota ?? "", extra: (e.extra ?? {}) as any,
  });
}
