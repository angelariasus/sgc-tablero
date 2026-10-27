import { loadOriginal } from "./load.mjs";
const { window, errors } = loadOriginal();
console.log("errors:", errors.slice(0,3));
const ev = (s) => window.eval(s);
console.log("S.view", ev("S.view"), "DB vis", ev("DB.vis.length"), "rej", ev("DB.rejected.length"), "alerts", ev("ALERTS.length"));
console.log("DS.items", ev("DS.items ? DS.items.length : 'none'"));
