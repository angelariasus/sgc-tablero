import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { measurements, uploads } from "@sgc/db";
import { harness, readFile, realize, fixture, type Harness } from "./helpers";

let H: Harness;
let admin: string, oficina: string, respENF: string, respTM: string, lectura: string;

beforeAll(async () => {
  H = await harness({ BOOTSTRAP_ADMIN_EMAIL: "admin@unmsm.test" });
  admin = await H.person("admin", { email: "admin@unmsm.test" });
  oficina = await H.person("oficina");
  respENF = await H.person("responsable", { escuela: "ENF" });
  respTM = await H.person("responsable", { escuela: "TM" });
  lectura = await H.person("lectura");
});
afterAll(async () => { await H.close(); });

describe("acceso y sesión", () => {
  it("sin sesión no hay acceso, salvo /health", async () => {
    expect((await H.req(null, "GET", "/health")).status).toBe(200);
    for (const u of ["/api/me", "/api/state", "/api/catalog", "/api/team", "/api/templates"]) expect((await H.req(null, "GET", u)).status).toBe(401);
  });
  it("una sesión que no es de un usuario definido no entra", async () => {
    H.verifier.register("11111111-1111-4111-8111-111111111111", "extraño@gmail.com");
    const r = await H.req("11111111-1111-4111-8111-111111111111", "GET", "/api/me");
    expect(r.status).toBe(403);
    expect(r.json.error).toBe("no_access");
  });
  it("un token falso se rechaza", async () => {
    expect((await H.req("token-inventado", "GET", "/api/me")).status).toBe(401);
  });
  it("devuelve el perfil de la persona", async () => {
    const r = await H.req(respENF, "GET", "/api/me");
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ rol: "responsable", escuela: "ENF" });
  });
  it("una cuenta desactivada no entra", async () => {
    const x = await H.person("lectura");
    const p = await H.req(admin, "PATCH", `/api/team/${x}`, { activo: false });
    expect(p.status).toBe(200);
    const r = await H.req(x, "GET", "/api/me");
    expect(r.status).toBe(403);
    expect(r.json.error).toBe("disabled");
  });
});

describe("catálogo y estado", () => {
  it("el catálogo se sirve con ETag y responde 304 si no cambió", async () => {
    const r = await H.req(lectura, "GET", "/api/catalog");
    expect(r.status).toBe(200);
    expect(r.json.model.indicadores.length).toBeGreaterThan(100);
    expect(r.json.model.sineace.length).toBe(29);
    const etag = r.headers.etag as string;
    const again = await H.app.inject({ method: "GET", url: "/api/catalog", headers: { authorization: `Bearer ${lectura}`, "if-none-match": etag } });
    expect(again.statusCode).toBe(304);
  });
  it("el estado trae parámetros de fábrica, autoevaluación de la EPTM y sin mediciones cargadas", async () => {
    const r = await H.req(lectura, "GET", "/api/state");
    expect(r.status).toBe(200);
    expect(r.json.params.version).toBe(1);
    expect(r.json.params.reglas.length).toBe(14);
    expect(Object.keys(r.json.autoeval)).toEqual(["TM"]);
    expect(r.json.autoeval.TM.fabrica).toBe(true);
    expect(r.json.measurements).toEqual([]);
    expect(r.json.decision.roster).toBeTruthy();
  });
});

describe("la base impone las reglas de datos", () => {
  it("todas las tablas tienen RLS activado (la clave pública de Supabase no lee nada)", async () => {
    const res: any = await H.handle.db.execute(sql`select tablename, rowsecurity from pg_tables where schemaname = 'public'`);
    const rows = (res.rows ?? res) as { tablename: string; rowsecurity: boolean }[];
    expect(rows.length).toBeGreaterThanOrEqual(13);
    expect(rows.filter((t) => !t.rowsecurity).map((t) => t.tablename)).toEqual([]);
  });
  it("una medición sin fuente no se puede guardar ni por la puerta de atrás", async () => {
    const [u] = await H.handle.db.insert(uploads).values({ filename: "x.xlsx", sha256: "0", size: 1, storagePath: "x", kind: "carga", escuela: "ENF" }).returning();
    await expect(H.handle.db.insert(measurements).values({ uploadId: u.id, periodo: "2026", escuela: "ENF", indicador: "ID1", valorDirecto: 1, fuenteDato: "   " })).rejects.toThrow();
    await expect(H.handle.db.insert(measurements).values({ uploadId: u.id, periodo: "26", escuela: "ENF", indicador: "ID1", valorDirecto: 1, fuenteDato: "x" })).rejects.toThrow();
    await expect(H.handle.db.insert(measurements).values({ uploadId: u.id, periodo: "2026", escuela: "XXX", indicador: "ID1", valorDirecto: 1, fuenteDato: "x" })).rejects.toThrow();
    await H.handle.db.delete(uploads).where(sql`${uploads.id} = ${u.id}`);
  });
});

describe("carga de archivos Excel", () => {
  const EX = (n: string) => ({ name: n, data: readFile(n) });

  it("un archivo de EJEMPLO se analiza pero no se guarda en la base", async () => {
    const prev = await H.upload(oficina, EX("SGC_EJEMPLO_carga_ENF.xlsx"));
    expect(prev.status).toBe(200);
    expect(prev.json.guardado).toBe(false);
    expect(prev.json.errores.join(" ")).toMatch(/EJEMPLO/);
    const c = await H.upload(oficina, EX("SGC_EJEMPLO_carga_ENF.xlsx"), true);
    expect(c.status).toBe(422);
    const st = await H.req(oficina, "GET", "/api/state");
    expect(st.json.measurements.length).toBe(0);
  });

  it("rechaza lo que no es un Excel", async () => {
    const r = await H.upload(oficina, { name: "datos.xlsx", data: Buffer.from("esto no es un excel") });
    expect(r.status).toBe(400);
    const r2 = await H.upload(oficina, { name: "datos.csv", data: Buffer.from("a,b") });
    expect(r2.status).toBe(400);
  });

  it("la plantilla en blanco no se puede guardar: no dice de qué escuela es", async () => {
    const r = await H.upload(oficina, EX("SGC_Plantilla_de_carga_por_escuela_v0.6.xlsx"));
    expect(r.status).toBe(200);
    expect(r.json.errores.join(" ")).toMatch(/Portada: escuela_id/);
    expect(r.json.filasValidas).toBe(0);
    const c = await H.upload(oficina, EX("SGC_Plantilla_de_carga_por_escuela_v0.6.xlsx"), true);
    expect(c.status).toBe(422);
  });

  it("una responsable no puede cargar archivos de otra escuela", async () => {
    const data = realize(readFile("SGC_EJEMPLO_carga_OBS.xlsx"));
    const prev = await H.upload(respENF, { name: "obs.xlsx", data });
    expect(prev.status).toBe(200);
    expect(prev.json.permitido).toBe(false);
    const c = await H.upload(respENF, { name: "obs.xlsx", data }, true);
    expect(c.status).toBe(403);
    const l = await H.upload(lectura, { name: "obs.xlsx", data }, true);
    expect(l.status).toBe(403);
  });

  it("guarda las cargas reales, conserva el original y reemplaza un archivo con el mismo nombre", async () => {
    for (const n of ["SGC_EJEMPLO_carga_ENF.xlsx", "SGC_EJEMPLO_carga_OBS.xlsx", "SGC_EJEMPLO_carga_TM.xlsx"]) {
      const data = realize(readFile(n));
      const prev = await H.upload(oficina, { name: n, data });
      expect(prev.json.errores).toEqual([]);
      const c = await H.upload(oficina, { name: n, data }, true);
      expect(c.status, JSON.stringify(c.json)).toBe(201);
      expect(c.json.guardado).toBe(true);
    }
    const st = await H.req(oficina, "GET", "/api/state");
    expect(st.json.uploads.length).toBe(3);
    expect(st.json.measurements.length).toBeGreaterThan(200);
    expect(st.json.schoolsWithFiles.sort()).toEqual(["ENF", "OBS", "TM"]);
    expect(H.store.keys().length).toBe(3);
    // el mismo archivo otra vez reemplaza al anterior
    const again = await H.upload(oficina, { name: "SGC_EJEMPLO_carga_ENF.xlsx", data: realize(readFile("SGC_EJEMPLO_carga_ENF.xlsx")) }, true);
    expect(again.json.reemplazados).toBe(1);
    const st2 = await H.req(oficina, "GET", "/api/state");
    expect(st2.json.uploads.length).toBe(3);
    expect(st2.json.measurements.length).toBe(st.json.measurements.length);
    // se puede descargar el original
    const id = st2.json.uploads[0].id;
    const f = await H.req(oficina, "GET", `/api/uploads/${id}/file`);
    expect(f.status).toBe(200);
    expect(f.raw.subarray(0, 2).toString()).toBe("PK");
  });

  it("de punta a punta: lo guardado en la base da las mismas alertas, indicadores y trazabilidad que el tablero original", async () => {
    const fx = fixture("archivos-reales");
    const sheet = async (what: string, name: string) => {
      const r = await H.req(oficina, "GET", `/api/export?what=${what}&fmt=xlsx&corte=2026-10-22`);
      expect(r.status).toBe(200);
      return XLSX.utils.sheet_to_json<Record<string, any>>(XLSX.read(r.raw, { type: "buffer" }).Sheets[name], { defval: "" });
    };
    // la fecha de lectura de una autoevaluación cargada cambia cada día: se ignora
    const norm = (rows: Record<string, any>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === "desde" ? String(v).replace(/\d{4}-\d{2}-\d{2}/g, "D") : String(v)])));
    for (const [what, name] of [["alertas", "Alertas"], ["indicadores", "Indicadores"], ["trazabilidad", "Trazabilidad"], ["criterios", "Criterios"], ["valores_informe", "Valores_informe"]] as const) {
      const got = norm(await sheet(what, name));
      const exp = norm(fx.expected.exports[what]);
      expect(got.length, what).toBe(exp.length);
      expect(got, what).toEqual(exp);
    }
  });

  it("un responsable puede quitar los archivos de su escuela y no los de otra", async () => {
    const st = await H.req(oficina, "GET", "/api/state");
    const enf = st.json.uploads.find((u: any) => u.escuela === "ENF");
    const tm = st.json.uploads.find((u: any) => u.escuela === "TM");
    expect((await H.req(respTM, "DELETE", `/api/uploads/${enf.id}`)).status).toBe(403);
    expect((await H.req(respENF, "DELETE", `/api/uploads/${enf.id}`)).status).toBe(200);
    expect((await H.req(lectura, "DELETE", `/api/uploads/${tm.id}`)).status).toBe(403);
    const st2 = await H.req(oficina, "GET", "/api/state");
    expect(st2.json.uploads.length).toBe(2);
    expect(st2.json.measurements.every((m: any) => m.escuela !== "ENF")).toBe(true);
  });
});

describe("vista Decisión: edición con permisos y validación", () => {
  const body = { esc: "ENF", area: "", ind: "ID1", per: "2025", val: 80, fuente: "Encuesta de prueba", corte: "2026-10-22", nota: "" };

  it("sin fuente no se guarda un valor", async () => {
    const r = await H.req(respENF, "POST", "/api/decision/values", { ...body, fuente: "   " });
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/fuente/i);
  });
  it("el responsable de una escuela no edita otra, y quien solo lee no edita", async () => {
    expect((await H.req(respTM, "POST", "/api/decision/values", body)).status).toBe(403);
    expect((await H.req(lectura, "POST", "/api/decision/values", body)).status).toBe(403);
    expect((await H.req(null, "POST", "/api/decision/values", body)).status).toBe(401);
  });
  it("valida el periodo, el área y el indicador", async () => {
    expect((await H.req(respENF, "POST", "/api/decision/values", { ...body, per: "2025-S1" })).status).toBe(400);
    expect((await H.req(respENF, "POST", "/api/decision/values", { ...body, area: "RAD" })).status).toBe(400);
    expect((await H.req(respENF, "POST", "/api/decision/values", { ...body, ind: "ID99" })).status).toBe(400);
    expect((await H.req(respENF, "POST", "/api/decision/values", { ...body, val: "x" })).status).toBe(400);
  });
  it("guarda el valor, queda sin validar y la oficina lo valida", async () => {
    const r = await H.req(respENF, "POST", "/api/decision/values", body);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    let st = await H.req(lectura, "GET", "/api/state");
    const e = st.json.decision.entries.find((x: any) => x.key === r.json.key);
    expect(e).toMatchObject({ val: 80, fuente: "Encuesta de prueba", esc: "ENF" });
    expect(e.autor).toBe(respENF);
    // el responsable no valida su propio valor
    const v1 = await H.req(respENF, "POST", "/api/decision/validations", { key: r.json.key, entryTs: r.json.ts, estado: "Validado" });
    expect(v1.status).toBe(403);
    const v2 = await H.req(oficina, "POST", "/api/decision/validations", { key: r.json.key, entryTs: r.json.ts, estado: "Validado", nota: "ok" });
    expect(v2.status, JSON.stringify(v2.json)).toBe(200);
    st = await H.req(lectura, "GET", "/api/state");
    expect(st.json.decision.validations.some((v: any) => v.key === r.json.key && v.estado === "Validado")).toBe(true);
  });
  it("si el valor cambia, la validación anterior ya no sirve", async () => {
    const r1 = await H.req(respENF, "POST", "/api/decision/values", { ...body, per: "2024", val: 70 });
    const r2 = await H.req(respENF, "POST", "/api/decision/values", { ...body, per: "2024", val: 71 });
    const old = await H.req(oficina, "POST", "/api/decision/validations", { key: r1.json.key, entryTs: r1.json.ts, estado: "Validado" });
    expect(old.status).toBe(409);
    const ok = await H.req(oficina, "POST", "/api/decision/validations", { key: r2.json.key, entryTs: r2.json.ts, estado: "Observado", nota: "revisar" });
    expect(ok.status).toBe(200);
  });
  it("anular exige que exista un valor y registra la bitácora", async () => {
    expect((await H.req(respENF, "POST", "/api/decision/values", { ...body, per: "2023", anulado: true })).status).toBe(400);
    const r = await H.req(respENF, "POST", "/api/decision/values", { ...body, anulado: true, fuente: "Se anula por error de digitación" });
    expect(r.status).toBe(200);
    const st = await H.req(lectura, "GET", "/api/state");
    const acc = st.json.decision.events.map((e: any) => e.accion);
    expect(acc).toContain("Alta de valor");
    expect(acc).toContain("Anulación de valor");
  });
  it("actualiza el estado de un proceso con ficha y fuente", async () => {
    const bad = await H.req(respENF, "POST", "/api/decision/processes", { esc: "ENF", proc: "P1", ficha: "inventada", dueno: "X", fuente: "acta" });
    expect(bad.status).toBe(400);
    const nofuente = await H.req(respENF, "POST", "/api/decision/processes", { esc: "ENF", proc: "P1", ficha: "aprobada", dueno: "Dra. X", fuente: "" });
    expect(nofuente.status).toBe(400);
    const ok = await H.req(respENF, "POST", "/api/decision/processes", { esc: "ENF", proc: "P1", ficha: "aprobada", dueno: "Dra. X", fuente: "Resolución 01" });
    expect(ok.status).toBe(200);
    const other = await H.req(respENF, "POST", "/api/decision/processes", { esc: "TM", proc: "P1", ficha: "aprobada", dueno: "Y", fuente: "acta" });
    expect(other.status).toBe(403);
  });
});

describe("parámetros", () => {
  it("solo la oficina o la administración los cambian, y cada cambio es una versión nueva", async () => {
    const cur = await H.req(oficina, "GET", "/api/params");
    const p = cur.json.params;
    p.gen.dias_gracia = 15;
    expect((await H.req(respENF, "PUT", "/api/params", p)).status).toBe(403);
    const ok = await H.req(oficina, "PUT", "/api/params", p);
    expect(ok.status, JSON.stringify(ok.json)).toBe(200);
    expect(ok.json.version).toBe(cur.json.version + 1);
    const now = await H.req(oficina, "GET", "/api/params");
    expect(now.json.params.gen.dias_gracia).toBe(15);
    expect(now.json.params.origen).toBe("Editados en el tablero");
    const hist = await H.req(oficina, "GET", "/api/params/history");
    expect(hist.json.length).toBeGreaterThanOrEqual(2);
  });
  it("un límite de meta menor que el de riesgo se rechaza", async () => {
    const cur = await H.req(oficina, "GET", "/api/params");
    const p = cur.json.params;
    const id = Object.keys(p.metas)[0];
    p.metas[id][0].verde_min = 50;
    p.metas[id][0].rojo_min = 80;
    const r = await H.req(oficina, "PUT", "/api/params", p);
    expect(r.status).toBe(400);
    expect(r.json.message).toMatch(/límite meta/);
  });
  it("una meta sin fuente se guarda pero queda «Por definir» (no se aplica)", async () => {
    const cur = await H.req(oficina, "GET", "/api/params");
    const p = cur.json.params;
    const id = "ID1";
    p.metas[id][0].meta = 90;
    p.metas[id][0].fuente_meta = "";
    const r = await H.req(oficina, "PUT", "/api/params", p);
    expect(r.status).toBe(200);
    const now = await H.req(oficina, "GET", "/api/params");
    expect(now.json.params.metas[id][0].estado_meta).toBe("Por definir");
  });
  it("restablece los valores de fábrica", async () => {
    const r = await H.req(oficina, "POST", "/api/params/reset");
    expect(r.status).toBe(200);
    const now = await H.req(oficina, "GET", "/api/params");
    expect(now.json.params.gen.dias_gracia).toBe(30);
    expect(now.json.params.metas.ID1[0].fuente_meta).toMatch(/CONEAU/);
  });
  it("cambia la fecha de corte de la vista Decisión", async () => {
    expect((await H.req(respENF, "PUT", "/api/settings/decision-corte", { fecha: "2026-12-01" })).status).toBe(403);
    expect((await H.req(oficina, "PUT", "/api/settings/decision-corte", { fecha: "no-es-fecha" })).status).toBe(400);
    expect((await H.req(oficina, "PUT", "/api/settings/decision-corte", { fecha: "2026-12-01" })).status).toBe(200);
    const st = await H.req(oficina, "GET", "/api/state");
    expect(st.json.decisionCorte).toBe("2026-12-01");
    await H.req(oficina, "PUT", "/api/settings/decision-corte", { fecha: "2026-10-22" });
  });
});

describe("equipo", () => {
  it("solo la administración crea cuentas", async () => {
    const b = { email: "nueva@unmsm.test", nombre: "Nueva Persona", rol: "lectura", password: "una-clave-larga-123" };
    expect((await H.req(oficina, "POST", "/api/team", b)).status).toBe(403);
    const r = await H.req(admin, "POST", "/api/team", b);
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(H.adm.created.at(-1)?.email).toBe("nueva@unmsm.test");
    expect((await H.req(admin, "POST", "/api/team", b)).status).toBe(409);
    expect((await H.req(admin, "POST", "/api/team", { ...b, email: "x@unmsm.test", password: "corta" })).status).toBe(400);
    // la persona nueva ya puede entrar
    expect((await H.req(r.json.id, "GET", "/api/me")).status).toBe(200);
  });
  it("hay un solo responsable por escuela", async () => {
    const dup = await H.req(admin, "POST", "/api/team", { email: "otro@unmsm.test", nombre: "Otro ENF", rol: "responsable", escuela: "ENF", password: "una-clave-larga-123" });
    expect(dup.status).toBe(409);
    const sinEsc = await H.req(admin, "POST", "/api/team", { email: "otro2@unmsm.test", nombre: "Otro", rol: "responsable", password: "una-clave-larga-123" });
    expect(sinEsc.status).toBe(400);
    // reasignar: el anterior pasa a lectura
    const nuevo = await H.person("lectura");
    const r = await H.req(admin, "PATCH", `/api/team/${nuevo}`, { rol: "responsable", escuela: "ENF" });
    expect(r.status).toBe(200);
    expect((await H.req(respENF, "GET", "/api/me")).json.rol).toBe("lectura");
    expect((await H.req(nuevo, "GET", "/api/me")).json.rol).toBe("responsable");
  });
  it("siempre queda una cuenta de administración activa", async () => {
    const r = await H.req(admin, "PATCH", `/api/team/${admin}`, { activo: false });
    expect(r.status).toBe(409);
    const r2 = await H.req(admin, "PATCH", `/api/team/${admin}`, { rol: "oficina" });
    expect(r2.status).toBe(409);
  });
  it("la administración restablece contraseñas; los demás no", async () => {
    expect((await H.req(oficina, "POST", `/api/team/${lectura}/password`, { password: "otra-clave-larga-1" })).status).toBe(403);
    expect((await H.req(admin, "POST", `/api/team/${lectura}/password`, { password: "otra-clave-larga-1" })).status).toBe(200);
    expect(H.adm.passwords.get(lectura)).toBe("otra-clave-larga-1");
  });
  it("la bitácora completa es solo para la oficina y la administración", async () => {
    expect((await H.req(lectura, "GET", "/api/audit")).status).toBe(403);
    const r = await H.req(oficina, "GET", "/api/audit?limit=20");
    expect(r.status).toBe(200);
    expect(r.json.length).toBeGreaterThan(5);
  });
});

describe("exportaciones", () => {
  it("el Excel completo trae las hojas esperadas", async () => {
    const r = await H.req(lectura, "GET", "/api/export?what=todo&fmt=xlsx&ejemplo=1");
    expect(r.status).toBe(200);
    expect(r.headers["content-disposition"]).toMatch(/SGC_tablero_EJEMPLO_/);
    const XLSX = await import("xlsx");
    const wb = XLSX.read(r.raw, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Leeme", "Indicadores", "Alertas", "Trazabilidad", "Criterios", "Valores_informe"]);
  });
  it("el CSV de una hoja y la exportación de la vista Decisión funcionan", async () => {
    const r = await H.req(lectura, "GET", "/api/export?what=alertas&fmt=csv&ejemplo=1");
    expect(r.status).toBe(200);
    expect(r.raw.toString("utf8").charCodeAt(0)).toBe(0xfeff);
    expect((await H.req(lectura, "GET", "/api/export?what=todo&fmt=csv")).status).toBe(400);
    const d = await H.req(lectura, "GET", "/api/export/decision?what=alertas&fmt=csv");
    expect(d.status).toBe(200);
    const dx = await H.req(lectura, "GET", "/api/export/decision?what=todo&fmt=xlsx");
    expect(dx.status).toBe(200);
    const p = await H.req(lectura, "GET", "/api/export/params");
    expect(p.status).toBe(200);
  });
  it("las plantillas se descargan solo si están en la lista", async () => {
    const l = await H.req(lectura, "GET", "/api/templates");
    expect(l.json.length).toBe(4);
    expect((await H.req(lectura, "GET", "/api/templates/SGC_Plantilla_de_carga_por_escuela_v0.6.xlsx")).status).toBe(200);
    expect((await H.req(lectura, "GET", "/api/templates/..%2F..%2Fpackage.json")).status).toBe(404);
  });
});
