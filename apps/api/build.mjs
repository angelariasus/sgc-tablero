// Empaqueta la API para producción: un solo archivo (dist/server.js) con el código del monorepo y,
// al lado, sus dependencias externas declaradas en dist/package.json, las migraciones y las plantillas Excel.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const dist = path.join(here, "dist");
const readPkg = (p) => JSON.parse(fs.readFileSync(path.join(root, p, "package.json"), "utf8"));

const pkgs = ["apps/api", "packages/db", "packages/engine", "packages/excel", "packages/catalog"].map(readPkg);
const external = {};
for (const p of pkgs) for (const [k, v] of Object.entries(p.dependencies ?? {})) if (!k.startsWith("@sgc/")) external[k] = v;
// versiones exactas del archivo de bloqueo cuando existen, para que producción use lo mismo que las pruebas
const exact = (name) => { try { return JSON.parse(fs.readFileSync(path.join(root, "node_modules/.pnpm/node_modules", name, "package.json"), "utf8")).version; } catch { return null; } };
const deps = Object.fromEntries(Object.entries(external).map(([k, v]) => [k, /^https?:/.test(v) ? v : exact(k) ?? v]));

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
await build({
  entryPoints: [path.join(here, "src/server.ts")],
  outfile: path.join(dist, "server.js"),
  bundle: true, platform: "node", format: "esm", target: "node22", sourcemap: true, minify: false, logLevel: "info",
  external: Object.keys(external),
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
fs.cpSync(path.join(root, "packages/db/migrations"), path.join(dist, "migrations"), { recursive: true });
fs.cpSync(path.join(root, "packages/catalog/files"), path.join(dist, "assets/files"), { recursive: true });
fs.writeFileSync(path.join(dist, "package.json"), JSON.stringify({ name: "sgc-api-dist", private: true, type: "module", main: "server.js", engines: { node: ">=22" }, dependencies: deps }, null, 2));
console.log("dist listo:", Object.keys(deps).length, "dependencias externas");
