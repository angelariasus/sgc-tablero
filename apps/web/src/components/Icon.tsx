/** Iconos del tablero (mismo juego de símbolos que la v0.9). */
export const ICON_NAMES = ["i-ok","i-risk","i-crit","i-low","i-nodata","i-def","i-na","i-info","i-clock","i-doc","i-bell","i-grid","i-link","i-chart","i-diamond","i-download","i-upload","i-moon","i-sun","i-x","i-menu","i-home","i-flow","i-target","i-sliders"] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** Se monta una sola vez en el diseño de la página. */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="i-ok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></symbol>
        <symbol id="i-risk" viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z" /><path d="M12 10v4.5M12 17.2v.2" /></symbol>
        <symbol id="i-crit" viewBox="0 0 24 24"><path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" /><path d="M9 9l6 6M15 9l-6 6" /></symbol>
        <symbol id="i-low" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v7M8.8 12.2L12 15.5l3.2-3.3" /></symbol>
        <symbol id="i-nodata" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeDasharray="3 3" /><path d="M9.6 9.6a2.5 2.5 0 114 2c-.9.6-1.6 1-1.6 2.2M12 16.8v.2" /></symbol>
        <symbol id="i-def" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeDasharray="1.5 3" /><path d="M8 12h8" /></symbol>
        <symbol id="i-na" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M6 18L18 6" /></symbol>
        <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.2" /></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.3 2" /></symbol>
        <symbol id="i-doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15z" /><path d="M10 21h4" /></symbol>
        <symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></symbol>
        <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></symbol>
        <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V4M4 20h16" /><path d="M8 15l4-5 3 3 5-7" /></symbol>
        <symbol id="i-diamond" viewBox="0 0 24 24"><path d="M12 3l8 9-8 9-8-9z" /></symbol>
        <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M7.5 11L12 15.5 16.5 11M5 20h14" /></symbol>
        <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V5M7.5 9L12 4.5 16.5 9M5 20h14" /></symbol>
        <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></symbol>
        <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></symbol>
        <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></symbol>
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></symbol>
        <symbol id="i-flow" viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="5" rx="1" /><rect x="14" y="15" width="7" height="5" rx="1" /><path d="M6.5 9v4a2 2 0 002 2H14" /></symbol>
        <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></symbol>
        <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M5 5v14M12 5v14M19 5v14" /><circle cx="5" cy="9" r="2" /><circle cx="12" cy="15" r="2" /><circle cx="19" cy="8" r="2" /></symbol>
      </defs>
    </svg>
  );
}

export function Ic({ n, c = "" }: { n: string; c?: string }) {
  return (
    <svg className={"ic " + c} aria-hidden="true">
      <use href={"#" + n} />
    </svg>
  );
}
