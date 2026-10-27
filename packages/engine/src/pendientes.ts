import type { Engine } from "./core";

/** Pendientes y decisiones del tablero (texto de la v0.9). */
export function nuevosPendientes(E: Engine): { ambito: string; pendiente: string; accion: string }[] {
  const M = E.M;
  const nConf = M.indicadores.filter(i => i.estado_meta === 'En conflicto').length;
  const nSinMeta = E.CARGABLES.filter(c => !(E.params.metas[c.id] || []).some(r => r.meta !== null && r.fuente_meta)).length;
  return [
    { ambito: 'Referencia visual', pendiente: 'El archivo «Tablero de Autoevaluación EPTM» que se mencionó como referencia no estaba en la carpeta del proyecto. Este tablero se construyó a partir de las funciones que se describieron (tarjetas de estado, estándares E1 a E10, indicadores ID01 a ID29, evidencia por área, exportación CSV y modo oscuro), sin copiar nada de ese archivo.', accion: 'Robert sube el archivo del tablero EPTM al proyecto; se compara y se ajusta lo que difiera.' },
    { ambito: 'Metas y umbrales', pendiente: `Solo hay umbrales con fuente para el POI (menos de 75 %, de 75 a menos de 95 %, 95 % o más, según los reportes de seguimiento). Para el resto no se inventan: ${nSinMeta} indicadores no tienen meta con fuente y los demás tienen meta pero no semáforo. Aparecen en gris como «Por definir» o «Bajo la meta».`, accion: 'El comité de calidad define, con fuente, los límites de «En meta» y «En riesgo» por indicador y los carga en Parámetros o en la hoja Metas_Umbrales.' },
    { ambito: 'Metas y umbrales', pendiente: 'Los valores de referencia de los 29 indicadores SINEACE vienen del modelo CONEAU 2026 [A4]. Son referencias del modelo, no metas aprobadas por la Facultad ni por cada escuela.', accion: 'Decidir si la Facultad adopta esas referencias como meta o fija las propias.' },
    { ambito: 'Metas y umbrales', pendiente: `${nConf} indicadores tienen metas en conflicto entre documentos (ver Contradicciones). El tablero usa la meta del documento que se indica en cada caso y la marca; los demás valores quedan sin semáforo.`, accion: 'Resolver con la unidad responsable qué fuente manda para cada indicador en conflicto.' },
    { ambito: 'Estructura', pendiente: 'Tecnología Médica se trata como una escuela con cuatro áreas: Radiología, Terapia Física, Terapia Ocupacional y Laboratorio Clínico y Anatomía Patológica (nombres dados por Robert). La plantilla 0.1 usaba los códigos TM-A1 a TM-A4: el tablero los sigue reconociendo.', accion: 'Confirmar con la dirección de la escuela si los nombres oficiales de las áreas coinciden con estos.' },
    { ambito: 'Estructura', pendiente: 'Sin hoja de área, la serie de una escuela de TM es el promedio simple de sus áreas y se marca «por confirmar». Si se prefiere ponderar por estudiantes, falta el dato de matrícula por área.', accion: 'Confirmar si el valor de TM es promedio simple, ponderado o un solo valor de la escuela.' },
    { ambito: 'Alcance', pendiente: 'Alcance inicial propuesto: los 29 indicadores SINEACE, los indicadores de los nueve procesos del 10.2 y los del piloto. Cada escuela lo ajusta en la hoja Alcance de su archivo.', accion: 'La escuela de cada fase confirma su alcance al recibir la plantilla.' },
    { ambito: 'Implementación', pendiente: 'Orden de implementación definido por Robert: 1.º Enfermería (piloto), 2.º Obstetricia, 3.º Tecnología Médica con subfases por área. Falta la fecha de inicio y cierre de cada fase.', accion: 'Robert o el comité fijan las fechas; el plan de implementación se ajusta a este orden.' },
    { ambito: 'POI de las escuelas', pendiente: 'El POI de escuela disponible es el de Tecnología Médica (formato UPPR). Los de Enfermería y Obstetricia están por confirmar.', accion: 'Pedirlos a las direcciones de escuela en el mismo formato UPPR.' },
    { ambito: 'Formatos oficiales', pendiente: 'La plantilla de carga es una propuesta y no lleva código de formato. Donde exista un formato oficial de la UNMSM o de la Facultad (por ejemplo, del Manual FM) se debe usar y citar su código; no se inventan códigos.', accion: 'Por confirmar con la UPPR qué formatos oficiales cubren la carga de indicadores y cuáles son sus códigos.' },
    { ambito: 'PEI vigente', pendiente: 'Rige el PEI 2026-2030 (RR N.° 009248-2025-R) [A12]; el PEI 2023-2027 queda como serie histórica. Ningún documento leído dice si lo deroga expresamente ni cómo es la transición del PE FM 2024-2027. Las metas de la Facultad para 2026-2030 no figuran en la matriz [A18].', accion: 'Confirmar con la OGPL y la UPPR la derogación y la transición; las metas 2026-2030 de la Facultad quedan por confirmar.' },
    { ambito: 'Indicadores del PE FM', pendiente: 'Los 29 indicadores del PE FM se cargaron desde la matriz [A18] con sus metas de 2024 y 2025 y su responsable. La clasificación de cada uno como «puntual» o «acumulado en el año» es criterio propio [CP], y «2025-I» se tomó como primer semestre calendario. AE.01.03-2 (tutoría) tiene sentido descendente en el PE FM pero el POI lo evalúa como ascendente: queda «Por definir».', accion: 'La unidad responsable confirma la clasificación, la fecha de corte de «2025-I» y el sentido de AE.01.03-2.' },
    { ambito: 'POI 2025', pendiente: 'Decidido por Robert (20-10-2026): la cifra oficial del POI 2025 es el reporte anual en PDF [A15], con 30 actividades y 94,64 %. El Excel de seguimiento [A19] es un archivo de trabajo con 33 (93,81 % recalculado, 91,00 % escrito). Las tres actividades que solo trae el Excel (publicaciones, mantenimiento y equipamiento) no entran a las cifras; la diferencia queda registrada en las incongruencias 1 y 2.', accion: 'Pedir a la UPPR el reporte completo oficial de 2025 con fecha de consulta y centro de costo, para ver si esas tres actividades pertenecen al POI.' },
    { ambito: 'Avance esperado', pendiente: 'Decidido por Robert (20-10-2026): «Avance 2025-I» y los demás datos parciales se comparan con el programado acumulado al corte del POI mensual, no con 0,5 del año. Cada indicador acumulado del PE FM se vincula a una actividad de referencia del POI [CP] (por ejemplo, AE.01.01 con ACT01) y el esperado es la meta anual por la fracción de su programación mensual que ya vencía al corte. Los acumulados sin actividad de referencia con programación mensual (AE.02.01, AE.02.02, AE.02.03, OE.03-2, AE.03.01-1, AE.03.02-2, AE.03.03-2, AE.04.01 y AE.04.02) no tienen esperado con fuente: quedan «En seguimiento» y no en rojo.', accion: 'La UPPR confirma qué actividad del POI mide cada indicador del PE FM; con eso se completan los que hoy quedan en seguimiento.' },
    { ambito: 'Continúa en el PEI', pendiente: 'El rojo (3 indicadores) y el naranja oscuro (11) de la matriz [A18] significan «continúa en medición para 2026-2030». Por indicación de Robert se mantienen como dos estados distintos en la ficha, aunque no se sabe qué diferencia a uno de otro.', accion: 'Confirmar con quien marcó la matriz el significado de cada tono.' },
    { ambito: 'Criterios SINEACE', pendiente: 'Criterios corregidos el 20-10-2026 por Robert, contrastados con las fichas del Modelo: ID4 = 3.1 a 3.4, 4.1, 8.2, 8.4; ID10 = 3.1, 6.1, 8.4; ID11 = 2.7, 9.3; ID23 = 7.4, 8.2; ID27 = 6.1, 6.2, 6.3, 8.2; ID29 = 6.1, 6.2, 6.3, 8.2, 8.5. ID9 sigue por confirmar: queda con 3.5, 7.4, 8.2.', accion: 'Confirmar el conjunto completo de ID9 con la ficha del Modelo.' },
    { ambito: 'Reglas de cumplimiento', pendiente: 'ID25 e ID26 son tiempos y cumplen si el valor es menor o igual al referencial; ID6 es una variación y cumple si no es negativa. La ficha del Modelo dice «menor a» en ID25 e ID26, sin el igual.', accion: 'Confirmar con la OCAA el caso en que el valor es exactamente igual al referencial.' },
    { ambito: 'ID13', pendiente: 'Se mantiene 15 % (ficha del Modelo). La guía de la UNMSM que cita Robert trae 25 %; ese documento no está en el proyecto.', accion: 'Confirmar con la OCAA cuál rige (ver Incongruencias).' },

    { ambito: 'Periodicidad', pendiente: 'La periodicidad de los indicadores SINEACE se tomó de los indicadores de proceso que los miden [CP]. Los días de gracia antes de marcar «dato vencido» (30) son una propuesta [CP].', accion: 'El comité confirma periodicidad y días de gracia.' },
    { ambito: 'Responsables', pendiente: 'El responsable de cada indicador SINEACE se toma de la ficha del SGC vinculada y está «por confirmar» en casi todos los casos. Las alertas lo muestran así.', accion: 'Cada escuela completa el responsable local en la hoja Alcance.' },
    { ambito: 'Flujo de entrega', pendiente: 'No está definido quién envía cada archivo, con qué calendario ni quién consolida y valida (una persona de la Facultad que junte los tres archivos o carga directa de cada escuela).', accion: 'Robert define el calendario y quién consolida; el tablero ya admite los tres archivos a la vez.' },
    { ambito: 'Identidad visual', pendiente: 'Los espacios de logotipo y escudo están vacíos a propósito. No se dibujaron ni se reprodujeron.', accion: 'Robert sube los archivos oficiales desde los recuadros de la barra lateral (se guardan solo en su navegador).' },
    { ambito: 'Herramienta', pendiente: 'El tablero es un archivo HTML que se abre sin instalar nada. Si la Facultad quiere una herramienta institucional (Power BI u otra), el modelo de datos y la plantilla de Excel se pueden reutilizar.', accion: 'Robert decide si se mantiene este formato o se migra.' },
    { ambito: 'Seguridad', pendiente: 'Para leer Excel el archivo incluye la librería SheetJS 0.18.5, que tiene avisos de seguridad públicos conocidos al abrir archivos manipulados. Se usa solo con archivos propios y no hay conexión a internet.', accion: 'Cargar solo archivos que vengan de las escuelas. Valorar actualizar la librería en una versión posterior.' },
    { ambito: 'Gráficos', pendiente: 'Las tres series de escuelas usan tonos violeta, como pide la identidad. En modo oscuro la separación entre tonos no pasa la validación automática de color; se compensa con marcadores distintos, etiquetas directas, leyenda y tabla alternativa. La línea de meta dorada se oscureció para tener contraste.', accion: 'Robert acepta esa desviación o prefiere otro color para una de las series.' },
  ].concat(M.pendientes_v3 || []);
}
export const DECISIONES: { t: string; r: string; d: string }[] = [
  { t: 'Umbrales «En meta» y «En riesgo»', r: 'Fijarlos por indicador con fuente; no extender 75 % y 95 % del POI al resto sin sustento.', d: 'Mientras no existan, los indicadores solo se comparan con su meta y quedan en gris si no la cumplen.' },
  { t: 'Metas en conflicto entre documentos', r: 'Resolver con la unidad dueña de cada indicador (ver Contradicciones).', d: 'Cada conflicto sin resolver deja el indicador sin semáforo.' },
  { t: 'Referencias SINEACE como metas', r: 'Adoptarlas como meta provisional con la etiqueta «referencia del modelo».', d: 'Hoy se muestran así, sin darles carácter de meta aprobada.' },
  { t: 'POI por escuela', r: 'Usar el POI de Tecnología Médica ya recibido y pedir los de Enfermería y Obstetricia en formato UPPR; el de la Facultad queda como marco común.', d: 'Sin POI de escuela, sus actividades no se reparten.' },
  { t: 'Fechas de las fases de implementación', r: 'Fijar inicio y cierre de cada fase (Enfermería, Obstetricia y las cuatro áreas de Tecnología Médica).', d: 'Con las fechas, el tablero exige la carga a cada escuela desde su fase.' },
  { t: 'Esperado a la fecha en el PE FM', r: 'Mantener la actividad de referencia elegida por criterio propio hasta que la UPPR diga qué actividad mide cada indicador.', d: 'Evita falsos rojos con datos parciales, pero es una aproximación.' },
  { t: 'Un archivo por escuela y quién consolida', r: 'Un archivo por escuela, y una persona de calidad de la Facultad que los reúna cada trimestre.', d: 'Es lo que permite comparar escuelas con el mismo corte.' },
  { t: 'Herramienta definitiva', r: 'Usar este HTML como prototipo y decidir tras el piloto.', d: 'Si se pasa a una herramienta institucional, el modelo y la plantilla se reutilizan.' },
  { t: 'Desviación de color en modo oscuro', r: 'Aceptarla: hay marcadores, etiquetas y tabla alternativa.', d: 'Las tres series violeta son de la identidad y quedan muy cercanas en oscuro.' },
  { t: 'Logotipo, escudo y el tablero EPTM', r: 'Subir los tres archivos al proyecto.', d: 'Los recuadros están listos; el tablero EPTM permite contrastar funciones.' },
];

/**
 * Versión para la aplicación web: igual que la del tablero HTML, salvo los pendientes que hablaban del archivo HTML,
 * de la librería de Excel incrustada o de que nada salía del equipo, que ya no aplican.
 */
const AMBITOS_REEMPLAZADOS: Record<string, { pendiente: string; accion: string }> = {
  Herramienta: {
    pendiente: "El tablero pasó de un archivo HTML a una aplicación web: pantallas en Next.js (Vercel), API en Railway y base PostgreSQL en Supabase. Los datos del modelo, los parámetros, las plantillas de Excel y las reglas de cálculo son los de la versión 0.9.",
    accion: "Definir quién mantiene la aplicación, el calendario de respaldos de la base y a quién se le piden cuentas nuevas.",
  },
  Seguridad: {
    pendiente: "Los archivos Excel se leen en el servidor (SheetJS 0.20), solo se aceptan .xlsx y cada original se guarda con su huella SHA-256. Las filas sin fuente del dato no se guardan como dato.",
    accion: "Cargar solo archivos que vengan de las escuelas y revisar la bitácora cuando se cambien parámetros.",
  },
};
const DECISION_HERRAMIENTA = {
  t: "Herramienta definitiva",
  r: "Mantener esta aplicación web como herramienta institucional y asignar quién la administra.",
  d: "El modelo, las reglas y la plantilla de Excel se conservan igual; solo cambia dónde se guardan los datos.",
};

export function nuevosPendientesApp(E: Engine) {
  return nuevosPendientes(E).map((p) => (AMBITOS_REEMPLAZADOS[p.ambito] ? { ambito: p.ambito, ...AMBITOS_REEMPLAZADOS[p.ambito] } : p));
}
export const DECISIONES_APP = DECISIONES.map((d) => (d.t === "Herramienta definitiva" ? DECISION_HERRAMIENTA : d));
