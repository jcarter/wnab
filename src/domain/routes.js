const MONTH_PATH = /^\/budget\/(\d{4})(0[1-9]|1[0-2])\/?$/;

export function currentMonthKey(today = new Date()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
}

// Returns a month key like 2026-10-01 for /budget/202610, else null.
export function monthFromPath(pathname) {
  const match = MONTH_PATH.exec(pathname);
  return match ? `${match[1]}-${match[2]}-01` : null;
}

// The current month is the default and has no path.
export function pathForMonth(month) {
  return month === currentMonthKey() ? '/' : `/budget/${month.slice(0, 7).replace('-', '')}`;
}

// URL month, else current month, if shared; otherwise the latest shared month.
export function resolveMonth(pathname, sharedMonths) {
  const requested = monthFromPath(pathname) ?? currentMonthKey();
  return sharedMonths.includes(requested) ? requested : sharedMonths[0] ?? '';
}

const VIEW_PATHS = { settings: '/settings', mapping: '/settings/map' };

export function viewFromPath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return Object.keys(VIEW_PATHS).find((view) => VIEW_PATHS[view] === path) ?? 'budget';
}

// The budget view's path depends on the selected month.
export function pathForView(view, month) {
  return VIEW_PATHS[view] ?? (month ? pathForMonth(month) : '/');
}
