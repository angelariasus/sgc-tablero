export type StateCode = "CRIT" | "RIESGO" | "BAJO" | "SD" | "SEG" | "OK" | "DEF" | "NA";

export interface StateDef {
  rank: number;
  label: string;
  cls: string;
  icon: string;
  sub?: string;
}

export const ST: Record<StateCode, StateDef> = {
  CRIT: { rank: 6, label: "Crítico", cls: "crit", icon: "i-crit" },
  RIESGO: { rank: 5, label: "En riesgo", cls: "risk", icon: "i-risk" },
  BAJO: { rank: 4, label: "Bajo la meta", cls: "low", icon: "i-low", sub: "umbral por definir" },
  SD: { rank: 3, label: "Sin dato", cls: "nodata", icon: "i-nodata" },
  SEG: { rank: 2, label: "En seguimiento", cls: "info", icon: "i-clock", sub: "medición parcial" },
  OK: { rank: 1, label: "En meta", cls: "ok", icon: "i-ok" },
  DEF: { rank: 0, label: "Por definir", cls: "def", icon: "i-def", sub: "meta sin fuente" },
  NA: { rank: -1, label: "No aplica", cls: "na", icon: "i-na" },
};

export type Severidad = "Crítica" | "En riesgo" | "Aviso";
export const SEV: Record<string, { rank: number; cls: string; icon: string }> = {
  Crítica: { rank: 3, cls: "crit", icon: "i-crit" },
  "En riesgo": { rank: 2, cls: "risk", icon: "i-risk" },
  Aviso: { rank: 1, cls: "info", icon: "i-info" },
};
