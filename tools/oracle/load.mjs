// Carga el HTML original en jsdom y devuelve la ventana con el tablero v0.9 arrancado.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const HTML_PATH = path.resolve(here, "../../reference/SGC_Tablero_dinamico_escuelas_v0.9.html");

export function loadOriginal() {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String(e.stack || e)));
  vc.on("error", (e) => errors.push(String(e)));
  const dom = new JSDOM(html, {
    url: "https://sgc.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
    },
  });
  return { window: dom.window, errors };
}
