/** Every dashboard panel is under this, so that its refresh reads only the dashboard's panels, and nothing else (ADR 0019). */
export const DASHBOARD_ROOT_KEY = ["dashboard"] as const;

/** One key per panel. Today isn't in it: each read works out the date when it runs, and returns it (research R6). */
export const panelKey = (panel: string) =>
  [...DASHBOARD_ROOT_KEY, panel] as const;
