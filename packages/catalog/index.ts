import model from "./model.json";
import example from "./example.json";
import params from "./params.json";

/** Catálogo inicial del tablero (extraído del HTML v0.9). */
export const catalogModel = model as any;
export const catalogExample = example as any;
export const catalogParamsDef = params as any;
export const TEMPLATE_FILES = [
  "SGC_Plantilla_de_carga_por_escuela_v0.6.xlsx",
  "SGC_EJEMPLO_carga_ENF.xlsx",
  "SGC_EJEMPLO_carga_OBS.xlsx",
  "SGC_EJEMPLO_carga_TM.xlsx",
  "SGC_Consolidado_autoevaluacion_EPTM.xlsx",
] as const;
