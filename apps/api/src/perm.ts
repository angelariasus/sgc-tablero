import type { Rol } from "@sgc/db";

export interface Actor { id: string; email: string; nombre: string; rol: Rol; escuela: string | null }

export const isStaff = (a: Actor) => a.rol === "admin" || a.rol === "oficina";

/** Qué puede hacer cada rol. Se comprueba en el servidor en cada operación. */
export const can = {
  /** valida valores de la vista Decisión */
  validate: (a: Actor) => isStaff(a),
  manageTeam: (a: Actor) => a.rol === "admin",
  editParams: (a: Actor) => isStaff(a),
  /** edita valores y procesos de una escuela en la vista Decisión */
  editDecision: (a: Actor, esc: string) => isStaff(a) || (a.rol === "responsable" && a.escuela === esc),
  /** sube un archivo de carga de una escuela */
  upload: (a: Actor, esc: string | null) => isStaff(a) || (a.rol === "responsable" && !!esc && a.escuela === esc),
  /** sube archivos que no son de una escuela (parámetros) */
  uploadGlobal: (a: Actor) => isStaff(a),
  readAudit: (a: Actor) => isStaff(a),
};
